const { IdempotencyKey } = require('../models');
const { v4: uuidv4 } = require('uuid');

/**
 * 幂等性中间件
 * 基于 MySQL 实现，无需 Redis
 */
const idempotencyMiddleware = async (req, res, next) => {
    // 只对 POST/PUT/PATCH 请求应用幂等性
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
        return next();
    }

    // 获取或生成请求键
    const requestKey = req.headers['idempotency-key'] ||
        req.headers['x-idempotency-key'] ||
        generateDefaultKey(req);

    try {
        // 检查是否已处理过此请求
        const existing = await IdempotencyKey.findOne({
            where: { request_key: requestKey }
        });

        if (existing) {
            // 请求已处理，返回之前的响应
            console.log(`✅ 幂等性命中: ${requestKey}`);
            return res.json(existing.response_data);
        }

        // 保存原始的 res.json 方法
        const originalJson = res.json.bind(res);

        // 重写 res.json 以保存响应
        res.json = function (data) {
            // 异步保存幂等性记录（不阻塞响应）
            saveIdempotencyRecord(requestKey, req.body, data).catch(err => {
                console.error('保存幂等性记录失败:', err);
            });

            // 返回响应
            return originalJson(data);
        };

        next();

    } catch (error) {
        console.error('幂等性检查失败:', error);
        // 幂等性检查失败不应阻塞业务
        next();
    }
};

/**
 * 生成默认请求键
 */
function generateDefaultKey(req) {
    // 基于用户、路径、时间戳生成
    const userId = req.user?.id || 'anonymous';
    const path = req.path;
    const timestamp = Math.floor(Date.now() / 1000); // 1秒精度
    return `${userId}-${path}-${timestamp}`;
}

/**
 * 保存幂等性记录
 */
async function saveIdempotencyRecord(requestKey, requestBody, responseData) {
    try {
        await IdempotencyKey.create({
            request_key: requestKey,
            request_body: requestBody,
            response_data: responseData,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
        });
        console.log(`💾 幂等性记录已保存: ${requestKey}`);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            // 并发情况下可能已插入，忽略
            console.log(`⚠️ 幂等性记录已存在: ${requestKey}`);
        } else {
            throw error;
        }
    }
}

/**
 * 清理过期记录（定时任务）
 */
async function cleanupExpiredKeys() {
    try {
        const deleted = await IdempotencyKey.destroy({
            where: {
                expires_at: {
                    [require('sequelize').Op.lt]: new Date()
                }
            }
        });
        if (deleted > 0) {
            console.log(`🗑️ 清理了 ${deleted} 条过期幂等性记录`);
        }
    } catch (error) {
        console.error('清理幂等性记录失败:', error);
    }
}

// 每小时清理一次过期记录
setInterval(cleanupExpiredKeys, 60 * 60 * 1000);

module.exports = idempotencyMiddleware;
