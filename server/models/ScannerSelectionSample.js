const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const ScannerSelectionSample = sequelize.define('ScannerSelectionSample', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  session_id: {
    type: DataTypes.STRING(80),
    allowNull: false
  },
  trigger: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'manual'
  },
  operation_context: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'scan'
  },
  selected_candidate_id: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  selected_decoded_text: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  candidate_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  decision_type: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'user_selected'
  },
  top_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  score_margin: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  user_name: {
    type: DataTypes.STRING(100),
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
  candidates: {
    type: DataTypes.JSON,
    allowNull: true
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'scanner_selection_samples',
  timestamps: true,
  indexes: [
    { fields: ['session_id'] },
    { fields: ['operation_context'] },
    { fields: ['decision_type'] },
    { fields: ['user_id'] },
    { fields: ['createdAt'] }
  ],
  comment: '多码候选选择样本表，用于后续 LightGBM/Learning-to-Rank 训练'
})

module.exports = ScannerSelectionSample
