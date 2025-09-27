const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const SalesOrderLine = sequelize.define('SalesOrderLine', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  so_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: '销售订单ID'
  },
  so_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '销售订单号'
  },
  sku: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '商品SKU'
  },
  item_name: {
    type: DataTypes.STRING(200),
    comment: '商品名称'
  },
  qty: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '销售数量'
  },
  picked_qty: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已拣选数量'
  },
  shipped_qty: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已发货数量'
  },
  uom: {
    type: DataTypes.STRING(20),
    defaultValue: 'pcs',
    comment: '计量单位'
  },
  unit_price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '单价'
  },
  line_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    comment: '行金额'
  },
  status: {
    type: DataTypes.ENUM('OPEN', 'PARTIAL', 'COMPLETED'),
    defaultValue: 'OPEN',
    comment: '行状态'
  },
  notes: {
    type: DataTypes.TEXT,
    comment: '备注'
  }
}, {
  tableName: 'sales_order_lines',
  timestamps: true,
  comment: '销售订单行表'
})

module.exports = SalesOrderLine

