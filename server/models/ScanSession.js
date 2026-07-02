const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const ScanSession = sequelize.define('ScanSession', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  session_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'Client-side scan or selection session identifier'
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  user_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  operation_mode: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'SCAN'
  },
  warehouse_zone: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  device_type: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  trigger: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'manual'
  },
  decision_type: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'user_selected'
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  confirmed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  confirmation_time_ms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  selected_item_id: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  selected_candidate_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  candidate_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  top_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  score_margin: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  user_agent: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'scan_sessions',
  timestamps: true,
  indexes: [
    { fields: ['session_key'], unique: true },
    { fields: ['operation_mode'] },
    { fields: ['decision_type'] },
    { fields: ['selected_item_id'] },
    { fields: ['user_id'] },
    { fields: ['confirmed_at'] }
  ],
  comment: '扫码多候选选择会话表，用于后续 rule-based / ML ranking 训练'
})

module.exports = ScanSession
