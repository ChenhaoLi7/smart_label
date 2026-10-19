<template>
  <main class="forecast-page"><div class="forecast-inner">
    <header><div><button class="back" @click="router.push('/dashboard')">← Dashboard</button><p class="eyebrow">Inventory planning</p><h1>SKU sales forecast</h1><p>Review a seven-day outlook and the sales history behind it.</p></div><span class="version">Read-only</span></header>
    <div class="source-tabs" role="group" aria-label="Forecast data source">
      <button :disabled="initializing" :class="{active:source === 'office'}" @click="changeSource('office')">Office products</button>
      <button :disabled="initializing" :class="{active:source === 'm5_public'}" @click="changeSource('m5_public')">Public-data example</button>
    </div>
    <p v-if="source === 'm5_public'" class="notice" data-testid="replay-notice"><strong>Historical replay, not a live forecast.</strong> Walmart M5 · CA_1 · forecasts archived for April–May 2016 public products. Not office sales.</p>
    <section class="panel controls">
      <label>Product<select v-model="sku" @change="query"><option v-if="!skuOptions.length" value="">No products available</option><option v-for="item in skuOptions" :key="item.sku" :value="item.sku">{{ item.name ? `${item.name} · ${item.sku}` : item.sku }}</option></select></label>
      <label v-if="source === 'm5_public'">Forecast as of<select v-model="asOf" @change="query"><option v-for="date in metadata.public_origins" :key="date">{{ date }}</option></select></label>
      <label v-if="source === 'm5_public'">Method<select v-model="method" @change="query"><option value="mean28">28-day moving average</option><option value="seasonal">Same weekday last week</option><option value="lightgbm">Fixed LightGBM</option></select></label>
      <button class="primary" :disabled="busy || !sku" @click="query">{{ busy ? 'Loading…' : 'Refresh forecast' }}</button>
    </section>
    <p v-if="initializing" class="panel loading" role="status" data-testid="forecast-loading">Loading forecast data…</p>
    <p v-if="metadataError" class="error" role="alert" data-testid="metadata-error">Forecast data could not be loaded: {{ metadataError }}. Nothing is shown until this loads.</p>
    <p v-if="source === 'office' && officeError" class="error" role="alert" data-testid="office-error">Office products could not be loaded: {{ officeError }}. This is a loading failure, not a lack of sales.</p>
    <p v-if="error" class="error" role="alert" data-testid="forecast-error">Forecast request failed: {{ error }}. This is not the same as having no sales.</p>
    <section v-if="!busy && !initializing && source === 'office' && forecast && forecast.available === false && forecast.status !== 'insufficient_office_history'" class="panel empty" role="status" data-testid="office-unavailable">
      <div class="empty-icon">↗</div><h2>Not forecastable: no sales history for {{ forecast.sku }}</h2><p>A dated, verified sales series is needed for {{ forecast.sku }}. Scan activity and stock-in / stock-out counts are not treated as sales.</p><p>Use the public-data example to explore the forecasting feature. No public forecast is assigned to an office product.</p>
    </section>
    <section v-if="!busy && !initializing && source === 'office' && forecast && (forecast.status === 'insufficient_office_history' || forecast.status === 'office_baseline_unvalidated')" class="panel" role="status" data-testid="office-history">
      <h2>Office pickup history · {{ forecast.sku }}</h2>
      <p>Source: stock-linked pickups confirmed in the office shop (user-declared, not automatically verified). Three things are kept apart: whether the shop was recording, whether this SKU was on sale, and what was actually recorded. Unknown days stay empty, never zero.</p>
      <div class="office-facts" data-testid="office-layers">
        <div><span>Shop linked all day</span><strong>{{ layer('shop_linked_all_day') }}</strong></div>
        <div><span>This SKU bound all day</span><strong>{{ layer('sku_bound_all_day') }}</strong></div>
        <div><span>Days with recorded pickups</span><strong>{{ layer('with_recorded_pickups') }}</strong></div>
        <div><span>Valid demand days</span><strong>{{ forecast.valid_demand_days ?? 0 }} / 28</strong></div>
      </div>
      <p v-if="layer('stockout_observed')" class="footnote">Stock-out seen on {{ layer('stockout_observed') }} day(s): supply was limited, so those days do not show demand.</p>
      <p v-if="forecast.status === 'insufficient_office_history'" class="notice">No office forecast: {{ forecast.reason }} No model is applied and no public data is substituted.</p>
      <p v-else class="notice">Baseline only: simple 28-day average of valid demand days ({{ forecast.daily_forecasts[0] ? number(forecast.daily_forecasts[0].forecast) : '—' }} per day). Not validated for this office and not a trained model.</p>
      <p class="footnote">{{ forecast.required_for_baseline }}</p>
      <table v-if="(forecast.office_history || []).length"><thead><tr><th>Date</th><th>Shop linked</th><th>SKU on sale</th><th>Confirmed</th><th>Returned</th><th>Net</th></tr></thead>
        <tbody><tr v-for="r in forecast.office_history.slice(-14).reverse()" :key="r.date"><td>{{ r.date }}</td><td>{{ r.shop_linked_all_day ? 'yes' : 'no' }}</td><td>{{ r.sku_bound_all_day ? (r.stockout_observed ? 'stock-out' : 'bound') : 'no' }}</td><template v-if="r.recorded_net !== null"><td>{{ r.recorded_confirmed }}</td><td>{{ r.recorded_returned }}</td><td>{{ r.recorded_net }}</td></template><td v-else colspan="3">unknown (not recorded)</td></tr></tbody></table>
      <p v-else>No full day of office history for this SKU yet.</p>
    </section>
    <section v-if="!busy && !initializing && source === 'office' && !officeError && !metadataError && !officeItems.length" class="panel empty" role="status" data-testid="office-empty">
      <h2>No office products found</h2><p>The product list loaded but is empty, so there is nothing to forecast.</p>
    </section>
    <template v-if="forecast?.available && !busy && forecast.status !== 'office_baseline_unvalidated'">
      <section class="summary"><article class="panel"><span>{{ forecast.status === 'historical_replay' ? 'Seven-day total (historical replay)' : 'Seven-day total' }}</span><strong>{{ number(forecast.total) }} <small>units</small></strong><p>About {{ number(forecast.total / 7) }} units per day · expected sales, not a guaranteed quantity</p></article><article class="panel"><span>Forecast made as of</span><strong class="date">{{ forecast.as_of }}</strong><p>Covers {{ forecast.daily_forecasts[0].date }} to {{ forecast.daily_forecasts[6].date }} · {{ methodLabel }} · {{ forecast.method_version }}</p></article></section>
      <section class="panel"><div class="chart-heading"><h2>Daily sales and seven-day forecast</h2><div class="legend"><span class="key past"><i></i>Past daily sales</span><span class="key future"><i></i>Forecast</span></div></div>
        <svg class="chart" viewBox="0 0 900 300" role="img" :aria-label="`Sales history and seven-day ${methodLabel} forecast for ${sku}`">
          <text x="45" y="11" fill="#667982" font-size="12">Units per day</text>
          <g v-for="line in chart.grid" :key="line.y"><line x1="45" :y1="line.y" x2="875" :y2="line.y" stroke="#e6edef"/><text x="36" :y="line.y+4" text-anchor="end" fill="#667982" font-size="12">{{ line.value }}</text></g>
          <rect :x="chart.boundary" y="18" :width="875-chart.boundary" height="240" fill="#eaf6f0"/><text :x="chart.boundary+10" y="34" fill="#267c5f" font-size="12">Forecast period</text>
          <line :x1="chart.boundary" y1="18" :x2="chart.boundary" y2="258" stroke="#9cc9b6" stroke-dasharray="4 4"/>
          <polyline :points="chart.history" fill="none" stroke="#347aa1" stroke-width="2" stroke-linejoin="round"/>
          <polyline :points="chart.future" fill="none" stroke="#218564" stroke-width="2.5" stroke-dasharray="7 5"/>
          <circle v-for="p in chart.futurePoints" :key="p.x" :cx="p.x" :cy="p.y" r="3.5" fill="#218564"/>
          <g v-for="t in chart.ticks" :key="t.x"><line :x1="t.x" y1="258" :x2="t.x" y2="263" stroke="#b8c7cc"/><text :x="t.x" y="280" :text-anchor="t.anchor" fill="#667982" font-size="12">{{ t.label }}</text></g>
        </svg>
        <table><thead><tr><th>Date</th><th>Expected units</th></tr></thead><tbody><tr v-for="row in forecast.daily_forecasts" :key="row.date"><td>{{ row.date }}</td><td>{{ number(row.forecast) }}</td></tr></tbody></table>
      </section>
      <section class="panel"><h2>What the public-data comparison showed</h2><p>Daily errors were similar. The moving-average baseline performed slightly better on seven-day totals.</p><table><thead><tr><th>Method</th><th>Daily MAE ↓</th><th>Seven-day total MAE ↓</th></tr></thead><tbody><tr v-for="name in ['seasonal','mean28','lightgbm']" :key="name"><td>{{ labels[name] }}</td><td>{{ number(metadata.evaluation.metrics[name].mae,3) }}</td><td>{{ number(metadata.evaluation.metrics[name].seven_day_total_mae,3) }}</td></tr></tbody></table><p class="footnote">100 Walmart SKUs · 28 historical holdout days. Lower error is better. The moving average was chosen before this comparison as the default. This does not establish performance for office products.</p></section>
    </template>
    <footer>No orders, inventory changes or automatic replenishment are submitted by this page.</footer>
  </div></main>
