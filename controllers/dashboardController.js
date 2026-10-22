const Device = require('../models/Device')
const Room = require('../models/Room')
const Alert = require('../models/Alert')
const EnergyLog = require('../models/EnergyLog')
const Household = require('../models/Household')

exports.getDashboardSummary = async (req, res) => {
    try {
        let householdId = req.user.householdId

        const household = await Household.findById(householdId).select("name")

        const devices = await Device.find({ householdId }).populate('roomId', 'name type')
        const rooms = await Room.find({ householdId })

        let totalDevices = devices.length
        let onCount = 0
        let offCount = 0
        let standbyCount = 0
        let malfunctionCount = 0
        let connectedCount = 0

        devices.forEach(d => {
            if (d.connected) connectedCount++
            if (d.status === 'on') onCount++
            else if (d.status === 'off') offCount++
            else if (d.status === 'standby') standbyCount++
            else if (d.status === 'malfunction') malfunctionCount++;
        })

        let roomsMap = {}
        rooms.forEach(r => {
            roomsMap[r._id.toString()] = {
                _id: r._id,
                name: r.name,
                type: r.type,
                devices: []
            }
        })

        let unassignedDevices = []

        devices.forEach(dev => {
            if (dev.roomId && roomsMap[dev.roomId._id ? dev.roomId._id.toString() : dev.roomId.toString()]) {
                let key = dev.roomId._id ? dev.roomId._id.toString() : dev.roomId.toString()
                roomsMap[key].devices.push(dev)
            } else {
                unassignedDevices.push(dev)
            }
        })

        const recentAlerts = await Alert.find({ householdId })
            .sort({ createdAt: -1 })
            .limit(10)

        const energyAgg = await EnergyLog.aggregate([
            { $match: { householdId } },
            { $group: { _id: null, totalKwh: { $sum: "$consumption" }, totalMinutes: { $sum: "$usageMinutes" } } }
        ])

        let totalEnergyKwh = energyAgg.length > 0 ? Number(energyAgg[0].totalKwh.toFixed(2)) : 0
        let totalUsageHours = energyAgg.length > 0 ? Number((energyAgg[0].totalMinutes / 60).toFixed(1)) : 0

        res.json({
            householdName: household ? household.name : 'My Smart Home',
            metrics: {
                totalDevices,
                connectedDevices: connectedCount,
                devicesOn: onCount,
                devicesOff: offCount,
                devicesStandby: standbyCount,
                devicesMalfunctioning: malfunctionCount,
                totalEnergyKwh,
                totalUsageHours
            },
            rooms: Object.values(roomsMap),
            unassignedDevices,
            allDevices: devices,
            recentAlerts
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: err.message });
    }
}
