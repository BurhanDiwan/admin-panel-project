const Device = require('../models/Device')
const Room = require('../models/Room')
const UsageLog = require('../models/UsageLog')
const EnergyLog = require('../models/EnergyLog')
const Alert = require('../models/Alert')
const { predictUsagePatterns } = require('../utils/predictionEngine')

function getDefaultFeatures(type, customFeatures) {
    let defaults = {}
    switch (type) {
        case 'lamp':
            defaults = { brightness: 100, colorMode: 'Warm' }
            break
        case 'fan':
            defaults = { speed: 'Medium' }
            break
        case 'thermostat':
            defaults = { temperature: 24, minTemp: 18, maxTemp: 30 }
            break
        case 'ac':
            defaults = { temperature: 22, mode: 'cool' }
            break
        case 'heater':
            defaults = { temperature: 22 }
            break
        case 'washing_machine':
            defaults = { cycle: 'normal', remainingMinutes: 0 }
            break
        case 'coffee_maker':
            defaults = { strength: 'medium', brewed: false }
            break
        case 'tv':
            defaults = { volume: 20, channel: 1 }
            break
        case 'door_lock':
            defaults = { locked: true }
            break
        default:
            defaults = {}
    }
    return Object.assign({}, defaults, customFeatures || {})
}

function getEnergyRate(type) {
    const rates = {
        ac: 1.5,
        heater: 1.8,
        washing_machine: 0.9,
        thermostat: 0.2,
        tv: 0.15,
        fan: 0.075,
        coffee_maker: 0.8,
        lamp: 0.015,
        door_lock: 0.005,
        generic: 0.1
    }
    return rates[type] || 0.1
}

exports.createDevice = async (req, res) => {
    try {
        const { name, type, roomId, features, energyRate } = req.body

        if (!name || !type) {
            return res.status(400).json({ msg: "Device name and type are required" })
        }

        const validTypes = ['lamp', 'fan', 'thermostat', 'ac', 'heater', 'washing_machine', 'coffee_maker', 'tv', 'door_lock', 'generic']
        if (!validTypes.includes(type)) {
            return res.status(400).json({ msg: "Invalid device type specified" });
        }

        let deviceFeatures = getDefaultFeatures(type, features)
        let rate = energyRate || getEnergyRate(type)

        const device = new Device({
            name,
            type,
            roomId: roomId || null,
            householdId: req.user.householdId,
            status: 'off',
            connected: false,
            features: deviceFeatures,
            energyRate: rate,
            createdBy: req.user.id
        })

        await device.save()

        if (roomId) {
            await Room.findByIdAndUpdate(roomId, { $push: { devices: device._id } })
        }

        await UsageLog.create({
            deviceId: device._id,
            householdId: req.user.householdId,
            action: 'device_created',
            details: { name: device.name, type: device.type }
        })

        res.status(201).json(device);
    } catch (err) {
        res.status(500).json({ msg: "Error creating device", error: err.message })
    }
}

