const crypto = require('crypto')

const TASK_CONTEXTS = new Set(['general', 'item', 'lot', 'bin'])
const DECISION_TYPES = new Set(['candidate_displayed', 'user_selected', 'user_no_target', 'user_cancelled'])
const TERMINAL_TYPES = new Set(['user_selected', 'user_no_target', 'user_cancelled'])
const inFlightByDecisionId = new Map()
const MUTABLE_PAYLOAD_KEYS = new Set([
  'decision_type',
  'selected_candidate_id',
  'selected_decoded_text',
  'confirmed_at',
  'confirmation_time_ms',
  'accepted_rule_first',
  'events',
  'client_reported_events',
  'snapshot',
  'snapshot_fingerprint',
  'snapshot_status',
  'training_eligible',
  'persistence_status',
  'controls_enabled_delay_ms',
  'controls_enabled_at',
  'client_event',
  'server_canonical_decision',
  'server_received_at'
])

const makeHttpError = (message, statusCode = 400, code = 'INVALID_DECISION', details = null) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  error.details = details
  return error
}

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableValue(value[key])
    return result
  }, {})
}

const cloneJson = (value) => JSON.parse(JSON.stringify(value == null ? null : value))
const stableStringify = (value) => JSON.stringify(stableValue(value))
const fingerprint = (value) => crypto.createHash('sha256').update(stableStringify(value)).digest('hex')

const runOnceForDecision = async (decisionId, operation) => {
  const previous = inFlightByDecisionId.get(decisionId) || Promise.resolve()
  const pending = previous.catch(() => {}).then(operation)
  inFlightByDecisionId.set(decisionId, pending)
  try {
    return await pending
  } finally {
    if (inFlightByDecisionId.get(decisionId) === pending) inFlightByDecisionId.delete(decisionId)
  }
}

const getRecordPayload = (record) => {
  if (!record) return {}
  const value = typeof record.get === 'function' ? record.get('payload') : record.payload
  return value && typeof value === 'object' ? value : {}
}

const snapshotFromBody = (body = {}) => Object.keys(body).reduce((snapshot, key) => {
  if (!MUTABLE_PAYLOAD_KEYS.has(key)) snapshot[key] = body[key]
  return snapshot
}, {})

const snapshotFromPayload = (payload = {}) => {
  if (payload.snapshot && typeof payload.snapshot === 'object') return payload.snapshot
  return snapshotFromBody(payload)
}

const getEventFromBody = (body, decisionType, selectedCandidateId) => {
  const clientEvents = Array.isArray(body.events) ? body.events : []
  const incomingEvent = [...clientEvents].reverse().find((event) => (
    event && event.event_type === decisionType
  )) || body.client_event || null
  const occurredAt = String(
    incomingEvent?.occurred_at ||
    (decisionType === 'candidate_displayed' ? body.candidate_visible_at : body.confirmed_at) ||
    new Date().toISOString()
  ).slice(0, 80)
  const clientEventId = String(incomingEvent?.event_id || '').slice(0, 120) || fingerprint({
    decisionType,
    selectedCandidateId,
    occurredAt
  }).slice(0, 32)

  return {
    event_id: clientEventId,
    event_type: decisionType,
    occurred_at: occurredAt,
    client_occurred_at: occurredAt,
    server_received_at: new Date().toISOString(),
    selected_candidate_id: selectedCandidateId
  }
}

const appendEvent = (events = [], event) => {
  const previous = events.find((entry) => entry?.event_id === event.event_id)
  if (previous) {
    const comparablePrevious = { ...previous, server_received_at: null }
    const comparableIncoming = { ...event, server_received_at: null }
    if (stableStringify(comparablePrevious) !== stableStringify(comparableIncoming)) {
      throw makeHttpError('A client event id was reused with different decision data.', 409, 'EVENT_ID_CONFLICT')
    }
    return { events, appended: false }
  }
  return { events: [...events, event], appended: true }
}

