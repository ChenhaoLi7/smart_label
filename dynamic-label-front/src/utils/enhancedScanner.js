import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

const DEFAULT_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR
]

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const toGray = (r, g, b) => (r * 0.299) + (g * 0.587) + (b * 0.114)

const getContext = (canvas) => canvas.getContext('2d', { willReadFrequently: true })

const ensureCanvas = (cache, key, width, height) => {
  if (!cache[key]) {
    cache[key] = document.createElement('canvas')
  }

  const canvas = cache[key]
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height

  return canvas
}

const drawCrop = (video, canvas, crop) => {
  const ctx = getContext(canvas)
  ctx.drawImage(
    video,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  )
}

const rotateCanvasInto = (sourceCanvas, targetCanvas, degrees) => {
  const ctx = getContext(targetCanvas)
  const radians = (degrees * Math.PI) / 180

  ctx.save()
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height)
  ctx.translate(targetCanvas.width / 2, targetCanvas.height / 2)
  ctx.rotate(radians)
  ctx.drawImage(
    sourceCanvas,
    -sourceCanvas.width / 2,
    -sourceCanvas.height / 2,
    sourceCanvas.width,
    sourceCanvas.height
  )
  ctx.restore()
}

const buildScanHints = () => new Map([
  [DecodeHintType.TRY_HARDER, true],
  [DecodeHintType.POSSIBLE_FORMATS, DEFAULT_FORMATS]
])

export const createEnhancedCodeReader = () => new BrowserMultiFormatReader(buildScanHints())

const normalizeBarcodeFormat = (format) => {
  if (!format) return 'UNKNOWN'

  if (typeof format === 'string') {
    return format
  }

  if (typeof format.toString === 'function') {
    const stringified = format.toString()
    if (stringified && stringified !== '[object Object]') {
      return stringified
    }
  }

  return String(format)
}

export const buildPreferredVideoConstraints = (deviceId = '', facingMode = 'environment') => ({
  video: {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    facingMode: deviceId ? undefined : { ideal: facingMode },
    width: { ideal: 960 },
    height: { ideal: 540 }
  }
})

export const applyPreferredTrackConstraints = async (track) => {
  if (!track?.applyConstraints || !track?.getCapabilities) return

  try {
    const capabilities = track.getCapabilities()
    const advanced = {}

    if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
      advanced.focusMode = 'continuous'
    }

    if (Array.isArray(capabilities.exposureMode) && capabilities.exposureMode.includes('continuous')) {
      advanced.exposureMode = 'continuous'
    }

    if (Array.isArray(capabilities.whiteBalanceMode) && capabilities.whiteBalanceMode.includes('continuous')) {
      advanced.whiteBalanceMode = 'continuous'
    }

    if (capabilities.sharpness && typeof capabilities.sharpness.max === 'number') {
      advanced.sharpness = clamp(
        capabilities.sharpness.max * 0.75,
        capabilities.sharpness.min ?? 0,
        capabilities.sharpness.max
      )
    }

    if (Object.keys(advanced).length > 0) {
      await track.applyConstraints({ advanced: [advanced] })
    }
  } catch (error) {
    console.warn('Preferred track constraints could not be applied:', error)
  }
}

