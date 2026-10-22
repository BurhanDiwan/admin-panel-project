const mongoose = require("mongoose")

var groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    householdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Household',
        required: true
    },
    devices: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Device"
    }],
    actions: [{
        action: String,
        value: mongoose.Schema.Types.Mixed
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model('DeviceGroup', groupSchema)
