const path = require('path')
const axios = require('axios')
const FormData = require('form-data')
const CandidateJournal = require('./candidateJournal')
let journal
function getJournal() {
  if (!journal) journal = new CandidateJournal({
    directory: process.env.CANDIDATE_JOURNAL_DIR || path.resolve(__dirname, '../data/candidate-history'),
    namespace: process.env.CANDIDATE_DATA_NAMESPACE || 'real', identity: process.env.CANDIDATE_DATA_IDENTITY || 'real_human', purpose: 'functional_acceptance', actor: process.env.CANDIDATE_ACTOR || 'human'
  })
  return journal
}
async function recognize(file, body) {
  const form = new FormData()
  form.append('frame', file.buffer, { filename: 'scanner-frame', contentType: file.mimetype })
  form.append('mode', 'obb')
  form.append('operation_context', body.operation_context || 'scan')
  if (body.scan_frame) form.append('scan_frame', body.scan_frame)
  const headers = form.getHeaders()
  if (process.env.AI_SERVICE_INTERNAL_TOKEN) headers['X-Internal-Token'] = process.env.AI_SERVICE_INTERNAL_TOKEN
  const response = await axios.post(`${process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000'}/scanner/roi-assist`, form, { headers, timeout: 30000, maxBodyLength: 8 * 1024 * 1024 + 16384, maxContentLength: 8 * 1024 * 1024 })
  return response.data
}
module.exports = { getJournal, recognize, close: () => { if (journal) { journal.close(); journal = null } } }
