import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource
} from '@zxing/library'

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

const BARCODE_DETECTOR_FORMATS = [
  'qr_code',
  'data_matrix',
  'code_128',
  'code_39',
  'code_93',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'itf',
  'codabar'
]

const state = {
  disableBarcodeDetector: false
}

const QR_SCOUT_SAMPLE_WIDTH = 96
const QR_SCOUT_MAX_CANDIDATES = 2

let multiFormatReader = null
let barcodeDetector = null
let workerFrameCanvas = null
let workerFrameContext = null

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const toGray = (r, g, b) => (r * 0.299) + (g * 0.587) + (b * 0.114)

const normalizeBarcodeFormat = (format) => {
  if (!format) return 'UNKNOWN'
  if (typeof format === 'string') return format
  if (typeof format.toString === 'function') {
    const stringified = format.toString()
    if (stringified && stringified !== '[object Object]') {
      return stringified
    }
  }

  return String(format)
}

const buildScanHints = () => new Map([
  [DecodeHintType.TRY_HARDER, true],
  [DecodeHintType.POSSIBLE_FORMATS, DEFAULT_FORMATS]
])

const getReader = () => {
  if (!multiFormatReader) {
    multiFormatReader = new MultiFormatReader()
    multiFormatReader.setHints(buildScanHints())
  }

  return multiFormatReader
}

const getWorkerFrameContext = (width, height) => {
  if (typeof OffscreenCanvas === 'undefined') return null

  if (!workerFrameCanvas) {
    workerFrameCanvas = new OffscreenCanvas(width, height)
    workerFrameContext = workerFrameCanvas.getContext('2d', { willReadFrequently: true })
  }

  if (!workerFrameContext) return null

  if (workerFrameCanvas.width !== width) workerFrameCanvas.width = width
  if (workerFrameCanvas.height !== height) workerFrameCanvas.height = height

  return workerFrameContext
}

const getBarcodeDetector = () => {
  if (state.disableBarcodeDetector) return null
  if (typeof self.BarcodeDetector === 'undefined') return null
  if (typeof OffscreenCanvas === 'undefined') return null
  if (typeof ImageData === 'undefined') return null

  if (!barcodeDetector) {
    try {
      barcodeDetector = new self.BarcodeDetector({
        formats: BARCODE_DETECTOR_FORMATS
      })
    } catch (error) {
      barcodeDetector = null
    }
  }

  return barcodeDetector
}

const buildCenteredRoi = (width, height) => {
  const cropWidth = Math.min(width * 0.82, width)
  const cropHeight = Math.min(height * 0.48, height)

  return {
    x: Math.max((width - cropWidth) / 2, 0),
    y: Math.max((height - cropHeight) / 2, 0),
    width: cropWidth,
    height: cropHeight
  }
}

const buildSquareRoi = (width, height) => {
  const size = Math.min(width, height) * 0.58

  return {
    x: Math.max((width - size) / 2, 0),
    y: Math.max((height - size) / 2, 0),
    width: size,
    height: size
  }
}

const buildCandidateSource = (crop, candidateWidth, candidateHeight, frameWidth, frameHeight, rotationDegrees = 0) => ({
  cropX: crop.x,
  cropY: crop.y,
  cropWidth: crop.width,
  cropHeight: crop.height,
  candidateWidth,
  candidateHeight,
  frameWidth,
  frameHeight,
  rotationDegrees
})

const rotatePointAroundCenter = (point, width, height, degrees) => {
  if (!degrees) return point

  const radians = (degrees * Math.PI) / 180
  const centerX = width / 2
  const centerY = height / 2
  const dx = point.x - centerX
  const dy = point.y - centerY
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  return {
    x: centerX + (dx * cos) - (dy * sin),
    y: centerY + (dx * sin) + (dy * cos)
  }
}

const normalizeResultPoints = (points) => {
  if (!Array.isArray(points)) return []

  return points
    .map((point) => {
      const x = Number(point?.getX?.() ?? point?.x ?? point?.[0])
      const y = Number(point?.getY?.() ?? point?.y ?? point?.[1])
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null
      return { x, y }
    })
    .filter(Boolean)
}

const getBoundingBoxPoints = (box) => {
  if (!box) return []
  const x = Number(box.x || 0)
  const y = Number(box.y || 0)
  const width = Number(box.width || 0)
  const height = Number(box.height || 0)
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return []

  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ]
}

