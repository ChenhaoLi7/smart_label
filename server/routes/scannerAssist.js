const express = require('express')
const axios = require('axios')
const multer = require('multer')
const FormData = require('form-data')
const { Op, fn, col, literal } = require('sequelize')
const { Item, Lot, Bin, ScannerSelectionSample, ScanSession, ScanCandidate } = require('../models')
const authMiddleware = require('../middlewares/auth')
const requireRole = require('../middlewares/requireRole')
const {
  enrichCandidatesWithMlScores,
  loadRankerModel
} = require('../services/scannerRankerModel')

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.ROI_ASSIST_MAX_UPLOAD_BYTES || 8 * 1024 * 1024)
  }
})

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'
const ROI_ASSIST_HEALTH_TIMEOUT_MS = Number(process.env.ROI_ASSIST_HEALTH_TIMEOUT_MS || 10000)
const ROI_ASSIST_TIMEOUT_MS = Number(process.env.ROI_ASSIST_TIMEOUT_MS || 15000)
const FEEDBACK_MIN_OBSERVATIONS = Number(process.env.SCANNER_FEEDBACK_MIN_OBSERVATIONS || 2)
const FEEDBACK_CONFIDENCE_FULL_AT = Number(process.env.SCANNER_FEEDBACK_CONFIDENCE_FULL_AT || 12)
const RANKING_EXPORT_DEFAULT_LIMIT = Number(process.env.SCANNER_RANKING_EXPORT_DEFAULT_LIMIT || 5000)
const RANKING_EXPORT_MAX_LIMIT = Number(process.env.SCANNER_RANKING_EXPORT_MAX_LIMIT || 20000)

const getRequestIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) return String(forwardedFor).split(',')[0].trim()
  return req.ip || req.connection?.remoteAddress || null
}

const toFiniteNumber = (value, fallback = null) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

const clampScore = (value, fallback = 0) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.min(Math.max(numericValue, 0), 1)
}

const toFiniteInteger = (value, fallback = null) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.round(numericValue)
}

const toNullableBoolean = (value) => {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === '1' || value === 1) return true
  if (value === 'false' || value === '0' || value === 0) return false
  return null
}

const parseDateOrNull = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatDateForCsv = (value) => {
  if (!value) return ''
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}

const buildDateRangeWhere = ({ start, end } = {}) => {
  const confirmedAt = {}
  const startDate = parseDateOrNull(start)
  const endDate = parseDateOrNull(end)

  if (startDate) confirmedAt[Op.gte] = startDate
  if (endDate) confirmedAt[Op.lte] = endDate

  return Object.keys(confirmedAt).length ? { confirmed_at: confirmedAt } : {}
}

const parsePositiveLimit = (value, fallback = RANKING_EXPORT_DEFAULT_LIMIT) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return fallback
  return Math.min(Math.round(numericValue), RANKING_EXPORT_MAX_LIMIT)
}

const csvEscape = (value) => {
  if (value == null) return ''
  const stringValue = value instanceof Date
    ? value.toISOString()
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value)
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

const toCsv = (headers, rows) => {
  const headerLine = headers.map((header) => csvEscape(header.label)).join(',')
  const bodyLines = rows.map((row) => headers.map((header) => csvEscape(header.value(row))).join(','))
  return [headerLine, ...bodyLines].join('\n')
}

const inferDeviceType = (userAgent = '') => {
  const ua = String(userAgent || '')
  if (/ipad|macintosh.+mobile/i.test(ua)) return 'iPad'
  if (/iphone/i.test(ua)) return 'iPhone'
  if (/android/i.test(ua)) return 'Android'
  if (/mobile/i.test(ua)) return 'Mobile'
  return 'Desktop'
}

const normalizePoint = (point) => {
  if (!point) return null
  const x = toFiniteNumber(point.x ?? point[0])
  const y = toFiniteNumber(point.y ?? point[1])
  if (x == null || y == null) return null
  return { x, y }
}

const normalizePoints = (points) => {
  if (!Array.isArray(points)) return []
  return points.map(normalizePoint).filter(Boolean)
}

const getCandidateImageSize = (candidate = {}) => ({
  width: toFiniteNumber(
    candidate.image_width ||
    candidate.imageWidth ||
    candidate.frameWidth ||
    candidate.source_width ||
    candidate.sourceWidth
  ),
  height: toFiniteNumber(
    candidate.image_height ||
    candidate.imageHeight ||
    candidate.frameHeight ||
    candidate.source_height ||
    candidate.sourceHeight
  )
})