exports.getDevices = async (req, res) => {
    try {
        let filter = { householdId: req.user.householdId }

        if (req.query.room) {
            filter.roomId = req.query.room
        }
        if (req.query.type) {
            filter.type = req.query.type;
        }
        if (req.query.status) {
            filter.status = req.query.status
        }
        if (req.query.connected !== undefined) {
            filter.connected = req.query.connected === 'true'
        }

        const devices = await Device.find(filter).populate('roomId', 'name type')
        res.json(devices)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.getDeviceById = async (req, res) => {
    try {
        const device = await Device.findOne({ _id: req.params.id, householdId: req.user.householdId }).populate('roomId', 'name type')
        if (!device) {
            return res.status(404).json({ msg: "Device not found" });
        }
        res.json(device)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.connectDevice = async (req, res) => {
    try {
        let device = await Device.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!device) {
            return res.status(404).json({ msg: "Device not found" })
        }

        device.connected = true
        if (device.status === 'malfunction') {
            device.status = 'off'
        }
        await device.save()

        await UsageLog.create({
            deviceId: device._id,
            householdId: req.user.householdId,
            action: 'connected',
            details: { message: `Device ${device.name} successfully linked to management system` }
        })

        res.json({
            msg: `Device ${device.name} connected successfully and ready for dashboard control`,
            device
        });
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.disconnectDevice = async (req, res) => {
    try {
        const device = await Device.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!device) {
            return res.status(404).json({ msg: "Device not found" })
        }

        device.connected = false;
        device.status = 'off'
        await device.save()

        res.json({ msg: `Device ${device.name} disconnected`, device })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.toggleDevice = async (req, res) => {
    try {
        let device = await Device.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!device) {
            return res.status(404).json({ msg: "Device not found" });
        }

        if (!device.connected) {
            return res.status(400).json({ msg: "Device is not connected. Please connect the device first before operating." })
        }

        if (req.user.role === 'child') {
            if (!['lamp', 'fan'].includes(device.type)) {
                return res.status(403).json({ msg: "Child accounts can only toggle safe appliances (lamp and fan)" })
            }
        }

        let targetStatus = req.body.status
        if (!targetStatus) {
            targetStatus = device.status === 'on' ? 'off' : 'on'
        }

        const now = new Date()

        if (targetStatus === 'on') {
            device.status = 'on'
            device.lastTurnedOn = now
            await device.save()

            await UsageLog.create({
                deviceId: device._id,
                householdId: req.user.householdId,
                action: 'turned_on',
                details: { time: now }
            })

            return res.json({ msg: `Device ${device.name} turned on`, device })
        } else {
            let minutesElapsed = 0
            if (device.lastTurnedOn) {
                let diffMs = now.getTime() - new Date(device.lastTurnedOn).getTime()
                minutesElapsed = Math.max(1, Math.round(diffMs / (1000 * 60)))
            } else {
                minutesElapsed = 15
            }

            device.status = targetStatus
            device.totalUsageMinutes = (device.totalUsageMinutes || 0) + minutesElapsed
            let consumedKwh = Number(((device.energyRate || 1) * (minutesElapsed / 60)).toFixed(3))

            await device.save();

            await EnergyLog.create({
                deviceId: device._id,
                householdId: req.user.householdId,
                deviceName: device.name,
                date: now,
                usageMinutes: minutesElapsed,
                consumption: consumedKwh
            })

            await UsageLog.create({
                deviceId: device._id,
                householdId: req.user.householdId,
                action: 'turned_off',
                details: { minutesElapsed, consumedKwh }
            })

            if (device.type === 'heater' && device.totalUsageMinutes > 1440) {
                await Alert.create({
                    deviceId: device._id,
                    householdId: req.user.householdId,
                    deviceName: device.name,
                    type: 'malfunction',
                    message: `Heater ${device.name} has been operating for over 24 hours continuously. System recommends resetting the device.`
                })
            }

            return res.json({
                msg: `Device ${device.name} switched to ${targetStatus}`,
                device,
                sessionUsageMinutes: minutesElapsed,
                sessionKwh: consumedKwh
            })
        }
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.updateSettings = async (req, res) => {
    try {
        const device = await Device.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!device) {
            return res.status(404).json({ msg: "Device not found" })
        }

        if (!device.connected) {
            return res.status(400).json({ msg: "Cannot adjust settings while device is disconnected" })
        }

        if (req.user.role === 'child' && !['lamp', 'fan'].includes(device.type)) {
            return res.status(403).json({ msg: "Child accounts can only adjust settings for lamps and fans" });
        }

        let updates = req.body.features || req.body
        let currentFeatures = device.features || {}

        if (device.type === 'thermostat') {
            let min = currentFeatures.minTemp || 18
            let max = currentFeatures.maxTemp || 30
            if (updates.temperature !== undefined) {
                let temp = Number(updates.temperature)
                if (temp < min || temp > max) {
                    return res.status(400).json({ msg: `Thermostat temperature must be between ${min}°C and ${max}°C` })
                }
                currentFeatures.temperature = temp
            }
        } else if (device.type === 'fan') {
            if (updates.speed) {
                let validSpeeds = ['Low', 'Medium', 'High', 'low', 'medium', 'high']
                if (!validSpeeds.includes(updates.speed)) {
                    return res.status(400).json({ msg: "Fan speed must be Low, Medium, or High" })
                }
                currentFeatures.speed = updates.speed.charAt(0).toUpperCase() + updates.speed.slice(1).toLowerCase()
            }
        } else if (device.type === 'lamp') {
            if (updates.brightness !== undefined) {
                let b = Number(updates.brightness)
                if (b < 0 || b > 100) {
                    return res.status(400).json({ msg: "Brightness must be between 0 and 100" })
                }
                currentFeatures.brightness = b
            }
            if (updates.colorMode) {
                let validModes = ['Warm', 'Cold', 'warm', 'cold']
                if (!validModes.includes(updates.colorMode)) {
                    return res.status(400).json({ msg: "Color mode must be Warm or Cold" })
                }
                currentFeatures.colorMode = updates.colorMode.charAt(0).toUpperCase() + updates.colorMode.slice(1).toLowerCase()
            }
        } else if (device.type === 'ac') {
            if (updates.temperature !== undefined) {
                let t = Number(updates.temperature)
                if (t < 16 || t > 30) {
                    return res.status(400).json({ msg: "AC temperature must be between 16°C and 30°C" })
                }
                currentFeatures.temperature = t
            }
            if (updates.mode) {
                currentFeatures.mode = updates.mode
            }
        } else if (device.type === 'door_lock') {
            if (updates.locked !== undefined) {
                currentFeatures.locked = Boolean(updates.locked)
            }
        } else {
            Object.assign(currentFeatures, updates)
        }

        device.features = currentFeatures
        device.markModified('features')
        await device.save()

        await UsageLog.create({
            deviceId: device._id,
            householdId: req.user.householdId,
            action: 'setting_changed',
            details: currentFeatures
        })

        res.json({ msg: "Device settings updated successfully", device })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.updateStatus = async (req, res) => {
    try {
        const { status } = req.body
        const allowed = ['on', 'off', 'standby', 'malfunction']
        if (!allowed.includes(status)) {
            return res.status(400).json({ msg: "Invalid status value" })
        }

        const device = await Device.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!device) {
            return res.status(404).json({ msg: "Device not found" })
        }

        device.status = status
        await device.save()

        if (status === 'malfunction') {
            await Alert.create({
                deviceId: device._id,
                householdId: req.user.householdId,
                deviceName: device.name,
                type: 'malfunction',
                message: `Device ${device.name} failed to respond and reported a simulated malfunction.`
            })
        }

        res.json({ msg: `Device status changed to ${status}`, device })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.simulateMalfunction = async (req, res) => {
    try {
        var device = await Device.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!device) {
            return res.status(404).json({ msg: "Device not found" })
        }

        device.status = 'malfunction'
        await device.save()

        const alert = await Alert.create({
            deviceId: device._id,
            householdId: req.user.householdId,
            deviceName: device.name,
            type: 'malfunction',
            message: `Simulated malfunction alert: ${device.name} (${device.type}) is unresponsive or exhibiting abnormal behavior. Please check or reset.`
        })

        res.json({ msg: `Simulated malfunction triggered for ${device.name}`, device, alert })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.deleteDevice = async (req, res) => {
    try {
        const device = await Device.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!device) {
            return res.status(404).json({ msg: "Device not found" })
        }

        if (device.roomId) {
            await Room.findByIdAndUpdate(device.roomId, { $pull: { devices: device._id } })
        }

        await UsageLog.deleteMany({ deviceId: device._id })
        await EnergyLog.deleteMany({ deviceId: device._id })
        await Alert.deleteMany({ deviceId: device._id })
        await Device.deleteOne({ _id: device._id })

        res.json({ msg: "Device deleted successfully" })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.getPredictions = async (req, res) => {
    try {
        let deviceId = req.params.id || req.query.deviceId
        const predictions = await predictUsagePatterns(req.user.householdId, deviceId)
        res.json({
            count: predictions.length,
            predictions
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}
