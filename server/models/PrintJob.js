const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const PrintJob = sequelize.define('PrintJob', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  job_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '打印任务号'
  },
  template_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '模板名称'
  },
  template_id: {
    type: DataTypes.INTEGER,
    comment: '模板ID'
  },
  print_type: {
    type: DataTypes.ENUM('LOT', 'BIN', 'ITEM', 'SO', 'PO', 'TASK'),
    allowNull: false,
    comment: '打印类型'
  },
  total_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '总打印数量'
  },
  copies_per_item: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: '每项打印份数'
  },
  format: {
    type: DataTypes.ENUM('PDF', 'PNG', 'ZPL'),
    defaultValue: 'PDF',
    comment: '输出格式'
  },
  dpi: {
    type: DataTypes.INTEGER,
    defaultValue: 300,
    comment: '打印分辨率'
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'),
    defaultValue: 'PENDING',
    comment: '任务状态'
  },
  output_file: {
    type: DataTypes.STRING(500),
    comment: '输出文件路径'
  },
  error_message: {
    type: DataTypes.TEXT,
    comment: '错误信息'
  },
  created_by: {
    type: DataTypes.STRING(100),
    comment: '创建人'
  },
  completed_at: {
    type: DataTypes.DATE,
    comment: '完成时间'
  }
}, {
  tableName: 'print_jobs',
  timestamps: true,
  comment: '打印任务表'
})

module.exports = PrintJob

