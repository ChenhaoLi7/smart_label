# ai_service/app.py
from fastapi import FastAPI, HTTPException
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
from typing import List, Dict, Any
import warnings
warnings.filterwarnings('ignore')

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