const Routine = require('../models/Routine')
const Device = require('../models/Device')
const UsageLog = require('../models/UsageLog')
const EnergyLog = require('../models/EnergyLog')

exports.createRoutine = async (req, res) => {
    try {
        const { name, schedule, actions } = req.body

        if (!name) {
            return res.status(400).json({ msg: "Routine name is required" })
        }

        const routine = new Routine({
            name,
            householdId: req.user.householdId,
            schedule: schedule || { hour: 0, minute: 0, days: [0, 1, 2, 3, 4, 5, 6] },
            actions: actions || [],
            createdBy: req.user.id
        })

        await routine.save()
        res.status(201).json(routine)
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

exports.getRoutines = function(req, res) {
    Routine.find({ householdId: req.user.householdId })
        .populate('actions.deviceId', 'name type status')
        .then(routines => {
            res.json(routines)
        })
        .catch(err => {
            res.status(500).json({ error: err.message });
        })
}

exports.getRoutineById = async (req, res) => {
    try {
        const routine = await Routine.findOne({ _id: req.params.id, householdId: req.user.householdId })
            .populate('actions.deviceId')
        if (!routine) {
            return res.status(404).json({ msg: "Routine not found" })
        }
        res.json(routine)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.updateRoutine = async (req, res) => {
    try {
        let routine = await Routine.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!routine) {
            return res.status(404).json({ msg: "Routine not found" })
        }

        const { name, schedule, actions, enabled } = req.body

        if (name) routine.name = name
        if (schedule) routine.schedule = schedule
        if (actions) routine.actions = actions
        if (enabled !== undefined) routine.enabled = enabled

        await routine.save();
        res.json({ msg: "Routine updated", routine })
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

exports.deleteRoutine = async (req, res) => {
    try {
        const routine = await Routine.findOneAndDelete({ _id: req.params.id, householdId: req.user.householdId })
        if (!routine) {
            return res.status(404).json({ msg: "Routine not found" })
        }
        res.json({ msg: "Routine removed successfully" })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.toggleRoutine = async (req, res) => {
    try {
        let routine = await Routine.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!routine) {
            return res.status(404).json({ msg: "Routine not found" });
        }

        routine.enabled = !routine.enabled
        await routine.save()

        res.json({ msg: `Routine ${routine.enabled ? 'enabled' : 'disabled'}`, routine })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.executeRoutine = async (req, res) => {
    try {
        const routine = await Routine.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!routine) {
            return res.status(404).json({ msg: "Routine not found" })
        }

        let executedActions = []
        let now = new Date()

        for (let item of routine.actions) {
            let device = await Device.findOne({ _id: item.deviceId, householdId: req.user.householdId })
            if (!device) continue

            if (item.action === 'turn_on') {
                device.status = 'on'
                device.lastTurnedOn = now
                await device.save()
                await UsageLog.create({
                    deviceId: device._id,
                    householdId: req.user.householdId,
                    action: 'routine_turned_on',
                    details: { routine: routine.name }
                })
                executedActions.push({ device: device.name, action: 'turned_on' })
            } else if (item.action === 'turn_off') {
                let minutes = 15
                if (device.lastTurnedOn) {
                    let diff = now.getTime() - new Date(device.lastTurnedOn).getTime()
                    minutes = Math.max(1, Math.round(diff / (1000 * 60)))
                }

                device.status = 'off'
                device.totalUsageMinutes = (device.totalUsageMinutes || 0) + minutes
                let kwh = Number(((device.energyRate || 1) * (minutes / 60)).toFixed(3))
                await device.save()

                await EnergyLog.create({
                    deviceId: device._id,
                    householdId: req.user.householdId,
                    deviceName: device.name,
                    date: now,
                    usageMinutes: minutes,
                    consumption: kwh
                })

                await UsageLog.create({
                    deviceId: device._id,
                    householdId: req.user.householdId,
                    action: 'routine_turned_off',
                    details: { routine: routine.name, minutes, kwh }
                })
                executedActions.push({ device: device.name, action: 'turned_off', consumption: kwh })
            } else if (item.action === 'set_temperature') {
                device.features = device.features || {}
                device.features.temperature = Number(item.value)
                device.markModified('features')
                await device.save()
                executedActions.push({ device: device.name, action: `set temperature to ${item.value}°C` })
            } else if (item.action === 'set_speed') {
                device.features = device.features || {}
                device.features.speed = item.value
                device.markModified('features')
                await device.save()
                executedActions.push({ device: device.name, action: `set speed to ${item.value}` })
            } else if (item.action === 'set_brightness') {
                device.features = device.features || {}
                device.features.brightness = Number(item.value)
                device.markModified('features')
                await device.save()
                executedActions.push({ device: device.name, action: `set brightness to ${item.value}%` })
            }
        }

        res.json({
            msg: `Routine '${routine.name}' executed successfully`,
            actionsCount: executedActions.length,
            details: executedActions
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}
