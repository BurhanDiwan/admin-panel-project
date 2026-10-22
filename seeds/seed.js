require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')
const Household = require('../models/Household')
const Room = require('../models/Room')
const Device = require('../models/Device')
const Routine = require('../models/Routine')
const DeviceGroup = require('../models/DeviceGroup')
const EnergyLog = require('../models/EnergyLog')
const UsageLog = require('../models/UsageLog')
const Alert = require('../models/Alert')

async function seedDatabase() {
    try {
        let uri = process.env.MONGO_URI || 'mongodb://localhost:27017/smarthome_manager'
        await mongoose.connect(uri)
        console.log("Connected to MongoDB for seeding")

        await User.deleteMany({})
        await Household.deleteMany({})
        await Room.deleteMany({})
        await Device.deleteMany({})
        await Routine.deleteMany({})
        await DeviceGroup.deleteMany({})
        await EnergyLog.deleteMany({})
        await UsageLog.deleteMany({})
        await Alert.deleteMany({})

        const admin = new User({
            name: "John Admin",
            email: "admin@smarthome.com",
            password: "password123",
            role: "admin"
        })
        await admin.save()

        const household = new Household({
            name: "My Smart Home",
            owner: admin._id,
            members: [admin._id]
        })
        await household.save()

        admin.householdId = household._id
        await admin.save()

        const guest = new User({
            name: "Alice Guest",
            email: "guest@smarthome.com",
            password: "guest123",
            role: "guest",
            householdId: household._id
        })
        await guest.save()

        const child = new User({
            name: "Timmy Child",
            email: "child@smarthome.com",
            password: "child123",
            role: "child",
            householdId: household._id
        })
        await child.save()

        household.members.push(guest._id, child._id)
        await household.save()

        const livingRoom = await Room.create({
            name: "Living Room",
            type: "living_room",
            householdId: household._id,
            devices: []
        })

        const bedroom = await Room.create({
            name: "Master Bedroom",
            type: "bedroom",
            householdId: household._id,
            devices: []
        })

        const kitchen = await Room.create({
            name: "Kitchen",
            type: "kitchen",
            householdId: household._id,
            devices: []
        })

        const devicesList = [
            {
                name: "Smart Lamp",
                type: "lamp",
                roomId: bedroom._id,
                householdId: household._id,
                status: "on",
                connected: true,
                features: { brightness: 80, colorMode: "Warm" },
                energyRate: 0.015,
                totalUsageMinutes: 340,
                createdBy: admin._id
            },
            {
                name: "Living Room Lamp",
                type: "lamp",
                roomId: livingRoom._id,
                householdId: household._id,
                status: "off",
                connected: true,
                features: { brightness: 100, colorMode: "Cold" },
                energyRate: 0.015,
                totalUsageMinutes: 190,
                createdBy: admin._id
            },
            {
                name: "Ceiling Fan",
                type: "fan",
                roomId: livingRoom._id,
                householdId: household._id,
                status: "on",
                connected: true,
                features: { speed: "Medium" },
                energyRate: 0.075,
                totalUsageMinutes: 620,
                createdBy: admin._id
            },
            {
                name: "Smart Thermostat",
                type: "thermostat",
                roomId: livingRoom._id,
                householdId: household._id,
                status: "on",
                connected: true,
                features: { temperature: 22, minTemp: 18, maxTemp: 30 },
                energyRate: 0.2,
                totalUsageMinutes: 980,
                createdBy: admin._id
            },
            {
                name: "Smart AC",
                type: "ac",
                roomId: bedroom._id,
                householdId: household._id,
                status: "on",
                connected: true,
                features: { temperature: 21, mode: "cool" },
                energyRate: 1.5,
                totalUsageMinutes: 1200,
                createdBy: admin._id
            },
            {
                name: "Space Heater",
                type: "heater",
                roomId: livingRoom._id,
                householdId: household._id,
                status: "off",
                connected: true,
                features: { temperature: 23 },
                energyRate: 1.8,
                totalUsageMinutes: 1520,
                createdBy: admin._id
            },
            {
                name: "Coffee Maker",
                type: "coffee_maker",
                roomId: kitchen._id,
                householdId: household._id,
                status: "off",
                connected: true,
                features: { strength: "strong", brewed: false },
                energyRate: 0.8,
                totalUsageMinutes: 85,
                createdBy: admin._id
            },
            {
                name: "Living Room TV",
                type: "tv",
                roomId: livingRoom._id,
                householdId: household._id,
                status: "off",
                connected: true,
                features: { volume: 22, channel: 5 },
                energyRate: 0.15,
                totalUsageMinutes: 460,
                createdBy: admin._id
            },
            {
                name: "Front Door Lock",
                type: "door_lock",
                householdId: household._id,
                status: "on",
                connected: true,
                features: { locked: true },
                energyRate: 0.005,
                totalUsageMinutes: 5000,
                createdBy: admin._id
            }
        ]

        let createdDevices = []
        for (let devData of devicesList) {
            let dev = await Device.create(devData)
            createdDevices.push(dev)

            if (dev.roomId) {
                await Room.findByIdAndUpdate(dev.roomId, { $push: { devices: dev._id } })
            }
        }

        const smartLamp = createdDevices.find(d => d.name === "Smart Lamp")
        const ceilingFan = createdDevices.find(d => d.name === "Ceiling Fan")
        const coffeeMaker = createdDevices.find(d => d.name === "Coffee Maker")
        const tv = createdDevices.find(d => d.name === "Living Room TV")
        const heater = createdDevices.find(d => d.name === "Space Heater")
        const ac = createdDevices.find(d => d.name === "Smart AC")

        const routine = await Routine.create({
            name: "Night Mode Routine",
            householdId: household._id,
            schedule: { hour: 22, minute: 0, days: [0, 1, 2, 3, 4, 5, 6] },
            actions: [
                { deviceId: smartLamp._id, action: "turn_off" },
                { deviceId: ceilingFan._id, action: "turn_off" }
            ],
            enabled: true,
            createdBy: admin._id
        })

        const morningGroup = await DeviceGroup.create({
            name: "Morning Routine Group",
            householdId: household._id,
            devices: [coffeeMaker._id, smartLamp._id, tv._id],
            actions: [
                { action: "set_brightness", value: 90 }
            ],
            createdBy: admin._id
        })

        const days = [6, 5, 4, 3, 2, 1, 0]
        for (let dayOffset of days) {
            let logDate = new Date()
            logDate.setDate(logDate.getDate() - dayOffset)

            await EnergyLog.create({
                deviceId: ac._id,
                householdId: household._id,
                deviceName: ac.name,
                date: logDate,
                usageMinutes: 240,
                consumption: 6.0
            })

            await EnergyLog.create({
                deviceId: heater._id,
                householdId: household._id,
                deviceName: heater.name,
                date: logDate,
                usageMinutes: 180,
                consumption: 5.4
            })

            await EnergyLog.create({
                deviceId: ceilingFan._id,
                householdId: household._id,
                deviceName: ceilingFan.name,
                date: logDate,
                usageMinutes: 300,
                consumption: 0.375
            })

            await EnergyLog.create({
                deviceId: smartLamp._id,
                householdId: household._id,
                deviceName: smartLamp.name,
                date: logDate,
                usageMinutes: 120,
                consumption: 0.03
            })
        }

        for (let i = 1; i <= 5; i++) {
            let logTime = new Date()
            logTime.setDate(logTime.getDate() - i)
            logTime.setHours(7, 15, 0, 0)

            await UsageLog.create({
                deviceId: coffeeMaker._id,
                householdId: household._id,
                action: "turned_on",
                details: { method: "manual" },
                timestamp: logTime
            })

            let lampTime = new Date()
            lampTime.setDate(lampTime.getDate() - i)
            lampTime.setHours(7, 5, 0, 0)

            await UsageLog.create({
                deviceId: smartLamp._id,
                householdId: household._id,
                action: "turned_on",
                details: { brightness: 80 },
                timestamp: lampTime
            })
        }

        await Alert.create({
            deviceId: heater._id,
            householdId: household._id,
            deviceName: heater.name,
            type: "malfunction",
            message: `Warning: Space Heater has exceeded 24 continuous simulated hours (${heater.totalUsageMinutes} mins). Safety inspection advised.`,
            resolved: false
        })

        console.log("Seeding completed successfully!")
        console.log("Admin: admin@smarthome.com / password123")
        console.log("Guest: guest@smarthome.com / guest123")
        console.log("Child: child@smarthome.com / child123")

        process.exit(0)
    } catch (e) {
        console.error("Seeding failed:", e)
        process.exit(1)
    }
}

seedDatabase()
