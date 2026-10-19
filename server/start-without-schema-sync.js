// Start the existing application against an already prepared database.
// Same routes, static paths and error handlers as server.js, but this entry point
// never calls syncDatabase(), creates tables or alters schema.
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: process.env.APP_ENV_FILE || path.join(__dirname, '.env') })
const express = require('express')
const app = require('./app')
const sequelize = require('./config/database')
const runtime = require('./services/predictionRuntime')

const server = express()
server.use('/uploads', express.static(path.join(__dirname, 'uploads')))
server.use('/downloads', express.static(path.join(__dirname, 'public/downloads')))
server.use(app)
server.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: '服务器内部错误', error: process.env.NODE_ENV === 'development' ? err.message : {} })
})
server.use('*', (req, res) => res.status(404).json({ message: '接口不存在' }))

let listener
async function start() {
  await sequelize.authenticate()
  const host = process.env.BIND_HOST || '127.0.0.1'
  listener = server.listen(Number(process.env.PORT || 3000), host, () => {
    if (process.env.APP_PID_FILE) fs.writeFileSync(process.env.APP_PID_FILE, String(process.pid), { mode: 0o600 })
    console.log(`Application ready on ${host}:${listener.address().port}; schema sync disabled`)
  })
}
async function close() { if (listener) await new Promise(resolve => listener.close(resolve)); runtime.close(); await sequelize.close(); process.exit(0) }
process.on('SIGTERM', close); process.on('SIGINT', close)
start().catch(error => { console.error(`Application startup failed: ${error.original?.code || error.name}`); process.exit(1) })
