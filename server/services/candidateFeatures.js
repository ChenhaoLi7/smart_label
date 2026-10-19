// Shared online/export feature contract. No fitting or model weight updates.
const crypto = require('crypto')
// v1.1: same feature formulas and weights as v1; adds position provenance from candidate-position-v1.
// History matching uses label keys only, so v1 history rows remain compatible.
const VERSION = 'personal-task-space-v1.1'
const RULE_VERSION = 'manual-fusion-v1'
const TASKS = ['general', 'item', 'lot', 'bin']
const OPERATIONS = ['SCAN', 'INBOUND', 'OUTBOUND', 'COUNT', 'MOVE']
const WEIGHTS = Object.freeze({ center: 0.30, area: 0.10, detection: 0.10, decode: 0.15, compatibility: 0.25, task_center: 0.06, task_quality: 0.04, history_delta: 0.65 })
const clone = v => JSON.parse(JSON.stringify(v))
const hash = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex')
const httpError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })
const numeric = v => (v === null || v === undefined || v === '' || typeof v === 'boolean' || !Number.isFinite(Number(v))) ? null : Number(v)
const measured = (v, source) => { const n = numeric(v); return { value: n !== null && n >= 0 && n <= 1 ? n : null, available: n !== null && n >= 0 && n <= 1, source: source || 'candidate_measurement' } }
function taskContext(input = {}) {
  const type = input.type
  const operation = input.operation
  if (!TASKS.includes(type) || !OPERATIONS.includes(operation) || !['identify', 'inquiry', 'inventory_prepare'].includes(input.step)) throw httpError('Invalid task context')
  return { type, operation, step: input.step }
}
const taskKey = t => `${t.operation}/${t.step}/${t.type}`
function canonicalCandidate(c, index) {
  const id = String(c.candidate_id || '')
  if (!id || id.trim() !== id || id.length > 80) throw httpError('Invalid candidate ID')
  let parsed = null
  try { parsed = JSON.parse(String(c.decoded_text || '')) } catch (_) { /* raw UPC requires resolved ITEM type */ }
  let type = String(parsed?.type || c.display?.entityType || c.selection_type || '').toUpperCase()
  if (!['ITEM', 'LOT', 'BIN'].includes(type)) type = 'UNKNOWN'
  let value = (type === 'ITEM' ? c.display?.sku : type === 'LOT' ? c.display?.lot_number : c.display?.bin_code) || parsed?.id || (type === 'ITEM' ? parsed?.sku : type === 'LOT' ? parsed?.lot_number : parsed?.bin_code)
  if (!value && type === 'ITEM' && c.display?.found === true && /^[A-Za-z0-9_-]{1,80}$/.test(String(c.decoded_text || ''))) value = c.decoded_text
  // Explicit label key: ITEM=SKU, LOT=lot_number, BIN=bin_code (existing resolver contract).
  // When the isolated scan flow has no inventory lookup, retain a stable
  // pseudonymous identity for the decoded label without calling it a SKU.
  const key = value && type !== 'UNKNOWN'
    ? `${type}:${String(value)}`
    : String(c.decoded_text || '').trim()
      ? `CODE_SHA256:${crypto.createHash('sha256').update(String(c.decoded_text).trim()).digest('hex')}`
      : null
  const spatial = {
    center_distance: measured(c.center_distance_ratio, c.center_distance_source),
    relative_area: measured(c.relative_area ?? c.detection_area_ratio, c.relative_area_source || 'detector_relative_area'),
    detection_quality: measured(c.confidence, c.confidence_source),
    decode_quality: measured(c.quality_score, c.quality_score_source)
  }
  const p = c.position && typeof c.position === 'object' ? c.position : null
  const position = p
    ? { version: String(p.version || ''), status: String(p.status || 'not_reported'), source: p.source || null, association: p.association || null, reference: p.reference || null, location_count: Number.isInteger(p.location_count) ? p.location_count : null, symbology_conflict: p.symbology_conflict === true }
    : { version: null, status: 'not_reported', source: null, association: null, reference: null, location_count: null, symbology_conflict: false }
  const decode_sources = Array.isArray(c.decode_sources) ? c.decode_sources.map(String).slice(0, 8) : []
  return { candidate_id: id, key, type, original_index: index, title: String(c.display?.title || c.title || key || id).slice(0, 200), decoded_text: String(c.decoded_text || '').slice(0, 4000), spatial, position, decode_sources }
}
function validHistory(rows, asOf, namespace) {
  const accepted = new Map(); const conflicts = new Set(); const cutoff = Date.parse(asOf)
  for (const r of rows) {
    if (!r || !r.decision_id || r.namespace !== namespace || !r.server_verified || r.actor !== 'human' || r.outcome !== 'user_selected' || !r.display_verified || !r.user_key || r.purpose !== 'natural_preference') continue
    if (namespace === 'real' && r.data_identity !== 'real_human') continue
    if (namespace === 'fixture' && r.data_identity !== 'fixture') continue
    const times = [r.as_of, r.visible_at, r.confirmed_at, r.recorded_at].map(Date.parse)
    if (times.some(t => !Number.isFinite(t) || t >= cutoff) || times[0] > times[1] || times[1] > times[2] || times[2] > times[3]) continue
    if (!Array.isArray(r.pool_keys) || !Array.isArray(r.displayed_keys) || r.pool_keys.length < 1 || r.pool_keys.some(k => typeof k !== 'string') || !r.pool_keys.includes(r.selected_key) || r.pool_keys.length !== r.displayed_keys.length || [...r.pool_keys].sort().join('\0') !== [...r.displayed_keys].sort().join('\0')) continue
    const previous = accepted.get(r.decision_id)
    if (previous && hash(previous) !== hash(r)) conflicts.add(r.decision_id)
    else accepted.set(r.decision_id, r)
  }
  return [...accepted.values()].filter(r => !conflicts.has(r.decision_id))
}
function historyStats(rows, userKey, key, task, asOf) {
  const relevant = rows.filter(r => r.pool_keys.includes(key) && (!userKey || r.user_key === userKey))
  function summarize(events) {
    const selections = events.filter(r => r.selected_key === key)
    const last = selections.length ? Math.max(...selections.map(r => Date.parse(r.confirmed_at))) : null
    return { shown: events.length, selected: selections.length, smoothed_rate: (selections.length + 1) / (events.length + 2), seconds_since_last_selection: last === null ? null : Math.max(0, (Date.parse(asOf) - last) / 1000), position_counts: events.reduce((a,r) => { const p = String(r.displayed_keys.indexOf(key) + 1); a[p] = (a[p] || 0) + 1; return a }, {}) }
  }
  return { all_tasks: summarize(relevant), current_task: summarize(relevant.filter(r => r.task_key === taskKey(task))) }
}
function buildSnapshot({ candidates, task, userKey, asOf, history = [], namespace = 'real', historyStatus = 'available', strategy = 'history_rules', snapshotId, shadow = null }) {
  const started = process.hrtime.bigint()
  if (!['spatial_task_rules','history_rules','global_rules'].includes(strategy)) throw httpError('Invalid strategy')
  if (!Array.isArray(candidates) || candidates.length > 64) throw httpError('Candidate pool must contain at most 64 entries')
  const canonical = candidates.map(canonicalCandidate)
  if (new Set(canonical.map(c => c.candidate_id)).size !== canonical.length) throw httpError('Duplicate candidate IDs')
  // Multiple detections of the same label do not make multiple independent observations.
  const records = validHistory(history, asOf, namespace)
  const features = canonical.map(c => {
    const personal = historyStats(records, userKey, c.key, task, asOf)
    const global = historyStats(records, null, c.key, task, asOf)
    const p = personal.current_task, g = global.current_task
    const fallback = historyStatus !== 'available' ? 'history_query_failed' : !c.key ? 'unresolved_label_key' : p.shown ? 'personal_task_history' : g.shown ? 'global_task_history' : 'no_history'
    const historyRate = fallback === 'personal_task_history' ? p.smoothed_rate : fallback === 'global_task_history' ? g.smoothed_rate : 0.5
    const center = c.spatial.center_distance.available ? 1 - c.spatial.center_distance.value : 0.5
    const area = c.spatial.relative_area.available ? Math.min(1, Math.sqrt(c.spatial.relative_area.value) * 4) : 0.5
    const detection = c.spatial.detection_quality.value ?? 0.5, decode = c.spatial.decode_quality.value ?? 0.5
    const compatibility = task.type === 'general' ? 0.5 : c.type === task.type.toUpperCase() ? 1 : c.type === 'UNKNOWN' ? 0.25 : 0
    const task_center = task.type === 'general' ? 0 : compatibility * center
    const task_quality = task.type === 'general' ? 0 : compatibility * decode
    const operation_center = task.operation === 'OUTBOUND' ? center : 0
    const operation_quality = task.operation === 'INBOUND' ? decode : 0
    const pure = WEIGHTS.center*center + WEIGHTS.area*area + WEIGHTS.detection*detection + WEIGHTS.decode*decode + WEIGHTS.compatibility*compatibility + WEIGHTS.task_center*(task_center + operation_center)/2 + WEIGHTS.task_quality*(task_quality + operation_quality)/2
    return { ...c, task: { ...task, compatibility }, interactions: { task_center, task_quality, outbound_center: operation_center, inbound_quality: operation_quality }, personal, global, history_source: fallback, effective_history_rate: historyRate,
      scores: { spatial_task_rules: pure, global_rules: pure + WEIGHTS.history_delta * (g.shown ? g.smoothed_rate - 0.5 : 0), history_rules: pure + WEIGHTS.history_delta * (historyRate - 0.5) } }
  })
  const order = method => [...features].sort((a,b) => b.scores[method] - a.scores[method] || a.original_index - b.original_index).map(c => c.candidate_id)
  const snapshot = { snapshot_id: snapshotId, as_of: asOf, feature_version: VERSION, rule_version: RULE_VERSION, weights: WEIGHTS, namespace, user_key: userKey, task: clone(task), task_key: taskKey(task), history_status: historyStatus, valid_history_decisions: records.length, strategy, strategy_kind: 'manual_rules_not_learned', original_order: canonical.map(c => c.candidate_id), pure_rule_order: order('spatial_task_rules'), global_rule_order: order('global_rules'), history_rule_order: order('history_rules'), displayed_order: order(strategy), features, old_model: shadow || { status: 'missing', purpose: 'unvalidated_diagnostic_only', scores: [] }, position_bias_warning: true, outcome_features_used: false }
  snapshot.elapsed_ms = Number(process.hrtime.bigint() - started)/1e6
  snapshot.fingerprint = hash(snapshot)
  return clone(snapshot)
}
module.exports = { VERSION, RULE_VERSION, WEIGHTS, taskContext, taskKey, canonicalCandidate, validHistory, historyStats, buildSnapshot, httpError, hash, clone }