const buildFrameLocation = (candidate, points) => {
  const source = candidate?.source
  if (!source || !Array.isArray(points) || !points.length) return null

  const framePoints = points.map((point) => {
    const unrotated = rotatePointAroundCenter(
      point,
      source.candidateWidth,
      source.candidateHeight,
      -(source.rotationDegrees || 0)
    )

    return {
      x: source.cropX + ((unrotated.x / source.candidateWidth) * source.cropWidth),
      y: source.cropY + ((unrotated.y / source.candidateHeight) * source.cropHeight)
    }
  })

  return {
    source: 'worker-scanner',
    points: framePoints,
    frameWidth: source.frameWidth,
    frameHeight: source.frameHeight,
    candidateLabel: candidate.label
  }
}

const sampleGrayAt = (rgba, width, height, sourceX, sourceY) => {
  const x = clamp(Math.round(sourceX), 0, width - 1)
  const y = clamp(Math.round(sourceY), 0, height - 1)
  const offset = ((y * width) + x) * 4

  return toGray(rgba[offset], rgba[offset + 1], rgba[offset + 2])
}

const computeFrameMetricsFromRgba = (rgba, width, height) => {
  const sampleWidth = 96
  const sampleHeight = 72
  const grayscale = new Float32Array(sampleWidth * sampleHeight)

  let sum = 0
  let sumSquares = 0
  let saturated = 0

  for (let y = 0; y < sampleHeight; y += 1) {
    const sourceY = ((y + 0.5) / sampleHeight) * height - 0.5

    for (let x = 0; x < sampleWidth; x += 1) {
      const sourceX = ((x + 0.5) / sampleWidth) * width - 0.5
      const gray = sampleGrayAt(rgba, width, height, sourceX, sourceY)
      const index = (y * sampleWidth) + x

      grayscale[index] = gray
      sum += gray
      sumSquares += gray * gray
      if (gray >= 245) saturated += 1
    }
  }

  const total = grayscale.length
  const brightness = total ? sum / total : 0
  const variance = total ? Math.max((sumSquares / total) - (brightness * brightness), 0) : 0
  const contrast = Math.sqrt(variance)

  let edgeEnergy = 0
  for (let y = 1; y < sampleHeight - 1; y += 1) {
    for (let x = 1; x < sampleWidth - 1; x += 1) {
      const index = (y * sampleWidth) + x
      const horizontal = Math.abs(grayscale[index + 1] - grayscale[index - 1])
      const vertical = Math.abs(grayscale[index + sampleWidth] - grayscale[index - sampleWidth])
      edgeEnergy += horizontal + vertical
    }
  }

  const edgeCount = Math.max((sampleWidth - 2) * (sampleHeight - 2), 1)
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

const buildIntegralImage = (values, width, height) => {
  const integral = new Float32Array((width + 1) * (height + 1))

  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0

    for (let x = 1; x <= width; x += 1) {
      rowSum += values[((y - 1) * width) + (x - 1)]
      integral[(y * (width + 1)) + x] = integral[((y - 1) * (width + 1)) + x] + rowSum
    }
  }

  return integral
}

const sumIntegralRect = (integral, integralWidth, x, y, width, height) => {
  const x1 = x
  const y1 = y
  const x2 = x + width
  const y2 = y + height

  return (
    integral[(y2 * integralWidth) + x2] -
    integral[(y1 * integralWidth) + x2] -
    integral[(y2 * integralWidth) + x1] +
    integral[(y1 * integralWidth) + x1]
  )
}

const rectanglesOverlap = (a, b) => {
  const left = Math.max(a.x, b.x)
  const top = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.size, b.x + b.size)
  const bottom = Math.min(a.y + a.size, b.y + b.size)
  const intersection = Math.max(right - left, 0) * Math.max(bottom - top, 0)
  if (!intersection) return false

  const union = (a.size * a.size) + (b.size * b.size) - intersection
  return union > 0 && (intersection / union) > 0.36
}

