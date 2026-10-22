const EnergyLog = require('../models/EnergyLog')

function calculateConsumption(energyRate, usageMinutes) {
    let rate = energyRate || 0.1
    let minutes = usageMinutes || 0
    return Number((rate * (minutes / 60)).toFixed(3))
}

const getDailyUsage = async (householdId, targetDate) => {
    let start = new Date(targetDate)
    start.setHours(0, 0, 0, 0)
    let end = new Date(targetDate)
    end.setHours(23, 59, 59, 999)

    return await EnergyLog.find({
        householdId,
        date: { $gte: start, $lte: end }
    }).populate('deviceId', 'name type')
}

var getWeeklyUsage = async function(householdId) {
    let weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    return await EnergyLog.aggregate([
        {
            $match: {
                householdId,
                date: { $gte: weekAgo }
            }
        },
        {
            $group: {
                _id: "$deviceId",
                deviceName: { $first: "$deviceName" },
                totalMinutes: { $sum: "$usageMinutes" },
                totalConsumption: { $sum: "$consumption" }
            }
        },
        { $sort: { totalConsumption: -1 } }
    ])
}

module.exports = {
    calculateConsumption,
    getDailyUsage,
    getWeeklyUsage
}
