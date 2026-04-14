const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Suggestion = sequelize.define('Suggestion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '提交建议的用户ID'
  },
  title: {
    type: DataTypes.STRING(150),
    allowNull: false,
    comment: '建议标题'
  },
  desired_item: {
    type: DataTypes.STRING(150),
    allowNull: false,
    comment: '希望新增的商品或饮料'
  },
  preferred_brand: {
    type: DataTypes.STRING(120),
    allowNull: true,
    comment: '偏好的品牌'
  },
  category: {
    type: DataTypes.ENUM('BEVERAGE', 'SNACK', 'OTHER'),
    allowNull: false,
    defaultValue: 'BEVERAGE',
    comment: '建议分类'
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '补充说明'
  },
  status: {
    type: DataTypes.ENUM('NEW', 'UNDER_REVIEW', 'PLANNED', 'DECLINED'),
    allowNull: false,
    defaultValue: 'NEW',
    comment: '处理状态'
  },
  admin_reply: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '管理员回复'
  },
  resolved_by: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '处理人'
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '处理时间'
  }
}, {
  tableName: 'suggestions',
  timestamps: true,
  comment: '用户建议表'
})

module.exports = Suggestion
