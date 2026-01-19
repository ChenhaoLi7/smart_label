const { BillOfMaterials, Item, Lot, Transaction, Bin } = require('../models')
const sequelize = require('../config/database')

// 创建/更新BOM
const createBOM = async (req, res) => {
    try {
        const { parent_sku, items } = req.body

        // items example: [{ child_sku: 'B', quantity: 2, wastage_rate: 0.1 }]

        if (!parent_sku || !items || !Array.isArray(items)) {
            return res.status(400).json({ success: false, message: 'Invalid parameters' })
        }

        // 简单起见，先删除旧的再重新创建
        await BillOfMaterials.destroy({ where: { parent_sku } })

        const bomItems = items.map(item => ({
            parent_sku,
            child_sku: item.child_sku,
            quantity: item.quantity,
            wastage_rate: item.wastage_rate || 0,
            uom: item.uom || 'pcs'
        }))

        await BillOfMaterials.bulkCreate(bomItems)

        res.json({ success: true, message: 'BOM created/updated successfully' })
    } catch (error) {
        console.error('Create BOM error:', error)
        res.status(500).json({ success: false, message: error.message })
    }
}

// 获取BOM
const getBOM = async (req, res) => {
    try {
        const { sku } = req.params
        const bom = await BillOfMaterials.findAll({ where: { parent_sku: sku } })
        res.json({ success: true, data: bom })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// 生产成品
const produceItem = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { sku, qty, bin_code } = req.body
        if (!sku || !qty) throw new Error('Missing sku or qty')

        // 1. 获取BOM
        const bom = await BillOfMaterials.findAll({ where: { parent_sku: sku } })
        if (!bom || bom.length === 0) throw new Error(`No BOM found for ${sku}`)

        const userId = req.user?.id || 'system'
        const consumedMaterials = []

        // 2. 扣减原材料
        for (const item of bom) {
            // 计算所需数量（含损耗）
            const requiredQty = qty * item.quantity * (1 + item.wastage_rate)

            // 查找原材料库存 (简单版：按 expiry 排序，先出旧货)
            // 注意：这里需要更复杂的库存分配逻辑，为简化演示，我们假设直接扣减总库存
            // 实际生产环境下应该遍历 Lot 表进行扣减

            // step 2a: 查找所有可用批次
            const lots = await Lot.findAll({
                where: { sku: item.child_sku },
                order: [['expiry_date', 'ASC'], ['created_at', 'ASC']],
                transaction
            })

            let remainingToDeduct = requiredQty

            for (const lot of lots) {
                if (remainingToDeduct <= 0) break;

                const deduct = Math.min(lot.qty, remainingToDeduct)

                if (deduct > 0) {
                    await lot.update({ qty: lot.qty - deduct }, { transaction })
                    remainingToDeduct -= deduct

                    // 记录原材料出库交易
                    await Transaction.create({
                        transactionType: 'out',
                        itemCode: item.child_sku,
                        itemName: item.child_sku, // Should lookup name
                        quantity: deduct,
                        beforeQuantity: lot.qty + deduct,
                        afterQuantity: lot.qty,
                        operator: req.user?.username || 'system',
                        operatorId: userId,
                        notes: `Used for producing ${qty} ${sku}`,
                        transactionTime: new Date()
                    }, { transaction })
                }
            }

            if (remainingToDeduct > 0.001) { // Float tolerance
                throw new Error(`Insufficient stock for raw material: ${item.child_sku}`)
            }
        }

        // 3. 增加成品库存
        // 创建新批次
        const lotNumber = `PROD-${Date.now()}`

        // 查找目标库位 (如果没有指定，找个默认或者新建)
        let targetBinId = null;
        if (bin_code) {
            const bin = await Bin.findOne({ where: { bin_code } })
            if (bin) targetBinId = bin.id
        }

        const newLot = await Lot.create({
            lot_number: lotNumber,
            sku: sku,
            qty: qty,
            uom: 'pcs', // Should lookup item uom
            bin_id: targetBinId,
            created_by: userId
        }, { transaction })

        // 记录成品入库交易
        await Transaction.create({
            transactionType: 'in',
            itemCode: sku,
            itemName: sku,
            quantity: qty,
            beforeQuantity: 0,
            afterQuantity: qty,
            operator: req.user?.username || 'system',
            operatorId: userId,
            location: bin_code || 'N/A',
            notes: 'Production Output',
            transactionTime: new Date()
        }, { transaction })

        await transaction.commit();

        res.json({
            success: true,
            message: 'Production successful',
            data: {
                lot: newLot,
                consumed: bom.length
            }
        })

    } catch (error) {
        await transaction.rollback();
        console.error('Production error:', error)
        res.status(500).json({ success: false, message: error.message })
    }
}

module.exports = {
    createBOM,
    getBOM,
    produceItem
}
