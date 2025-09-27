const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  itemCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '商品编码'
  },
  itemName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '商品名称'
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '商品分类'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '当前库存数量'
  },
  minQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
    comment: '最小库存数量'
  },
  maxQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1000,
    comment: '最大库存数量'
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '个',
    comment: '单位'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
    comment: '单价'
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '库位信息'
  },
  supplier: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '供应商'
  },
  leadTime: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 7,
    comment: '交货期（天）'
  },
  status: {
    type: DataTypes.ENUM('normal', 'low_stock', 'out_of_stock', 'overstock'),
    allowNull: false,
    defaultValue: 'normal',
    comment: '库存状态'
  },
  lastUpdated: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '最后更新时间'
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '动态标签信息'
  },
  demandHistory: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '需求历史数据'
  },
  aiPredictions: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'AI预测结果'
  }
}, {
  tableName: 'inventory',
  timestamps: true,
  indexes: [
    {
      fields: ['itemCode']
    },
    {
      fields: ['category']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = Inventory;
