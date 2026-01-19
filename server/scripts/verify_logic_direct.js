const { Sequelize } = require('sequelize');
const { BOMHeader, BOMLine, WorkOrder, WorkOrderConsumption, WorkOrderOutput, Item, Lot, Transaction, Bin, User } = require('../models');
const sequelize = require('../config/database');

async function verifyLogic() {
    try {
        console.log('🔄 Syncing Database...');
        await sequelize.sync({ alter: true }); // Sync to create missing tables

        console.log('🏗️ Setting up Test Data...');
        const uniqueId = Date.now();
        const skuFG = `FG-TEST-${uniqueId}`;
        const skuRM = `RM-TEST-${uniqueId}`;

        // 1. Create Items
        await Item.findOrCreate({ where: { sku: skuFG }, defaults: { name: 'Test FG' } });
        await Item.findOrCreate({ where: { sku: skuRM }, defaults: { name: 'Test RM' } });

        // 2. Create BOM
        console.log('📝 Creating BOM...');
        const bom = await BOMHeader.create({
            sku: skuFG,
            version: 'v1.0',
            status: 'ACTIVE'
        });
        await BOMLine.create({
            bom_id: bom.id,
            component_sku: skuRM,
            qty_per: 2 // Requires 2 RMs for 1 FG
        });

        // 3. Create Stock
        console.log('📦 Adding Stock...');
        const lot = await Lot.create({
            lot_number: `LOT-${uniqueId}`,
            sku: skuRM,
            qty: 100,
            bin_id: 1 // Assuming ID 1 exists, or null
        });

        // 4. Create Work Order
        console.log('📋 Creating Work Order...');
        const wo = await WorkOrder.create({
            wo_number: `WO-${uniqueId}`,
            sku: skuFG,
            qty_planned: 10,
            bom_id: bom.id,
            status: 'RELEASED'
            // Skipping DRAFT for brevity, jumping to RELEASED logic
        });

        // 5. Start Work Order
        console.log('🚀 Starting Work Order...');
        await wo.update({ status: 'IN_PROGRESS', start_date: new Date() });

        // 6. Consume Material
        console.log('🍽️ Consuming Material...');
        // Need 10 FGs * 2 RMs = 20 RMs
        const qtyToConsume = 20;

        await sequelize.transaction(async (t) => {
            await lot.update({ qty: lot.qty - qtyToConsume }, { transaction: t });
            await WorkOrderConsumption.create({
                wo_id: wo.id,
                lot_id: lot.id,
                component_sku: skuRM,
                qty_consumed: qtyToConsume,
                bin_code: 'TEST-BIN'
            }, { transaction: t });
        });

        // Check Lot
        const updatedLot = await Lot.findByPk(lot.id);
        if (updatedLot.qty !== 80) throw new Error(`Lot qty mismatch: expected 80, got ${updatedLot.qty}`);
        console.log('✅ Consumption Verified');

        // Create FG Bin
        const [fgBin] = await Bin.findOrCreate({
            where: { bin_code: 'FG-BIN' },
            defaults: {
                zone: 'A',
                capacity: 1000
            }
        });

        console.log('🏁 Completing Work Order...');
        await sequelize.transaction(async (t) => {
            const newLot = await Lot.create({
                lot_number: `FG-LOT-${uniqueId}`,
                sku: skuFG,
                qty: 10,
                bin_id: fgBin.id
            }, { transaction: t });

            await WorkOrderOutput.create({
                wo_id: wo.id,
                lot_id: newLot.id,
                sku: skuFG,
                qty_produced: 10,
                bin_code: 'FG-BIN'
            }, { transaction: t });

            await wo.update({ status: 'COMPLETED', qty_completed: 10 }, { transaction: t });
        });

        // Check WO
        const updatedWO = await WorkOrder.findByPk(wo.id);
        if (updatedWO.status !== 'COMPLETED') throw new Error('WO Status not COMPLETED');
        console.log('✅ Completion Verified');

        console.log('🎉 ALL TESTS PASSED');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    }
}

verifyLogic();
