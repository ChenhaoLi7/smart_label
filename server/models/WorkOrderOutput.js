const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const WorkOrderOutput = sequelize.define('WorkOrderOutput', {
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
        comment: '生成的成品批次ID'
    },
    sku: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '成品SKU'
    },
    qty_produced: {
        type: DataTypes.FLOAT,
        allowNull: false,
        comment: '实际产出数量'
    },
    bin_code: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: '入库库位'
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
    tableName: 'work_order_outputs',
    timestamps: true,
    comment: '工单产出记录'
})

module.exports = WorkOrderOutput
