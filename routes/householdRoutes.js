const express = require('express')
const router = express.Router()
const householdController = require('../controllers/householdController')
const auth = require('../middleware/auth')
const roleCheck = require('../middleware/roleCheck')

router.get('/', auth, householdController.getHousehold);
router.put('/', auth, roleCheck(['admin']), householdController.updateHousehold)
router.post('/members', auth, roleCheck(['admin']), householdController.addMember)
router.delete('/members/:userId', auth, roleCheck(['admin']), householdController.removeMember);

module.exports = router
