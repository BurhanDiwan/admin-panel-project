const mongoose = require("mongoose")

let deviceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['lamp', 'fan', 'thermostat', 'ac', 'heater', 'washing_machine', 'coffee_maker', 'tv', 'door_lock', 'generic']
    },
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room"
    },
    householdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Household',
        required: true
    },
    status: {
        type: String,
        enum: ["on", "off", "standby", "malfunction"],
        default: "off"
    },
    connected: {
        type: Boolean,
        default: false
    },
    features: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    energyRate: {
        type: Number,
        default: 1
    },
    totalUsageMinutes: {
        type: Number,
        default: 0
    },
    lastTurnedOn: {
        type: Date
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DeviceGroup"
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model('Device', deviceSchema)
