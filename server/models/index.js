// server/models/index.js
require('dotenv').config();
const sequelize = require('../config/database');

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

// 同步数据库
const syncDatabase = async () => {
  try {
    await User.sync()
    await Inventory.sync()
    await Transaction.sync()
    await Item.sync()
    await Bin.sync()
    await Lot.sync()
    await PurchaseOrder.sync()
    await PurchaseOrderLine.sync()
    await SalesOrder.sync()
    await SalesOrderLine.sync()
    await PrintJob.sync()
    await ScanLog.sync()
    // await BillOfMaterials.sync() // Deprecated
    await BOMHeader.sync()
    await BOMLine.sync()
    await WorkOrder.sync()
    await WorkOrderConsumption.sync()
    await WorkOrderOutput.sync()

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
  syncDatabase
}