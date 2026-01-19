const { WorkOrder, WorkOrderConsumption, WorkOrderOutput, BOMHeader, BOMLine, Item, Lot, Transaction, Bin } = require('../models')
const sequelize = require('../config/database')
const { Op } = require('sequelize')

// 1. Create Work Order (DRAFT)
const createWorkOrder = async (req, res) => {
    try {
        const { wo_number, sku, qty_planned, bom_id, notes } = req.body

        if (!wo_number || !sku || !qty_planned) {
            return res.status(400).json({ success: false, message: 'Missing required fields: wo_number, sku, qty_planned' })
        }

        // Validate SKU
        const item = await Item.findOne({ where: { sku } })
        if (!item) return res.status(404).json({ success: false, message: 'SKU not found' })

        // Check duplicate WO
        const existingWO = await WorkOrder.findOne({ where: { wo_number } })
        if (existingWO) return res.status(400).json({ success: false, message: 'Work Order number already exists' })

        // Auto-select BOM if not provided (latest active)
        let selectedBomId = bom_id
        if (!selectedBomId) {
            const bom = await BOMHeader.findOne({
                where: { sku, status: 'ACTIVE' },
                order: [['created_at', 'DESC']]
            })
            if (bom) selectedBomId = bom.id
        }

        const newWO = await WorkOrder.create({
            wo_number,
            sku,
            qty_planned,
            qty_completed: 0,
            status: 'DRAFT',
            bom_id: selectedBomId, // Can be null if custom WO
            notes,
            created_by: req.user?.username || 'system'
        })

        res.json({ success: true, data: newWO })

    } catch (error) {
        console.error('Create WO error:', error)
        res.status(500).json({ success: false, message: error.message })
    }
}

// 2. Release Work Order (DRAFT -> RELEASED)
const releaseWorkOrder = async (req, res) => {
    try {
        const { id } = req.params
        const wo = await WorkOrder.findByPk(id)

        if (!wo) return res.status(404).json({ success: false, message: 'Work Order not found' })
        if (wo.status !== 'DRAFT') return res.status(400).json({ success: false, message: `Cannot release WO in ${wo.status} status` })

        await wo.update({ status: 'RELEASED' })
        res.json({ success: true, message: 'Work Order Released', data: wo })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// 3. Start Work Order (RELEASED -> IN_PROGRESS)
const startWorkOrder = async (req, res) => {
    try {
        const { id } = req.params
        const wo = await WorkOrder.findByPk(id)

        if (!wo) return res.status(404).json({ success: false, message: 'Work Order not found' })
        if (wo.status !== 'RELEASED') return res.status(400).json({ success: false, message: `Cannot start WO in ${wo.status} status` })

        await wo.update({
            status: 'IN_PROGRESS',
            start_date: new Date()
        })
        res.json({ success: true, message: 'Work Order Started', data: wo })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// 4. Consume Material (Deduct Lot -> Record Consumption)
const consumeMaterial = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params // wo_id
        const { lot_id, component_sku, qty_consumed, bin_code } = req.body

        // Checking WO Status
        const wo = await WorkOrder.findByPk(id)
        if (!wo) throw new Error('Work Order not found')
        if (wo.status !== 'IN_PROGRESS') throw new Error('Work Order must be IN_PROGRESS to consume materials')

        // Checking Lot Validity
        const lot = await Lot.findByPk(lot_id)
        if (!lot) throw new Error('Lot not found')
        if (lot.sku !== component_sku) throw new Error(`Lot SKU ${lot.sku} does not match requested component ${component_sku}`)
        if (lot.qty < qty_consumed) throw new Error(`Insufficient quantity in lot. Available: ${lot.qty}`)

        // Deduct Inventory
        await lot.update({ qty: lot.qty - qty_consumed }, { transaction })

        // Record Consumption
        const consumption = await WorkOrderConsumption.create({
            wo_id: wo.id,
            lot_id: lot.id,
            component_sku,
            qty_consumed,
            bin_code: bin_code || lot.bin?.bin_code || 'UNKNOWN',
            operator: req.user?.username || 'system',
            created_at: new Date()
        }, { transaction })

        // Record Transaction
        await Transaction.create({
            transactionType: 'out',
            itemCode: component_sku,
            itemName: component_sku, // Could fetch Item name
            quantity: qty_consumed,
            beforeQuantity: lot.qty + qty_consumed,
            afterQuantity: lot.qty,
            operator: req.user?.username || 'system',
            notes: `WO Consumption: ${wo.wo_number}`,
            transactionTime: new Date()
        }, { transaction })

        await transaction.commit()
        res.json({ success: true, message: 'Material consumed', data: consumption })

    } catch (error) {
        await transaction.rollback()
        console.error('Consumption error:', error)
        res.status(500).json({ success: false, message: error.message })
    }
}

// 5. Complete Work Order (Output Finished Good)
const completeWorkOrder = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params // wo_id
        const { qty_produced, bin_code } = req.body

        // Checking WO Status
        const wo = await WorkOrder.findByPk(id)
        if (!wo) throw new Error('Work Order not found')
        if (wo.status !== 'IN_PROGRESS') throw new Error('Work Order must be IN_PROGRESS to complete')

        // Create Finished Good Lot
        const lotNumber = `FG-${wo.wo_number}-${Date.now().toString().slice(-4)}`

        let targetBinId = null
        if (bin_code) {
            const bin = await Bin.findOne({ where: { bin_code } })
            if (bin) targetBinId = bin.id
        }

        const newLot = await Lot.create({
            lot_number: lotNumber,
            sku: wo.sku,
            qty: qty_produced,
            uom: 'pcs', // Should fetch from Item master
            bin_id: targetBinId,
            created_by: req.user?.username || 'system'
        }, { transaction })

        // Record Output
        const output = await WorkOrderOutput.create({
            wo_id: wo.id,
            lot_id: newLot.id,
            sku: wo.sku,
            qty_produced,
            bin_code: bin_code || 'N/A',
            operator: req.user?.username || 'system',
            created_at: new Date()
        }, { transaction })

        // Update WO Status
        const newCompletedQty = wo.qty_completed + qty_produced
        let newStatus = 'IN_PROGRESS'
        if (newCompletedQty >= wo.qty_planned) {
            newStatus = 'COMPLETED'
        }

        await wo.update({
            qty_completed: newCompletedQty,
            status: newStatus,
            end_date: newStatus === 'COMPLETED' ? new Date() : null
        }, { transaction })

        // Record Transaction
        await Transaction.create({
            transactionType: 'in',
            itemCode: wo.sku,
            itemName: wo.sku,
            quantity: qty_produced,
            beforeQuantity: 0, // It's a new lot
            afterQuantity: qty_produced,
            operator: req.user?.username || 'system',
            location: bin_code || 'N/A',
            notes: `WO Output: ${wo.wo_number}`,
            transactionTime: new Date()
        }, { transaction })

        await transaction.commit()
        res.json({ success: true, message: 'Production recorded', data: output })

    } catch (error) {
        await transaction.rollback()
        console.error('Completion error:', error)
        res.status(500).json({ success: false, message: error.message })
    }
}

module.exports = {
    createWorkOrder,
    releaseWorkOrder,
    startWorkOrder,
    consumeMaterial,
    completeWorkOrder
}
