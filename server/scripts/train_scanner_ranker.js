#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { Op } = require('sequelize')
const sequelize = require('../config/database')
const { ScanCandidate, ScanSession } = require('../models')
const { MODEL_PATH, buildFeatureMap } = require('../services/scannerRankerModel')

const FEATURE_NAMES = [
  'center_score',
  'area_score',
  'confidence_score',
  'roi_score',
  'quality_score',
  'database_score',
  'feedback_score',
  'rule_score',
  'inverse_risk',
  'is_item',
  'is_lot',
  'is_bin',
  'is_barcode',
  'is_qr',
  'is_unknown_code',
  'ctx_outbound',
  'ctx_move',
  'ctx_inbound',
  'ctx_count',
  'ctx_create_item'
]

const DEFAULT_EPOCHS = 900
const DEFAULT_LR = 0.08
const DEFAULT_L2 = 0.001

const parseArg = (name, fallback) => {
  const prefix = `--${name}=`
  const raw = process.argv.find((arg) => arg.startsWith(prefix))
  if (!raw) return fallback
  const value = Number(raw.slice(prefix.length))
  return Number.isFinite(value) ? value : fallback
}

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

const vectorize = (featureMap) => FEATURE_NAMES.map((name) => {
  const value = Number(featureMap[name])
  return Number.isFinite(value) ? value : 0
})

const toCandidateShape = (row) => {
  const hasDisplay = Boolean(row.display_title || row.display_subtitle || row.candidate_item_id)
  const centerScore = row.center_distance_ratio == null
    ? undefined
    : clamp01(1 - Number(row.center_distance_ratio), 0.52)
  const riskPenalty = row.barcode_value && String(row.barcode_value).length >= 4 ? 0 : 0.45

  return {
    candidate_id: row.candidate_key,
    decoded_text: row.barcode_value,
    decoded_types: row.barcode_type ? [row.barcode_type] : [],
    class_name: row.barcode_type,
    selection_type: row.parsed_type,
    parsed_label: { type: row.parsed_type || 'CODE' },
    confidence: row.confidence,
    quality_score: row.quality_score,
    feedback_score: row.feedback_score,
    rule_based_score: row.rule_based_score,
    selection_score: row.rule_based_score,
    center_distance_ratio: row.center_distance_ratio,
    detection_area_ratio: row.relative_area,
    relative_area: row.relative_area,
    score: row.payload?.score,
    display: {
      found: hasDisplay,
      entityType: row.parsed_type,
      title: row.display_title,
      subtitle: row.display_subtitle
    },
    selection_features: {
      center_score: centerScore,
      area_score: row.relative_area == null ? undefined : clamp01(Math.sqrt(Math.max(Number(row.relative_area), 0)) * 4, 0.45),
      database_score: hasDisplay ? 1 : 0.45,
      feedback_score: clamp01(row.feedback_score, 0),
      rule_score: clamp01(row.rule_based_score, 0.5),
      risk_penalty: riskPenalty
    }
  }
}

const buildSamples = (rows) => rows.map((row) => {
  const plain = row.get({ plain: true })
  const operationMode = plain.session?.operation_mode || plain.operation_mode || 'SCAN'
  const featureMap = buildFeatureMap(toCandidateShape(plain), operationMode)

  return {
    sessionId: plain.scan_session_id,
    candidateKey: plain.candidate_key,
    y: plain.is_selected ? 1 : 0,
    x: vectorize(featureMap),
    ruleScore: clamp01(plain.rule_based_score, 0),
    operationMode
  }
})

const deterministicSplit = (samples) => {
  const sessionIds = [...new Set(samples.map((sample) => sample.sessionId))]
  if (sessionIds.length < 5) {
    return {
      train: samples,
      validation: samples,
      validationMode: 'training_set'
    }
  }

  const validationIds = new Set(sessionIds.filter((_id, index) => index % 5 === 0))
  const train = samples.filter((sample) => !validationIds.has(sample.sessionId))
  const validation = samples.filter((sample) => validationIds.has(sample.sessionId))

  return {
    train: train.length ? train : samples,
    validation: validation.length ? validation : samples,
    validationMode: train.length && validation.length ? 'holdout_by_session' : 'training_set'
  }
}

const trainLogisticRegression = (samples, {
  epochs = DEFAULT_EPOCHS,
  learningRate = DEFAULT_LR,
  l2 = DEFAULT_L2
} = {}) => {
  const featureCount = FEATURE_NAMES.length
  const weights = Array(featureCount).fill(0)
  let bias = 0
  const positives = samples.filter((sample) => sample.y === 1).length
  const negatives = samples.length - positives
  const posWeight = positives ? samples.length / (2 * positives) : 1
  const negWeight = negatives ? samples.length / (2 * negatives) : 1

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradW = Array(featureCount).fill(0)
    let gradB = 0
    let weightedCount = 0

    for (const sample of samples) {
      const linear = sample.x.reduce((sum, value, index) => sum + (value * weights[index]), bias)
      const prediction = sigmoid(linear)
      const classWeight = sample.y === 1 ? posWeight : negWeight
      const error = (prediction - sample.y) * classWeight

      weightedCount += classWeight
      gradB += error
      for (let index = 0; index < featureCount; index += 1) {
        gradW[index] += error * sample.x[index]
      }
    }

    const divisor = weightedCount || samples.length || 1
    bias -= learningRate * (gradB / divisor)
    for (let index = 0; index < featureCount; index += 1) {
      const regularization = l2 * weights[index]
      weights[index] -= learningRate * ((gradW[index] / divisor) + regularization)
    }
  }

  return { weights, bias }
}

