const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const ScanCandidate = sequelize.define('ScanCandidate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  scan_session_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  candidate_key: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  candidate_item_id: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  barcode_value: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  barcode_type: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  parsed_type: {
    type: DataTypes.STRING(40),
    allowNull: true
  },
  bbox_x: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  bbox_y: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  bbox_width: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  bbox_height: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  center_distance: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  center_distance_ratio: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  barcode_area: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  relative_area: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  detected_frames: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  decode_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  scan_stability: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  operation_mode: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'SCAN'
  },
  inventory_quantity: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  inventory_available: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  is_out_of_stock: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  same_location: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  is_fifo_candidate: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  visual_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  scan_stability_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  context_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  feedback_score: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 0
  },
  rule_based_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  initial_rank: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  final_rank: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  is_selected: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  display_title: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  display_subtitle: {
    type: DataTypes.STRING(240),
    allowNull: true
  },
  confidence: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  quality_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  best_preprocessing_mode: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'scan_candidates',
  timestamps: true,
  indexes: [
    { fields: ['scan_session_id'] },
    { fields: ['candidate_key'] },
    { fields: ['candidate_item_id'] },
    { fields: ['parsed_type'] },
    { fields: ['operation_mode'] },
    { fields: ['is_selected'] },
    { fields: ['rule_based_score'] }
  ],
  comment: '扫码候选码特征表，用于 multi-code ranking 和后续 ML 训练'
})

module.exports = ScanCandidate
