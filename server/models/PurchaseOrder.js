// server/models/PurchaseOrder.js
const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const PurchaseOrder = sequelize.define('PurchaseOrder', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  po_number: {
    type: DataTypes.STRING(64),
    unique: true,
    allowNull: false,
    comment: '采购订单号'
  },
  supplier_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: '供应商ID'
  },
  supplier_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '供应商名称'
  },
  order_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    comment: '订单日期'
  },
  expected_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '预期到货日期'
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'SENT', 'CONFIRMED', 'PARTIAL', 'COMPLETED', 'CANCELLED'),
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
  payment_terms: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '付款条件'
  },
  delivery_terms: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '交货条件'
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
  tableName: 'purchase_orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: '采购订单表'
})

module.exports = PurchaseOrder
