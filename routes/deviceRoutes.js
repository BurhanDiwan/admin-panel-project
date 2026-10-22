const express = require('express')
const router = express.Router()
const deviceController = require('../controllers/deviceController')
const auth = require('../middleware/auth')
const roleCheck = require('../middleware/roleCheck')

router.post('/', auth, roleCheck(['admin', 'guest']), deviceController.createDevice)
router.get('/', auth, deviceController.getDevices)
router.get('/predictions', auth, deviceController.getPredictions)
router.get('/:id/predictions', auth, deviceController.getPredictions)
router.get('/:id', auth, deviceController.getDeviceById);
router.put('/:id/connect', auth, deviceController.connectDevice)
router.put('/:id/disconnect', auth, deviceController.disconnectDevice)
router.put('/:id/toggle', auth, deviceController.toggleDevice)
router.put('/:id/settings', auth, deviceController.updateSettings)
router.put('/:id/status', auth, deviceController.updateStatus)
router.post('/:id/simulate-malfunction', auth, deviceController.simulateMalfunction)
router.delete('/:id', auth, roleCheck(['admin']), deviceController.deleteDevice);

module.exports = router