const getCandidateBounds = (candidate = {}) => {
  const points = normalizePoints(candidate.points || candidate.detection?.points)
  const { width: imageWidth, height: imageHeight } = getCandidateImageSize(candidate)

  if (points.length) {
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const bboxWidth = Math.max(maxX - minX, 0)
    const bboxHeight = Math.max(maxY - minY, 0)
    const area = bboxWidth * bboxHeight
    const imageArea = imageWidth && imageHeight ? imageWidth * imageHeight : null
    const centerX = minX + (bboxWidth / 2)
    const centerY = minY + (bboxHeight / 2)
    const centerDistance = imageWidth && imageHeight
      ? Math.hypot(centerX - (imageWidth / 2), centerY - (imageHeight / 2))
      : null
    const maxCenterDistance = imageWidth && imageHeight ? Math.hypot(imageWidth / 2, imageHeight / 2) : null

    return {
      x: minX,
      y: minY,
      width: bboxWidth,
      height: bboxHeight,
      area,
      relativeArea: imageArea ? area / imageArea : toFiniteNumber(candidate.detection_area_ratio),
      centerDistance,
      centerDistanceRatio: toFiniteNumber(candidate.center_distance_ratio) ??
        (maxCenterDistance ? centerDistance / maxCenterDistance : null)
    }
  }

  const fallbackWidth = toFiniteNumber(candidate.bbox_width || candidate.width)
  const fallbackHeight = toFiniteNumber(candidate.bbox_height || candidate.height)
  const fallbackArea = fallbackWidth != null && fallbackHeight != null ? fallbackWidth * fallbackHeight : null

  return {
    x: toFiniteNumber(candidate.bbox_x || candidate.x),
    y: toFiniteNumber(candidate.bbox_y || candidate.y),
    width: fallbackWidth,
    height: fallbackHeight,
    area: fallbackArea,
    relativeArea: toFiniteNumber(candidate.detection_area_ratio),
    centerDistance: toFiniteNumber(candidate.center_distance),
    centerDistanceRatio: toFiniteNumber(candidate.center_distance_ratio)
  }
}

const extractInventoryQuantity = (candidate = {}) => {
  const direct = toFiniteNumber(candidate.inventory_quantity)
  if (direct != null) return direct

  const primary = String(candidate.display?.primary || '')
  const match = primary.match(/(-?\d+(?:\.\d+)?)\s*(?:pcs|items|lots|bins|個|本)?/i)
  return match ? toFiniteNumber(match[1]) : null
}

const inferCandidateItemId = (candidate = {}) => {
  const rawText = normalizeDecodedText(candidate)
  const parsed = parseCandidatePayload(rawText)

  if (parsed.type === 'ITEM' && parsed.id) return parsed.id
  if (parsed.sku) return parsed.sku

  const text = [
    candidate.display?.subtitle,
    candidate.display?.secondary,
    candidate.display?.primary
  ].filter(Boolean).join(' ')
  const skuMatch = text.match(/\bSKU\s+([A-Za-z0-9_-]{4,80})/i)
  if (skuMatch) return skuMatch[1]

  return parsed.id || null
}

const buildResearchScores = (candidate = {}) => {
  const features = candidate.selection_features || {}
  const bounds = getCandidateBounds(candidate)
  const relativeArea = bounds.relativeArea ?? toFiniteNumber(candidate.detection_area_ratio, 0)
  const centerScore = clampScore(
    features.center_score,
    bounds.centerDistanceRatio == null ? 0.52 : 1 - bounds.centerDistanceRatio
  )
  const areaScore = clampScore(Math.sqrt(Math.max(relativeArea || 0, 0)) * 4, 0.45)
  const visualScore = clampScore((0.6 * centerScore) + (0.4 * areaScore), 0.5)
  const stabilityScore = clampScore(
    features.stability_score,
    toFiniteNumber(candidate.scan_stability, null) ?? 0.5
  )
  const typeScore = clampScore(features.type_score, 0.45)
  const databaseScore = clampScore(features.database_score, candidate.display?.found === true ? 1 : 0.45)
  const riskScore = clampScore(features.risk_penalty, 0)
  const contextScore = clampScore((typeScore * 0.55) + (databaseScore * 0.35) + ((1 - riskScore) * 0.1), 0.5)
  const feedbackScore = clampScore(candidate.feedback_score, 0)
  const ruleScore = clampScore(
    candidate.selection_score,
    (0.35 * visualScore) + (0.25 * stabilityScore) + (0.3 * contextScore) + (0.1 * feedbackScore)
  )

  return {
    bounds,
    visualScore,
    stabilityScore,
    contextScore,
    feedbackScore,
    ruleScore
  }
}

const buildFeedbackSignal = ({
  shownCount = 0,
  selectedCount = 0,
  avgRuleBasedScore = null
} = {}) => {
  const normalizedShownCount = Math.max(toFiniteInteger(shownCount, 0) || 0, 0)
  const normalizedSelectedCount = Math.max(toFiniteInteger(selectedCount, 0) || 0, 0)
  const selectionRate = normalizedShownCount > 0
    ? normalizedSelectedCount / normalizedShownCount
    : 0
  const confidence = normalizedShownCount > 0
    ? Math.min(normalizedShownCount / FEEDBACK_CONFIDENCE_FULL_AT, 1)
    : 0
  const feedbackScore = normalizedShownCount >= FEEDBACK_MIN_OBSERVATIONS
    ? clampScore(selectionRate * confidence)
    : 0

  return {
    shown_count: normalizedShownCount,
    selected_count: normalizedSelectedCount,
    selection_rate: Number(clampScore(selectionRate).toFixed(4)),
    confidence: Number(clampScore(confidence).toFixed(4)),
    avg_rule_based_score: toFiniteNumber(avgRuleBasedScore),
    feedback_score: Number(feedbackScore.toFixed(4))
  }
}

