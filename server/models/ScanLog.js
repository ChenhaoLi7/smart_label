const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const ScanLog = sequelize.define('ScanLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  raw_content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '原始扫描内容'
  },
  parsed_type: {
    type: DataTypes.STRING(50),
    comment: '解析后的类型'
  },
  parsed_id: {
    type: DataTypes.STRING(100),
    comment: '解析后的ID'
  },
  parsed_data: {
    type: DataTypes.JSON,
    comment: '解析后的完整数据'
  },
  scan_type: {
    type: DataTypes.ENUM('INBOUND', 'OUTBOUND', 'MOVE', 'COUNT', 'VERIFY'),
    comment: '扫码类型'
  },
  user_id: {
    type: DataTypes.INTEGER,
    comment: '操作用户ID'
  },
  user_name: {
    type: DataTypes.STRING(100),
    comment: '操作用户名称'
  },
  device_id: {
    type: DataTypes.STRING(100),
    comment: '设备ID'
  },
  device_type: {
    type: DataTypes.ENUM('CAMERA', 'SCANNER', 'MANUAL', 'FILE'),
    comment: '设备类型'
  },
  ip_address: {
    type: DataTypes.STRING(45),
    comment: 'IP地址'
  },
  user_agent: {
    type: DataTypes.STRING(500),
    comment: '用户代理'
  },
  success: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '是否成功'
  },
  error_message: {
    type: DataTypes.TEXT,
    comment: '错误信息'
  },
  processing_time: {
    type: DataTypes.INTEGER,
    comment: '处理时间(毫秒)'
  },
  next_action: {
    type: DataTypes.STRING(100),
    comment: '下一步动作'
  },
  business_result: {
    type: DataTypes.JSON,
    comment: '业务处理结果'
  }
}, {
  tableName: 'scan_logs',
  timestamps: true,
  comment: '扫码日志表'
})

module.exports = ScanLog