export const computeFrameMetrics = (video, cache) => {
  const sampleCanvas = ensureCanvas(cache, 'sampleCanvas', 96, 72)
  const ctx = getContext(sampleCanvas)
  ctx.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height)

  const { data } = ctx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height)
  const grayscale = new Float32Array(sampleCanvas.width * sampleCanvas.height)

  let sum = 0
  let sumSquares = 0
  let saturated = 0

  for (let i = 0, px = 0; i < data.length; i += 4, px += 1) {
    const gray = toGray(data[i], data[i + 1], data[i + 2])
    grayscale[px] = gray
    sum += gray
    sumSquares += gray * gray
    if (gray >= 245) saturated += 1
  }

  const total = grayscale.length
  const brightness = total ? sum / total : 0
  const variance = total ? Math.max((sumSquares / total) - (brightness * brightness), 0) : 0
  const contrast = Math.sqrt(variance)

  let edgeEnergy = 0
  for (let y = 1; y < sampleCanvas.height - 1; y += 1) {
    for (let x = 1; x < sampleCanvas.width - 1; x += 1) {
      const index = (y * sampleCanvas.width) + x
      const horizontal = Math.abs(grayscale[index + 1] - grayscale[index - 1])
      const vertical = Math.abs(grayscale[index + sampleCanvas.width] - grayscale[index - sampleCanvas.width])
      edgeEnergy += horizontal + vertical
    }
  }

  const edgeCount = Math.max((sampleCanvas.width - 2) * (sampleCanvas.height - 2), 1)
  const sharpness = edgeEnergy / edgeCount
  const brightnessScore = 1 - clamp(Math.abs(brightness - 148) / 148, 0, 1)
  const contrastScore = clamp(contrast / 62, 0, 1)
  const sharpnessScore = clamp(sharpness / 55, 0, 1)
  const saturationPenalty = clamp((saturated / total) * 2.5, 0, 0.35)
  const score = clamp(
    (sharpnessScore * 0.4) +
    (contrastScore * 0.35) +
    (brightnessScore * 0.25) -
    saturationPenalty,
    0,
    1
  )

  return {
    brightness,
    contrast,
    sharpness,
    score,
    lowLight: brightness < 96,
    blurry: sharpness < 12
  }
}

const buildCenteredRoi = (video) => {
  const width = video.videoWidth || 1280
  const height = video.videoHeight || 720
  const cropWidth = Math.min(width * 0.82, width)
  const cropHeight = Math.min(height * 0.48, height)

  return {
    x: Math.max((width - cropWidth) / 2, 0),
    y: Math.max((height - cropHeight) / 2, 0),
    width: cropWidth,
    height: cropHeight
  }
}

const buildSquareRoi = (video) => {
  const width = video.videoWidth || 1280
  const height = video.videoHeight || 720
  const size = Math.min(width, height) * 0.58

  return {
    x: Math.max((width - size) / 2, 0),
    y: Math.max((height - size) / 2, 0),
    width: size,
    height: size
  }
}

const enhanceLowLight = (sourceCanvas, targetCanvas, metrics) => {
  const sourceCtx = getContext(sourceCanvas)
  const targetCtx = getContext(targetCanvas)
  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
  const output = targetCtx.createImageData(sourceCanvas.width, sourceCanvas.height)

  let min = 255
  let max = 0
  const gray = new Uint8ClampedArray(sourceCanvas.width * sourceCanvas.height)

  for (let i = 0, px = 0; i < imageData.data.length; i += 4, px += 1) {
    const luminance = Math.round(toGray(imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]))
    gray[px] = luminance
    if (luminance < min) min = luminance
    if (luminance > max) max = luminance
  }

  const dynamicRange = Math.max(max - min, 24)
  const gamma = metrics.lowLight ? 0.72 : 0.88

  for (let i = 0, px = 0; i < output.data.length; i += 4, px += 1) {
    const normalized = clamp((gray[px] - min) / dynamicRange, 0, 1)
    const boosted = Math.pow(normalized, gamma)
    const contrastBoost = clamp((boosted - 0.5) * 1.18 + 0.5, 0, 1)
    const value = Math.round(contrastBoost * 255)

    output.data[i] = value
    output.data[i + 1] = value
    output.data[i + 2] = value
    output.data[i + 3] = 255
  }

  targetCtx.putImageData(output, 0, 0)
}

