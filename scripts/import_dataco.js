const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const sequelize = require('../server/config/database');
const { Item, Inventory, Transaction, Bin, Lot, syncDatabase } = require('../server/models');

// 配置
const CSV_PATH = path.join(__dirname, '../data/DataCoSupplyChainDataset.csv');
const IMPORT_LIMIT = 5000; // 导入前5000条以保证速度

async function importData() {
    console.log('🚀 开始导入 DataCo 供应链真实数据 (修正版)...');

    try {
        // 确保数据库结构最新
        await syncDatabase();

        // 基础库位确保存在
        const zones = ['A', 'B', 'C', 'D'];
        for (const zone of zones) {
            for (let i = 1; i <= 5; i++) {
                const binCode = `${zone}-${String(i).padStart(2, '0')}-01`;
                await Bin.findOrCreate({
                    where: { bin_code: binCode },
                    defaults: {
                        zone: zone,
                        aisle: String(i),
                        rack: '1',
                        level: '1',
                        position: '01',
                        capacity: 1000,
                        status: 'ACTIVE'
                    }
                });
            }
        }

        const itemsMap = new Map();
        let count = 0;

        const stream = fs.createReadStream(CSV_PATH)
            .pipe(csv.parse({ headers: true }))
            .on('error', error => console.error('读取 CSV 出错:', error))
            .on('data', async row => {
                if (count >= IMPORT_LIMIT) {
                    return;
                }

                stream.pause();

                try {
                    const sku = row['Product Card Id'];
                    const itemName = row['Product Name'];
                    const category = row['Category Name'];
                    const price = parseFloat(row['Product Price']) || 0;
                    const quantity = parseInt(row['Order Item Quantity']) || 1;
                    const orderDateStr = row['order date (DateOrders)'];
                    const orderDate = orderDateStr ? new Date(orderDateStr) : new Date();
                    const orderStatus = row['Order Status'];

                    // 1. 商品
                    if (!itemsMap.has(sku)) {
                        await Item.findOrCreate({
                            where: { sku: sku },
                            defaults: {
                                name: itemName,
                                category: category,
                                status: 'ACTIVE'
                            }
                        });
                        itemsMap.set(sku, true);
                    }

                    // 2. 库存汇总
                    const [inv, created] = await Inventory.findOrCreate({
                        where: { itemCode: sku },
                        defaults: {
                            itemName: itemName,
                            category: category,
                            quantity: 0,
                            price: price,
                            status: 'normal'
                        }
                    });

                    // 3. 交易流水
                    const type = orderStatus === 'COMPLETE' ? 'out' : 'in';
                    const beforeQty = inv.quantity || 0;
                    const afterQty = type === 'in' ? beforeQty + quantity : Math.max(0, beforeQty - quantity);

                    await Transaction.create({
                        transactionType: type,
                        itemCode: sku,
                        itemName: itemName,
                        quantity: quantity,
                        beforeQuantity: beforeQty,
                        afterQuantity: afterQty,
                        transactionTime: orderDate,
                        notes: `DataCo Import: ${orderStatus}`
                    });

                    inv.quantity = afterQty;
                    inv.price = price;
                    inv.status = afterQty < 10 ? 'low_stock' : 'normal';
                    await inv.save();

                    // 4. 批次 (去掉多余字段)
                    if (type === 'in') {
                        const bin = await Bin.findOne({ order: sequelize.random() });
                        if (bin) {
                            await Lot.create({
                                lot_number: `LOT-${Date.now()}-${sku}-${count}`,
                                sku: sku,
                                qty: quantity,
                                bin_id: bin.id,
                                manufacture_date: orderDate,
                                status: 'ACTIVE'
                            });
                        }
                    }

                    count++;
                    if (count % 100 === 0) {
                        console.log(`已处理 ${count} 条记录...`);
                    }

                    if (count >= IMPORT_LIMIT) {
                        console.log('✅ 导入达限');
                        stream.destroy();
                    }
                } catch (err) {
                    // 仅在非流销毁错误时打印
                    if (err.message !== 'stream.destroy is not a function') {
                        console.error('导入行出错:', err.message);
                    }
                } finally {
                    if (!stream.destroyed) stream.resume();
                }
            })
            .on('close', () => {
                console.log(`🌈 数据导入完成！共处理 ${count} 记录。`);
                process.exit(0);
            });
    } catch (error) {
        console.error('重大失败:', error);
        process.exit(1);
    }
}

importData();
