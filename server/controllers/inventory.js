const { Inventory, Transaction } = require('../models');
const { Op } = require('sequelize');

// 获取所有库存
exports.getAllInventory = async (req, res) => {
  try {
    const inventory = await Inventory.findAll({
      order: [['lastUpdated', 'DESC']]
    });
    res.json(inventory);
  } catch (error) {
    console.error('获取库存失败:', error);
    res.status(500).json({ message: '获取库存失败' });
  }
};

// 根据商品编码获取库存
exports.getInventoryByCode = async (req, res) => {
  try {
    const { itemCode } = req.params;
    const inventory = await Inventory.findOne({
      where: { itemCode }
    });
    
    if (!inventory) {
      return res.status(404).json({ message: '商品不存在' });
    }
    
    res.json(inventory);
  } catch (error) {
    console.error('获取商品库存失败:', error);
    res.status(500).json({ message: '获取商品库存失败' });
  }
};

// 扫码入库
exports.scanIn = async (req, res) => {
  try {
    const { 
      itemCode, 
      itemName, 
      quantity, 
      category = '未分类',
      location,
      supplier,
      operator,
      operatorId,
      scanCode,
      notes 
    } = req.body;

    if (!itemCode || !itemName || !quantity) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    // 查找或创建库存记录
    let [inventory, created] = await Inventory.findOrCreate({
      where: { itemCode },
      defaults: {
        itemName,
        category,
        quantity: 0,
        minQuantity: 10,
        maxQuantity: 1000,
        unit: '个',
        price: 0.00,
        location: location || '默认库位',
        supplier: supplier || '未知供应商',
        leadTime: 7,
        status: 'normal',
        tags: {},
        demandHistory: [],
        aiPredictions: {}
      }
    });

    if (!created) {
      // 更新现有库存
      const beforeQuantity = inventory.quantity;
      const afterQuantity = beforeQuantity + parseInt(quantity);
      
      // 更新库存状态
      let status = 'normal';
      if (afterQuantity <= inventory.minQuantity) {
        status = 'low_stock';
      } else if (afterQuantity >= inventory.maxQuantity) {
        status = 'overstock';
      }

      await inventory.update({
        quantity: afterQuantity,
        status,
        lastUpdated: new Date()
      });

      // 记录交易
      await Transaction.create({
        transactionType: 'in',
        itemCode,
        itemName,
        quantity: parseInt(quantity),
        beforeQuantity,
        afterQuantity,
        operator,
        operatorId,
        location: inventory.location,
        supplier,
        notes,
        scanCode,
        transactionTime: new Date()
      });

      res.json({
        message: '入库成功',
        inventory: {
          itemCode,
          itemName,
          beforeQuantity,
          afterQuantity,
          status
        }
      });
    } else {
      // 新商品首次入库
      await inventory.update({
        quantity: parseInt(quantity),
        status: 'normal',
        lastUpdated: new Date()
      });

      // 记录交易
      await Transaction.create({
        transactionType: 'in',
        itemCode,
        itemName,
        quantity: parseInt(quantity),
        beforeQuantity: 0,
        afterQuantity: parseInt(quantity),
        operator,
        operatorId,
        location: inventory.location,
        supplier,
        notes,
        scanCode,
        transactionTime: new Date()
      });

      res.json({
        message: '新商品入库成功',
        inventory: {
          itemCode,
          itemName,
          quantity: parseInt(quantity),
          status: 'normal'
        }
      });
    }
  } catch (error) {
    console.error('入库失败:', error);
    res.status(500).json({ message: '入库失败' });
  }
};

// 扫码出库
exports.scanOut = async (req, res) => {
  try {
    const { 
      itemCode, 
      quantity, 
      operator,
      operatorId,
      customer,
      location,
      scanCode,
      notes 
    } = req.body;

    if (!itemCode || !quantity) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    // 查找库存记录
    const inventory = await Inventory.findOne({
      where: { itemCode }
    });

    if (!inventory) {
      return res.status(404).json({ message: '商品不存在' });
    }

    const outQuantity = parseInt(quantity);
    const beforeQuantity = inventory.quantity;

    if (outQuantity > beforeQuantity) {
      return res.status(400).json({ 
        message: '出库数量超过库存数量',
        currentStock: beforeQuantity,
        requestQuantity: outQuantity
      });
    }

    const afterQuantity = beforeQuantity - outQuantity;
    
    // 更新库存状态
    let status = 'normal';
    if (afterQuantity <= inventory.minQuantity) {
      status = 'low_stock';
    } else if (afterQuantity === 0) {
      status = 'out_of_stock';
    }

    await inventory.update({
      quantity: afterQuantity,
      status,
      lastUpdated: new Date()
    });

    // 记录交易
    await Transaction.create({
      transactionType: 'out',
      itemCode,
      itemName: inventory.itemName,
      quantity: outQuantity,
      beforeQuantity,
      afterQuantity,
      operator,
      operatorId,
      location: location || inventory.location,
      customer,
      notes,
      scanCode,
      transactionTime: new Date()
    });

    res.json({
      message: '出库成功',
      inventory: {
        itemCode,
        itemName: inventory.itemName,
        beforeQuantity,
        afterQuantity,
        status
      }
    });

  } catch (error) {
    console.error('出库失败:', error);
    res.status(500).json({ message: '出库失败' });
  }
};

// 获取交易历史
exports.getTransactionHistory = async (req, res) => {
  try {
    const { itemCode, type, limit = 100 } = req.query;
    
    const where = {};
    if (itemCode) where.itemCode = itemCode;
    if (type) where.transactionType = type;

    const transactions = await Transaction.findAll({
      where,
      order: [['transactionTime', 'DESC']],
      limit: parseInt(limit)
    });

    res.json(transactions);
  } catch (error) {
    console.error('获取交易历史失败:', error);
    res.status(500).json({ message: '获取交易历史失败' });
  }
};

// 更新库存信息
exports.updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const inventory = await Inventory.findByPk(id);
    if (!inventory) {
      return res.status(404).json({ message: '库存记录不存在' });
    }

    await inventory.update(updateData);
    res.json({ message: '更新成功', inventory });
  } catch (error) {
    console.error('更新库存失败:', error);
    res.status(500).json({ message: '更新库存失败' });
  }
};

// 删除库存记录
exports.deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;
    
    const inventory = await Inventory.findByPk(id);
    if (!inventory) {
      return res.status(404).json({ message: '库存记录不存在' });
    }

    await inventory.destroy();
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除库存失败:', error);
    res.status(500).json({ message: '删除库存失败' });
  }
};
