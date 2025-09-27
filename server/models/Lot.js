const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Lot = sequelize.define('Lot', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lot_number: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: '批次号'
  },
  sku: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '商品SKU'
  },
  qty: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '数量'
  },
  uom: {
    type: DataTypes.STRING(20),
    defaultValue: 'pcs',
    comment: '计量单位'
  },
  bin_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '库位ID'
  },
  expiry_date: {
    type: DataTypes.DATE,
    comment: '过期时间'
  },
  manufacture_date: {
    type: DataTypes.DATE,
    comment: '生产日期'
  },
  supplier: {
    type: DataTypes.STRING(200),
    comment: '供应商'
  },
  po_number: {
    type: DataTypes.STRING(100),
    comment: '采购订单号'
  },
  quality_status: {
    type: DataTypes.ENUM('PENDING', 'PASSED', 'FAILED', 'QUARANTINE'),
    defaultValue: 'PENDING',
    comment: '质检状态'
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'EXPIRED', 'CONSUMED', 'DAMAGED'),
    defaultValue: 'ACTIVE',
    comment: '批次状态'
  },
  notes: {
    type: DataTypes.TEXT,
    comment: '备注'
  },
  created_by: {
    type: DataTypes.STRING(100),
    comment: '创建人'
  },
  updated_by: {
    type: DataTypes.STRING(100),
    comment: '更新人'
  }
}, {
  tableName: 'lots',
  timestamps: true,
  comment: '批次库存表'
})

module.exports = Lot

