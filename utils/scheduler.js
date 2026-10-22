const cron = require('node-cron')
const Routine = require('../models/Routine')
const Device = require('../models/Device')
const UsageLog = require('../models/UsageLog')
const EnergyLog = require('../models/EnergyLog')
const Alert = require('../models/Alert')

async function executeAction(device, actionItem, routineName, householdId) {
    let now = new Date()
    if (actionItem.action === 'turn_on') {
        device.status = 'on'
        device.lastTurnedOn = now
        await device.save()
        await UsageLog.create({
            deviceId: device._id,
            householdId,
            action: 'routine_turn_on',
            details: { routine: routineName }
        })
    } else if (actionItem.action === 'turn_off') {
        let mins = 15
        if (device.lastTurnedOn) {
            let diff = now.getTime() - new Date(device.lastTurnedOn).getTime()
            mins = Math.max(1, Math.round(diff / (1000 * 60)))
        }
        device.status = 'off'
        device.totalUsageMinutes = (device.totalUsageMinutes || 0) + mins
        let kwh = Number(((device.energyRate || 1) * (mins / 60)).toFixed(3))
        await device.save()

        await EnergyLog.create({
            deviceId: device._id,
            householdId,
            deviceName: device.name,
            date: now,
            usageMinutes: mins,
            consumption: kwh
        })

        await UsageLog.create({
            deviceId: device._id,
            householdId,
            action: 'routine_turn_off',
            details: { routine: routineName, mins, kwh }
        })
    } else if (actionItem.action === 'set_temperature') {
        device.features = device.features || {}
        device.features.temperature = Number(actionItem.value)
        device.markModified('features')
        await device.save()
    } else if (actionItem.action === 'set_speed') {
        device.features = device.features || {}
        device.features.speed = actionItem.value
        device.markModified('features')
        await device.save()
    } else if (actionItem.action === 'set_brightness') {
        device.features = device.features || {}
        device.features.brightness = Number(actionItem.value)
        device.markModified('features')
        await device.save()
    }
}

async function runScheduledRoutines() {
    try {
        let now = new Date()
        let currentHour = now.getHours()
        let currentMinute = now.getMinutes()
        let currentDay = now.getDay()

        const activeRoutines = await Routine.find({ enabled: true })

        for (let r of activeRoutines) {
            let s = r.schedule || {}
            let hourMatch = s.hour === undefined || s.hour === currentHour
            let minuteMatch = s.minute === undefined || s.minute === currentMinute
            let dayMatch = !s.days || s.days.length === 0 || s.days.includes(currentDay)

            if (hourMatch && minuteMatch && dayMatch) {
                for (let act of r.actions) {
                    let dev = await Device.findById(act.deviceId)
                    if (dev && dev.connected) {
                        await executeAction(dev, act, r.name, r.householdId)
                    }
                }
            }
        }
    } catch (e) {
        console.error("Scheduler error:", e.message)
    }
}

async function checkHeaterSafety() {
    try {
        const heaters = await Device.find({ type: 'heater', status: 'on' })
        let now = new Date()
        for (let h of heaters) {
            if (h.lastTurnedOn) {
                let diffHours = (now.getTime() - new Date(h.lastTurnedOn).getTime()) / (1000 * 60 * 60)
                if (diffHours >= 24) {
                    let exists = await Alert.findOne({ deviceId: h._id, resolved: false, type: 'malfunction' })
                    if (!exists) {
                        await Alert.create({
                            deviceId: h._id,
                            householdId: h.householdId,
                            deviceName: h.name,
                            type: 'malfunction',
                            message: `Auto-Safety Warning: Heater ${h.name} has been operating for 24+ consecutive hours. Reset recommended.`
                        })
                    }
                }
            }
        }
    } catch (err) {
        console.error("Safety monitor error:", err.message)
    }
}

function initScheduler() {
    cron.schedule('* * * * *', () => {
        runScheduledRoutines()
    })

    cron.schedule('0 * * * *', () => {
        checkHeaterSafety()
    })
}

module.exports = {
    initScheduler,
    runScheduledRoutines,
    checkHeaterSafety
}