const applyBlockThreshold = (sourceCanvas, targetCanvas, metrics) => {
  const sourceCtx = getContext(sourceCanvas)
  const targetCtx = getContext(targetCanvas)
  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
  const output = targetCtx.createImageData(sourceCanvas.width, sourceCanvas.height)

  const width = sourceCanvas.width
  const height = sourceCanvas.height
  const blockSize = metrics.lowLight ? 18 : 24
  const cols = Math.ceil(width / blockSize)
  const rows = Math.ceil(height / blockSize)
  const means = new Float32Array(cols * rows)
  const gray = new Uint8ClampedArray(width * height)

  for (let i = 0, px = 0; i < imageData.data.length; i += 4, px += 1) {
    gray[px] = Math.round(toGray(imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]))
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const xStart = col * blockSize
      const yStart = row * blockSize
      const xEnd = Math.min(xStart + blockSize, width)
      const yEnd = Math.min(yStart + blockSize, height)

      let sum = 0
      let count = 0

      for (let y = yStart; y < yEnd; y += 1) {
        for (let x = xStart; x < xEnd; x += 1) {
          sum += gray[(y * width) + x]
          count += 1
        }
      }

      means[(row * cols) + col] = count ? (sum / count) : 0
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const col = Math.min(Math.floor(x / blockSize), cols - 1)
      const row = Math.min(Math.floor(y / blockSize), rows - 1)
      const threshold = means[(row * cols) + col] - (metrics.lowLight ? 12 : 8)
      const value = gray[(y * width) + x] > threshold ? 255 : 0
      const offset = ((y * width) + x) * 4

      output.data[offset] = value
      output.data[offset + 1] = value
      output.data[offset + 2] = value
      output.data[offset + 3] = 255
    }
  }

  targetCtx.putImageData(output, 0, 0)
}

export const buildDecodeCandidatesFromVideo = (video, cache, metrics, options = {}) => {
  const roi = buildCenteredRoi(video)
  const squareRoi = buildSquareRoi(video)
  const includeFullFrame = options.includeFullFrame === true
  const enableTiltAssist = options.enableTiltAssist !== false
  const includeEnhancedAssist = options.includeEnhancedAssist !== false
  const includeBinaryAssist = options.includeBinaryAssist !== false
  const targetWidth = clamp(Math.round(roi.width), 480, 960)
  const targetHeight = clamp(Math.round(roi.height), 220, 540)

  const roiCanvas = ensureCanvas(cache, 'roiCanvas', targetWidth, targetHeight)
  drawCrop(video, roiCanvas, roi)

  const candidates = [
    { label: 'roi-base', canvas: roiCanvas }
  ]

  if (enableTiltAssist) {
    [-14, -8, 8, 14].forEach((angle) => {
      const rotatedCanvas = ensureCanvas(cache, `roiTilt${angle}`, targetWidth, targetHeight)
      rotateCanvasInto(roiCanvas, rotatedCanvas, angle)
      candidates.push({ label: `roi-tilt-${angle}`, canvas: rotatedCanvas })
    })
  }

  if (includeEnhancedAssist) {
    const enhancedCanvas = ensureCanvas(cache, 'enhancedCanvas', targetWidth, targetHeight)
    enhanceLowLight(roiCanvas, enhancedCanvas, metrics)
    candidates.push({ label: 'roi-enhanced', canvas: enhancedCanvas })
  }

  if (includeBinaryAssist) {
    const binaryCanvas = ensureCanvas(cache, 'binaryCanvas', targetWidth, targetHeight)
    applyBlockThreshold(roiCanvas, binaryCanvas, metrics)
    candidates.push({ label: 'roi-binary', canvas: binaryCanvas })
  }

  const squareSize = clamp(Math.round(squareRoi.width), 360, 720)
  const squareCanvas = ensureCanvas(cache, 'squareCanvas', squareSize, squareSize)
  drawCrop(video, squareCanvas, squareRoi)
  candidates.push({ label: 'center-square', canvas: squareCanvas })

  if (enableTiltAssist) {
    [-10, 10].forEach((angle) => {
      const rotatedSquareCanvas = ensureCanvas(cache, `squareTilt${angle}`, squareSize, squareSize)
      rotateCanvasInto(squareCanvas, rotatedSquareCanvas, angle)
      candidates.push({ label: `square-tilt-${angle}`, canvas: rotatedSquareCanvas })
    })
  }

  if (includeFullFrame) {
    const fullWidth = clamp(video.videoWidth || 1280, 640, 1280)
    const fullHeight = clamp(video.videoHeight || 720, 360, 720)
    const fullCanvas = ensureCanvas(cache, 'fullCanvas', fullWidth, fullHeight)
    const ctx = getContext(fullCanvas)
    ctx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height)
    candidates.push({ label: 'full-frame', canvas: fullCanvas })
  }

  return candidates
}

