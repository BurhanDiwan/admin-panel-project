const mongoose = require('mongoose');

var routineSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    householdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Household",
        required: true
    },
    schedule: {
        hour: { type: Number },
        minute: { type: Number },
        days: [{ type: Number }]
    },
    actions: [{
        deviceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Device'
        },
        action: {
            type: String
        },
        value: {
            type: mongoose.Schema.Types.Mixed
        }
    }],
    enabled: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Routine", routineSchema)
