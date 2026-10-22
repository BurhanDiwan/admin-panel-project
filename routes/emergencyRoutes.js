const express = require('express')
const router = express.Router()
const emergencyController = require('../controllers/emergencyController')
const auth = require('../middleware/auth')
const roleCheck = require('../middleware/roleCheck')

router.post('/activate', auth, roleCheck(['admin']), emergencyController.activateEmergency)
router.post('/deactivate', auth, roleCheck(['admin']), emergencyController.deactivateEmergency)
router.get('/status', auth, emergencyController.getEmergencyStatus);

module.exports = router