const findQrScoutRegions = (rgba, frameWidth, frameHeight) => {
  const sampleWidth = QR_SCOUT_SAMPLE_WIDTH
  const sampleHeight = clamp(Math.round((frameHeight / frameWidth) * sampleWidth), 54, 96)
  const samplePixels = sampleWidth * sampleHeight
  const gray = new Uint8ClampedArray(samplePixels)
  const edges = new Float32Array(samplePixels)
  const dark = new Float32Array(samplePixels)
  const bright = new Float32Array(samplePixels)

  let sum = 0

  for (let y = 0; y < sampleHeight; y += 1) {
    const sourceY = ((y + 0.5) / sampleHeight) * frameHeight - 0.5

    for (let x = 0; x < sampleWidth; x += 1) {
      const sourceX = ((x + 0.5) / sampleWidth) * frameWidth - 0.5
      const value = sampleGrayAt(rgba, frameWidth, frameHeight, sourceX, sourceY)
      const index = (y * sampleWidth) + x

      gray[index] = value
      sum += value
    }
  }

  const mean = samplePixels ? sum / samplePixels : 128
  const darkThreshold = clamp(mean - 24, 42, 180)
  const brightThreshold = clamp(mean + 18, 82, 225)

  for (let y = 1; y < sampleHeight - 1; y += 1) {
    for (let x = 1; x < sampleWidth - 1; x += 1) {
      const index = (y * sampleWidth) + x
      const horizontal = Math.abs(gray[index + 1] - gray[index - 1])
      const vertical = Math.abs(gray[index + sampleWidth] - gray[index - sampleWidth])

      edges[index] = horizontal + vertical
    }
  }

  for (let index = 0; index < samplePixels; index += 1) {
    dark[index] = gray[index] <= darkThreshold ? 1 : 0
    bright[index] = gray[index] >= brightThreshold ? 1 : 0
  }

  const integralWidth = sampleWidth + 1
  const edgeIntegral = buildIntegralImage(edges, sampleWidth, sampleHeight)
  const darkIntegral = buildIntegralImage(dark, sampleWidth, sampleHeight)
  const brightIntegral = buildIntegralImage(bright, sampleWidth, sampleHeight)
  const minSide = Math.min(sampleWidth, sampleHeight)
  const windowSizes = [
    Math.round(minSide * 0.2),
    Math.round(minSide * 0.28),
    Math.round(minSide * 0.38),
    Math.round(minSide * 0.5)
  ].map((size) => clamp(size, 14, minSide - 4))
  const regions = []

  windowSizes.forEach((size) => {
    const step = Math.max(Math.round(size * 0.3), 4)

    for (let y = 1; y <= sampleHeight - size - 1; y += step) {
      for (let x = 1; x <= sampleWidth - size - 1; x += step) {
        const area = size * size
        const edgeMean = sumIntegralRect(edgeIntegral, integralWidth, x, y, size, size) / area
        if (edgeMean < 18) continue

        const darkRatio = sumIntegralRect(darkIntegral, integralWidth, x, y, size, size) / area
        const brightRatio = sumIntegralRect(brightIntegral, integralWidth, x, y, size, size) / area
        const balance = Math.min(darkRatio, brightRatio)
        if (balance < 0.08) continue

        const centerX = x + (size / 2)
        const centerY = y + (size / 2)
        const normalizedDistance = Math.hypot(
          (centerX / sampleWidth) - 0.5,
          (centerY / sampleHeight) - 0.5
        )
        const centerBias = 1 - clamp(normalizedDistance * 0.5, 0, 0.25)
        const score = edgeMean * (0.72 + (balance * 1.6)) * centerBias

        regions.push({
          x,
          y,
          size,
          score
        })
      }
    }
  })

  const selected = []
  regions
    .sort((a, b) => b.score - a.score)
    .some((region) => {
      if (selected.some((existing) => rectanglesOverlap(existing, region))) return false

      selected.push(region)
      return selected.length >= QR_SCOUT_MAX_CANDIDATES
    })

  return {
    sampleWidth,
    sampleHeight,
    regions: selected
  }
}

const cropAndScaleRgba = (rgba, frameWidth, frameHeight, crop, targetWidth, targetHeight) => {
  const output = new Uint8ClampedArray(targetWidth * targetHeight * 4)

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = crop.y + (((y + 0.5) / targetHeight) * crop.height) - 0.5
    const clampedY = clamp(Math.round(sourceY), 0, frameHeight - 1)

    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = crop.x + (((x + 0.5) / targetWidth) * crop.width) - 0.5
      const clampedX = clamp(Math.round(sourceX), 0, frameWidth - 1)
      const sourceOffset = ((clampedY * frameWidth) + clampedX) * 4
      const targetOffset = ((y * targetWidth) + x) * 4

      output[targetOffset] = rgba[sourceOffset]
      output[targetOffset + 1] = rgba[sourceOffset + 1]
      output[targetOffset + 2] = rgba[sourceOffset + 2]
      output[targetOffset + 3] = rgba[sourceOffset + 3]
    }
  }

  return output
}

