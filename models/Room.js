const mongoose = require('mongoose')

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    householdId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Household",
        required: true
    },
    type: {
        type: String,
        enum: ['bedroom', 'living_room', 'kitchen', 'bathroom', 'garage', 'office', 'other'],
        default: 'other'
    },
    devices: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model("Room", roomSchema)