const validateDecisionBody = (body = {}) => {
  const decisionId = String(body.decision_id || '').trim()
  const decisionType = String(body.decision_type || '')
  const taskContext = String(body.task_context || '')
  const candidates = Array.isArray(body.candidates) ? body.candidates : []

  if (!decisionId || decisionId.length > 80) throw makeHttpError('A valid decision_id is required.')
  if (!DECISION_TYPES.has(decisionType)) throw makeHttpError('Unsupported candidate decision event.')
  if (!TASK_CONTEXTS.has(taskContext)) throw makeHttpError('Unsupported task_context.')
  if (candidates.length > 64) throw makeHttpError('Candidate snapshot exceeds the 64-candidate safety limit.')

  const candidateIds = candidates.map((candidate) => String(candidate?.candidate_id ?? '').trim())
  if (candidateIds.some((candidateId) => !candidateId || candidateId.length > 80)) {
    throw makeHttpError('Every candidate must have a non-empty candidate_id of at most 80 characters.')
  }
  if (candidates.some((candidate, index) => String(candidate?.candidate_id ?? '') !== candidateIds[index])) {
    throw makeHttpError('Candidate IDs must not contain leading or trailing whitespace.')
  }
  if (new Set(candidateIds).size !== candidateIds.length) {
    throw makeHttpError('Candidate IDs must be unique within a decision snapshot.')
  }
  const validateCandidateCount = (field, value) => {
    if (value == null) return
    const count = Number(value)
    if (!Number.isInteger(count) || count !== candidateIds.length) {
      throw makeHttpError(`${field} must match the candidate pool size.`)
    }
  }
  if (body.candidate_count == null) throw makeHttpError('candidate_count is required for a decision snapshot.')
  validateCandidateCount('candidate_count', body.candidate_count)
  validateCandidateCount('candidate_count_after_dedup', body.candidate_count_after_dedup)
  validateCandidateCount('candidate_pool_diagnostics.candidate_count_after_dedup', body.pool_diagnostics?.candidate_count_after_dedup)

  const validateOrder = (field, { subset = false } = {}) => {
    if (!Object.prototype.hasOwnProperty.call(body, field)) throw makeHttpError(`${field} is required for a decision snapshot.`)
    if (!Array.isArray(body[field])) throw makeHttpError(`${field} must be an array.`)
    const order = body[field].map((value) => String(value ?? '').trim())
    if (order.some((candidateId, index) => (
      !candidateId || candidateId.length > 80 || String(body[field][index] ?? '') !== candidateId
    ))) {
      throw makeHttpError(`${field} contains an invalid candidate ID.`)
    }
    if (new Set(order).size !== order.length) throw makeHttpError(`${field} must not contain duplicate candidate IDs.`)
    if (order.some((candidateId) => !candidateIds.includes(candidateId))) {
      throw makeHttpError(`${field} contains an ID outside the candidate pool.`)
    }
    if (!subset && (order.length !== candidateIds.length || candidateIds.some((candidateId) => !order.includes(candidateId)))) {
      throw makeHttpError(`${field} must be a permutation of the candidate pool.`)
    }
    return order
  }

  const displayedOrder = validateOrder('displayed_order')
  const pureRuleOrder = validateOrder('pure_rule_order')
  const actualStrategyOrder = validateOrder('actual_strategy_order')
  validateOrder('model_shadow_order', { subset: true })

  for (const [field, order] of [
    ['rule_first_candidate_id', pureRuleOrder],
    ['actual_strategy_first_candidate_id', actualStrategyOrder]
  ]) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) throw makeHttpError(`${field} is required for a decision snapshot.`)
    const rawFirstCandidateId = body[field] == null ? null : String(body[field])
    const firstCandidateId = rawFirstCandidateId == null ? null : rawFirstCandidateId.trim()
    if (rawFirstCandidateId != null && (!firstCandidateId || rawFirstCandidateId !== firstCandidateId)) {
      throw makeHttpError(`${field} must be a non-empty candidate ID without surrounding whitespace.`)
    }
    if (firstCandidateId && !candidateIds.includes(firstCandidateId)) {
      throw makeHttpError(`${field} must identify a candidate in the pool.`)
    }
    if (order && (order[0] || null) !== firstCandidateId) {
      throw makeHttpError(`${field} must match the first ID in its order.`)
    }
  }
  const selectedCandidateId = body.selected_candidate_id == null
    ? null
    : String(body.selected_candidate_id).trim()
  if (body.selected_candidate_id != null && String(body.selected_candidate_id) !== selectedCandidateId) {
    throw makeHttpError('selected_candidate_id must not contain leading or trailing whitespace.')
  }
  if (decisionType === 'user_selected' && !candidateIds.includes(selectedCandidateId)) {
    throw makeHttpError('The selected candidate is not in this decision snapshot.')
  }
  if (decisionType !== 'user_selected' && selectedCandidateId) {
    throw makeHttpError('Only a user_selected event may include selected_candidate_id.')
  }

  return { decisionId, decisionType, taskContext, candidates, candidateIds, selectedCandidateId }
}

