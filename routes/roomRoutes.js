const express = require('express')
const router = express.Router()
const roomController = require('../controllers/roomController')
const auth = require('../middleware/auth')
const roleCheck = require('../middleware/roleCheck')

router.post('/', auth, roomController.createRoom)
router.get('/', auth, roomController.getRooms)
router.get('/:id', auth, roomController.getRoomById);
router.put('/:id', auth, roleCheck(['admin']), roomController.updateRoom)
router.delete('/:id', auth, roleCheck(['admin']), roomController.deleteRoom);
router.post('/:id/devices', auth, roomController.assignDevice)

module.exports = router