const rotateRgbaSameSize = (rgba, width, height, degrees) => {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(-radians)
  const sin = Math.sin(-radians)
  const centerX = (width - 1) / 2
  const centerY = (height - 1) / 2
  const output = new Uint8ClampedArray(rgba.length)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - centerX
      const dy = y - centerY
      const sourceX = Math.round((cos * dx) - (sin * dy) + centerX)
      const sourceY = Math.round((sin * dx) + (cos * dy) + centerY)
      const targetOffset = ((y * width) + x) * 4

      if (sourceX < 0 || sourceX >= width || sourceY < 0 || sourceY >= height) {
        output[targetOffset] = 0
        output[targetOffset + 1] = 0
        output[targetOffset + 2] = 0
        output[targetOffset + 3] = 255
        continue
      }

      const sourceOffset = ((sourceY * width) + sourceX) * 4
      output[targetOffset] = rgba[sourceOffset]
      output[targetOffset + 1] = rgba[sourceOffset + 1]
      output[targetOffset + 2] = rgba[sourceOffset + 2]
      output[targetOffset + 3] = rgba[sourceOffset + 3]
    }
  }

  return output
}

const enhanceLowLightRgba = (rgba, width, height, metrics) => {
  const gray = new Uint8ClampedArray(width * height)
  let min = 255
  let max = 0

  for (let px = 0, offset = 0; px < gray.length; px += 1, offset += 4) {
    const luminance = Math.round(toGray(rgba[offset], rgba[offset + 1], rgba[offset + 2]))
    gray[px] = luminance
    if (luminance < min) min = luminance
    if (luminance > max) max = luminance
  }

  const dynamicRange = Math.max(max - min, 24)
  const gamma = metrics.lowLight ? 0.72 : 0.88
  const output = new Uint8ClampedArray(width * height * 4)

  for (let px = 0, offset = 0; px < gray.length; px += 1, offset += 4) {
    const normalized = clamp((gray[px] - min) / dynamicRange, 0, 1)
    const boosted = Math.pow(normalized, gamma)
    const contrastBoost = clamp((boosted - 0.5) * 1.18 + 0.5, 0, 1)
    const value = Math.round(contrastBoost * 255)

    output[offset] = value
    output[offset + 1] = value
    output[offset + 2] = value
    output[offset + 3] = 255
  }

  return output
}

const applyBlockThresholdRgba = (rgba, width, height, metrics) => {
  const blockSize = metrics.lowLight ? 18 : 24
  const cols = Math.ceil(width / blockSize)
  const rows = Math.ceil(height / blockSize)
  const means = new Float32Array(cols * rows)
  const gray = new Uint8ClampedArray(width * height)

  for (let px = 0, offset = 0; px < gray.length; px += 1, offset += 4) {
    gray[px] = Math.round(toGray(rgba[offset], rgba[offset + 1], rgba[offset + 2]))
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

  const output = new Uint8ClampedArray(width * height * 4)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const col = Math.min(Math.floor(x / blockSize), cols - 1)
      const row = Math.min(Math.floor(y / blockSize), rows - 1)
      const threshold = means[(row * cols) + col] - (metrics.lowLight ? 12 : 8)
      const value = gray[(y * width) + x] > threshold ? 255 : 0
      const offset = ((y * width) + x) * 4

      output[offset] = value
      output[offset + 1] = value
      output[offset + 2] = value
      output[offset + 3] = 255
    }
  }

  return output
}

