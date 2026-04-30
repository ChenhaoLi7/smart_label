const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const ScannerBenchmark = sequelize.define('ScannerBenchmark', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  session_id: {
    type: DataTypes.STRING(80),
    allowNull: false,
    unique: true
  },
  mode: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'camera'
  },
  status: {
    type: DataTypes.STRING(40),
    allowNull: false
  },
  label_type: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'UNKNOWN'
  },
  raw_content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  raw_length: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  device_id: {
    type: DataTypes.STRING(160),
    allowNull: true
  },
  device_label: {
    type: DataTypes.STRING(240),
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
  started_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lock_ms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  first_frame_ms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  decode_attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  frame_samples: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  avg_frame_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  best_frame_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  worst_frame_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  avg_brightness: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  low_light_frames: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  blurry_frames: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  decode_path: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  decoded_format: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  decode_engine: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  fill_ratio: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  scenario_tags: {
    type: DataTypes.JSON,
    allowNull: true
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'scanner_benchmarks',
  timestamps: true,
  indexes: [
    { fields: ['mode'] },
    { fields: ['status'] },
    { fields: ['label_type'] },
    { fields: ['completed_at'] },
    { fields: ['user_id'] }
  ]
})

module.exports = ScannerBenchmark