const getCandidateFeedbackSignals = async (candidates = [], operationContext = 'SCAN') => {
  const decodedValues = [...new Set(
    candidates
      .map((candidate) => normalizeDecodedText(candidate))
      .filter(Boolean)
  )]
  if (!decodedValues.length) return new Map()

  const normalizedOperation = String(operationContext || 'SCAN').slice(0, 40).toUpperCase()
  const operationModes = [...new Set([normalizedOperation, 'SCAN'].filter(Boolean))]

  try {
    const rows = await ScanCandidate.findAll({
      where: {
        barcode_value: { [Op.in]: decodedValues },
        operation_mode: { [Op.in]: operationModes }
      },
      attributes: [
        'barcode_value',
        [fn('COUNT', col('id')), 'shown_count'],
        [literal('SUM(CASE WHEN is_selected = 1 THEN 1 ELSE 0 END)'), 'selected_count'],
        [fn('AVG', col('rule_based_score')), 'avg_rule_based_score']
      ],
      group: ['barcode_value'],
      raw: true
    })

    return new Map(
      rows.map((row) => [
        String(row.barcode_value || ''),
        buildFeedbackSignal({
          shownCount: row.shown_count,
          selectedCount: row.selected_count,
          avgRuleBasedScore: row.avg_rule_based_score
        })
      ])
    )
  } catch (error) {
    console.warn('[ROI Assist] candidate feedback signal lookup failed:', error.message)
    return new Map()
  }
}

const attachFeedbackSignals = async (candidates = [], operationContext = 'SCAN') => {
  const feedbackSignals = await getCandidateFeedbackSignals(candidates, operationContext)

  return candidates.map((candidate) => {
    const decodedText = normalizeDecodedText(candidate)
    const feedbackSignal = feedbackSignals.get(decodedText) || buildFeedbackSignal()

    return {
      ...candidate,
      feedback_score: feedbackSignal.feedback_score,
      feedback_signal: feedbackSignal
    }
  })
}

const sanitizeSelectionCandidate = (candidate = {}) => ({
  candidate_id: String(candidate.candidate_id || '').slice(0, 80),
  decoded_text: String(candidate.decoded_text || '').slice(0, 500),
  parsed_type: String(candidate.parsed_label?.type || candidate.selection_type || candidate.display?.entityType || '').slice(0, 40),
  selection_score: toFiniteNumber(candidate.selection_score),
  selection_score_percent: toFiniteNumber(candidate.selection_score_percent),
  selection_rank: toFiniteNumber(candidate.selection_rank),
  selection_reasons: Array.isArray(candidate.selection_reasons)
    ? candidate.selection_reasons.slice(0, 8).map((reason) => String(reason).slice(0, 80))
    : [],
  confidence: toFiniteNumber(candidate.confidence),
  roi_score: toFiniteNumber(candidate.score),
  center_distance_ratio: toFiniteNumber(candidate.center_distance_ratio),
  quality_score: toFiniteNumber(candidate.quality_score),
  detection_area_ratio: toFiniteNumber(candidate.detection_area_ratio),
  feedback_score: toFiniteNumber(candidate.feedback_score),
  feedback_signal: candidate.feedback_signal || null,
  ml_score: toFiniteNumber(candidate.ml_score),
  ml_model_status: String(candidate.ml_model_status || '').slice(0, 40) || null,
  ml_model_version: String(candidate.ml_model_version || '').slice(0, 80) || null,
  ml_reliable: toNullableBoolean(candidate.ml_reliable),
  db_found: Boolean(candidate.display?.found),
  display_title: String(candidate.display?.title || '').slice(0, 160),
  display_subtitle: String(candidate.display?.subtitle || '').slice(0, 160),
  points: normalizePoints(candidate.points || candidate.detection?.points),
  image_width: getCandidateImageSize(candidate).width,
  image_height: getCandidateImageSize(candidate).height,
  best_preprocessing_mode: String(candidate.best_preprocessing_mode || '').slice(0, 80)
})

const normalizeDecodedText = (candidate) => {
  if (!candidate) return ''
  const direct = String(candidate.decoded_text || '').trim()
  if (direct) return direct

  const decodedTexts = Array.isArray(candidate.decoded_texts) ? candidate.decoded_texts : []
  const firstText = decodedTexts.find((text) => String(text || '').trim())
  return firstText ? String(firstText).trim() : ''
}

const parseCandidatePayload = (rawText) => {
  const raw = String(rawText || '').trim()
  if (!raw) return { type: 'UNKNOWN', id: '', raw }

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const type = String(parsed.type || '').trim().toUpperCase()
      if (type) {
        return {
          type,
          id: String(parsed.id || parsed.sku || parsed.lot_number || parsed.bin || parsed.bin_code || '').trim(),
          sku: parsed.sku ? String(parsed.sku).trim() : undefined,
          raw
        }
      }
    }
  } catch (_error) {
    // Plain SKU, LOT and BIN labels are expected too.
  }

  const lotMatch = raw.match(/^LOT:([^;]+)(?:;SKU:(.+))?$/i)
  if (lotMatch) {
    return {
      type: 'LOT',
      id: lotMatch[1].trim(),
      sku: lotMatch[2]?.trim(),
      raw
    }
  }

  const binMatch = raw.match(/^BIN:([^;]+)(?:;ZONE:(.+))?$/i)
  if (binMatch) {
    return {
      type: 'BIN',
      id: binMatch[1].trim(),
      raw
    }
  }

  const itemMatch = raw.match(/^ITEM:(.+)$/i)
  if (itemMatch) {
    return {
      type: 'ITEM',
      id: itemMatch[1].trim(),
      raw
    }
  }

  if (/^LOT-/i.test(raw)) {
    return { type: 'LOT', id: raw, raw }
  }

  return { type: 'ITEM', id: raw, raw }
}

const candidateIdsForItemLookup = (id) => {
  const normalized = String(id || '').trim()
  const ids = [normalized]
  if (/^0+\d+$/.test(normalized)) {
    ids.push(normalized.replace(/^0+/, ''))
  }
  return [...new Set(ids.filter(Boolean))]
}

