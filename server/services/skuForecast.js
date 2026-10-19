const fs = require('fs')
const path = require('path')
const METHODS = Object.freeze(['mean28', 'seasonal', 'lightgbm'])
const VERSIONS = { mean28: 'mean28-v1', seasonal: 'seasonal-v1', lightgbm: 'lgbm-m5-fixed-v1' }
const problem = message => Object.assign(new Error(message), { statusCode: 400 })
function createForecastService({ catalogPath = path.join(__dirname, '../data/m5/forecast_catalog.json'), metricsPath = path.join(__dirname, '../data/m5/final_metrics.json'), listOfficeItems = async () => [], officeHistory = null } = {}) {
  let catalog, evaluation
  const load = () => { if (!catalog) { catalog = JSON.parse(fs.readFileSync(catalogPath)); evaluation = JSON.parse(fs.readFileSync(metricsPath)) } }
  function metadata() {
    load()
    const first = catalog[Object.keys(catalog)[0]]
    return { sources: ['office', 'm5_public'], default_source: 'office', default_method: 'mean28', methods: METHODS, public_store: 'CA_1', public_skus: Object.keys(catalog).sort(), public_origins: Object.values(first.origins).map(o => o.as_of), evaluation: { metrics: evaluation.metrics, inventory: { skus: evaluation.inventory.skus, test_dates: evaluation.inventory.test_dates } } }
  }
  async function forecast(input = {}) {
    const source = input.source || 'office', method = input.method || 'mean28', horizon = Number(input.horizon ?? 7)
    if (!['office', 'm5_public'].includes(source)) throw problem('Unknown data source')
    if (!METHODS.includes(method) || horizon !== 7) throw problem('Choose a supported method and a seven-day horizon')
    const sku = String(input.sku || '')
    if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(sku)) throw problem('Choose a valid SKU')
    if (source === 'office' && officeHistory) return officeForecast(sku, horizon)
    if (source === 'office') return { available: false, status: 'sales_history_not_connected', source, sku, horizon, daily_forecasts: [], reason: 'Dated, verified sales history is not connected for this office SKU. Scan counts and stock movements are not sales. No public SKU is substituted.', replenishment_available: false }
    load()
    const store = input.store || 'CA_1'
    if (store !== 'CA_1' || !Object.hasOwn(catalog, sku)) return { available: false, status: 'unknown_public_sku', source, sku, store, daily_forecasts: [], reason: 'This SKU/store is not part of the archived public-data experiment.' }
    const item = catalog[sku], snap = Object.values(item.origins).find(o => o.as_of === input.as_of)
    if (!snap) throw problem('Choose one of the archived historical forecast dates')
    const daily = snap.forecasts.map(row => ({ date: row.date, forecast: row[method] }))
    if (daily.length !== 7 || daily.some(r => !Number.isFinite(r.forecast) || r.forecast < 0)) throw new Error('Invalid archived forecast')
    return { available: true, status: 'historical_replay', source, data_source: 'Walmart M5 / CA_1 / historical replay', sku, store, as_of: snap.as_of, horizon: 7, method, method_version: VERSIONS[method], total: daily.reduce((n, r) => n + r.forecast, 0), history: snap.history, daily_forecasts: daily, replenishment_available: false }
  }
  // Office: history of inventory-linked confirmed pickups with explicit daily coverage. No training; no M5 model is applied.
  async function officeForecast(sku, horizon) {
    const h = await officeHistory(sku)
    const base = { source: 'office', sku, horizon, data_source: 'Office shop: inventory-linked confirmed pickups (user-declared)', data_start: h.data_start,
      coverage_layers: h.layers, valid_demand_days: h.valid_demand_days, consecutive_valid_days: h.consecutive_valid_days_to_yesterday,
      unknown_days: h.unknown_days, negative_net_days: h.negative_net_days, required_for_baseline: h.required_for_baseline,
      covered_days: h.covered_days, consecutive_complete_days: h.consecutive_complete_days_to_yesterday, missing_days: h.missing_days_in_range,
      office_history: h.history, replenishment_available: false }
    if (!h.eligible_for_baseline) return { available: false, status: 'insufficient_office_history', ...base, daily_forecasts: [], reason: h.reason || 'No valid demand days for this SKU' }
    const start = new Date(Date.now() + 86400000)
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
    const daily = Array.from({ length: 7 }, (_, i) => ({ date: fmt.format(new Date(start.getTime() + i * 86400000)), forecast: h.baseline.daily_mean }))
    return { available: true, status: 'office_baseline_unvalidated', ...base, as_of: fmt.format(new Date()), method: 'mean28', method_version: 'office-mean28-unvalidated',
      total: daily.reduce((n, r) => n + r.forecast, 0), history: h.history.filter(r => r.valid_demand_day).map(r => ({ date: r.date, sales: r.recorded_net })), daily_forecasts: daily,
      reason: 'Simple 28-day average of complete covered days; not validated for this office' }
  }
  return { metadata, forecast, officeItems: listOfficeItems }
}
module.exports = { createForecastService, METHODS }
