const DeviceGroup = require('../models/DeviceGroup')
const Device = require('../models/Device')
const UsageLog = require('../models/UsageLog')

exports.createGroup = async (req, res) => {
    try {
        const { name, devices, actions } = req.body

        if (!name) {
            return res.status(400).json({ msg: "Group name is required" })
        }

        const group = new DeviceGroup({
            name,
            householdId: req.user.householdId,
            devices: devices || [],
            actions: actions || [],
            createdBy: req.user.id
        })

        await group.save();
        res.status(201).json(group)
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

exports.getGroups = function(req, res) {
    DeviceGroup.find({ householdId: req.user.householdId })
        .populate('devices')
        .then(groups => {
            res.json(groups)
        })
        .catch(err => {
            res.status(500).json({ error: err.message })
        })
}

exports.getGroupById = async (req, res) => {
    try {
        const group = await DeviceGroup.findOne({ _id: req.params.id, householdId: req.user.householdId }).populate('devices')
        if (!group) {
            return res.status(404).json({ msg: "Device group not found" })
        }
        res.json(group)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.updateGroup = async (req, res) => {
    try {
        let group = await DeviceGroup.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!group) {
            return res.status(404).json({ msg: "Device group not found" });
        }

        const { name, devices, actions } = req.body
        if (name) group.name = name
        if (devices) group.devices = devices
        if (actions) group.actions = actions

        await group.save()
        res.json({ msg: "Device group updated", group })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.deleteGroup = async (req, res) => {
    try {
        const group = await DeviceGroup.findOneAndDelete({ _id: req.params.id, householdId: req.user.householdId })
        if (!group) {
            return res.status(404).json({ msg: "Device group not found" })
        }
        res.json({ msg: "Device group deleted" })
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

exports.activateGroup = async (req, res) => {
    try {
        const group = await DeviceGroup.findOne({ _id: req.params.id, householdId: req.user.householdId }).populate('devices')
        if (!group) {
            return res.status(404).json({ msg: "Device group not found" })
        }

        let updatedDevices = []
        let now = new Date()

        for (let dev of group.devices) {
            dev.status = 'on'
            dev.lastTurnedOn = now

            if (group.actions && group.actions.length > 0) {
                group.actions.forEach(act => {
                    if (act.action === 'set_temperature' && (dev.type === 'thermostat' || dev.type === 'ac')) {
                        dev.features = dev.features || {}
                        dev.features.temperature = Number(act.value)
                        dev.markModified('features')
                    }
                    if (act.action === 'set_speed' && dev.type === 'fan') {
                        dev.features = dev.features || {}
                        dev.features.speed = act.value
                        dev.markModified('features')
                    }
                    if (act.action === 'set_brightness' && dev.type === 'lamp') {
                        dev.features = dev.features || {}
                        dev.features.brightness = Number(act.value)
                        dev.markModified('features')
                    }
                })
            }

            await dev.save()

            await UsageLog.create({
                deviceId: dev._id,
                householdId: req.user.householdId,
                action: 'group_activated',
                details: { groupName: group.name }
            })

            updatedDevices.push({
                id: dev._id,
                name: dev.name,
                type: dev.type,
                status: dev.status
            })
        }

        res.json({
            msg: `Group '${group.name}' activated. All associated devices turned on simultaneously.`,
            devicesCount: updatedDevices.length,
            devices: updatedDevices
        })
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

exports.deactivateGroup = async (req, res) => {
    try {
        const group = await DeviceGroup.findOne({ _id: req.params.id, householdId: req.user.householdId }).populate('devices')
        if (!group) {
            return res.status(404).json({ msg: "Device group not found" })
        }

        let turnedOff = []
        for (let dev of group.devices) {
            dev.status = 'off'
            await dev.save()
            turnedOff.push(dev.name)
        }

        res.json({
            msg: `Group '${group.name}' deactivated. All devices switched off.`,
            devices: turnedOff
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}
