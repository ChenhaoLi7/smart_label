const express = require('express')
const multer = require('multer')
const crypto = require('crypto')
const { canonicalCandidate, hash } = require('../services/candidateFeatures')

// The candidate pool is created here from recognition, never accepted from JSON.
module.exports = function createCandidateRecommendation({ authenticate, authorize, getJournal, recognize, resolve = async c => c }) {
  const router = express.Router()
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })
  router.use(authenticate, authorize, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  const inFlight = new Map()
  const wrap = fn => async (req, res, next) => { try { await fn(req, res) } catch (e) { next(e) } }
  const journalFor = req => {
    const journal = getJournal()
    if (!journal) throw Object.assign(new Error('Recommendation history is not configured'), { statusCode: 503 })
    return { journal, user: journal.userKey(req.user?.userId ?? req.user?.id) }
  }
  router.get('/status', wrap(async (req, res) => {
    const { journal } = journalFor(req)
    res.json({ success: true, namespace: journal.namespace, identity: journal.identity, method: 'personal-task-space-rules-v1', learned_model: false, selection_only: true })
  }))
  router.post('/tasks', wrap(async (req, res) => {
    const { journal, user } = journalFor(req)
    const mode = req.body.collection_mode || 'functional_acceptance'
    if (!['functional_acceptance', 'natural_preference'].includes(mode)) throw Object.assign(new Error('Unknown collection mode'), { statusCode: 400 })
    if (mode === 'natural_preference' && req.body.consent !== true) throw Object.assign(new Error('Explicit history consent is required'), { statusCode: 400 })
    const task = journal.createTask(user, { ...req.body, collection_mode: mode })
    res.json({ success: true, task })
  }))
  router.post('/frames', upload.single('frame'), wrap(async (req, res) => {
    const { journal, user } = journalFor(req)
    if (!req.file || !/^image\/(jpeg|png|webp)$/.test(req.file.mimetype)) throw Object.assign(new Error('Upload a JPEG, PNG or WebP frame'), { statusCode: 400 })
    const task = journal.owned('task', req.body.task_id, user)
    if (Date.now() - Date.parse(task.created_at) > 3600000) throw Object.assign(new Error('Task expired; identify a new frame'), { statusCode: 409 })
    const requestId = String(req.body.request_id || '')
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(requestId)) throw Object.assign(new Error('request_id is required'), { statusCode: 400 })
    const frameHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex')
    // A request ID is bound to user + task + frame digest, for replays and for concurrent duplicates.
    const binding = { task_id: task.id, frame_sha256: frameHash }
    const sameBinding = other => other.task_id === binding.task_id && other.frame_sha256 === binding.frame_sha256
    const replay = snapshot => ({ success: true, candidates: snapshot.provenance.candidates, personalization_snapshot: snapshot, replayed: true })
    const prior = journal.rows.find(r => r.kind === 'snapshot' && r.user_key === user && r.request_id === requestId)
    if (prior) {
      if (!sameBinding({ task_id: prior.task_id, frame_sha256: prior.snapshot.provenance?.frame_sha256 })) throw Object.assign(new Error('Request ID reused with another frame or task'), { statusCode: 409 })
      return res.json(replay(prior.snapshot))
    }
    const flightKey = `${user}:${requestId}`
    const flight = inFlight.get(flightKey)
    if (flight) {
      if (!sameBinding(flight.binding)) throw Object.assign(new Error('Request ID reused with another frame or task'), { statusCode: 409 })
      const shared = await flight.promise
      if (shared.error) throw shared.error
      if (!shared.body) throw Object.assign(new Error('The original request was cancelled; identify the frame again'), { statusCode: 409 })
      return res.json(replay(shared.body.personalization_snapshot))
    }
    let clientGone = false
    res.on('close', () => { if (!res.writableEnded) clientGone = true })
    const work = identify(req, task, user, journal, requestId, frameHash, () => clientGone)
    inFlight.set(flightKey, { binding, promise: work.then(body => ({ body }), error => ({ error })) })
    let body
    try { body = await work } finally { inFlight.delete(flightKey) }
    if (body && !clientGone) res.json(body)
  }))
  async function identify(req, task, user, journal, requestId, frameHash, isGone) {
    const payload = await recognize(req.file, { ...req.body, operation_context: task.task.operation.toLowerCase() })
    const raw = Array.isArray(payload.candidates) ? payload.candidates : []
    let candidates = raw.map((c, i) => ({ ...c, candidate_id: String(c.candidate_id || `roi-${i + 1}`), decoded_text: String(c.decoded_text || c.decoded_texts?.find(Boolean) || '').trim() })).filter(c => c.success && c.decoded_text)
    if (!candidates.length && Array.isArray(payload.decoded_texts)) candidates = [...new Set(payload.decoded_texts.filter(Boolean))].map((text, i) => ({ candidate_id: `roi-fallback-${i + 1}`, success: true, decoded_text: String(text), decoded_texts: [String(text)], decoded_types: payload.decoded_types || [], source: 'whole_image', confidence: null, quality_score: null, center_distance_ratio: null }))
    const seen = new Set()
    candidates = candidates.filter(c => !seen.has(c.decoded_text) && seen.add(c.decoded_text)).slice(0, 64)
    // Resolve only actual decoder returns, retaining detector measurements.
    candidates = await Promise.all(candidates.map(async c => { try { return await resolve(c) } catch (_) { return { ...c, lookup_status: 'unavailable' } } }))
    candidates.forEach(canonicalCandidate)
    // A client that disconnected (stopped camera, left page, timed out) gets no frozen snapshot.
    if (isGone()) return null
    const snapshot = await journal.recommend(user, {
      task_id: task.id, request_id: requestId, candidates, strategy: 'history_rules',
      provenance: { source: 'server_recognition', frame_sha256: frameHash, received_bytes: req.file.size, candidates }
    })
    return { ...payload, success: payload.success === true, candidates, personalization_snapshot: snapshot, candidate_pool_digest: hash(candidates) }
  }
  router.get('/snapshots/:id', wrap(async (req, res) => { const { journal, user } = journalFor(req); res.json({ success: true, snapshot: journal.export(user, req.params.id) }) }))
  router.post('/snapshots/:id/events', wrap(async (req, res) => { const { journal, user } = journalFor(req); res.json({ success: true, event: await journal.event(user, req.params.id, req.body) }) }))
  router.use((err, _req, res, _next) => res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : err.statusCode || 502).json({ success: false, message: err.statusCode || err.code === 'LIMIT_FILE_SIZE' ? err.message : 'Recognition or history service is unavailable. Please retry.' }))
  return router
}
