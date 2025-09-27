const jwt = require('jsonwebtoken')
const crypto = require('crypto')

// JWS配置
const JWS_CONFIG = {
  // 生产环境应该从环境变量获取
  SECRET: process.env.JWT_SECRET || 'smart-warehouse-2024-secret-key-change-in-production',
  ALGORITHM: 'HS256',
  ISSUER: 'smart-warehouse',
  AUDIENCE: 'warehouse-operations'
}

/**
 * 生成静态标签JWS（长期有效）
 * @param {string} type - 标签类型 (BIN, LOT, ITEM)
 * @param {string} id - 标识符
 * @param {Object} additionalData - 额外数据
 * @returns {Promise<string>} JWS字符串
 */
const generateStaticLabelJWS = async (type, id, additionalData = {}) => {
  try {
    const now = Math.floor(Date.now() / 1000)
    
    const payload = {
      v: 1,
      type: type,
      id: id,
      iat: now,
      iss: JWS_CONFIG.ISSUER,
      aud: JWS_CONFIG.AUDIENCE,
      ...additionalData
    }
    
    const jws = jwt.sign(payload, JWS_CONFIG.SECRET, {
      algorithm: JWS_CONFIG.ALGORITHM,
      header: {
        kid: `${type}_${id}`
      }
    })
    
    return jws
  } catch (error) {
    console.error('生成静态标签JWS失败:', error)
    throw error
  }
}

/**
 * 生成动态任务JWS（短期有效）
 * @param {string} type - 任务类型 (TASK, PO, SO)
 * @param {string} taskId - 任务标识符
 * @param {number} ttlSeconds - 有效期（秒）
 * @param {Object} additionalData - 额外数据
 * @returns {Promise<string>} JWS字符串
 */
const generateDynamicTaskJWS = async (type, taskId, ttlSeconds = 120, additionalData = {}) => {
  try {
    const now = Math.floor(Date.now() / 1000)
    const nonce = crypto.randomUUID()
    
    const payload = {
      v: 1,
      type: type,
      task: taskId,
      iat: now,
      exp: now + ttlSeconds,
      iss: JWS_CONFIG.ISSUER,
      aud: JWS_CONFIG.AUDIENCE,
      nonce: nonce,
      ...additionalData
    }
    
    const jws = jwt.sign(payload, JWS_CONFIG.SECRET, {
      algorithm: JWS_CONFIG.ALGORITHM,
      expiresIn: ttlSeconds,
      header: {
        kid: `${type}_${taskId}`
      }
    })
    
    return jws
  } catch (error) {
    console.error('生成动态任务JWS失败:', error)
    throw error
  }
}

/**
 * 验证JWS
 * @param {string} jws - JWS字符串
 * @returns {Promise<Object>} 解析后的payload
 */
const verifyJWS = async (jws) => {
  try {
    const payload = jwt.verify(jws, JWS_CONFIG.SECRET, {
      algorithms: [JWS_CONFIG.ALGORITHM],
      issuer: JWS_CONFIG.ISSUER,
      audience: JWS_CONFIG.AUDIENCE
    })
    
    return {
      valid: true,
      payload: payload,
      expired: payload.exp ? payload.exp < Math.floor(Date.now() / 1000) : false
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return {
        valid: false,
        expired: true,
        error: 'JWS已过期'
      }
    } else if (error.name === 'JsonWebTokenError') {
      return {
        valid: false,
        expired: false,
        error: 'JWS无效'
      }
    } else {
      return {
        valid: false,
        expired: false,
        error: `验证失败: ${error.message}`
      }
    }
  }
}

/**
 * 生成批次标签JWS
 * @param {string} lotNumber - 批次号
 * @param {string} sku - 商品SKU
 * @returns {Promise<string>} JWS字符串
 */
const generateLotJWS = async (lotNumber, sku) => {
  return generateStaticLabelJWS('LOT', lotNumber, { sku })
}

/**
 * 生成库位标签JWS
 * @param {string} binCode - 库位编码
 * @param {string} zone - 区域
 * @returns {Promise<string>} JWS字符串
 */
const generateBinJWS = async (binCode, zone) => {
  return generateStaticLabelJWS('BIN', binCode, { zone })
}

/**
 * 生成物料标签JWS
 * @param {string} sku - 商品SKU
 * @returns {Promise<string>} JWS字符串
 */
const generateItemJWS = async (sku) => {
  return generateStaticLabelJWS('ITEM', sku)
}

/**
 * 生成拣选任务JWS
 * @param {string} taskId - 任务ID
 * @param {string} soNumber - 销售订单号
 * @param {number} ttlSeconds - 有效期
 * @returns {Promise<string>} JWS字符串
 */
const generatePickingTaskJWS = async (taskId, soNumber, ttlSeconds = 300) => {
  return generateDynamicTaskJWS('TASK', taskId, ttlSeconds, { 
    task_type: 'PICKING',
    so_number: soNumber
  })
}

/**
 * 生成收货任务JWS
 * @param {string} taskId - 任务ID
 * @param {string} poNumber - 采购订单号
 * @param {number} ttlSeconds - 有效期
 * @returns {Promise<string>} JWS字符串
 */
const generateReceivingTaskJWS = async (taskId, poNumber, ttlSeconds = 300) => {
  return generateDynamicTaskJWS('TASK', taskId, ttlSeconds, { 
    task_type: 'RECEIVING',
    po_number: poNumber
  })
}

module.exports = {
  generateStaticLabelJWS,
  generateDynamicTaskJWS,
  verifyJWS,
  generateLotJWS,
  generateBinJWS,
  generateItemJWS,
  generatePickingTaskJWS,
  generateReceivingTaskJWS
}

