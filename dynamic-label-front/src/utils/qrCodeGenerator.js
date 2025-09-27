import QRCode from 'qrcode'

// 二维码类型定义
export const QR_TYPES = {
  // 静态标签（长期有效）
  BIN: 'BIN',           // 库位
  LOT: 'LOT',           // 批次
  ITEM: 'ITEM',         // 物料
  
  // 动态任务（短期有效）
  TASK: 'TASK',         // 任务
  PO: 'PO',             // 采购订单
  SO: 'SO',             // 销售订单
  MOVE: 'MOVE'          // 移库任务
}

// 静态标签模板（不包含签名，由后端生成）
export function createStaticLabelTemplate(type, id, additionalData = {}) {
  return {
    v: 1,
    type: type,
    id: id,
    ...additionalData
  }
}

// 动态任务模板（包含过期时间，由后端生成）
export function createDynamicTaskTemplate(type, taskId, ttlSeconds = 120) {
  const now = Math.floor(Date.now() / 1000)
  return {
    v: 1,
    type: type,
    task: taskId,
    iat: now,
    exp: now + ttlSeconds,
    nonce: generateNonce()
  }
}

// 生成随机数（仅用于模板预览）
function generateNonce() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15)
}

// 生成二维码图像（前端只负责渲染）
export async function generateQRImage(content, options = {}) {
  const defaultOptions = {
    width: 200,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'M'
  }
  
  const finalOptions = { ...defaultOptions, ...options }
  
  try {
    // 如果内容是对象，转换为JSON字符串
    const qrContent = typeof content === 'string' ? content : JSON.stringify(content)
    const dataURL = await QRCode.toDataURL(qrContent, finalOptions)
    return dataURL
  } catch (error) {
    console.error('生成二维码失败:', error)
    throw error
  }
}

// 获取二维码类型描述
export function getQRTypeDescription(type) {
  const descriptions = {
    [QR_TYPES.BIN]: '库位二维码 - 包含库位位置信息',
    [QR_TYPES.LOT]: '批次二维码 - 包含批次标识信息',
    [QR_TYPES.ITEM]: '物料二维码 - 包含物料基本信息',
    [QR_TYPES.TASK]: '任务二维码 - 包含任务执行信息',
    [QR_TYPES.PO]: '采购订单二维码 - 包含采购订单信息',
    [QR_TYPES.SO]: '销售订单二维码 - 包含销售订单信息',
    [QR_TYPES.MOVE]: '移库任务二维码 - 包含移库任务信息'
  }
  return descriptions[type] || '未知类型'
}

// 批量生成二维码图像
export async function generateBatchQRImages(items, options = {}) {
  const promises = items.map(item => generateQRImage(item.content, options))
  return Promise.all(promises)
}

// 默认导出
export default {
  QR_TYPES,
  createStaticLabelTemplate,
  createDynamicTaskTemplate,
  generateQRImage,
  generateBatchQRImages,
  getQRTypeDescription
}
