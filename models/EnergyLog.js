const mongoose = require("mongoose")

const energyLogSchema = new mongoose.Schema({
    deviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true
    },
    householdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Household"
    },
    deviceName: String,
    date: {
        type: Date,
        required: true
    },
    usageMinutes: {
        type: Number,
        default: 0
    },
    consumption: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

energyLogSchema.index({ deviceId: 1, date: 1 })

module.exports = mongoose.model("EnergyLog", energyLogSchema)