const buildRowValues = ({
  decisionId,
  decisionType,
  selectedCandidateId,
  candidates,
  payload,
  request,
  existing = null
}) => {
  const selectedCandidate = candidates.find((candidate) => String(candidate?.candidate_id ?? '') === selectedCandidateId)
  const firstScore = candidates[0]?.pure_rule_score
  const secondScore = candidates[1]?.pure_rule_score
  const topScore = firstScore == null || !Number.isFinite(Number(firstScore)) ? null : Number(firstScore)
  const scoreMargin = topScore == null || secondScore == null || !Number.isFinite(Number(secondScore))
    ? null
    : topScore - Number(secondScore)

  return {
    session_id: decisionId,
    trigger: 'multi_code_target',
    operation_context: 'SCAN',
    selected_candidate_id: selectedCandidateId,
    selected_decoded_text: selectedCandidate?.decoded_text == null ? null : String(selectedCandidate.decoded_text).slice(0, 4000),
    candidate_count: candidates.length,
    decision_type: decisionType,
    top_score: topScore,
    score_margin: scoreMargin,
    user_id: existing?.user_id ?? request.userId ?? null,
    user_name: existing?.user_name ?? request.userName ?? null,
    user_agent: existing?.user_agent ?? (String(request.userAgent || '').slice(0, 500) || null),
    ip_address: existing?.ip_address ?? (String(request.ipAddress || '').slice(0, 45) || null),
    candidates,
    payload
  }
}

const assertOwner = (existing, request) => {
  if (existing.user_id != null && request.userId != null && String(existing.user_id) !== String(request.userId)) {
    throw makeHttpError('This decision belongs to another user.', 403, 'DECISION_OWNER_MISMATCH')
  }
}

const checkSnapshotMatches = (savedPayload, incomingSnapshot) => {
  const savedSnapshot = snapshotFromPayload(savedPayload)
  const savedFingerprint = savedPayload.snapshot_fingerprint || fingerprint(savedSnapshot)
  if (fingerprint(incomingSnapshot) !== savedFingerprint) {
    throw makeHttpError('The displayed candidate snapshot is immutable and does not match this request.', 409, 'DECISION_SNAPSHOT_CONFLICT')
  }
  return savedSnapshot
}

