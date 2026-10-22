const express = require('express')
const router = express.Router()
const groupController = require('../controllers/groupController')
const auth = require('../middleware/auth')
const roleCheck = require('../middleware/roleCheck')

router.post('/', auth, roleCheck(['admin']), groupController.createGroup)
router.get('/', auth, groupController.getGroups);
router.get('/:id', auth, groupController.getGroupById)
router.put('/:id', auth, roleCheck(['admin']), groupController.updateGroup)
router.delete('/:id', auth, roleCheck(['admin']), groupController.deleteGroup);
router.post('/:id/activate', auth, groupController.activateGroup)
router.post('/:id/deactivate', auth, groupController.deactivateGroup)

module.exports = router
