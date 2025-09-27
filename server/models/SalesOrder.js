// server/models/SalesOrder.js
const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const SalesOrder = sequelize.define('SalesOrder', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  so_number: {
    type: DataTypes.STRING(64),
    unique: true,
    allowNull: false,
    comment: '销售订单号'
  },
  customer_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: '客户ID'
  },
  customer_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '客户名称'
  },
  order_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '订单日期'
  },
  ship_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '要求发货日期'
  },
  delivery_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '要求交货日期'
  },
  priority: {
    type: DataTypes.ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT'),
    defaultValue: 'NORMAL',
    comment: '优先级'
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'CONFIRMED', 'PICKING', 'PARTIAL', 'SHIPPED', 'DELIVERED', 'CANCELLED'),
    defaultValue: 'DRAFT',
    comment: '订单状态'
  },
  total_amount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
    comment: '订单总金额'
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'CNY',
    comment: '货币类型'
  },
  payment_method: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '付款方式'
  },
  shipping_address: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '收货地址'
  },
  shipping_method: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '配送方式'
  },
  tracking_number: {
    type: DataTypes.STRING(128),
    allowNull: true,
    comment: '物流单号'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  },
  created_by: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '创建人'
  }
}, {
  tableName: 'sales_orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: '销售订单表'
})

module.exports = SalesOrder
