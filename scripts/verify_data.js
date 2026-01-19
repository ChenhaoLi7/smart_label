const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const { Item, Inventory, Transaction } = require('../server/models');
const sequelize = require('../server/config/database');

async function verify() {
    try {
        const itemCount = await Item.count();
        const inventoryCount = await Inventory.count();
        const transactionCount = await Transaction.count();

        console.log('--- Database Counts ---');
        console.log(`Items: ${itemCount}`);
        console.log(`Inventory: ${inventoryCount}`);
        console.log(`Transactions: ${transactionCount}`);

        if (itemCount > 10) {
            console.log('✅ Data seems to be populated.');
            const sample = await Inventory.findAll({ limit: 5 });
            console.log('Sample Inventory:', JSON.stringify(sample, null, 2));
        } else {
            console.log('❌ Data missing! Only found initial seeds?');
        }
    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        process.exit();
    }
}

verify();
