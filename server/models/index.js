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

// 定义模型关联关系
// 商品相关
Item.hasMany(Lot, { foreignKey: 'sku', sourceKey: 'sku', as: 'lots' })
Lot.belongsTo(Item, { foreignKey: 'sku', targetKey: 'sku', as: 'item' })

// 库位相关
Bin.hasMany(Lot, { foreignKey: 'bin_code', sourceKey: 'bin_code', as: 'lots' })
Lot.belongsTo(Bin, { foreignKey: 'bin_code', targetKey: 'bin_code', as: 'bin' })

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
  syncDatabase
}