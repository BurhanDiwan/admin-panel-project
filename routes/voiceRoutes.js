const express = require('express')
const router = express.Router()
const voiceController = require('../controllers/voiceController')
const auth = require('../middleware/auth')

router.post('/command', auth, voiceController.processVoiceCommand);

module.exports = router
