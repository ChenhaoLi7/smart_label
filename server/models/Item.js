const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Item = sequelize.define('Item', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sku: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '商品SKU编码'
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: '商品名称'
  },
  description: {
    type: DataTypes.TEXT,
    comment: '商品描述'
  },
  category: {
    type: DataTypes.STRING(100),
    comment: '商品分类'
  },
  uom: {
    type: DataTypes.STRING(20),
    defaultValue: 'pcs',
    comment: '计量单位'
  },
  min_stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '最小库存'
  },
  max_stock: {
    type: DataTypes.INTEGER,
    comment: '最大库存'
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'DISCONTINUED'),
    defaultValue: 'ACTIVE',
    comment: '商品状态'
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
  tableName: 'items',
  timestamps: true,
  comment: '商品信息表'
})

module.exports = Item