const recordCandidateDecision = async ({ model, body, request = {} }) => {
  const normalized = validateDecisionBody(body)
  const { decisionId, decisionType, taskContext, candidates, selectedCandidateId } = normalized
  const incomingSnapshot = snapshotFromBody(body)
  const now = new Date().toISOString()

  return runOnceForDecision(decisionId, async () => {
    const existing = await model.findOne({ where: { session_id: decisionId } })
    const clientEvent = getEventFromBody(body, decisionType, selectedCandidateId)
    const incomingSelectedCandidate = candidates.find((candidate) => String(candidate?.candidate_id ?? '') === selectedCandidateId)

    if (!existing) {
      const payload = {
        ...cloneJson(incomingSnapshot),
        decision_id: decisionId,
        task_context: taskContext,
        operation_context: 'SCAN',
        decision_type: decisionType,
        selected_candidate_id: selectedCandidateId,
        selected_decoded_text: incomingSelectedCandidate?.decoded_text == null
          ? null
          : String(incomingSelectedCandidate.decoded_text).slice(0, 4000),
        confirmed_at: TERMINAL_TYPES.has(decisionType) ? (body.confirmed_at || clientEvent.client_occurred_at) : null,
        confirmation_time_ms: TERMINAL_TYPES.has(decisionType) ? (body.confirmation_time_ms ?? null) : null,
        controls_enabled_delay_ms: body.controls_enabled_delay_ms ?? null,
        controls_enabled_at: body.controls_enabled_at ?? null,
        accepted_rule_first: body.accepted_rule_first ?? null,
        candidates: cloneJson(candidates),
        events: [clientEvent],
        snapshot: cloneJson(incomingSnapshot),
        snapshot_fingerprint: fingerprint(incomingSnapshot),
        snapshot_status: decisionType === 'candidate_displayed' ? 'displayed_saved' : 'late_upload_unverified_display',
        training_eligible: false,
        server_received_at: now
      }

      if (decisionType !== 'candidate_displayed') {
        payload.client_reported_events = Array.isArray(body.events)
          ? body.events.map((event) => ({ ...event, client_reported_unverified: true }))
          : []
      }

      const values = buildRowValues({
        decisionId,
        decisionType,
        selectedCandidateId,
        candidates: cloneJson(candidates),
        payload,
        request
      })
      await model.create(values)
      return {
        created: true,
        replayed: false,
        decision_type: decisionType,
        selected_candidate_id: selectedCandidateId,
        persistence_status: decisionType === 'candidate_displayed' ? 'saved' : 'late_upload',
        snapshot_status: payload.snapshot_status,
        training_eligible: false,
        server_received_at: now
      }
    }

    assertOwner(existing, request)
    const previousPayload = getRecordPayload(existing)
    const existingSnapshot = checkSnapshotMatches(previousPayload, incomingSnapshot)
    const frozenCandidates = Array.isArray(existingSnapshot.candidates)
      ? existingSnapshot.candidates
      : (Array.isArray(existing.candidates) ? existing.candidates : [])

    if (TERMINAL_TYPES.has(existing.decision_type)) {
      if (existing.decision_type !== decisionType || String(existing.selected_candidate_id || '') !== String(selectedCandidateId || '')) {
        throw makeHttpError('This decision already has a different saved outcome.', 409, 'DECISION_TERMINAL_CONFLICT', {
          canonical_decision: {
            decision_type: existing.decision_type,
            selected_candidate_id: existing.selected_candidate_id || null
          }
        })
      }
      const previousEvents = Array.isArray(previousPayload.events) ? previousPayload.events : []
      const appended = appendEvent(previousEvents, clientEvent)
      if (appended.appended) {
        await existing.update({
          payload: { ...previousPayload, events: appended.events }
        })
      }
      return {
        created: false,
        replayed: true,
        decision_type: existing.decision_type,
        selected_candidate_id: existing.selected_candidate_id || null,
        persistence_status: previousPayload.snapshot_status === 'late_upload_unverified_display' ? 'late_upload' : 'saved',
        snapshot_status: previousPayload.snapshot_status || 'displayed_saved',
        training_eligible: false,
        server_received_at: appended.events.find((event) => event.event_id === clientEvent.event_id)?.server_received_at || null
      }
    }

    if (existing.decision_type !== 'candidate_displayed') {
      throw makeHttpError('This decision cannot transition from its current state.', 409, 'DECISION_STATE_CONFLICT')
    }

    if (decisionType === 'candidate_displayed') {
      const previousEvents = Array.isArray(previousPayload.events) ? previousPayload.events : []
      const appended = appendEvent(previousEvents, clientEvent)
      if (appended.appended) await existing.update({ payload: { ...previousPayload, events: appended.events } })
      return {
        created: false,
        replayed: true,
        decision_type: existing.decision_type,
        selected_candidate_id: null,
        persistence_status: 'saved',
        snapshot_status: previousPayload.snapshot_status || 'displayed_saved',
        training_eligible: false,
        server_received_at: appended.events.find((event) => event.event_id === clientEvent.event_id)?.server_received_at || null
      }
    }

    if (decisionType === 'user_selected' && !frozenCandidates.some((candidate) => String(candidate?.candidate_id ?? '') === selectedCandidateId)) {
      throw makeHttpError('The selected candidate was not in the originally displayed candidate pool.', 409, 'SELECTED_CANDIDATE_NOT_IN_FROZEN_POOL')
    }

    const previousEvents = Array.isArray(previousPayload.events) ? previousPayload.events : []
    const appended = appendEvent(previousEvents, clientEvent)
    const payload = {
      ...previousPayload,
      decision_id: decisionId,
      task_context: previousPayload.task_context,
      operation_context: 'SCAN',
      decision_type: decisionType,
      selected_candidate_id: selectedCandidateId,
      selected_decoded_text: frozenCandidates.find((candidate) => String(candidate?.candidate_id ?? '') === selectedCandidateId)?.decoded_text == null
        ? null
        : String(frozenCandidates.find((candidate) => String(candidate?.candidate_id ?? '') === selectedCandidateId).decoded_text).slice(0, 4000),
      confirmed_at: body.confirmed_at || clientEvent.client_occurred_at,
      confirmation_time_ms: body.confirmation_time_ms ?? null,
      controls_enabled_delay_ms: body.controls_enabled_delay_ms ?? previousPayload.controls_enabled_delay_ms ?? null,
      controls_enabled_at: body.controls_enabled_at ?? previousPayload.controls_enabled_at ?? null,
      accepted_rule_first: body.accepted_rule_first ?? null,
      events: appended.events,
      snapshot: cloneJson(existingSnapshot),
      snapshot_fingerprint: previousPayload.snapshot_fingerprint || fingerprint(existingSnapshot),
      snapshot_status: previousPayload.snapshot_status || 'displayed_saved',
      training_eligible: false,
      server_received_at: now
    }
    const values = buildRowValues({
      decisionId,
      decisionType,
      selectedCandidateId,
      candidates: cloneJson(frozenCandidates),
      payload,
      request,
      existing
    })
    values.selected_decoded_text = frozenCandidates.find((candidate) => String(candidate?.candidate_id ?? '') === selectedCandidateId)?.decoded_text == null
      ? null
      : String(frozenCandidates.find((candidate) => String(candidate?.candidate_id ?? '') === selectedCandidateId).decoded_text).slice(0, 4000)
    await existing.update(values)
    return {
      created: false,
      replayed: false,
      decision_type: decisionType,
      selected_candidate_id: selectedCandidateId,
      persistence_status: 'saved',
      snapshot_status: payload.snapshot_status,
      training_eligible: false,
      server_received_at: now
    }
  })
}

module.exports = {
  recordCandidateDecision,
  validateDecisionBody,
  snapshotFromBody
}
