const express = require('express')
const axios = require('axios')
const multer = require('multer')
const FormData = require('form-data')

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

module.exports = router
