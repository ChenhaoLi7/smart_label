const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/auth')

const {
    createBOM,
    getBOM
} = require('../controllers/bomController')

const {
    createWorkOrder,
    releaseWorkOrder,
    startWorkOrder,
    consumeMaterial,
    completeWorkOrder
} = require('../controllers/workOrderController')

// Protect all routes
router.use(authMiddleware)

// BOM Management
router.post('/boms', createBOM)
router.get('/boms/:sku', getBOM)

// Work Order Management
router.post('/work-orders', createWorkOrder)
router.post('/work-orders/:id/release', releaseWorkOrder)
router.post('/work-orders/:id/start', startWorkOrder)
router.post('/work-orders/:id/consume', consumeMaterial)
router.post('/work-orders/:id/complete', completeWorkOrder)

module.exports = router
