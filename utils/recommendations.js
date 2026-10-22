const EnergyLog = require('../models/EnergyLog')
const Device = require('../models/Device')
const UsageLog = require('../models/UsageLog')

async function generateRecommendations(householdId) {
    let recommendations = []

    const topConsumers = await EnergyLog.aggregate([
        { $match: { householdId } },
        {
            $group: {
                _id: "$deviceId",
                deviceName: { $first: "$deviceName" },
                totalKwh: { $sum: "$consumption" },
                totalMinutes: { $sum: "$usageMinutes" }
            }
        },
        { $sort: { totalKwh: -1 } },
        { $limit: 3 }
    ])

    if (topConsumers.length > 0) {
        let highest = topConsumers[0]
        if (highest.totalKwh > 5) {
            recommendations.push({
                type: 'high_consumption',
                priority: 'high',
                message: `${highest.deviceName} is your highest energy consumer (${highest.totalKwh.toFixed(1)} kWh). Consider scheduling operating hours or adjusting power settings.`,
                relatedDevices: [highest.deviceName]
            })
        }
    }

    const devices = await Device.find({ householdId })

    const activeAcs = devices.filter(d => d.type === 'ac')
    activeAcs.forEach(ac => {
        let temp = (ac.features && ac.features.temperature) || 22
        if (temp < 24) {
            recommendations.push({
                type: 'efficiency_setting',
                priority: 'medium',
                message: `Your ${ac.name} is currently set to ${temp}°C. Increasing the temperature to 24°C-26°C can save up to 10% on simulated cooling energy.`,
                relatedDevices: [ac.name]
            })
        }
    })

    const heaters = devices.filter(d => d.type === 'heater')
    heaters.forEach(h => {
        if (h.totalUsageMinutes > 600) {
            recommendations.push({
                type: 'overuse_warning',
                priority: 'high',
                message: `${h.name} has run for ${Math.round(h.totalUsageMinutes / 60)} hours total. Consider using automated thermostat schedules to optimize heating cycles.`,
                relatedDevices: [h.name]
            })
        }
    })

    const nightLogs = await UsageLog.find({
        householdId,
        action: 'turned_on'
    }).limit(50)

    let lateNightTurnOns = 0
    nightLogs.forEach(log => {
        let hour = new Date(log.timestamp).getHours()
        if (hour >= 23 || hour <= 4) {
            lateNightTurnOns++
        }
    })

    if (lateNightTurnOns > 2) {
        recommendations.push({
            type: 'sleep_routine',
            priority: 'medium',
            message: "Multiple appliances were turned on or left running past midnight. We recommend setting up a 'Night Mode' routine to turn off all lights and fans automatically at 11 PM.",
            relatedDevices: ['Smart Lamp', 'Ceiling Fan']
        })
    }

    if (recommendations.length === 0) {
        recommendations.push({
            type: 'general',
            priority: 'low',
            message: "Your home energy consumption is well balanced. Keep appliances in standby or off when not in use to maintain peak efficiency.",
            relatedDevices: []
        })
    }

    return recommendations
}

module.exports = {
    generateRecommendations
}
