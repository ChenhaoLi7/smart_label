const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const BOMLine = sequelize.define('BOMLine', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    bom_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'BOM主表ID'
    },
    component_sku: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '原材料SKU'
    },
    qty_per: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 1,
        comment: '单位用量'
    },
    uom: {
        type: DataTypes.STRING(20),
        defaultValue: 'pcs',
        comment: '计量单位'
    },
    scrap_rate: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        comment: '损耗率 (e.g. 0.05 = 5%)'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '备注'
    }
}, {
    tableName: 'bom_lines',
    timestamps: true,
    comment: '配方明细表'
})

module.exports = BOMLine