const summarizeLots = (lots = []) => {
  const activeLots = lots.filter((lot) => lot.status === 'ACTIVE')
  const totalQty = activeLots.reduce((sum, lot) => sum + Number(lot.qty || 0), 0)
  const bins = new Set(activeLots.map((lot) => lot.bin?.bin_code).filter(Boolean))

  return {
    activeLots,
    totalQty,
    binCount: bins.size
  }
}

const buildUnknownDisplay = (parsed) => ({
  found: false,
  entityType: parsed.type || 'UNKNOWN',
  title: parsed.type === 'LOT'
    ? 'Unknown lot'
    : parsed.type === 'BIN'
      ? 'Unknown bin'
      : 'Unknown item',
  subtitle: parsed.id || parsed.raw || 'Unresolved label',
  primary: 'Not found in warehouse master data',
  secondary: 'You can still select it to continue normal scan handling.',
  chips: ['Unregistered']
})

const resolveItemDisplay = async (parsed) => {
  for (const sku of candidateIdsForItemLookup(parsed.id)) {
    const item = await Item.findOne({
      where: { sku },
      include: [{
        model: Lot,
        as: 'lots',
        required: false,
        include: [{
          model: Bin,
          as: 'bin',
          attributes: ['bin_code', 'zone']
        }]
      }]
    })

    if (!item) continue

    const { activeLots, totalQty, binCount } = summarizeLots(item.lots || [])
    return {
      found: true,
      entityType: 'ITEM',
      title: item.name || item.sku,
      subtitle: `SKU ${item.sku}`,
      primary: `${totalQty} ${item.uom || 'pcs'} available`,
      secondary: `${activeLots.length} active lot${activeLots.length === 1 ? '' : 's'} · ${binCount} bin${binCount === 1 ? '' : 's'}`,
      chips: [
        item.category || 'Item',
        item.status || 'UNKNOWN'
      ].filter(Boolean)
    }
  }

  return buildUnknownDisplay(parsed)
}

const resolveLotDisplay = async (parsed) => {
  const whereClause = { lot_number: parsed.id }
  if (parsed.sku) whereClause.sku = parsed.sku

  const lot = await Lot.findOne({
    where: whereClause,
    include: [
      { model: Item, as: 'item' },
      { model: Bin, as: 'bin', attributes: ['bin_code', 'zone'] }
    ]
  })

  if (!lot) return buildUnknownDisplay(parsed)

  const uom = lot.uom || lot.item?.uom || 'pcs'
  return {
    found: true,
    entityType: 'LOT',
    title: lot.item?.name || lot.sku,
    subtitle: lot.lot_number,
    primary: `${Number(lot.qty || 0)} ${uom} in ${lot.bin?.bin_code || 'unassigned bin'}`,
    secondary: `SKU ${lot.sku}${lot.expiry_date ? ` · Exp ${lot.expiry_date}` : ''}`,
    chips: [
      lot.status || 'LOT',
      lot.quality_status || null
    ].filter(Boolean)
  }
}

const resolveBinDisplay = async (parsed) => {
  const bin = await Bin.findOne({
    where: { bin_code: parsed.id },
    include: [{
      model: Lot,
      as: 'lots',
      required: false,
      include: [{
        model: Item,
        as: 'item',
        attributes: ['sku', 'name', 'uom']
      }]
    }]
  })

  if (!bin) return buildUnknownDisplay(parsed)

  const activeLots = (bin.lots || []).filter((lot) => lot.status === 'ACTIVE')
  const totalQty = activeLots.reduce((sum, lot) => sum + Number(lot.qty || 0), 0)
  const itemCount = new Set(activeLots.map((lot) => lot.sku).filter(Boolean)).size

  return {
    found: true,
    entityType: 'BIN',
    title: `Bin ${bin.bin_code}`,
    subtitle: bin.zone || 'Storage location',
    primary: `${totalQty} pcs stored`,
    secondary: `${activeLots.length} active lot${activeLots.length === 1 ? '' : 's'} · ${itemCount} item${itemCount === 1 ? '' : 's'}`,
    chips: [
      bin.temperature_zone || 'BIN',
      bin.status || null
    ].filter(Boolean)
  }
}

const resolveCandidateDisplay = async (candidate) => {
  const rawText = normalizeDecodedText(candidate)
  const parsed = parseCandidatePayload(rawText)

  let display
  if (parsed.type === 'LOT') {
    display = await resolveLotDisplay(parsed)
  } else if (parsed.type === 'BIN') {
    display = await resolveBinDisplay(parsed)
  } else if (parsed.type === 'ITEM') {
    display = await resolveItemDisplay(parsed)
  } else {
    display = buildUnknownDisplay(parsed)
  }

  return {
    ...candidate,
    decoded_text: rawText,
    parsed_label: parsed,
    display
  }
}

