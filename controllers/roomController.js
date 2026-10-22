const Room = require('../models/Room')
const Device = require('../models/Device')

exports.createRoom = async (req, res) => {
    try {
        let name = req.body.name
        let type = req.body.type || 'other'

        if (!name) {
            return res.status(400).json({ msg: "Room name is required" })
        }

        const validTypes = ['bedroom', 'living_room', 'kitchen', 'bathroom', 'garage', 'office', 'other']
        if (!validTypes.includes(type)) {
            type = 'other';
        }

        const room = new Room({
            name,
            type,
            householdId: req.user.householdId,
            devices: []
        })

        await room.save();
        res.status(201).json(room)
    } catch (err) {
        console.error(err)
        res.status(500).json({ msg: "Error creating room", error: err.message })
    }
}

exports.getRooms = function(req, res) {
    Room.find({ householdId: req.user.householdId })
        .populate('devices')
        .then(rooms => {
            res.json(rooms)
        })
        .catch(err => {
            res.status(500).json({ msg: "Could not fetch rooms", err: err.message });
        })
}

exports.getRoomById = async (req, res) => {
    try {
        const room = await Room.findOne({ _id: req.params.id, householdId: req.user.householdId }).populate('devices')
        if (!room) {
            return res.status(404).json({ msg: "Room not found" })
        }
        res.json(room);
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.updateRoom = async (req, res) => {
    try {
        const { name, type } = req.body
        let room = await Room.findOne({ _id: req.params.id, householdId: req.user.householdId })

        if (!room) {
            return res.status(404).json({ msg: "Room not found" });
        }

        if (name) room.name = name
        if (type) room.type = type

        await room.save()
        res.json(room)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.deleteRoom = async (req, res) => {
    try {
        const room = await Room.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!room) {
            return res.status(404).json({ msg: "Room not found" });
        }

        await Device.updateMany({ roomId: room._id }, { $unset: { roomId: 1 } })
        await Room.deleteOne({ _id: room._id })

        res.json({ msg: "Room deleted and devices unassigned" })
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

exports.assignDevice = async (req, res) => {
    try {
        const deviceId = req.body.deviceId
        if (!deviceId) {
            return res.status(400).json({ msg: "deviceId is required" })
        }

        const room = await Room.findOne({ _id: req.params.id, householdId: req.user.householdId })
        if (!room) {
            return res.status(404).json({ msg: "Room not found" })
        }

        const device = await Device.findOne({ _id: deviceId, householdId: req.user.householdId })
        if (!device) {
            return res.status(404).json({ msg: "Device not found" });
        }

        if (device.roomId && device.roomId.toString() !== room._id.toString()) {
            await Room.updateOne({ _id: device.roomId }, { $pull: { devices: device._id } })
        }

        device.roomId = room._id
        await device.save()

        if (!room.devices.includes(device._id)) {
            room.devices.push(device._id);
            await room.save()
        }

        res.json({ msg: "Device assigned to room", room, device })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}
