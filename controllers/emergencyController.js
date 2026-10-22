const Device = require('../models/Device')
const Alert = require('../models/Alert')
const UsageLog = require('../models/UsageLog')

let activeEmergencyState = {}

exports.activateEmergency = async (req, res) => {
    try {
        let householdId = req.user.householdId

        const devices = await Device.find({ householdId })

        let modifiedDevices = []
        let lockedDoors = []

        for (let dev of devices) {
            if (dev.type === 'door_lock') {
                dev.features = dev.features || {}
                dev.features.locked = true
                dev.markModified('features')
                lockedDoors.push(dev.name)
            } else {
                dev.status = 'off'
            }
            await dev.save()

            await UsageLog.create({
                deviceId: dev._id,
                householdId,
                action: 'emergency_shutdown',
                details: { triggeredBy: req.user.id }
            })
            modifiedDevices.push(dev.name)
        }

        const alert = await Alert.create({
            householdId,
            type: 'warning',
            message: `EMERGENCY MODE ACTIVATED: All ${devices.length} appliances switched off and virtual doors secured by user ${req.user.id}.`
        })

        activeEmergencyState[householdId.toString()] = {
            active: true,
            activatedAt: new Date(),
            activatedBy: req.user.id
        }

        res.json({
            msg: "Emergency mode successfully activated. All appliances have been turned off and virtual doors are locked.",
            emergencyActive: true,
            doorsSecured: lockedDoors,
            devicesShutDownCount: modifiedDevices.length,
            alert
        })
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

exports.deactivateEmergency = async (req, res) => {
    try {
        let householdId = req.user.householdId

        activeEmergencyState[householdId.toString()] = {
            active: false,
            deactivatedAt: new Date()
        }

        const alert = await Alert.create({
            householdId,
            type: 'info',
            message: "Emergency mode deactivated. Appliances remain in safe off state until turned on manually."
        })

        res.json({
            msg: "Emergency mode has been deactivated.",
            emergencyActive: false,
            alert
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.getEmergencyStatus = function(req, res) {
    let householdId = req.user.householdId.toString()
    let state = activeEmergencyState[householdId] || { active: false }
    res.json(state)
}