const buildScanCandidateRecord = (candidate, {
  scanSessionId,
  selectedCandidateId,
  operationMode,
  finalIndex
}) => {
  const rawText = normalizeDecodedText(candidate)
  const parsed = parseCandidatePayload(rawText)
  const research = buildResearchScores(candidate)
  const bounds = research.bounds
  const inventoryQuantity = extractInventoryQuantity(candidate)
  const inventoryAvailable = candidate.inventory_available != null
    ? toNullableBoolean(candidate.inventory_available)
    : inventoryQuantity == null ? null : inventoryQuantity > 0
  const finalRank = toFiniteInteger(candidate.selection_rank, finalIndex + 1)
  const initialRank = toFiniteInteger(candidate.selection_features?.original_index, finalIndex)
  const isSelected = selectedCandidateId
    ? String(candidate.candidate_id || '') === selectedCandidateId
    : Boolean(candidate.is_selected)

  return {
    scan_session_id: scanSessionId,
    candidate_key: String(candidate.candidate_id || `candidate-${finalIndex + 1}`).slice(0, 100),
    candidate_item_id: inferCandidateItemId(candidate),
    barcode_value: rawText || null,
    barcode_type: String(candidate.decoded_types?.[0] || candidate.class_name || '').slice(0, 80) || null,
    parsed_type: String(parsed.type || candidate.selection_type || '').slice(0, 40) || null,
    bbox_x: toFiniteNumber(bounds.x),
    bbox_y: toFiniteNumber(bounds.y),
    bbox_width: toFiniteNumber(bounds.width),
    bbox_height: toFiniteNumber(bounds.height),
    center_distance: toFiniteNumber(bounds.centerDistance),
    center_distance_ratio: toFiniteNumber(bounds.centerDistanceRatio),
    barcode_area: toFiniteNumber(bounds.area),
    relative_area: toFiniteNumber(bounds.relativeArea),
    detected_frames: toFiniteInteger(candidate.detected_frames, 1) || 1,
    decode_count: toFiniteInteger(candidate.decode_count, 1) || 1,
    scan_stability: research.stabilityScore,
    operation_mode: operationMode,
    inventory_quantity: inventoryQuantity,
    inventory_available: inventoryAvailable,
    is_out_of_stock: inventoryQuantity == null ? null : inventoryQuantity <= 0,
    same_location: toNullableBoolean(candidate.same_location),
    is_fifo_candidate: toNullableBoolean(candidate.is_fifo_candidate),
    visual_score: research.visualScore,
    scan_stability_score: research.stabilityScore,
    context_score: research.contextScore,
    feedback_score: research.feedbackScore,
    rule_based_score: research.ruleScore,
    initial_rank: initialRank == null ? finalIndex + 1 : initialRank + 1,
    final_rank: finalRank,
    is_selected: isSelected,
    display_title: String(candidate.display?.title || '').slice(0, 200) || null,
    display_subtitle: String(candidate.display?.subtitle || '').slice(0, 240) || null,
    confidence: toFiniteNumber(candidate.confidence),
    quality_score: toFiniteNumber(candidate.quality_score),
    best_preprocessing_mode: String(candidate.best_preprocessing_mode || '').slice(0, 80) || null,
    payload: candidate
  }
}

const persistScanSelectionTrainingData = async ({
  body,
  req,
  candidates,
  sortedCandidates,
  selectedCandidateId,
  selectedCandidate,
  topScore,
  scoreMargin
}) => {
  const sessionKey = String(body.session_id || `selection-${Date.now()}`).slice(0, 100)
  const operationMode = String(body.operation_context || 'SCAN').slice(0, 40).toUpperCase()
  const startedAt = parseDateOrNull(body.started_at || body.startedAt) || parseDateOrNull(body.created_at)
  const confirmedAt = parseDateOrNull(body.confirmed_at || body.confirmedAt) || new Date()
  const confirmationTimeMs = toFiniteInteger(
    body.confirmation_time_ms ||
    body.confirmationTimeMs ||
    (startedAt ? confirmedAt.getTime() - startedAt.getTime() : null)
  )

  const [scanSession, created] = await ScanSession.findOrCreate({
    where: { session_key: sessionKey },
    defaults: {
      session_key: sessionKey,
      user_id: req.user?.id || null,
      user_name: req.user?.username || req.user?.email || null,
      operation_mode: operationMode,
      warehouse_zone: String(body.warehouse_zone || body.warehouseZone || '').slice(0, 80) || null,
      device_type: String(body.device_type || body.deviceType || inferDeviceType(req.headers['user-agent'])).slice(0, 80),
      trigger: String(body.trigger || 'manual').slice(0, 30),
      decision_type: String(body.decision_type || 'user_selected').slice(0, 40),
      started_at: startedAt,
      confirmed_at: confirmedAt,
      confirmation_time_ms: confirmationTimeMs,
      selected_item_id: selectedCandidate ? inferCandidateItemId(selectedCandidate) : null,
      selected_candidate_id: selectedCandidateId,
      candidate_count: candidates.length,
      top_score: toFiniteNumber(topScore),
      score_margin: toFiniteNumber(scoreMargin),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
      ip_address: getRequestIp(req),
      payload: body
    }
  })

  if (!created) {
    await scanSession.update({
      user_id: req.user?.id || scanSession.user_id,
      user_name: req.user?.username || req.user?.email || scanSession.user_name,
      operation_mode: operationMode,
      warehouse_zone: String(body.warehouse_zone || body.warehouseZone || scanSession.warehouse_zone || '').slice(0, 80) || null,
      device_type: String(body.device_type || body.deviceType || inferDeviceType(req.headers['user-agent'])).slice(0, 80),
      trigger: String(body.trigger || 'manual').slice(0, 30),
      decision_type: String(body.decision_type || 'user_selected').slice(0, 40),
      started_at: startedAt || scanSession.started_at,
      confirmed_at: confirmedAt,
      confirmation_time_ms: confirmationTimeMs,
      selected_item_id: selectedCandidate ? inferCandidateItemId(selectedCandidate) : null,
      selected_candidate_id: selectedCandidateId,
      candidate_count: candidates.length,
      top_score: toFiniteNumber(topScore),
      score_margin: toFiniteNumber(scoreMargin),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
      ip_address: getRequestIp(req),
      payload: body
    })
  }

  await ScanCandidate.destroy({ where: { scan_session_id: scanSession.id } })

  const candidateRecords = sortedCandidates.map((candidate, index) => buildScanCandidateRecord(candidate, {
    scanSessionId: scanSession.id,
    selectedCandidateId,
    operationMode,
    finalIndex: index
  }))

  if (candidateRecords.length) {
    await ScanCandidate.bulkCreate(candidateRecords)
  }

  return scanSession
}