export const decodeFromCandidates = (reader, candidates) => {
  for (const candidate of candidates) {
    try {
      const result = reader.decodeFromCanvas(candidate.canvas)
      if (result?.getText?.()) {
        const points = result.getResultPoints?.() || []
        let fillRatio = null

        if (points.length > 0) {
          const xs = points.map((point) => Number(point?.getX?.() ?? point?.x ?? 0))
          const ys = points.map((point) => Number(point?.getY?.() ?? point?.y ?? 0))
          const minX = Math.min(...xs)
          const maxX = Math.max(...xs)
          const minY = Math.min(...ys)
          const maxY = Math.max(...ys)
          const widthRatio = candidate.canvas.width > 0 ? (maxX - minX) / candidate.canvas.width : 0
          const heightRatio = candidate.canvas.height > 0 ? (maxY - minY) / candidate.canvas.height : 0
          const dominantRatio = Math.max(widthRatio, heightRatio)

          if (Number.isFinite(dominantRatio) && dominantRatio > 0) {
            fillRatio = clamp(dominantRatio, 0, 1.2)
          }
        }

        return {
          text: result.getText(),
          label: candidate.label,
          format: normalizeBarcodeFormat(result.getBarcodeFormat?.()),
          fillRatio
        }
      }
    } catch (error) {
      // Ignore miss frames and try the next prepared candidate.
    }
  }

  return null
}

export const createTemporalConsensus = ({
  ttlMs = 900,
  requiredHits = 2,
  requiredWeight = 0.9,
  minLead = 0.14
} = {}) => {
  const bucket = new Map()

  const cleanup = (now) => {
    for (const [key, entry] of bucket.entries()) {
      if (now - entry.lastSeen > ttlMs) {
        bucket.delete(key)
      }
    }
  }

  return {
    reset() {
      bucket.clear()
    },
    register(rawValue, weight = 0.5) {
      const code = String(rawValue || '').trim()
      if (!code) return { confirmed: false }

      const now = Date.now()
      cleanup(now)

      const entry = bucket.get(code) || { hits: 0, weight: 0, lastSeen: now }
      entry.hits += 1
      entry.weight += Math.max(weight, 0.05)
      entry.lastSeen = now
      bucket.set(code, entry)

      let leaderCode = code
      let leader = entry
      let runnerWeight = 0

      for (const [candidateCode, candidate] of bucket.entries()) {
        if (candidate.weight > leader.weight) {
          runnerWeight = leader.weight
          leaderCode = candidateCode
          leader = candidate
          continue
        }

        if (candidateCode !== leaderCode) {
          runnerWeight = Math.max(runnerWeight, candidate.weight)
        }
      }

      const confirmed =
        leader.hits >= requiredHits &&
        leader.weight >= requiredWeight &&
        (leader.weight - runnerWeight) >= minLead

      if (confirmed) {
        bucket.clear()
        return {
          confirmed: true,
          code: leaderCode,
          hits: leader.hits,
          weight: leader.weight
        }
      }

      return {
        confirmed: false,
        leaderCode,
        hits: leader.hits,
        weight: leader.weight
      }
    }
  }
}
