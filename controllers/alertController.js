const Alert = require('../models/Alert')
const Device = require('../models/Device')

exports.getAlerts = async (req, res) => {
    try {
        let query = { householdId: req.user.householdId }
        if (req.query.resolved !== undefined) {
            query.resolved = req.query.resolved === 'true'
        }
        if (req.query.type) {
            query.type = req.query.type;
        }

        const alerts = await Alert.find(query).sort({ createdAt: -1 })
        res.json(alerts)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.getAlertById = async (req, res) => {
    try {
        const alert = await Alert.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!alert) {
            return res.status(404).json({ msg: "Alert not found" });
        }
        res.json(alert)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.resolveAlert = async function(req, res) {
    try {
        let alert = await Alert.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!alert) {
            return res.status(404).json({ msg: "Alert not found" })
        }

        alert.resolved = true
        await alert.save()

        res.json({ msg: "Alert marked as resolved", alert });
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.deleteAlert = async (req, res) => {
    try {
        const alert = await Alert.findOneAndDelete({ _id: req.params.id, householdId: req.user.householdId })
        if (!alert) {
            return res.status(404).json({ msg: "Alert not found" });
        }
        res.json({ msg: "Alert deleted successfully" })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.checkMalfunctions = async (req, res) => {
    try {
        const devices = await Device.find({ householdId: req.user.householdId })
        let newAlerts = []
        let now = new Date()

        for (let dev of devices) {
            if (dev.status === 'on' && dev.lastTurnedOn) {
                let diffHours = (now.getTime() - new Date(dev.lastTurnedOn).getTime()) / (1000 * 60 * 60)

                if (dev.type === 'heater' && (diffHours >= 24 || dev.totalUsageMinutes >= 1440)) {
                    let existing = await Alert.findOne({
                        deviceId: dev._id,
                        resolved: false,
                        type: 'malfunction'
                    })
                    if (!existing) {
                        let created = await Alert.create({
                            deviceId: dev._id,
                            householdId: req.user.householdId,
                            deviceName: dev.name,
                            type: 'malfunction',
                            message: `Critical: Heater ${dev.name} has been running continuously for over 24 hours. Automatic safety warning triggered; reset recommended.`
                        })
                        newAlerts.push(created)
                    }
                }

                if (dev.type === 'ac' && diffHours >= 12) {
                    let temp = dev.features && dev.features.temperature
                    if (temp && temp <= 18) {
                        let existing = await Alert.findOne({
                            deviceId: dev._id,
                            resolved: false,
                            type: 'warning'
                        })
                        if (!existing) {
                            let created = await Alert.create({
                                deviceId: dev._id,
                                householdId: req.user.householdId,
                                deviceName: dev.name,
                                type: 'warning',
                                message: `Warning: AC ${dev.name} is running at extreme low temperature (${temp}°C) continuously for over 12 hours.`
                            })
                            newAlerts.push(created)
                        }
                    }
                }
            }

            if (dev.status === 'malfunction') {
                let existing = await Alert.findOne({
                    deviceId: dev._id,
                    resolved: false
                })
                if (!existing) {
                    let created = await Alert.create({
                        deviceId: dev._id,
                        householdId: req.user.householdId,
                        deviceName: dev.name,
                        type: 'malfunction',
                        message: `Device ${dev.name} reported malfunction state and requires maintenance.`
                    })
                    newAlerts.push(created)
                }
            }
        }

        res.json({
            msg: "Malfunction scan completed",
            scannedDevices: devices.length,
            newAlertsGenerated: newAlerts.length,
            alerts: newAlerts
        })
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

exports.triggerAlert = async (req, res) => {
    try {
        const { deviceId, type, message } = req.body
        if (!message) {
            return res.status(400).json({ msg: "Alert message is required" })
        }

        let deviceName = 'System'
        if (deviceId) {
            let dev = await Device.findOne({ _id: deviceId, householdId: req.user.householdId })
            if (dev) deviceName = dev.name
        }

        const alert = await Alert.create({
            deviceId: deviceId || null,
            householdId: req.user.householdId,
            deviceName,
            type: type || 'warning',
            message
        })

        res.status(201).json({ msg: "Alert generated", alert })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}