const buildDecodeCandidatesFromFrame = (rgba, frameWidth, frameHeight, metrics, options = {}) => {
  const roi = buildCenteredRoi(frameWidth, frameHeight)
  const squareRoi = buildSquareRoi(frameWidth, frameHeight)
  const includeFullFrame = options.includeFullFrame === true
  const enableTiltAssist = options.enableTiltAssist !== false
  const includeEnhancedAssist = options.includeEnhancedAssist !== false
  const includeBinaryAssist = options.includeBinaryAssist !== false
  const targetWidth = clamp(Math.round(roi.width), 480, 960)
  const targetHeight = clamp(Math.round(roi.height), 220, 540)
  const roiBase = cropAndScaleRgba(rgba, frameWidth, frameHeight, roi, targetWidth, targetHeight)
  const roiSource = buildCandidateSource(roi, targetWidth, targetHeight, frameWidth, frameHeight)

  const candidates = [
    { label: 'roi-base', data: roiBase, width: targetWidth, height: targetHeight, source: roiSource }
  ]

  if (enableTiltAssist) {
    [-14, -8, 8, 14].forEach((angle) => {
      candidates.push({
        label: `roi-tilt-${angle}`,
        data: rotateRgbaSameSize(roiBase, targetWidth, targetHeight, angle),
        width: targetWidth,
        height: targetHeight,
        source: buildCandidateSource(roi, targetWidth, targetHeight, frameWidth, frameHeight, angle)
      })
    })
  }

  if (includeEnhancedAssist) {
    candidates.push({
      label: 'roi-enhanced',
      data: enhanceLowLightRgba(roiBase, targetWidth, targetHeight, metrics),
      width: targetWidth,
      height: targetHeight,
      source: roiSource
    })
  }

  if (includeBinaryAssist) {
    candidates.push({
      label: 'roi-binary',
      data: applyBlockThresholdRgba(roiBase, targetWidth, targetHeight, metrics),
      width: targetWidth,
      height: targetHeight,
      source: roiSource
    })
  }

  const squareSize = clamp(Math.round(squareRoi.width), 360, 720)
  const squareBase = cropAndScaleRgba(rgba, frameWidth, frameHeight, squareRoi, squareSize, squareSize)
  const squareSource = buildCandidateSource(squareRoi, squareSize, squareSize, frameWidth, frameHeight)
  candidates.push({
    label: 'center-square',
    data: squareBase,
    width: squareSize,
    height: squareSize,
    source: squareSource
  })

  if (enableTiltAssist) {
    [-10, 10].forEach((angle) => {
      candidates.push({
        label: `square-tilt-${angle}`,
        data: rotateRgbaSameSize(squareBase, squareSize, squareSize, angle),
        width: squareSize,
        height: squareSize,
        source: buildCandidateSource(squareRoi, squareSize, squareSize, frameWidth, frameHeight, angle)
      })
    })
  }

  if (includeFullFrame) {
    const fullWidth = clamp(frameWidth, 640, 1280)
    const fullHeight = clamp(frameHeight, 360, 720)
    candidates.push({
      label: 'full-frame',
      data: cropAndScaleRgba(rgba, frameWidth, frameHeight, {
        x: 0,
        y: 0,
        width: frameWidth,
        height: frameHeight
      }, fullWidth, fullHeight),
      width: fullWidth,
      height: fullHeight,
      source: buildCandidateSource({ x: 0, y: 0, width: frameWidth, height: frameHeight }, fullWidth, fullHeight, frameWidth, frameHeight)
    })
  }

  return candidates
}

const buildQrScoutCandidatesFromFrame = (rgba, frameWidth, frameHeight, metrics, options = {}) => {
  const includeEnhancedAssist = options.includeEnhancedAssist === true
  const scout = findQrScoutRegions(rgba, frameWidth, frameHeight)
  if (!scout.regions.length) return []

  const scaleX = frameWidth / scout.sampleWidth
  const scaleY = frameHeight / scout.sampleHeight
  const candidates = []

  scout.regions.forEach((region, index) => {
    const centerX = (region.x + (region.size / 2)) * scaleX
    const centerY = (region.y + (region.size / 2)) * scaleY
    const regionFrameSize = Math.max(region.size * scaleX, region.size * scaleY)
    const cropSize = clamp(
      regionFrameSize * 1.95,
      Math.min(frameWidth, frameHeight) * 0.22,
      Math.min(frameWidth, frameHeight) * 0.86
    )
    const crop = {
      x: clamp(centerX - (cropSize / 2), 0, Math.max(frameWidth - cropSize, 0)),
      y: clamp(centerY - (cropSize / 2), 0, Math.max(frameHeight - cropSize, 0)),
      width: Math.min(cropSize, frameWidth),
      height: Math.min(cropSize, frameHeight)
    }
    const targetSize = clamp(Math.round(crop.width * 1.45), 420, 760)
    const baseData = cropAndScaleRgba(rgba, frameWidth, frameHeight, crop, targetSize, targetSize)
    const labelPrefix = `qr-scout-${index + 1}`

    candidates.push({
      label: labelPrefix,
      data: baseData,
      width: targetSize,
      height: targetSize,
      source: buildCandidateSource(crop, targetSize, targetSize, frameWidth, frameHeight)
    })

    if (includeEnhancedAssist || metrics.lowLight) {
      candidates.push({
        label: `${labelPrefix}-enhanced`,
        data: enhanceLowLightRgba(baseData, targetSize, targetSize, metrics),
        width: targetSize,
        height: targetSize,
        source: buildCandidateSource(crop, targetSize, targetSize, frameWidth, frameHeight)
      })
    }
  })

  return candidates
}