const scoreSample = (sample, model) => sigmoid(
  sample.x.reduce((sum, value, index) => sum + (value * model.weights[index]), model.bias)
)

const top1Accuracy = (samples, scoreFn) => {
  const grouped = new Map()
  samples.forEach((sample) => {
    const group = grouped.get(sample.sessionId) || []
    group.push(sample)
    grouped.set(sample.sessionId, group)
  })

  let correct = 0
  let total = 0
  grouped.forEach((group) => {
    const selected = group.find((sample) => sample.y === 1)
    if (!selected) return
    const top = [...group].sort((left, right) => scoreFn(right) - scoreFn(left))[0]
    total += 1
    if (top?.candidateKey === selected.candidateKey) correct += 1
  })

  return total ? correct / total : 0
}

const evaluateModel = (samples, model) => {
  let correct = 0
  let loss = 0

  for (const sample of samples) {
    const score = scoreSample(sample, model)
    const clipped = Math.min(Math.max(score, 1e-6), 1 - 1e-6)
    const predicted = score >= 0.5 ? 1 : 0
    if (predicted === sample.y) correct += 1
    loss += -(sample.y * Math.log(clipped) + (1 - sample.y) * Math.log(1 - clipped))
  }

  return {
    candidate_accuracy: samples.length ? Number((correct / samples.length).toFixed(4)) : 0,
    log_loss: samples.length ? Number((loss / samples.length).toFixed(4)) : null,
    ml_top1_accuracy: Number(top1Accuracy(samples, (sample) => scoreSample(sample, model)).toFixed(4)),
    rule_top1_accuracy: Number(top1Accuracy(samples, (sample) => sample.ruleScore).toFixed(4))
  }
}

const buildTrainingSummary = (samples) => {
  const operationModes = {}
  samples.forEach((sample) => {
    operationModes[sample.operationMode] = (operationModes[sample.operationMode] || 0) + 1
  })

  return {
    sessions: new Set(samples.map((sample) => sample.sessionId)).size,
    candidates: samples.length,
    positive_candidates: samples.filter((sample) => sample.y === 1).length,
    negative_candidates: samples.filter((sample) => sample.y === 0).length,
    operation_modes: operationModes
  }
}

const main = async () => {
  const epochs = Math.max(1, Math.round(parseArg('epochs', DEFAULT_EPOCHS)))
  const learningRate = parseArg('lr', DEFAULT_LR)
  const l2 = parseArg('l2', DEFAULT_L2)

  const rows = await ScanCandidate.findAll({
    include: [{
      model: ScanSession,
      as: 'session',
      required: true,
      where: {
        selected_candidate_id: { [Op.ne]: null }
      }
    }],
    order: [
      ['scan_session_id', 'ASC'],
      ['final_rank', 'ASC'],
      ['id', 'ASC']
    ]
  })

  const samples = buildSamples(rows)
  const positives = samples.filter((sample) => sample.y === 1).length
  const negatives = samples.length - positives

  if (samples.length < 4 || positives === 0 || negatives === 0) {
    console.log('Scanner ranker training skipped: not enough positive/negative candidate samples yet.')
    console.log(JSON.stringify({ samples: samples.length, positives, negatives }, null, 2))
    return
  }

  const { train, validation, validationMode } = deterministicSplit(samples)
  const modelWeights = trainLogisticRegression(train, { epochs, learningRate, l2 })
  const metrics = {
    validation_mode: validationMode,
    train: evaluateModel(train, modelWeights),
    validation: evaluateModel(validation, modelWeights)
  }
  const model = {
    version: 'scanner-ranker-logistic-v1',
    model_type: 'logistic_regression',
    trained_at: new Date().toISOString(),
    feature_names: FEATURE_NAMES,
    weights: modelWeights.weights.map((value) => Number(value.toFixed(8))),
    bias: Number(modelWeights.bias.toFixed(8)),
    training_config: {
      epochs,
      learning_rate: learningRate,
      l2
    },
    training_summary: buildTrainingSummary(samples),
    metrics,
    notes: 'Warm-start ranker for context-aware multi-code selection. Keep rule-based ranking as guardrail until more sessions are collected.'
  }

  fs.mkdirSync(path.dirname(MODEL_PATH), { recursive: true })
  fs.writeFileSync(MODEL_PATH, `${JSON.stringify(model, null, 2)}\n`)

  console.log('Scanner ranker model trained.')
  console.log(JSON.stringify({
    model_path: MODEL_PATH,
    training_summary: model.training_summary,
    metrics: model.metrics
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('Scanner ranker training failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close().catch(() => {})
  })
