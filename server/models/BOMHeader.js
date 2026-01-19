const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const BOMHeader = sequelize.define('BOMHeader', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    sku: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '成品SKU'
    },
    version: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'v1.0',
        comment: 'BOM版本'
    },
    status: {
        type: DataTypes.ENUM('DRAFT', 'ACTIVE', 'OBSOLETE'),
        defaultValue: 'DRAFT',
        comment: '状态'
    },
    effective_date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: '生效日期'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '备注'
    }
}, {
    tableName: 'bom_headers',
    timestamps: true,
    comment: '配方主表'
})

module.exports = BOMHeader
