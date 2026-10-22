const Household = require('../models/Household')
const User = require('../models/User')
const Room = require('../models/Room')

exports.getHousehold = async (req, res) => {
    try {
        let householdId = req.user.householdId
        if (!householdId) {
            return res.status(404).json({ msg: "User does not belong to any household" })
        }

        const household = await Household.findById(householdId)
            .populate('owner', 'name email role')
            .populate('members', 'name email role')

        if (!household) {
            return res.status(404).json({ msg: 'Household not found' });
        }

        const rooms = await Room.find({ householdId: household._id }).populate('devices')

        res.json({
            household,
            rooms
        })
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error", error: err.message })
    }
}

exports.updateHousehold = async function(req, res) {
    try {
        var name = req.body.name
        if (!name) {
            return res.status(400).json({ msg: "Household name is required" })
        }

        let household = await Household.findById(req.user.householdId)
        if (!household) {
            return res.status(404).json({ msg: "Household not found" })
        }

        household.name = name;
        await household.save()

        res.json({ msg: "Household updated successfully", household });
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
}

exports.addMember = async (req, res) => {
    try {
        const { email, role, name, password } = req.body
        if (!email) {
            return res.status(400).json({ msg: "Email is required to add member" });
        }

        const household = await Household.findById(req.user.householdId)
        if (!household) {
            return res.status(404).json({ msg: "Household not found" })
        }

        let targetUser = await User.findOne({ email: email.toLowerCase() })

        let assignedRole = role || 'guest'
        if (!['admin', 'guest', 'child'].includes(assignedRole)) {
            assignedRole = 'guest';
        }

        if (targetUser) {
            targetUser.householdId = household._id
            targetUser.role = assignedRole
            await targetUser.save()

            if (!household.members.includes(targetUser._id)) {
                household.members.push(targetUser._id)
                await household.save();
            }

            return res.json({ msg: "Member added to household", user: { id: targetUser._id, name: targetUser.name, email: targetUser.email, role: targetUser.role } })
        }

        if (!password || !name) {
            return res.status(400).json({ msg: "For new user, name and initial password are required" })
        }

        const newUser = new User({
            name,
            email: email.toLowerCase(),
            password,
            role: assignedRole,
            householdId: household._id
        })

        await newUser.save()
        household.members.push(newUser._id)
        await household.save()

        res.status(201).json({
            msg: "New member created and added to household",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        })
    } catch (err) {
        res.status(500).json({ msg: "Server error", err: err.message })
    }
}

exports.removeMember = async (req, res) => {
    try {
        const userId = req.params.userId
        const household = await Household.findById(req.user.householdId)

        if (!household) {
            return res.status(404).json({ msg: "Household not found" })
        }

        if (household.owner.toString() === userId) {
            return res.status(400).json({ msg: "Cannot remove household owner" })
        }

        household.members = household.members.filter(m => m.toString() !== userId);
        await household.save()

        await User.findByIdAndUpdate(userId, { $unset: { householdId: 1 } })

        res.json({ msg: "Member removed from household" })
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
