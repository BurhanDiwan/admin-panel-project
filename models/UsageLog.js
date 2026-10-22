const mongoose = require('mongoose');

let usageLogSchema = new mongoose.Schema({
    deviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Device",
        required: true
    },
    householdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Household'
    },
    action: {
        type: String,
        required: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
})

usageLogSchema.index({ deviceId: 1, timestamp: 1 });

module.exports = mongoose.model("UsageLog", usageLogSchema)
