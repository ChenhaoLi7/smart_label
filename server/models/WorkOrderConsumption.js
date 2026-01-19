const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const WorkOrderConsumption = sequelize.define('WorkOrderConsumption', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    wo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: '工单ID'
    },
    lot_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: '使用的原材料批次ID'
    },
    component_sku: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '原材料SKU'
    },
    qty_consumed: {
        type: DataTypes.FLOAT,
        allowNull: false,
        comment: '实际消耗数量'
    },
    bin_code: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '领料库位'
    },
    operator: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '操作人'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '备注'
    }
}, {
    tableName: 'work_order_consumptions',
    timestamps: true,
    comment: '工单投料记录'
})

module.exports = WorkOrderConsumption
