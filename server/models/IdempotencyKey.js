const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const IdempotencyKey = sequelize.define('IdempotencyKey', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        request_key: {
            type: DataTypes.STRING(64),
            unique: true,
            allowNull: false,
            comment: '请求唯一键（用于幂等性控制）'
        },
        request_body: {
            type: DataTypes.JSON,
            comment: '请求体'
        },
        response_data: {
            type: DataTypes.JSON,
            comment: '响应数据'
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: '过期时间'
        }
    }, {
        tableName: 'idempotency_keys',
        timestamps: true,
        updatedAt: false,
        indexes: [
            {
                fields: ['request_key'],
                unique: true
            },
            {
                fields: ['expires_at'],
                name: 'idx_expires'
            }
        ]
    });

    return IdempotencyKey;
};
