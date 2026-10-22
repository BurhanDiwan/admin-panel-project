const express = require('express')
const router = express.Router()
const energyController = require('../controllers/energyController')
const auth = require('../middleware/auth')

router.get('/summary', auth, energyController.getEnergySummary)
router.get('/device/:deviceId', auth, energyController.getDeviceEnergy);
router.get('/recommendations', auth, energyController.getRecommendations)
router.post('/simulate-usage', auth, energyController.simulateUsage)

module.exports = router;