const computeFillRatioFromBoundingBox = (box, width, height) => {
  if (!box || !width || !height) return null

  const widthRatio = Number(box.width || 0) / width
  const heightRatio = Number(box.height || 0) / height
  const dominantRatio = Math.max(widthRatio, heightRatio)

  if (!Number.isFinite(dominantRatio) || dominantRatio <= 0) return null
  return clamp(dominantRatio, 0, 1.2)
}

const computeFillRatioFromPoints = (points, width, height) => {
  if (!Array.isArray(points) || !points.length || !width || !height) return null

  const xs = points.map((point) => Number(point?.getX?.() ?? point?.x ?? 0))
  const ys = points.map((point) => Number(point?.getY?.() ?? point?.y ?? 0))
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const widthRatio = (maxX - minX) / width
  const heightRatio = (maxY - minY) / height
  const dominantRatio = Math.max(widthRatio, heightRatio)

  if (!Number.isFinite(dominantRatio) || dominantRatio <= 0) return null
  return clamp(dominantRatio, 0, 1.2)
}

const decodeCandidateWithBarcodeDetector = async (candidate) => {
  const detector = getBarcodeDetector()
  if (!detector) return null

  try {
    const canvas = new OffscreenCanvas(candidate.width, candidate.height)
    const context = canvas.getContext('2d')
    if (!context) return null

    const imageData = new ImageData(candidate.data, candidate.width, candidate.height)
    context.putImageData(imageData, 0, 0)
    const detections = await detector.detect(canvas)
    const detection = detections?.[0]

    if (!detection?.rawValue) return null
    const points = normalizeResultPoints(detection.cornerPoints || [])
    const fallbackPoints = points.length ? points : getBoundingBoxPoints(detection.boundingBox)

    return {
      text: String(detection.rawValue).trim(),
      label: candidate.label,
      format: normalizeBarcodeFormat(detection.format),
      fillRatio: computeFillRatioFromBoundingBox(detection.boundingBox, candidate.width, candidate.height),
      location: buildFrameLocation(candidate, fallbackPoints)
    }
  } catch (error) {
    return null
  }
}

const decodeCandidateWithZXing = (candidate) => {
  const luminances = new Uint8ClampedArray(candidate.width * candidate.height)

  for (let pixel = 0, offset = 0; pixel < luminances.length; pixel += 1, offset += 4) {
    luminances[pixel] = Math.round(toGray(
      candidate.data[offset],
      candidate.data[offset + 1],
      candidate.data[offset + 2]
    ))
  }

  const source = new RGBLuminanceSource(
    luminances,
    candidate.width,
    candidate.height,
    candidate.width,
    candidate.height,
    0,
    0
  )
  const bitmap = new BinaryBitmap(new HybridBinarizer(source))
  const reader = getReader()

  try {
    const result = reader.decodeWithState(bitmap)
    if (!result?.getText?.()) return null
    const points = normalizeResultPoints(result.getResultPoints?.() || [])

    return {
      text: result.getText(),
      label: candidate.label,
      format: normalizeBarcodeFormat(result.getBarcodeFormat?.()),
      fillRatio: computeFillRatioFromPoints(points, candidate.width, candidate.height),
      location: buildFrameLocation(candidate, points)
    }
  } catch (error) {
    return null
  } finally {
    reader.reset()
  }
}

const decodeFromCandidates = async (candidates) => {
  for (const candidate of candidates) {
    const detectorResult = await decodeCandidateWithBarcodeDetector(candidate)
    if (detectorResult?.text) {
      return {
        ...detectorResult,
        engine: 'BarcodeDetector'
      }
    }

    const zxingResult = decodeCandidateWithZXing(candidate)
    if (zxingResult?.text) {
      return {
        ...zxingResult,
        engine: 'ZXing'
      }
    }
  }

  return null
}

