const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const BillOfMaterials = sequelize.define('BillOfMaterials', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    parent_sku: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '成品SKU'
    },
    child_sku: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '原材料SKU'
    },
    quantity: {
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
    wastage_rate: {
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
    tableName: 'bill_of_materials',
    timestamps: true,
    comment: '物料清单(BOM)表'
})

module.exports = BillOfMaterials
