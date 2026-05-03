# ai_service/app.py
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, IsolationForest
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
import joblib
import os
import sys
import time
import tempfile
from pathlib import Path
from typing import List, Dict, Any
import warnings
warnings.filterwarnings('ignore')

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OBB_PIPELINE_DIR = PROJECT_ROOT / "barcode_obb_pipeline"
if OBB_PIPELINE_DIR.exists() and str(OBB_PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(OBB_PIPELINE_DIR))

ROI_MODEL_PATH = Path(os.getenv("ROI_OBB_MODEL_PATH", OBB_PIPELINE_DIR / "models" / "best_obb.pt"))
ROI_ASSIST_MAX_UPLOAD_BYTES = int(os.getenv("ROI_ASSIST_MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))
ROI_ASSIST_KEEP_UPLOADS = os.getenv("ROI_ASSIST_KEEP_UPLOADS", "0") == "1"

app = FastAPI(title="智能仓库AI服务", version="1.0.0")

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据模型
class DemandRequest(BaseModel):
    itemId: int
    history: List[float]
    periods: int = 7

class DemandResponse(BaseModel):
    forecast: List[float]
    nextPeriod: float
    confidence: float
    model_type: str

class AnomalyRequest(BaseModel):
    data: List[float]
    threshold: float = 0.95

class AnomalyResponse(BaseModel):
    anomalies: List[bool]
    anomaly_scores: List[float]
    threshold: float

class InventoryOptimizationRequest(BaseModel):
    current_stock: List[Dict[str, Any]]
    demand_history: List[float]
    lead_time: int
    safety_stock: float

class InventoryOptimizationResponse(BaseModel):
    optimal_order_quantity: float
    reorder_point: float
    safety_stock: float
    expected_shortage: float

# 全局变量存储模型
models = {}
scalers = {}

def _check_import(module_name: str) -> Dict[str, Any]:
    try:
        __import__(module_name)
        return {"available": True, "error": None}
    except Exception as error:
        return {"available": False, "error": str(error)}

def _safe_trigger(value: str) -> str:
    normalized = (value or "manual").strip().lower()
    if normalized not in {"manual", "auto", "debug"}:
        return "manual"
    return normalized

def _safe_mode(value: str) -> str:
    normalized = (value or "obb").strip().lower()
    if normalized == "rbb":
        return "obb"
    if normalized not in {"obb", "baseline"}:
        return "obb"
    return normalized

def _pipeline_health() -> Dict[str, Any]:
    return {
        "service": "roi-assist",
        "model_path": str(ROI_MODEL_PATH),
        "model_ready": ROI_MODEL_PATH.exists(),
        "pipeline_dir": str(OBB_PIPELINE_DIR),
        "pipeline_ready": OBB_PIPELINE_DIR.exists(),
        "dependencies": {
            "cv2": _check_import("cv2"),
            "pyzbar": _check_import("pyzbar"),
            "ultralytics": _check_import("ultralytics"),
        }
    }

def _normalize_pipeline_result(result: Dict[str, Any], *, method: str) -> Dict[str, Any]:
    return {
        "success": bool(result.get("success")),
        "method": method,
        "decoded_texts": result.get("decoded_texts", []),
        "decoded_types": result.get("decoded_types", []),
        "processing_time_ms": result.get("total_processing_time_ms", result.get("processing_time_ms")),
        "error": result.get("error"),
        "candidates": result.get("candidates", []),
        "best_candidate": result.get("best_candidate"),
        "arbitration": result.get("arbitration"),
        "raw": result,
    }

def _build_baseline_candidates(result: Dict[str, Any]) -> List[Dict[str, Any]]:
    decoded_texts = result.get("decoded_texts") or []
    decoded_types = result.get("decoded_types") or []
    candidates = []

    for index, text in enumerate(decoded_texts):
        if not text:
            continue
        candidates.append({
            "candidate_id": f"baseline-{index + 1}",
            "source": "server_whole_image",
            "class_name": decoded_types[index] if index < len(decoded_types) else "CODE",
            "confidence": None,
            "success": True,
            "decoded_text": str(text),
            "decoded_texts": [str(text)],
            "decoded_types": [decoded_types[index]] if index < len(decoded_types) else [],
            "best_preprocessing_mode": "whole_image",
            "score": 0.64,
            "quality_score": None,
            "center_distance_ratio": None,
            "roi_width": None,
            "roi_height": None,
            "brightness": None,
            "contrast": None,
            "blur_score": None,
            "error": None,
        })

    return candidates

def _merge_roi_candidates(*candidate_groups: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged: List[Dict[str, Any]] = []
    seen_texts = set()

    for group in candidate_groups:
        for candidate in group or []:
            decoded_text = candidate.get("decoded_text")
            decoded_texts = candidate.get("decoded_texts") or ([decoded_text] if decoded_text else [])
            normalized_text = next((str(text).strip() for text in decoded_texts if str(text).strip()), "")

            if candidate.get("success") and normalized_text:
                if normalized_text in seen_texts:
                    continue
                seen_texts.add(normalized_text)
                candidate = {**candidate, "decoded_text": normalized_text}

            merged.append(candidate)

    return sorted(merged, key=lambda item: item.get("score") or 0.0, reverse=True)

def _build_roi_arbitration(candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
    successful = [candidate for candidate in candidates if candidate.get("success") and candidate.get("decoded_text")]
    unique_texts = []
    for candidate in successful:
        text = str(candidate.get("decoded_text") or "").strip()
        if text and text not in unique_texts:
            unique_texts.append(text)

    best = successful[0] if successful else None
    runner_up = successful[1] if len(successful) > 1 else None
    score_margin = None
    if best and runner_up:
        score_margin = round((best.get("score") or 0.0) - (runner_up.get("score") or 0.0), 4)

    return {
        "candidate_count": len(successful),
        "unique_decoded_count": len(unique_texts),
        "requires_user_selection": len(unique_texts) > 1,
        "auto_selectable": len(unique_texts) == 1,
        "score_margin": score_margin,
        "selected_candidate_id": best.get("candidate_id") if best else None,
        "selected_text": best.get("decoded_text") if best else None,
    }

def create_lstm_model(input_shape):
    """创建LSTM模型"""
    model = Sequential([
        LSTM(50, return_sequences=True, input_shape=input_shape),
        Dropout(0.2),
        LSTM(50, return_sequences=False),
        Dropout(0.2),
        Dense(25),
        Dense(1)
    ])
    model.compile(optimizer=Adam(learning_rate=0.001), loss='mse')
    return model

def prepare_lstm_data(data, look_back=7):
    """准备LSTM数据"""
    X, y = [], []
    for i in range(len(data) - look_back):
        X.append(data[i:(i + look_back)])
        y.append(data[i + look_back])
    return np.array(X), np.array(y)

@app.post("/predict/demand", response_model=DemandResponse)
async def predict_demand(req: DemandRequest):
    """需求预测 - 使用LSTM模型"""
    try:
        if len(req.history) < 7:
            raise HTTPException(status_code=400, detail="历史数据不足，至少需要7个数据点")
        
        # 数据预处理
        data = np.array(req.history).reshape(-1, 1)
        scaler = StandardScaler()
        data_scaled = scaler.fit_transform(data)
        
        # 准备LSTM数据
        look_back = 7
        X, y = prepare_lstm_data(data_scaled.flatten(), look_back)
        
        if len(X) == 0:
            raise HTTPException(status_code=400, detail="数据不足以训练模型")
        
        # 创建并训练LSTM模型
        model = create_lstm_model((look_back, 1))
        model.fit(X, y, epochs=100, batch_size=32, verbose=0)
        
        # 预测未来需求
        last_sequence = data_scaled[-look_back:].reshape(1, look_back, 1)
        predictions = []
        
        for _ in range(req.periods):
            pred = model.predict(last_sequence, verbose=0)
            predictions.append(pred[0, 0])
            last_sequence = np.roll(last_sequence, -1, axis=1)
            last_sequence[0, -1, 0] = pred[0, 0]
        
        # 反标准化
        predictions_original = scaler.inverse_transform(np.array(predictions).reshape(-1, 1))
        forecast = predictions_original.flatten().tolist()
        
        # 计算置信度（基于历史数据的方差）
        confidence = max(0.5, 1 - np.std(req.history) / np.mean(req.history))
        
        return DemandResponse(
            forecast=forecast,
            nextPeriod=forecast[0],
            confidence=min(0.95, confidence),
            model_type="LSTM"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"预测失败: {str(e)}")

@app.post("/detect/anomaly", response_model=AnomalyResponse)
async def detect_anomaly(req: AnomalyRequest):
    """异常检测 - 使用Isolation Forest"""
    try:
        if len(req.data) < 10:
            raise HTTPException(status_code=400, detail="数据不足，至少需要10个数据点")
        
        # 数据预处理
        data = np.array(req.data).reshape(-1, 1)
        scaler = StandardScaler()
        data_scaled = scaler.fit_transform(data)
        
        # 使用Isolation Forest检测异常
        iso_forest = IsolationForest(contamination=1-req.threshold, random_state=42)
        anomaly_scores = iso_forest.fit_predict(data_scaled)
        
        # 转换预测结果（-1为异常，1为正常）
        anomalies = [score == -1 for score in anomaly_scores]
        
        # 计算异常分数
        decision_scores = iso_forest.decision_function(data_scaled)
        normalized_scores = (decision_scores - np.min(decision_scores)) / (np.max(decision_scores) - np.min(decision_scores))
        
        return AnomalyResponse(
            anomalies=anomalies,
            anomaly_scores=normalized_scores.tolist(),
            threshold=req.threshold
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"异常检测失败: {str(e)}")

@app.post("/optimize/inventory", response_model=InventoryOptimizationResponse)
async def optimize_inventory(req: InventoryOptimizationRequest):
    """库存优化 - 使用随机森林和统计方法"""
    try:
        if len(req.demand_history) < 30:
            raise HTTPException(status_code=400, detail="需求历史数据不足，至少需要30个数据点")
        
        # 计算需求统计
        demand_mean = np.mean(req.demand_history)
        demand_std = np.std(req.demand_history)
        
        # 计算安全库存
        safety_stock = req.safety_stock * demand_std * np.sqrt(req.lead_time)
        
        # 计算再订货点
        reorder_point = demand_mean * req.lead_time + safety_stock
        
        # 使用随机森林预测需求波动
        X = np.arange(len(req.demand_history)).reshape(-1, 1)
        y = req.demand_history
        
        rf_model = RandomForestRegressor(n_estimators=100, random_state=42)
        rf_model.fit(X, y)
        
        # 预测未来需求
        future_X = np.arange(len(req.demand_history), len(req.demand_history) + req.lead_time).reshape(-1, 1)
        future_demand = rf_model.predict(future_X)
        
        # 计算最优订货量
        optimal_order_quantity = max(0, np.sum(future_demand) + safety_stock - req.current_stock[0].get('quantity', 0))
        
        # 计算预期缺货概率
        expected_shortage = max(0, np.sum(future_demand) - req.current_stock[0].get('quantity', 0))
        
        return InventoryOptimizationResponse(
            optimal_order_quantity=float(optimal_order_quantity),
            reorder_point=float(reorder_point),
            safety_stock=float(safety_stock),
            expected_shortage=float(expected_shortage)
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"库存优化失败: {str(e)}")

@app.post("/cluster/items")
async def cluster_items(data: List[Dict[str, Any]]):
    """商品聚类分析 - 使用K-means"""
    try:
        if len(data) < 5:
            raise HTTPException(status_code=400, detail="数据不足，至少需要5个商品")
        
        # 提取特征
        features = []
        for item in data:
            feature_vector = [
                item.get('demand_rate', 0),
                item.get('profit_margin', 0),
                item.get('storage_cost', 0),
                item.get('lead_time', 0)
            ]
            features.append(feature_vector)
        
        features = np.array(features)
        
        # 标准化特征
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)
        
        # 使用肘部法则确定最佳聚类数
        inertias = []
        K_range = range(2, min(6, len(data)))
        
        for k in K_range:
            kmeans = KMeans(n_clusters=k, random_state=42)
            kmeans.fit(features_scaled)
            inertias.append(kmeans.inertia_)
        
        # 选择最佳聚类数（这里简化为选择3个聚类）
        optimal_k = 3
        
        # 执行聚类
        kmeans = KMeans(n_clusters=optimal_k, random_state=42)
        cluster_labels = kmeans.fit_predict(features_scaled)
        
        # 返回聚类结果
        result = []
        for i, item in enumerate(data):
            item['cluster'] = int(cluster_labels[i])
            result.append(item)
        
        return {
            "clusters": result,
            "cluster_centers": kmeans.cluster_centers_.tolist(),
            "optimal_clusters": optimal_k
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"聚类分析失败: {str(e)}")

@app.get("/scanner/roi-assist/health")
async def scanner_roi_assist_health():
    """ROI Assist health check for barcode OBB fallback."""
    return _pipeline_health()

@app.post("/scanner/roi-assist")
async def scanner_roi_assist(
    frame: UploadFile = File(...),
    mode: str = Form("obb"),
    trigger: str = Form("manual"),
    operation_context: str = Form("")
):
    """Decode one uploaded scanner frame using server-side ROI assist.

    The endpoint first tries server-side whole-image decoding as a cheap fallback.
    If that fails and mode=obb, it tries the YOLO-OBB rotated ROI pipeline.
    """
    started_at = time.perf_counter()
    normalized_mode = _safe_mode(mode)
    normalized_trigger = _safe_trigger(trigger)

    if not OBB_PIPELINE_DIR.exists():
        raise HTTPException(status_code=503, detail="barcode_obb_pipeline directory is missing")

    payload = await frame.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded frame is empty")
    if len(payload) > ROI_ASSIST_MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded frame is too large")

    suffix = Path(frame.filename or "frame.jpg").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}:
        suffix = ".jpg"

    temp_dir = OBB_PIPELINE_DIR / "data" / "results" / "roi_assist_uploads"
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=suffix,
            prefix=f"{normalized_trigger}_",
            dir=temp_dir,
            delete=False,
        ) as temp_file:
            temp_file.write(payload)
            temp_path = Path(temp_file.name)

        from src.baseline_decode import decode_whole_image
        from src.proposed_obb_decode import decode_with_obb_candidates

        baseline_result = _normalize_pipeline_result(
            decode_whole_image(str(temp_path)),
            method="server_whole_image",
        )
        baseline_candidates = _build_baseline_candidates(baseline_result)
        proposed_result = None
        proposed_candidates = []
        selected_result = baseline_result

        if normalized_mode == "obb":
            proposed_result = _normalize_pipeline_result(
                decode_with_obb_candidates(str(temp_path), str(ROI_MODEL_PATH)),
                method="yolo_obb_roi",
            )
            proposed_candidates = proposed_result.get("candidates") or []
            selected_result = proposed_result if proposed_result["success"] else baseline_result

        all_candidates = _merge_roi_candidates(baseline_candidates, proposed_candidates)
        arbitration = _build_roi_arbitration(all_candidates)
        best_candidate = all_candidates[0] if all_candidates else None
        selected_texts = [candidate.get("decoded_text") for candidate in all_candidates if candidate.get("success") and candidate.get("decoded_text")]
        selected_types = []
        for candidate in all_candidates:
            for decoded_type in candidate.get("decoded_types") or []:
                if decoded_type and decoded_type not in selected_types:
                    selected_types.append(decoded_type)

        return {
            "success": bool(selected_result["success"] or selected_texts),
            "trigger": normalized_trigger,
            "mode": normalized_mode,
            "operation_context": operation_context,
            "method": selected_result["method"],
            "decoded_texts": selected_texts or selected_result["decoded_texts"],
            "decoded_types": selected_types or selected_result["decoded_types"],
            "processing_time_ms": round((time.perf_counter() - started_at) * 1000, 2),
            "model_ready": ROI_MODEL_PATH.exists(),
            "model_path": str(ROI_MODEL_PATH),
            "error": selected_result.get("error"),
            "candidates": all_candidates,
            "best_candidate": best_candidate,
            "arbitration": arbitration,
            "baseline": baseline_result,
            "proposed": proposed_result,
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"ROI Assist failed: {error}")
    finally:
        if temp_path and temp_path.exists() and not ROI_ASSIST_KEEP_UPLOADS:
            try:
                temp_path.unlink()
            except Exception:
                pass

@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "service": "智能仓库AI服务"}

@app.get("/models/info")
async def get_models_info():
    """获取模型信息"""
    return {
        "available_models": [
            "LSTM - 需求预测",
            "Isolation Forest - 异常检测", 
            "Random Forest - 需求预测",
            "K-means - 商品聚类"
        ],
        "model_status": "所有模型正常运行"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
