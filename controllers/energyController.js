const EnergyLog = require('../models/EnergyLog')
const Device = require('../models/Device')
const { generateRecommendations } = require('../utils/recommendations')
const { calculateConsumption, getWeeklyUsage } = require('../utils/energyCalculator')

exports.getEnergySummary = async (req, res) => {
    try {
        let householdId = req.user.householdId

        const perDevice = await EnergyLog.aggregate([
            { $match: { householdId } },
            {
                $group: {
                    _id: "$deviceId",
                    deviceName: { $first: "$deviceName" },
                    totalKwh: { $sum: "$consumption" },
                    totalMinutes: { $sum: "$usageMinutes" },
                    logCount: { $sum: 1 }
                }
            },
            { $sort: { totalKwh: -1 } }
        ])

        let totalHouseholdKwh = 0
        let totalHouseholdMinutes = 0

        perDevice.forEach(item => {
            totalHouseholdKwh += item.totalKwh
            totalHouseholdMinutes += item.totalMinutes
        })

        const weeklyStats = await getWeeklyUsage(householdId)

        res.json({
            summary: {
                totalConsumptionKwh: Number(totalHouseholdKwh.toFixed(2)),
                totalUsageHours: Number((totalHouseholdMinutes / 60).toFixed(1)),
                activeDevicesTracked: perDevice.length
            },
            deviceBreakdown: perDevice.map(d => ({
                deviceId: d._id,
                deviceName: d.deviceName,
                consumptionKwh: Number(d.totalKwh.toFixed(3)),
                usageHours: Number((d.totalMinutes / 60).toFixed(2)),
                eventsCount: d.logCount
            })),
            weeklyStats
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.getDeviceEnergy = async (req, res) => {
    try {
        const deviceId = req.params.deviceId
        const days = parseInt(req.query.days) || 7

        const device = await Device.findOne({ _id: deviceId, householdId: req.user.householdId })
        if (!device) {
            return res.status(404).json({ msg: "Device not found" });
        }

        let startDate = new Date()
        startDate.setDate(startDate.getDate() - days)

        const logs = await EnergyLog.find({
            deviceId: device._id,
            date: { $gte: startDate }
        }).sort({ date: -1 })

        let totalKwh = 0
        let totalMinutes = 0
        logs.forEach(l => {
            totalKwh += l.consumption
            totalMinutes += l.usageMinutes
        })

        res.json({
            device: {
                id: device._id,
                name: device.name,
                type: device.type,
                energyRate: device.energyRate
            },
            periodDays: days,
            totalKwh: Number(totalKwh.toFixed(3)),
            totalHours: Number((totalMinutes / 60).toFixed(2)),
            logs
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.getRecommendations = async (req, res) => {
    try {
        let recommendations = await generateRecommendations(req.user.householdId)
        res.json({
            count: recommendations.length,
            recommendations
        })
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

exports.simulateUsage = async (req, res) => {
    try {
        const { deviceId, minutes, hours } = req.body

        const device = await Device.findOne({ _id: deviceId, householdId: req.user.householdId })
        if (!device) {
            return res.status(404).json({ msg: "Device not found" })
        }

        let usageMins = minutes || (hours ? hours * 60 : 60)
        let consumption = calculateConsumption(device.energyRate, usageMins)

        device.totalUsageMinutes = (device.totalUsageMinutes || 0) + usageMins
        await device.save()

        const log = await EnergyLog.create({
            deviceId: device._id,
            householdId: req.user.householdId,
            deviceName: device.name,
            date: new Date(),
            usageMinutes: usageMins,
            consumption
        })

        res.status(201).json({
            msg: `Simulated ${usageMins} minutes (${consumption} kWh) of usage for ${device.name}`,
            log,
            device
        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}
