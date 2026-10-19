// Single writer, append-only, run-local decision journal. Never imports database models.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { buildSnapshot, taskContext, taskKey, httpError, clone } = require('./candidateFeatures')
class CandidateJournal {
  constructor({ directory, namespace = 'fixture', identity = 'fixture', purpose = 'functional_acceptance', actor = 'automation', clock = () => new Date().toISOString(), shadow = null, historyReader = null }) {
    if (!path.isAbsolute(directory)) throw new Error('Explicit absolute journal directory required')
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    this.lock = path.join(directory, 'writer.lock')
    try { this.lockFd = fs.openSync(this.lock, 'wx', 0o600) } catch (error) {
      if (error.code !== 'EEXIST') throw error
      let owner
      try { owner = JSON.parse(fs.readFileSync(this.lock,'utf8')) } catch (_) { throw new Error('Journal lock has no verifiable owner; inspect before restarting') }
      if (!Number.isSafeInteger(owner.pid) || owner.pid < 1) throw error
      try { process.kill(owner.pid,0); throw new Error('Journal already has an active writer') } catch (probe) { if (probe.code !== 'ESRCH') throw probe }
      fs.unlinkSync(this.lock)
      this.lockFd = fs.openSync(this.lock, 'wx', 0o600)
    }
    fs.writeSync(this.lockFd,JSON.stringify({pid:process.pid,started_at:new Date().toISOString()}))
    this.file = path.join(directory, 'events.jsonl')
    this.clock = clock; this.namespace = namespace; this.identity = identity; this.purpose = purpose; this.actor = actor; this.shadow = shadow; this.historyReader = historyReader
    const keyFile = path.join(directory, 'identity.key')
    if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32), { mode: 0o600, flag: 'wx' })
    this.identityKey = fs.readFileSync(keyFile)
    this.rows = fs.existsSync(this.file) ? fs.readFileSync(this.file,'utf8').split('\n').filter(Boolean).map(JSON.parse) : []
    this.queue = Promise.resolve()
  }
  close() { fs.closeSync(this.lockFd); fs.unlinkSync(this.lock) }
  userKey(id) { if (id === undefined || id === null || id === '') throw httpError('Authenticated user ID required',401); return crypto.createHmac('sha256', this.identityKey).update(String(id)).digest('hex').slice(0,24) }
  append(row) { const fd = fs.openSync(this.file, 'a', 0o600); try { fs.writeSync(fd, `${JSON.stringify(row)}\n`); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }; this.rows.push(clone(row)); return clone(row) }
  serial(fn) { const pending = this.queue.catch(()=>{}).then(fn); this.queue = pending; return pending }
  owned(kind, id, userKey) { const row = this.rows.find(r => r.kind === kind && r.id === id); if (!row) throw httpError('Not found',404); if (row.user_key !== userKey) throw httpError('Record belongs to another user',403); return row }
  createTask(userKey, input) { const task = taskContext(input); return this.append({ kind:'task', id:crypto.randomUUID(), user_key:userKey, created_at:this.clock(), task, collection_mode:input.collection_mode || this.purpose }) }
  history() { return this.rows.filter(r => r.kind === 'terminal').map(r => r.history) }
  async recommend(userKey, input) {
    return this.serial(async () => {
      const taskRow = this.owned('task',input.task_id,userKey)
      if (Date.parse(this.clock()) - Date.parse(taskRow.created_at) > 3600000) throw httpError('Task expired; choose task again',409)
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(input.request_id || '')) throw httpError('request_id required')
      const { hash } = require('./candidateFeatures')
      // Bind on task + frame digest when the frame is known; recognition timing fields may differ between calls.
      const signature = input.provenance?.frame_sha256 ? hash({ task_id:input.task_id, frame_sha256:input.provenance.frame_sha256, strategy:input.strategy }) : hash({ task_id:input.task_id, candidates:input.candidates, strategy:input.strategy, provenance:input.provenance })
      const existing = this.rows.find(r => r.kind === 'snapshot' && r.user_key === userKey && r.request_id === input.request_id)
      if (existing) { if (existing.signature !== signature) throw httpError('Request ID reused with changed input',409); return clone(existing.snapshot) }
      // Freeze time before history I/O: later-arriving rows cannot enter this snapshot.
      const asOf = this.clock(); let history = []; let historyStatus = 'available'
      try { history = this.historyReader ? await this.historyReader({ as_of:asOf, user_key:userKey }) : this.history() } catch (_) { historyStatus = 'query_failed' }
      let shadow = null
      if (this.shadow) { try { shadow = this.shadow(input.candidates) } catch (_) { shadow = { status:'failed',purpose:'unvalidated_diagnostic_only',scores:[] } } }
      const id = crypto.randomUUID()
      const snapshot = buildSnapshot({ candidates:input.candidates, task:taskRow.task, userKey, asOf, history, namespace:this.namespace, historyStatus, strategy:input.strategy, snapshotId:id, shadow })
      snapshot.collection_mode = taskRow.collection_mode || this.purpose
      snapshot.data_identity = this.identity
      snapshot.provenance = clone(input.provenance || { source:'not_verified' })
      delete snapshot.fingerprint
      snapshot.fingerprint = hash(snapshot)
      this.append({ kind:'snapshot', id, user_key:userKey, task_id:taskRow.id, request_id:input.request_id, signature, snapshot })
      return snapshot
    })
  }
  event(userKey,id,input) {
    return this.serial(() => {
      const row = this.owned('snapshot',id,userKey), snapshot = row.snapshot
      if (!['candidate_displayed','user_selected','user_no_target','user_cancelled'].includes(input.outcome)) throw httpError('Unsupported human event')
      const chosen = input.selected_candidate_id ?? null
      if (input.outcome === 'user_selected' ? !snapshot.original_order.includes(chosen) : chosen !== null) throw httpError('Invalid selected candidate')
      const old = this.rows.find(r => r.kind === 'terminal' && r.id === id)
      if (old) {
        if (old.outcome !== input.outcome || old.selected_candidate_id !== chosen) throw httpError('Decision already has a different terminal outcome',409)
        return { ...clone(old), replayed:true }
      }
      const display = this.rows.find(r => r.kind === 'display' && r.id === id)
      if (input.outcome === 'candidate_displayed') {
        if (JSON.stringify(input.displayed_order) !== JSON.stringify(snapshot.displayed_order)) throw httpError('Display order differs from frozen snapshot',409)
        if (display) return { ...clone(display),replayed:true }
        return this.append({ kind:'display',id,user_key:userKey, outcome:input.outcome,selected_candidate_id:null,visible_at:this.clock(),displayed_order:snapshot.displayed_order,client_visible_at:input.client_visible_at || null })
      }
      if (!display && input.outcome !== 'user_cancelled') throw httpError('Display acknowledgement required',409)
      const now = this.clock(), selected = snapshot.features.find(f => f.candidate_id === chosen)
      const toKeys = order => [...new Set(order.map(cid => snapshot.features.find(c => c.candidate_id === cid)?.key).filter(Boolean))]
      const history = { decision_id:id, namespace:this.namespace,data_identity:this.identity,purpose:snapshot.collection_mode || this.purpose,user_key:userKey,server_verified:true,actor:this.actor,display_verified:Boolean(display),outcome:input.outcome,as_of:snapshot.as_of,visible_at:display?.visible_at || null,confirmed_at:now,recorded_at:now, task_key:taskKey(snapshot.task),pool_keys:toKeys(snapshot.original_order),displayed_keys:toKeys(snapshot.displayed_order),selected_key:selected?.key || null }
      return this.append({ kind:'terminal',id,user_key:userKey,outcome:input.outcome,selected_candidate_id:chosen,accepted_display_first:chosen === snapshot.displayed_order[0], accepted_rule_first:chosen === snapshot.pure_rule_order[0],confirmed_at:now,history,training_eligible:false,stock_mutations:0 })
    })
  }
  export(userKey,id) { return clone(this.owned('snapshot',id,userKey).snapshot) }
}
module.exports = CandidateJournal
