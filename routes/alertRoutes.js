const express = require('express')
const router = express.Router()
const alertController = require('../controllers/alertController')
const auth = require('../middleware/auth')
const roleCheck = require('../middleware/roleCheck')

router.get('/', auth, alertController.getAlerts)
router.get('/:id', auth, alertController.getAlertById);
router.put('/:id/resolve', auth, alertController.resolveAlert)
router.delete('/:id', auth, roleCheck(['admin']), alertController.deleteAlert)
router.post('/check', auth, alertController.checkMalfunctions)
router.post('/trigger', auth, alertController.triggerAlert);

module.exports = router
