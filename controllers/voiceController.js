const Device = require('../models/Device')
const UsageLog = require('../models/UsageLog')
const Alert = require('../models/Alert')

exports.processVoiceCommand = async (req, res) => {
    try {
        let text = req.body.command || req.body.text
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ msg: "Please provide a command string" })
        }

        let cmd = text.trim().toLowerCase()
        let householdId = req.user.householdId

        const devices = await Device.find({ householdId })

        if (cmd.includes("turn off all lights") || cmd.includes("switch off all lights") || cmd.includes("lights off")) {
            let lamps = devices.filter(d => d.type === 'lamp')
            for (let lamp of lamps) {
                lamp.status = 'off'
                await lamp.save()
            }
            return res.json({
                understood: true,
                command: text,
                response: `Turned off ${lamps.length} lights across the home.`,
                affectedDevices: lamps.map(l => l.name)
            })
        }

        if (cmd.includes("turn on all lights") || cmd.includes("switch on all lights") || cmd.includes("lights on")) {
            let lamps = devices.filter(d => d.type === 'lamp')
            for (let lamp of lamps) {
                lamp.status = 'on'
                lamp.lastTurnedOn = new Date()
                await lamp.save()
            }
            return res.json({
                understood: true,
                command: text,
                response: `Turned on ${lamps.length} lights.`,
                affectedDevices: lamps.map(l => l.name)
            })
        }

        if (cmd.includes("emergency") || cmd.includes("panic")) {
            for (let d of devices) {
                if (d.type === 'door_lock') {
                    d.features = d.features || {}
                    d.features.locked = true
                    d.markModified('features')
                } else {
                    d.status = 'off'
                }
                await d.save()
            }
            await Alert.create({
                householdId,
                type: 'warning',
                message: "Emergency mode triggered via voice command. All appliances turned off and doors secured."
            })
            return res.json({
                understood: true,
                command: text,
                response: "Emergency mode activated. All appliances have been turned off and virtual doors locked.",
                devicesAffectedCount: devices.length
            })
        }

        if (cmd.startsWith("what is the status of") || cmd.startsWith("status of")) {
            let queryName = cmd.replace("what is the status of", "").replace("status of", "").trim()
            let matched = devices.find(d => d.name.toLowerCase().includes(queryName))
            if (matched) {
                let statusDetails = `is currently ${matched.status.toUpperCase()}`
                if (matched.features && matched.features.temperature) {
                    statusDetails += ` at ${matched.features.temperature}°C`
                }
                if (matched.features && matched.features.speed) {
                    statusDetails += ` at ${matched.features.speed} speed`
                }
                if (matched.features && matched.features.brightness !== undefined) {
                    statusDetails += ` at ${matched.features.brightness}% brightness`
                }
                return res.json({
                    understood: true,
                    command: text,
                    response: `${matched.name} ${statusDetails}.`,
                    device: matched
                })
            } else {
                return res.json({
                    understood: false,
                    command: text,
                    response: `Could not find a device matching '${queryName}'.`
                })
            }
        }

        if (cmd.includes("show all devices") || cmd.includes("list devices")) {
            let summary = devices.map(d => `${d.name} (${d.status})`).join(", ")
            return res.json({
                understood: true,
                command: text,
                response: `You have ${devices.length} devices: ${summary}.`,
                devices
            })
        }

        let tempMatch = cmd.match(/set (.+?) temperature to (\d+)/i)
        if (tempMatch) {
            let targetName = tempMatch[1].trim()
            let targetTemp = parseInt(tempMatch[2])

            let dev = devices.find(d => d.name.toLowerCase().includes(targetName) && (d.type === 'thermostat' || d.type === 'ac' || d.type === 'heater'))
            if (dev) {
                dev.features = dev.features || {}
                dev.features.temperature = targetTemp
                dev.markModified('features')
                await dev.save()
                return res.json({
                    understood: true,
                    command: text,
                    response: `Set ${dev.name} temperature to ${targetTemp}°C.`,
                    device: dev
                })
            }
        }

        let brightMatch = cmd.match(/set (.+?) brightness to (\d+)/i)
        if (brightMatch) {
            let targetName = brightMatch[1].trim()
            let targetVal = Math.min(100, Math.max(0, parseInt(brightMatch[2])))

            let dev = devices.find(d => d.name.toLowerCase().includes(targetName) && d.type === 'lamp')
            if (dev) {
                dev.features = dev.features || {}
                dev.features.brightness = targetVal
                dev.markModified('features')
                await dev.save()
                return res.json({
                    understood: true,
                    command: text,
                    response: `Set ${dev.name} brightness to ${targetVal}%.`,
                    device: dev
                })
            }
        }

        let speedMatch = cmd.match(/set (.+?) speed to (low|medium|high)/i)
        if (speedMatch) {
            let targetName = speedMatch[1].trim()
            let targetSpeed = speedMatch[2].charAt(0).toUpperCase() + speedMatch[2].slice(1).toLowerCase()

            let dev = devices.find(d => d.name.toLowerCase().includes(targetName) && d.type === 'fan')
            if (dev) {
                dev.features = dev.features || {}
                dev.features.speed = targetSpeed
                dev.markModified('features')
                await dev.save()
                return res.json({
                    understood: true,
                    command: text,
                    response: `Set ${dev.name} speed to ${targetSpeed}.`,
                    device: dev
                })
            }
        }

        if (cmd.startsWith("turn on ") || cmd.startsWith("switch on ")) {
            let targetName = cmd.replace("turn on ", "").replace("switch on ", "").trim()
            let dev = devices.find(d => d.name.toLowerCase().includes(targetName))
            if (dev) {
                dev.status = 'on'
                dev.lastTurnedOn = new Date()
                await dev.save()
                await UsageLog.create({
                    deviceId: dev._id,
                    householdId,
                    action: 'voice_turn_on',
                    details: { command: text }
                })
                return res.json({
                    understood: true,
                    command: text,
                    response: `Turned on ${dev.name}.`,
                    device: dev
                })
            }
        }

        if (cmd.startsWith("turn off ") || cmd.startsWith("switch off ")) {
            let targetName = cmd.replace("turn off ", "").replace("switch off ", "").trim()
            let dev = devices.find(d => d.name.toLowerCase().includes(targetName))
            if (dev) {
                dev.status = 'off'
                await dev.save()
                await UsageLog.create({
                    deviceId: dev._id,
                    householdId,
                    action: 'voice_turn_off',
                    details: { command: text }
                })
                return res.json({
                    understood: true,
                    command: text,
                    response: `Turned off ${dev.name}.`,
                    device: dev
                })
            }
        }

        return res.json({
            understood: false,
            command: text,
            response: `Command not recognized. Try saying "turn off all lights", "set Living Room Thermostat temperature to 22", or "activate emergency mode".`
        })
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
