const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  transactionType: {
    type: DataTypes.ENUM('in', 'out'),
    allowNull: false,
    comment: '交易类型：入库/出库'
  },
  itemCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '商品编码'
  },
  itemName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '商品名称'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '交易数量'
  },
  beforeQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '交易前库存'
  },
  afterQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '交易后库存'
  },
  operator: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '操作员'
  },
  operatorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '操作员ID'
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '库位'
  },
  supplier: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '供应商'
  },
  customer: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '客户'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '备注'
  },
  scanCode: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '扫描码'
  },
  transactionTime: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '交易时间'
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  indexes: [
    {
      fields: ['itemCode']
    },
    {
      fields: ['transactionType']
    },
    {
      fields: ['transactionTime']
    },
    {
      fields: ['operatorId']
    }
  ]
});

module.exports = Transaction;
