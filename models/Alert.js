const mongoose = require('mongoose')

let alertSchema = new mongoose.Schema({
    deviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Device"
    },
    householdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Household'
    },
    deviceName: String,
    type: {
        type: String,
        enum: ["malfunction", "overuse", "warning", "info"]
    },
    message: {
        type: String,
        required: true
    },
    resolved: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Alert", alertSchema);
