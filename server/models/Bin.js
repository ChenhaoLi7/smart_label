const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Bin = sequelize.define('Bin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bin_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '库位编码'
  },
  zone: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '区域'
  },
  aisle: {
    type: DataTypes.STRING(50),
    comment: '通道'
  },
  rack: {
    type: DataTypes.STRING(50),
    comment: '货架'
  },
  level: {
    type: DataTypes.STRING(50),
    comment: '层级'
  },
  position: {
    type: DataTypes.STRING(50),
    comment: '位置'
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '容量'
  },
  used: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: '已使用容量'
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE'),
    defaultValue: 'ACTIVE',
    comment: '库位状态'
  },
  temperature_zone: {
    type: DataTypes.STRING(50),
    comment: '温区'
  },
  hazard_level: {
    type: DataTypes.ENUM('NONE', 'LOW', 'MEDIUM', 'HIGH'),
    defaultValue: 'NONE',
    comment: '危险等级'
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
  tableName: 'bins',
  timestamps: true,
  comment: '库位信息表'
})

module.exports = Bin

