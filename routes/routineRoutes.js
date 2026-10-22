const express = require('express')
const router = express.Router()
const routineController = require('../controllers/routineController')
const auth = require('../middleware/auth')
const roleCheck = require('../middleware/roleCheck')

router.post('/', auth, roleCheck(['admin']), routineController.createRoutine)
router.get('/', auth, routineController.getRoutines)
router.get('/:id', auth, routineController.getRoutineById);
router.put('/:id', auth, roleCheck(['admin']), routineController.updateRoutine)
router.delete('/:id', auth, roleCheck(['admin']), routineController.deleteRoutine)
router.put('/:id/toggle', auth, roleCheck(['admin']), routineController.toggleRoutine);
router.post('/:id/execute', auth, routineController.executeRoutine)

module.exports = router
