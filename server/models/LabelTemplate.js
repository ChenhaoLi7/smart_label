const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const LabelTemplate = sequelize.define('LabelTemplate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  template_key: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
    comment: '模板唯一标识'
  },
  name: {
    type: DataTypes.STRING(160),
    allowNull: false,
    comment: '模板名称'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '模板描述'
  },
  template_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'custom',
    comment: '模板分类'
  },
  size_width: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 60,
    comment: '宽度'
  },
  size_height: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 40,
    comment: '高度'
  },
  size_unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'mm',
    comment: '尺寸单位'
  },
  print_types: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '[]',
    comment: '支持的打印类型(JSON)'
  },
  placeholders: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '[]',
    comment: '可用占位符(JSON)'
  },
  canvas_state: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: '设计器画布状态(JSON)'
  },
  preview_image: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: '模板预览图(Base64)'
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '是否为系统默认模板'
  },
  created_by: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '创建人'
  },
  updated_by: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '更新人'
  }
}, {
  tableName: 'label_templates',
  timestamps: true,
  comment: '标签模板表'
})

module.exports = LabelTemplate
