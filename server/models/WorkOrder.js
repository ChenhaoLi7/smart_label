const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const WorkOrder = sequelize.define('WorkOrder', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    wo_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: '工单号'
    },
    sku: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '生产成品SKU'
    },
    qty_planned: {
        type: DataTypes.FLOAT,
        allowNull: false,
        comment: '计划数量'
    },
    qty_completed: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        comment: '已完成数量'
    },
    status: {
        type: DataTypes.ENUM('DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
        defaultValue: 'DRAFT',
        comment: '工单状态'
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '实际开始时间'
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '实际结束时间'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '备注'
    }
}, {
    tableName: 'work_orders',
    timestamps: true,
    comment: '生产工单主表'
})

module.exports = WorkOrder
