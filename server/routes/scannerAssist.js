const express = require('express')
const axios = require('axios')
const multer = require('multer')
const FormData = require('form-data')
const { Item, Lot, Bin } = require('../models')
const authMiddleware = require('../middlewares/auth')
const requireRole = require('../middlewares/requireRole')

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
      const resolvedCandidates = await Promise.all(
        limitedCandidates.map((candidate) => resolveCandidateDisplay(candidate))
      )

      res.json({
        success: true,
        candidates: resolvedCandidates
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

module.exports = router