const buildRankingSummary = async ({ start, end } = {}) => {
  const sessionWhere = buildDateRangeWhere({ start, end })
  const candidateInclude = [{
    model: ScanSession,
    as: 'session',
    attributes: [],
    required: true,
    where: sessionWhere
  }]

  const [
    totalSessions,
    selectedSessions,
    totalCandidates,
    selectedCandidates,
    operationRows,
    decisionRows,
    triggerRows,
    featureAverages,
    topCandidateRows
  ] = await Promise.all([
    ScanSession.count({ where: sessionWhere }),
    ScanSession.count({
      where: {
        ...sessionWhere,
        selected_candidate_id: { [Op.ne]: null }
      }
    }),
    ScanCandidate.count({ include: candidateInclude }),
    ScanCandidate.count({
      where: { is_selected: true },
      include: candidateInclude
    }),
    ScanSession.findAll({
      where: sessionWhere,
      attributes: [
        'operation_mode',
        [fn('COUNT', col('id')), 'session_count'],
        [fn('AVG', col('candidate_count')), 'avg_candidate_count'],
        [fn('AVG', col('confirmation_time_ms')), 'avg_confirmation_time_ms']
      ],
      group: ['operation_mode'],
      raw: true
    }),
    ScanSession.findAll({
      where: sessionWhere,
      attributes: [
        'decision_type',
        [fn('COUNT', col('id')), 'session_count']
      ],
      group: ['decision_type'],
      raw: true
    }),
    ScanSession.findAll({
      where: sessionWhere,
      attributes: [
        'trigger',
        [fn('COUNT', col('id')), 'session_count']
      ],
      group: ['trigger'],
      raw: true
    }),
    ScanCandidate.findOne({
      include: candidateInclude,
      attributes: [
        [fn('AVG', col('visual_score')), 'avg_visual_score'],
        [fn('AVG', col('scan_stability_score')), 'avg_scan_stability_score'],
        [fn('AVG', col('context_score')), 'avg_context_score'],
        [fn('AVG', col('feedback_score')), 'avg_feedback_score'],
        [fn('AVG', col('rule_based_score')), 'avg_rule_based_score'],
        [fn('AVG', col('center_distance_ratio')), 'avg_center_distance_ratio'],
        [fn('AVG', col('relative_area')), 'avg_relative_area']
      ],
      raw: true
    }),
    ScanCandidate.findAll({
      include: candidateInclude,
      attributes: [
        'barcode_value',
        'candidate_item_id',
        'display_title',
        'parsed_type',
        'operation_mode',
        [fn('COUNT', col('ScanCandidate.id')), 'shown_count'],
        [literal('SUM(CASE WHEN `ScanCandidate`.`is_selected` = 1 THEN 1 ELSE 0 END)'), 'selected_count'],
        [fn('AVG', col('rule_based_score')), 'avg_rule_based_score']
      ],
      group: ['barcode_value', 'candidate_item_id', 'display_title', 'parsed_type', 'operation_mode'],
      order: [[literal('selected_count'), 'DESC'], [literal('shown_count'), 'DESC']],
      limit: 12,
      raw: true
    })
  ])

  const selectedRate = totalCandidates ? selectedCandidates / totalCandidates : 0
  const sessionResolutionRate = totalSessions ? selectedSessions / totalSessions : 0

  return {
    filters: {
      start: parseDateOrNull(start)?.toISOString() || null,
      end: parseDateOrNull(end)?.toISOString() || null
    },
    totals: {
      sessions: totalSessions,
      sessions_with_selection: selectedSessions,
      candidates: totalCandidates,
      selected_candidates: selectedCandidates,
      session_resolution_rate: Number(sessionResolutionRate.toFixed(4)),
      candidate_selected_rate: Number(selectedRate.toFixed(4))
    },
    by_operation_mode: operationRows.map((row) => ({
      operation_mode: row.operation_mode || 'UNKNOWN',
      session_count: Number(row.session_count || 0),
      avg_candidate_count: Number(Number(row.avg_candidate_count || 0).toFixed(2)),
      avg_confirmation_time_ms: row.avg_confirmation_time_ms == null
        ? null
        : Number(Number(row.avg_confirmation_time_ms).toFixed(0))
    })),
    by_decision_type: decisionRows.map((row) => ({
      decision_type: row.decision_type || 'UNKNOWN',
      session_count: Number(row.session_count || 0)
    })),
    by_trigger: triggerRows.map((row) => ({
      trigger: row.trigger || 'UNKNOWN',
      session_count: Number(row.session_count || 0)
    })),
    feature_averages: Object.fromEntries(
      Object.entries(featureAverages || {}).map(([key, value]) => [
        key,
        value == null ? null : Number(Number(value).toFixed(4))
      ])
    ),
    top_selected_candidates: topCandidateRows.map((row) => {
      const shownCount = Number(row.shown_count || 0)
      const selectedCount = Number(row.selected_count || 0)
      return {
        barcode_value: row.barcode_value,
        candidate_item_id: row.candidate_item_id,
        display_title: row.display_title,
        parsed_type: row.parsed_type,
        operation_mode: row.operation_mode,
        shown_count: shownCount,
        selected_count: selectedCount,
        selection_rate: shownCount ? Number((selectedCount / shownCount).toFixed(4)) : 0,
        avg_rule_based_score: row.avg_rule_based_score == null
          ? null
          : Number(Number(row.avg_rule_based_score).toFixed(4))
      }
    })
  }
}