</template>
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter(), source = ref('office'), sku = ref(''), asOf = ref(''), method = ref('mean28'), busy = ref(false), error = ref(''), forecast = ref(null)
const layer = (k) => forecast.value?.coverage_layers?.[k] ?? 0
const metadata = ref({ public_origins:[], public_skus:[], evaluation:{metrics:{}} }), officeItems = ref([]), officeError = ref(''), metadataError = ref('')
const initializing = ref(true)
const labels = { mean28:'28-day moving average', seasonal:'Same weekday last week', lightgbm:'Fixed LightGBM' }
const methodLabel = computed(() => labels[method.value])
const skuOptions = computed(() => source.value === 'office' ? officeItems.value : metadata.value.public_skus.map(s => ({sku:s})))
const number = (n,d=2) => Number(n).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d})
let generation = 0, controller = null
async function api(path, signal) { const response = await fetch(`/api/sku-forecast${path}`,{headers:{Authorization:`Bearer ${localStorage.getItem('token')}`},cache:'no-store',signal}); const result = await response.json().catch(() => null); if (!response.ok || !result?.success) throw new Error(result?.message || `HTTP ${response.status}`); return result }
async function query() {
  const id = ++generation
  controller?.abort(); controller = new AbortController(); forecast.value = null; error.value = ''
  if (!sku.value) { busy.value=false; return }
  busy.value = true
  const params = new URLSearchParams({source:source.value,sku:sku.value,method:method.value,horizon:'7',as_of:asOf.value,store:'CA_1'})
  try { const result = await api(`?${params}`,controller.signal); if (id === generation) forecast.value=result } catch(e) { if (id === generation && e.name !== 'AbortError') error.value=e.message } finally { if (id === generation) busy.value=false }
}
async function changeSource(next) { if (next === source.value) return; source.value=next;sku.value=skuOptions.value[0]?.sku || ''; await query() }
// Round axis step to 1/2/2.5/5 x 10^k so unit counts read as whole numbers.
function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p }
const chart = computed(() => {
  if (!forecast.value?.available) return {grid:[],history:'',future:'',futurePoints:[],ticks:[],boundary:700}
  const history = forecast.value.history, future = forecast.value.daily_forecasts
  const values = [...history.map(r=>r.sales),...future.map(r=>r.forecast)], dates = [...history.map(r=>r.date),...future.map(r=>r.date)]
  const peak = Math.max(1,...values), step = niceStep(peak/4), top = Math.ceil(peak*1.05/step)*step
  const x = i => 45+i*830/(values.length-1), y = n => 258-n*240/top
  const grid = Array.from({length:Math.round(top/step)+1},(_,k)=>({y:y(k*step),value:String(+(k*step).toFixed(2))}))
  // Weekly date labels counted back from the forecast date, plus both ends when not crowded.
  const last = values.length-1, marks = new Set([0,last])
  for (let i = history.length-1; i >= 0; i -= 7) marks.add(i)
  const idx = [...marks].sort((a,b)=>a-b).filter((i,k,a)=>k===0||i===last||i-a[k-1]>=4&&last-i>=4)
  const ticks = idx.map(i=>({x:x(i),label:i===0?dates[i]:dates[i].slice(5),anchor:i===0?'start':i===last?'end':'middle'}))
  const futurePoints = future.map((r,i)=>({x:x(history.length+i),y:y(r.forecast)}))
  return {history:history.map((r,i)=>`${x(i)},${y(r.sales)}`).join(' '),future:futurePoints.map(p=>`${p.x},${p.y}`).join(' '),futurePoints,ticks,grid,boundary:(x(history.length-1)+x(history.length))/2}
})
// Load errors are kept in their own fields so a later query() cannot clear them.
onMounted(async()=>{
  try{metadata.value=await api('/metadata');asOf.value=metadata.value.public_origins[0]||''}catch(e){metadataError.value=e.message;initializing.value=false;return}
  try{officeItems.value=(await api('/office-items')).items}catch(e){officeError.value=e.message}
  sku.value=officeItems.value[0]?.sku||''
  initializing.value=false
  await query()
})
onBeforeUnmount(()=>{generation++;controller?.abort()})
</script>
<style scoped>
.forecast-page{min-height:100vh;background:#f5f8fa;color:#163c46;font-family:Arial,sans-serif;text-align:left}.forecast-inner{max-width:1160px;margin:0 auto;padding:32px 24px 70px;box-sizing:border-box}header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:24px}header p{margin:0}h1{font-size:34px;margin:8px 0}h2{font-size:20px;margin:0 0 12px}p{line-height:1.6;color:#58717a}.eyebrow{text-transform:uppercase;letter-spacing:1.5px;font-size:11px;font-weight:bold}.back{border:0;background:none;padding:0;color:#287481;cursor:pointer}.version{background:#e2efec;padding:8px 14px;border-radius:20px;font-size:13px}.source-tabs{display:flex;gap:8px;margin-bottom:18px}.source-tabs button,select{padding:11px 14px;border:1px solid #d1dde2;background:white;border-radius:9px;color:#163c46;font:inherit}.source-tabs .active{background:#164c56;color:white;border-color:#164c56}.panel{background:white;border:1px solid #dce7eb;padding:24px;border-radius:16px;margin-bottom:20px}.controls{display:flex;flex-wrap:wrap;gap:16px;align-items:end}label{display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:bold}select{max-width:340px;font-size:14px}.primary{background:#147b79;color:white;border:0;border-radius:9px;padding:13px 20px;cursor:pointer}.primary:disabled{opacity:.5}.notice{background:#fff5df;padding:15px 20px;border-radius:10px;color:#85582a;font-size:14px}.summary{display:grid;grid-template-columns:1fr 1fr;gap:20px}.summary span{color:#6b8088;font-size:13px;font-weight:bold}.summary strong{display:block;font-size:38px;margin:12px 0}.summary small{font-size:16px;font-weight:normal}.summary .date{font-size:28px}.summary p{font-size:13px;margin:0}.chart-heading{display:flex;justify-content:space-between;gap:15px}.legend{display:flex;gap:18px;font-size:13px;color:#58717a;align-items:center}.key{display:inline-flex;align-items:center;gap:7px}.key i{display:inline-block;width:22px;height:0;border-top:2.5px solid #347aa1}.key.future i{border-top:2.5px dashed #218564}.chart{width:100%;height:auto;display:block;margin:22px 0}table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:12px 8px;border-bottom:1px solid #e6edef}td:not(:first-child),th:not(:first-child){text-align:right}.empty{padding:50px 30px;text-align:center}.empty p{max-width:650px;margin:12px auto}.empty-icon{font-size:42px;color:#76a9a3;margin-bottom:14px}.footnote,footer{font-size:12px;color:#73858b}.loading{color:#58717a}.office-facts{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}.office-facts div{background:#f5f8fa;border-radius:12px;padding:12px}.office-facts span{display:block;font-size:12px;color:#6b8088}.office-facts strong{font-size:20px}.error{padding:15px;background:#fceae7;color:#93362c;border-radius:8px}@media(max-width:650px){.forecast-inner{padding:20px 12px}h1{font-size:27px}.summary{grid-template-columns:1fr;gap:0}.controls>label,.controls select{width:100%;max-width:100%}.panel{padding:18px}.chart-heading{display:block}.legend{margin-top:12px}.version{display:none}td,th{font-size:12px}}
</style>
