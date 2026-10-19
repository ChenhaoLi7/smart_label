// Read-only check for the Shop x LOT/BIN tables. Writes nothing.
// Usage: node scripts/shop_schema_check.js [--db <schema>]   (default: DB_NAME from .env)
// Reports whether the old columns the shop code relies on exist, which shop_* tables exist,
// and how many business rows they hold. The rollback (DROP) is only safe when
// shop_purchases, shop_stock_movements and shop_settlements are all empty.
const path = require('path')
require('dotenv').config({ path: process.env.APP_ENV_FILE || path.join(__dirname, '..', '.env') })
const mysql = require('mysql2/promise')

const REQUIRED = {
  lots: ['id', 'lot_number', 'sku', 'qty', 'bin_id', 'status', 'quality_status', 'expiry_date', 'version'],
  bins: ['id', 'bin_code', 'status'],
  items: ['id', 'sku', 'name', 'price', 'status'],
  transactions: ['transactionType', 'itemCode', 'itemName', 'quantity', 'beforeQuantity', 'afterQuantity', 'operator', 'operatorId', 'location', 'notes', 'transactionTime', 'createdAt', 'updatedAt', 'idempotency_key'],
  users: ['id', 'username', 'role']
}
const SHOP_TABLES = ['shop_settings', 'shop_mode_changes', 'shop_sale_bindings', 'shop_sale_binding_changes', 'shop_settlements', 'shop_purchases', 'shop_purchase_lines', 'shop_return_requests', 'shop_stock_movements']
const BUSINESS = ['shop_purchases', 'shop_stock_movements', 'shop_settlements']

;(async () => {
  const i = process.argv.indexOf('--db')
  const db = i > 0 ? process.argv[i + 1] : process.env.DB_NAME
  const c = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: db })
  const [cols] = await c.query('SELECT TABLE_NAME t, COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?', [db])
  const have = {}
  for (const r of cols) (have[r.t] = have[r.t] || new Set()).add(r.c)
  const missing = {}
  for (const [t, list] of Object.entries(REQUIRED)) {
    const m = list.filter((x) => !(have[t] && have[t].has(x)))
    if (m.length) missing[t] = m
  }
  const shopTables = SHOP_TABLES.filter((t) => have[t])
  const rows = {}
  for (const t of shopTables) rows[t] = Number((await c.query(`SELECT COUNT(*) n FROM \`${t}\``))[0][0].n)
  let mode = null
  if (have.shop_settings) mode = ((await c.query('SELECT mode FROM shop_settings'))[0][0] || {}).mode || 'LEGACY_TAB (no row, default)'
  await c.end()
  const businessRows = BUSINESS.reduce((s, t) => s + (rows[t] || 0), 0)
  console.log(JSON.stringify({
    schema: db,
    old_columns_ok: Object.keys(missing).length === 0,
    missing_old_columns: missing,
    shop_tables_present: shopTables,
    shop_tables_missing: SHOP_TABLES.filter((t) => !have[t]),
    row_counts: rows,
    mode,
    business_rows: businessRows,
    rollback_drop_safe: businessRows === 0
  }, null, 1))
})().catch((e) => { console.error('check failed:', e.code || e.message); process.exit(1) })