const buildRankingExportRows = async ({ start, end, limit } = {}) => {
  const sessionWhere = buildDateRangeWhere({ start, end })
  const safeLimit = parsePositiveLimit(limit)

  const rows = await ScanCandidate.findAll({
    include: [{
      model: ScanSession,
      as: 'session',
      required: true,
      where: sessionWhere
    }],
    order: [
      [{ model: ScanSession, as: 'session' }, 'confirmed_at', 'DESC'],
      ['scan_session_id', 'DESC'],
      ['final_rank', 'ASC']
    ],
    limit: safeLimit
  })

  return rows.map((row) => row.get({ plain: true }))
}

const rankingExportHeaders = [
  { label: 'session_id', value: (row) => row.session?.id },
  { label: 'session_key', value: (row) => row.session?.session_key },
  { label: 'user_id', value: (row) => row.session?.user_id },
  { label: 'user_name', value: (row) => row.session?.user_name },
  { label: 'operation_mode', value: (row) => row.session?.operation_mode || row.operation_mode },
  { label: 'warehouse_zone', value: (row) => row.session?.warehouse_zone },
  { label: 'device_type', value: (row) => row.session?.device_type },
  { label: 'trigger', value: (row) => row.session?.trigger },
  { label: 'decision_type', value: (row) => row.session?.decision_type },
  { label: 'started_at', value: (row) => formatDateForCsv(row.session?.started_at) },
  { label: 'confirmed_at', value: (row) => formatDateForCsv(row.session?.confirmed_at) },
  { label: 'confirmation_time_ms', value: (row) => row.session?.confirmation_time_ms },
  { label: 'selected_item_id', value: (row) => row.session?.selected_item_id },
  { label: 'selected_candidate_id', value: (row) => row.session?.selected_candidate_id },
  { label: 'candidate_count', value: (row) => row.session?.candidate_count },
  { label: 'top_score', value: (row) => row.session?.top_score },
  { label: 'score_margin', value: (row) => row.session?.score_margin },
  { label: 'candidate_key', value: (row) => row.candidate_key },
  { label: 'candidate_item_id', value: (row) => row.candidate_item_id },
  { label: 'barcode_value', value: (row) => row.barcode_value },
  { label: 'barcode_type', value: (row) => row.barcode_type },
  { label: 'parsed_type', value: (row) => row.parsed_type },
  { label: 'bbox_x', value: (row) => row.bbox_x },
  { label: 'bbox_y', value: (row) => row.bbox_y },
  { label: 'bbox_width', value: (row) => row.bbox_width },
  { label: 'bbox_height', value: (row) => row.bbox_height },
  { label: 'center_distance', value: (row) => row.center_distance },
  { label: 'center_distance_ratio', value: (row) => row.center_distance_ratio },
  { label: 'barcode_area', value: (row) => row.barcode_area },
  { label: 'relative_area', value: (row) => row.relative_area },
  { label: 'detected_frames', value: (row) => row.detected_frames },
  { label: 'decode_count', value: (row) => row.decode_count },
  { label: 'scan_stability', value: (row) => row.scan_stability },
  { label: 'inventory_quantity', value: (row) => row.inventory_quantity },
  { label: 'inventory_available', value: (row) => row.inventory_available },
  { label: 'is_out_of_stock', value: (row) => row.is_out_of_stock },
  { label: 'same_location', value: (row) => row.same_location },
  { label: 'is_fifo_candidate', value: (row) => row.is_fifo_candidate },
  { label: 'visual_score', value: (row) => row.visual_score },
  { label: 'scan_stability_score', value: (row) => row.scan_stability_score },
  { label: 'context_score', value: (row) => row.context_score },
  { label: 'feedback_score', value: (row) => row.feedback_score },
  { label: 'rule_based_score', value: (row) => row.rule_based_score },
  { label: 'initial_rank', value: (row) => row.initial_rank },
  { label: 'final_rank', value: (row) => row.final_rank },
  { label: 'is_selected', value: (row) => row.is_selected },
  { label: 'display_title', value: (row) => row.display_title },
  { label: 'display_subtitle', value: (row) => row.display_subtitle },
  { label: 'confidence', value: (row) => row.confidence },
  { label: 'quality_score', value: (row) => row.quality_score },
  { label: 'best_preprocessing_mode', value: (row) => row.best_preprocessing_mode },
  { label: 'created_at', value: (row) => formatDateForCsv(row.createdAt) }
]

router.get(
  '/roi-assist/ranking-summary',
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    try {
      const summary = await buildRankingSummary({
        start: req.query.start,
        end: req.query.end
      })

      res.json({
        success: true,
        summary
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to build scanner ranking summary',
        error: error.message
      })
    }
  }
)

