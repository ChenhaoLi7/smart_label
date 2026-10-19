const express = require('express')
module.exports = function createForecastRouter({ authenticate, authorize, service }) {
  const router = express.Router()
  router.use(authenticate, authorize, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  const wrap = fn => async (req, res, next) => { try { res.json({ success: true, ...await fn(req) }) } catch (e) { next(e) } }
  router.get('/metadata', wrap(async () => service.metadata()))
  router.get('/office-items', wrap(async () => ({ items: await service.officeItems() })))
  router.get('/', wrap(req => service.forecast(req.query)))
  router.use((err, _req, res, _next) => res.status(err.statusCode || 503).json({ success: false, message: err.statusCode ? err.message : 'Forecast data is unavailable. Please retry.' }))
  return router
}
