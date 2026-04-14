// server/models/index.js
require('dotenv').config();
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// 导入模型
const User = require('./User')(sequelize)
const Inventory = require('./Inventory')
const Transaction = require('./Transaction')
const Item = require('./Item')
const Bin = require('./Bin')
const Lot = require('./Lot')
const PurchaseOrder = require('./PurchaseOrder')
const PurchaseOrderLine = require('./PurchaseOrderLine')
const SalesOrder = require('./SalesOrder')
const SalesOrderLine = require('./SalesOrderLine')
const PrintJob = require('./PrintJob')
const ScanLog = require('./ScanLog')
const BOMHeader = require('./BOMHeader')
const BOMLine = require('./BOMLine')
const WorkOrder = require('./WorkOrder')
const WorkOrderConsumption = require('./WorkOrderConsumption')
const WorkOrderOutput = require('./WorkOrderOutput')
const Suggestion = require('./Suggestion')
const LabelTemplate = require('./LabelTemplate')

// 定义模型关联关系
// 商品相关
Item.hasMany(Lot, { foreignKey: 'sku', sourceKey: 'sku', as: 'lots' })
Lot.belongsTo(Item, { foreignKey: 'sku', targetKey: 'sku', as: 'item' })

// 批次 - 库位 (使用 bin_id 主键关联)
Lot.belongsTo(Bin, { foreignKey: 'bin_id', targetKey: 'id', as: 'bin' })
Bin.hasMany(Lot, { foreignKey: 'bin_id', sourceKey: 'id', as: 'lots' })

// 采购订单相关
PurchaseOrder.hasMany(PurchaseOrderLine, { foreignKey: 'po_id', as: 'lines' })
PurchaseOrderLine.belongsTo(PurchaseOrder, { foreignKey: 'po_id', as: 'purchaseOrder' })

PurchaseOrderLine.belongsTo(Item, { foreignKey: 'sku', targetKey: 'sku', as: 'item' })
Item.hasMany(PurchaseOrderLine, { foreignKey: 'sku', sourceKey: 'sku', as: 'purchaseOrderLines' })

// 销售订单相关
SalesOrder.hasMany(SalesOrderLine, { foreignKey: 'so_id', as: 'lines' })
SalesOrderLine.belongsTo(SalesOrder, { foreignKey: 'so_id', as: 'salesOrder' })

SalesOrderLine.belongsTo(Item, { foreignKey: 'sku', targetKey: 'sku', as: 'item' })
Item.hasMany(SalesOrderLine, { foreignKey: 'sku', sourceKey: 'sku', as: 'salesOrderLines' })

// 采购订单相关
PurchaseOrder.hasMany(PurchaseOrderLine, { foreignKey: 'po_id', sourceKey: 'id' })
PurchaseOrderLine.belongsTo(PurchaseOrder, { foreignKey: 'po_id', targetKey: 'id' })

// 销售订单相关
SalesOrder.hasMany(SalesOrderLine, { foreignKey: 'so_id', sourceKey: 'id' })
SalesOrderLine.belongsTo(SalesOrder, { foreignKey: 'so_id', targetKey: 'id' })

// 打印任务相关
PrintJob.hasMany(ScanLog, { foreignKey: 'print_job_id', sourceKey: 'id' })

// 生产制造相关 (BOM)
BOMHeader.hasMany(BOMLine, { foreignKey: 'bom_id', as: 'lines' })
BOMLine.belongsTo(BOMHeader, { foreignKey: 'bom_id', as: 'header' })

// 生产制造相关 (工单)
WorkOrder.hasMany(WorkOrderConsumption, { foreignKey: 'wo_id', as: 'consumptions' })
WorkOrderConsumption.belongsTo(WorkOrder, { foreignKey: 'wo_id', as: 'workOrder' })

WorkOrder.hasMany(WorkOrderOutput, { foreignKey: 'wo_id', as: 'outputs' })
WorkOrderOutput.belongsTo(WorkOrder, { foreignKey: 'wo_id', as: 'workOrder' })

// 用户建议相关
User.hasMany(Suggestion, { foreignKey: 'user_id', sourceKey: 'id', as: 'submittedSuggestions' })
Suggestion.belongsTo(User, { foreignKey: 'user_id', targetKey: 'id', as: 'author' })

// 同步数据库
const ensurePrintJobSchema = async () => {
  const queryInterface = sequelize.getQueryInterface()

  try {
    const table = await queryInterface.describeTable('print_jobs')

    if (!table.request_payload) {
      await queryInterface.addColumn('print_jobs', 'request_payload', {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: '打印请求快照(JSON)'
      })
      console.log('✅ print_jobs.request_payload 字段已补齐')
    }
  } catch (error) {
    console.error('❌ print_jobs 表结构检查失败:', error)
    throw error
  }
}

const ensureItemSchema = async () => {
  const queryInterface = sequelize.getQueryInterface()

  try {
    const table = await queryInterface.describeTable('items')

    if (!table.price) {
      await queryInterface.addColumn('items', 'price', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: '参考单价'
      })
      console.log('✅ items.price 字段已补齐')
    }
  } catch (error) {
    console.error('❌ items 表结构检查失败:', error)
    throw error
  }
}

const ensureLotSchema = async () => {
  const queryInterface = sequelize.getQueryInterface()

  try {
    const table = await queryInterface.describeTable('lots')

    if (!table.version) {
      await queryInterface.addColumn('lots', 'version', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '乐观锁版本号'
      })
      console.log('✅ lots.version 字段已补齐')
    }
  } catch (error) {
    console.error('❌ lots 表结构检查失败:', error)
    throw error
  }
}

const syncDatabase = async () => {
  try {
    await User.sync()
    await Inventory.sync()
    await Transaction.sync()
    await Item.sync()
    await ensureItemSchema()
    await Bin.sync()
    await Lot.sync()
    await ensureLotSchema()
    await PurchaseOrder.sync()
    await PurchaseOrderLine.sync()
    await SalesOrder.sync()
    await SalesOrderLine.sync()
    await PrintJob.sync()
    await ensurePrintJobSchema()
    await ScanLog.sync()
    // await BillOfMaterials.sync() // Deprecated
    await BOMHeader.sync()
    await BOMLine.sync()
    await WorkOrder.sync()
    await WorkOrderConsumption.sync()
    await WorkOrderOutput.sync()
    await Suggestion.sync()
    await LabelTemplate.sync()

    console.log('✅ 数据库模型同步完成')
  } catch (error) {
    console.error('❌ 数据库模型同步失败:', error)
  }
}

module.exports = {
  User,
  Inventory,
  Transaction,
  Item,
  Bin,
  Lot,
  PurchaseOrder,
  PurchaseOrderLine,
  SalesOrder,
  SalesOrderLine,
  PrintJob,
  ScanLog,
  BOMHeader,
  BOMLine,
  WorkOrder,
  WorkOrderConsumption,
  WorkOrderOutput,
  Suggestion,
  LabelTemplate,
  syncDatabase
}