const materializeFramePixels = ({ width, height, buffer, imageBitmap }) => {
  if (imageBitmap) {
    const context = getWorkerFrameContext(width, height)
    if (!context) {
      imageBitmap.close?.()
      throw new Error('ImageBitmap decoding requires OffscreenCanvas support in the worker.')
    }

    context.clearRect(0, 0, width, height)
    context.drawImage(imageBitmap, 0, 0, width, height)
    imageBitmap.close?.()

    return context.getImageData(0, 0, width, height).data
  }

  if (!buffer) {
    throw new Error('No frame payload was provided to the scanner worker.')
  }

  return new Uint8ClampedArray(buffer)
}

const decodeFrame = async ({ width, height, buffer, imageBitmap, missStreak = 0 }) => {
  const rgba = materializeFramePixels({ width, height, buffer, imageBitmap })
  const metrics = computeFrameMetricsFromRgba(rgba, width, height)

  const fastCandidates = buildDecodeCandidatesFromFrame(rgba, width, height, metrics, {
    includeEnhancedAssist: false,
    includeBinaryAssist: false,
    includeFullFrame: false,
    enableTiltAssist: false
  })

  let decoded = await decodeFromCandidates(fastCandidates)

  if (!decoded?.text) {
    const shouldUseMediumAssist =
      missStreak >= 1 ||
      metrics.lowLight ||
      metrics.blurry

    if (shouldUseMediumAssist) {
      const mediumCandidates = buildDecodeCandidatesFromFrame(rgba, width, height, metrics, {
        includeEnhancedAssist: true,
        includeBinaryAssist: missStreak >= 2 || metrics.lowLight,
        includeFullFrame: false,
        enableTiltAssist: missStreak >= 3 || metrics.blurry
      })

      decoded = await decodeFromCandidates(mediumCandidates)
    }
  }

  if (!decoded?.text && missStreak >= 2) {
    const qrScoutCandidates = buildQrScoutCandidatesFromFrame(rgba, width, height, metrics, {
      includeEnhancedAssist: missStreak >= 4 || metrics.lowLight
    })

    if (qrScoutCandidates.length) {
      decoded = await decodeFromCandidates(qrScoutCandidates)
    }
  }

  if (!decoded?.text) {
    const shouldUseHeavyAssist =
      missStreak >= 4 ||
      metrics.lowLight ||
      metrics.blurry

    if (shouldUseHeavyAssist) {
      const heavyCandidates = buildDecodeCandidatesFromFrame(rgba, width, height, metrics, {
        includeEnhancedAssist: true,
        includeBinaryAssist: true,
        includeFullFrame: missStreak >= 6 || metrics.lowLight,
        enableTiltAssist: true
      })

      decoded = await decodeFromCandidates(heavyCandidates)
    }
  }

  return {
    metrics,
    decodedText: decoded?.text || '',
    decodePath: decoded?.label || '',
    decodedFormat: decoded?.format || '',
    decodeEngine: decoded?.engine || '',
    fillRatio: decoded?.fillRatio ?? null,
    location: decoded?.location || null,
    missStreak: decoded?.text ? 0 : missStreak + 1
  }
}

self.onmessage = async (event) => {
  const message = event.data || {}

  if (message.type === 'init') {
    state.disableBarcodeDetector = Boolean(message.disableBarcodeDetector)
    self.postMessage({
      type: 'ready',
      barcodeDetectorAvailable: Boolean(getBarcodeDetector())
    })
    return
  }

  if (message.type === 'reset') {
    return
  }

  if (message.type !== 'decode-frame') {
    return
  }

  try {
    const result = await decodeFrame(message)
    self.postMessage({
      type: 'frame-result',
      requestId: message.requestId,
      generation: message.generation,
      ...result
    })
  } catch (error) {
    self.postMessage({
      type: 'frame-result',
      requestId: message.requestId,
      generation: message.generation,
      decodedText: '',
      decodePath: '',
      decodedFormat: '',
      decodeEngine: '',
      fillRatio: null,
      missStreak: Number(message.missStreak || 0) + 1,
      error: error?.message || 'Worker decode failed'
    })
  }
}