router.get(
  '/roi-assist/ranking-export',
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    try {
      const rows = await buildRankingExportRows({
        start: req.query.start,
        end: req.query.end,
        limit: req.query.limit
      })
      const csv = toCsv(rankingExportHeaders, rows)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="scanner-ranking-training-${timestamp}.csv"`
      )
      res.send(`\uFEFF${csv}`)
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to export scanner ranking training data',
        error: error.message
      })
    }
  }
)

router.get(
  '/roi-assist/ranking-model',
  authMiddleware,
  requireRole('admin'),
  async (_req, res) => {
    try {
      const model = loadRankerModel()

      res.json({
        success: true,
        model: {
          available: model.available,
          status: model.available ? model.training_summary?.sessions >= 30 ? 'ready' : 'warmup' : model.reason || 'unavailable',
          version: model.version || null,
          model_type: model.model_type || null,
          trained_at: model.trained_at || null,
          model_path: model.model_path,
          training_summary: model.training_summary || null,
          metrics: model.metrics || null
        }
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to load scanner ranking model',
        error: error.message
      })
    }
  }
)

router.get('/roi-assist/health', async (_req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/scanner/roi-assist/health`, {
      timeout: ROI_ASSIST_HEALTH_TIMEOUT_MS
    })
    res.json(response.data)
  } catch (error) {
    res.status(502).json({
      status: 'ERROR',
      message: 'ROI Assist service is unavailable',
      aiServiceUrl: AI_SERVICE_URL,
      error: error.message
    })
  }
})

router.post('/roi-assist', upload.single('frame'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Missing scanner frame upload. Expected multipart field: frame'
    })
  }

  const form = new FormData()
  form.append('frame', req.file.buffer, {
    filename: req.file.originalname || 'scanner-frame.jpg',
    contentType: req.file.mimetype || 'image/jpeg'
  })
  form.append('mode', req.body.mode || 'obb')
  form.append('trigger', req.body.trigger || 'manual')
  form.append('operation_context', req.body.operation_context || '')
  if (req.body.scan_frame) {
    form.append('scan_frame', req.body.scan_frame)
  }

  try {
    const response = await axios.post(`${AI_SERVICE_URL}/scanner/roi-assist`, form, {
      headers: form.getHeaders(),
      timeout: ROI_ASSIST_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    })
    res.status(response.status).json(response.data)
  } catch (error) {
    const status = error.response?.status || 502
    res.status(status).json({
      success: false,
      message: 'ROI Assist request failed',
      aiServiceUrl: AI_SERVICE_URL,
      error: error.response?.data || error.message
    })
  }
})

router.post(
  '/roi-assist/resolve-candidates',
  authMiddleware,
  requireRole('admin', 'operator'),
  async (req, res) => {
    try {
      const candidates = Array.isArray(req.body?.candidates) ? req.body.candidates : []
      const limitedCandidates = candidates.slice(0, 8)
      const operationContext = String(req.body?.operation_context || req.body?.operationContext || 'SCAN')
        .slice(0, 40)
        .toUpperCase()
      const resolvedCandidates = await Promise.all(
        limitedCandidates.map((candidate) => resolveCandidateDisplay(candidate))
      )
      const candidatesWithFeedback = await attachFeedbackSignals(resolvedCandidates, operationContext)
      const mlRanking = enrichCandidatesWithMlScores(candidatesWithFeedback, operationContext)

      res.json({
        success: true,
        ranking_model: mlRanking.model,
        candidates: mlRanking.candidates
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to resolve ROI Assist candidates',
        error: error.message
      })
    }
  }
)

router.post(
  '/roi-assist/selection-feedback',
  authMiddleware,
  requireRole('admin', 'operator'),
  async (req, res) => {
    try {
      const body = req.body || {}
      const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 12) : []
      const selectedCandidateId = body.selected_candidate_id ? String(body.selected_candidate_id).slice(0, 80) : null
      const selectedCandidate = candidates.find((candidate) => String(candidate.candidate_id || '') === selectedCandidateId)
      const rankedCandidates = [...candidates]
        .sort((left, right) => Number(right.selection_score || 0) - Number(left.selection_score || 0))
      const sortedCandidates = candidates
        .map(sanitizeSelectionCandidate)
        .sort((left, right) => Number(right.selection_score || 0) - Number(left.selection_score || 0))

      const topScore = sortedCandidates[0]?.selection_score ?? null
      const secondScore = sortedCandidates[1]?.selection_score ?? null
      const scoreMargin = topScore == null || secondScore == null ? null : topScore - secondScore

      await ScannerSelectionSample.create({
        session_id: String(body.session_id || `selection-${Date.now()}`).slice(0, 80),
        trigger: String(body.trigger || 'manual').slice(0, 30),
        operation_context: String(body.operation_context || 'scan').slice(0, 40),
        selected_candidate_id: selectedCandidateId,
        selected_decoded_text: selectedCandidate?.decoded_text ? String(selectedCandidate.decoded_text).slice(0, 4000) : null,
        candidate_count: candidates.length,
        decision_type: String(body.decision_type || 'user_selected').slice(0, 40),
        top_score: toFiniteNumber(topScore),
        score_margin: toFiniteNumber(scoreMargin),
        user_id: req.user?.id || null,
        user_name: req.user?.username || req.user?.email || null,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
        ip_address: getRequestIp(req),
        candidates: sortedCandidates,
        payload: {
          ...body,
          candidates: sortedCandidates
        }
      })

      await persistScanSelectionTrainingData({
        body,
        req,
        candidates,
        sortedCandidates: rankedCandidates,
        selectedCandidateId,
        selectedCandidate,
        topScore,
        scoreMargin
      })

      res.json({
        success: true,
        message: 'Scanner selection feedback recorded.',
        training_data_recorded: true
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to record scanner selection feedback',
        error: error.message
      })
    }
  }
)

module.exports = router
