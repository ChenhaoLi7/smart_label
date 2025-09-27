// server/models/PurchaseOrderLine.js
const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const PurchaseOrderLine = sequelize.define('PurchaseOrderLine', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  po_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'purchase_orders',
      key: 'id'
    },
    comment: '采购订单ID'
  },
  line_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '行号'
  },
  sku: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: '商品SKU'
  },
  item_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '商品名称'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '商品描述'
  },
  qty: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: false,
    defaultValue: 0,
    comment: '订购数量'
  },
  received_qty: {
    type: DataTypes.DECIMAL(18, 4),
    defaultValue: 0,
    comment: '已收货数量'
  },
  uom: {
    type: DataTypes.STRING(16),
    defaultValue: 'pcs',
    comment: '计量单位'
  },
  unit_price: {
    type: DataTypes.DECIMAL(15, 4),
    defaultValue: 0,
    comment: '单价'
  },
  line_amount: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0,
    comment: '行金额'
  },
  tax_rate: {
    type: DataTypes.DECIMAL(5, 4),
    defaultValue: 0,
    comment: '税率'
  },
  delivery_date: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '要求交货日期'
  },
  status: {
    type: DataTypes.ENUM('OPEN', 'PARTIAL', 'CLOSED', 'CANCELLED'),
    defaultValue: 'OPEN',
    comment: '行状态'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '行备注'
  }
}, {
  tableName: 'purchase_order_lines',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['po_id']
    },
    {
      fields: ['sku']
    },
    {
      fields: ['status']
    }
  ],
  comment: '采购订单行表'
})

module.exports = PurchaseOrderLine
