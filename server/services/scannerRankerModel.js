const fs = require('fs')
const path = require('path')

const MODEL_PATH = process.env.SCANNER_RANKER_MODEL_PATH ||
  path.join(__dirname, '..', 'ml_models', 'scanner_candidate_ranker.json')

const DEFAULT_MIN_RELIABLE_SESSIONS = Number(process.env.SCANNER_RANKER_MIN_RELIABLE_SESSIONS || 30)

let cachedModel = null
let cachedMtimeMs = null

const clamp01 = (value, fallback = 0) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(Math.max(numeric, 0), 1)
}

const sigmoid = (value) => {
  if (value >= 35) return 1
  if (value <= -35) return 0
  return 1 / (1 + Math.exp(-value))
}

const normalizeType = (candidate = {}) => {
  const displayType = String(candidate.display?.entityType || '').trim().toUpperCase()
  if (displayType) return displayType

  const selectedType = String(candidate.selection_type || '').trim().toUpperCase()
  if (selectedType) return selectedType

  const parsedType = String(candidate.parsed_label?.type || '').trim().toUpperCase()
  if (parsedType) return parsedType

  const className = String(candidate.class_name || '').toLowerCase()
  if (className.includes('qr')) return 'QR'
  if (className.includes('bar')) return 'BARCODE'
  return 'CODE'
}

const normalizeContext = (operationContext = 'SCAN') => {
  const normalized = String(operationContext || 'SCAN').trim().toUpperCase()
  if (!normalized) return 'SCAN'
  if (normalized.includes('OUT')) return 'OUTBOUND'
  if (normalized.includes('MOVE')) return 'MOVE'
  if (normalized.includes('IN')) return 'INBOUND'
  if (normalized.includes('COUNT')) return 'COUNT'
  if (normalized.includes('CREATE')) return 'CREATE_ITEM'
  return normalized
}

const featureValue = (candidate, name, fallback = 0) => {
  const direct = candidate?.[name]
  if (direct != null) return clamp01(direct, fallback)
  const fromFeatures = candidate?.selection_features?.[name]
  if (fromFeatures != null) return clamp01(fromFeatures, fallback)
  return fallback
}

const buildFeatureMap = (candidate = {}, operationContext = 'SCAN') => {
  const type = normalizeType(candidate)
  const context = normalizeContext(operationContext)
  const centerDistanceRatio = Number(candidate.center_distance_ratio)
  const relativeArea = Number(candidate.detection_area_ratio ?? candidate.relative_area)
  const centerScore = Number.isFinite(centerDistanceRatio)
    ? clamp01(1 - centerDistanceRatio, 0.52)
    : featureValue(candidate, 'center_score', 0.52)
  const areaScore = Number.isFinite(relativeArea)
    ? clamp01(Math.sqrt(Math.max(relativeArea, 0)) * 4, 0.45)
    : featureValue(candidate, 'area_score', 0.45)
  const ruleScore = clamp01(candidate.selection_score ?? candidate.rule_based_score, 0.5)
  const riskPenalty = featureValue(candidate, 'risk_penalty', 0)
  const displayFound = candidate.display?.found

  return {
    center_score: centerScore,
    area_score: areaScore,
    confidence_score: clamp01(candidate.confidence, 0.55),
    roi_score: clamp01(candidate.score ?? candidate.roi_score, 0.5),
    quality_score: clamp01(candidate.quality_score, 0.55),
    database_score: displayFound === true ? 1 : displayFound === false ? 0.2 : featureValue(candidate, 'database_score', 0.55),
    feedback_score: clamp01(candidate.feedback_score, 0),
    rule_score: ruleScore,
    inverse_risk: clamp01(1 - riskPenalty, 1),
    is_item: type === 'ITEM' ? 1 : 0,
    is_lot: type === 'LOT' ? 1 : 0,
    is_bin: type === 'BIN' ? 1 : 0,
    is_barcode: type === 'BARCODE' ? 1 : 0,
    is_qr: type === 'QR' ? 1 : 0,
    is_unknown_code: ['CODE', 'UNKNOWN'].includes(type) ? 1 : 0,
    ctx_outbound: context === 'OUTBOUND' ? 1 : 0,
    ctx_move: context === 'MOVE' ? 1 : 0,
    ctx_inbound: context === 'INBOUND' ? 1 : 0,
    ctx_count: context === 'COUNT' ? 1 : 0,
    ctx_create_item: context === 'CREATE_ITEM' ? 1 : 0
  }
}

const vectorize = (featureMap, featureNames = []) => (
  featureNames.map((name) => {
    const value = Number(featureMap[name])
    return Number.isFinite(value) ? value : 0
  })
)

const loadRankerModel = () => {
  try {
    const stat = fs.statSync(MODEL_PATH)
    if (cachedModel && cachedMtimeMs === stat.mtimeMs) {
      return cachedModel
    }

    const parsed = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'))
    if (!Array.isArray(parsed.feature_names) || !Array.isArray(parsed.weights)) {
      throw new Error('Invalid scanner ranker model format.')
    }

    cachedModel = {
      ...parsed,
      model_path: MODEL_PATH,
      available: true
    }
    cachedMtimeMs = stat.mtimeMs
    return cachedModel
  } catch (error) {
    cachedModel = {
      available: false,
      model_path: MODEL_PATH,
      reason: error.code === 'ENOENT' ? 'model_not_trained' : error.message
    }
    cachedMtimeMs = null
    return cachedModel
  }
}

const scoreCandidateWithModel = (candidate = {}, operationContext = 'SCAN') => {
  const model = loadRankerModel()
  if (!model.available) {
    return {
      ml_score: null,
      ml_model_status: model.reason || 'unavailable',
      ml_model_version: null,
      ml_reliable: false
    }
  }

  const featureMap = buildFeatureMap(candidate, operationContext)
  const features = vectorize(featureMap, model.feature_names)
  const linear = features.reduce((sum, value, index) => (
    sum + (value * Number(model.weights[index] || 0))
  ), Number(model.bias || 0))
  const score = sigmoid(linear)
  const trainingSessions = Number(model.training_summary?.sessions || 0)
  const reliable = trainingSessions >= DEFAULT_MIN_RELIABLE_SESSIONS

  return {
    ml_score: Number(score.toFixed(4)),
    ml_model_status: reliable ? 'ready' : 'warmup',
    ml_model_version: model.version || null,
    ml_reliable: reliable,
    ml_features: featureMap
  }
}

const enrichCandidatesWithMlScores = (candidates = [], operationContext = 'SCAN') => {
  const model = loadRankerModel()
  return {
    model: {
      available: model.available,
      status: model.available
        ? Number(model.training_summary?.sessions || 0) >= DEFAULT_MIN_RELIABLE_SESSIONS ? 'ready' : 'warmup'
        : model.reason || 'unavailable',
      version: model.version || null,
      trained_at: model.trained_at || null,
      training_summary: model.training_summary || null,
      metrics: model.metrics || null
    },
    candidates: candidates.map((candidate) => ({
      ...candidate,
      ...scoreCandidateWithModel(candidate, operationContext)
    }))
  }
}

module.exports = {
  MODEL_PATH,
  buildFeatureMap,
  enrichCandidatesWithMlScores,
  loadRankerModel,
  scoreCandidateWithModel
}
