const User = require('../models/User')
const Household = require('../models/Household')
const jwt = require("jsonwebtoken")

exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body

        if (!name || !email || !password) {
            return res.status(400).json({ msg: "Please enter all required fields" });
        }

        let existingUser = await User.findOne({ email: email.toLowerCase() })
        if (existingUser) {
            return res.status(400).json({ msg: 'User already exists with this email' })
        }

        let userRole = role ? role : 'admin'
        if (!['admin', 'guest', 'child'].includes(userRole)) {
            userRole = 'admin';
        }

        const user = new User({
            name,
            email: email.toLowerCase(),
            password,
            role: userRole
        })

        if (userRole === 'admin') {
            const household = new Household({
                name: `${name}'s Home`,
                owner: user._id,
                members: [user._id]
            })
            await household.save()
            user.householdId = household._id;
        }

        await user.save()

        const payload = {
            id: user._id,
            role: user.role,
            householdId: user.householdId
        }

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '7d' },
            (err, token) => {
                if (err) throw err
                res.status(201).json({
                    token,
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        householdId: user.householdId
                    }
                })
            }
        )
    } catch (err) {
        console.error(err)
        res.status(500).json({ msg: "Server error during registration", error: err.message })
    }
}

exports.login = async function(req, res) {
    try {
        var email = req.body.email
        var password = req.body.password

        if (!email || !password) {
            return res.status(400).json({ msg: 'Please provide email and password' })
        }

        const user = await User.findOne({ email: email.toLowerCase() })
        if (!user) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        let isMatch = await user.comparePassword(password)
        if (!isMatch) {
            return res.status(400).json({ msg: "Invalid credentials" })
        }

        const payload = {
            id: user._id,
            role: user.role,
            householdId: user.householdId
        }

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
            if (err) throw err
            res.json({
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    householdId: user.householdId
                }
            })
        })
    } catch (error) {
        console.error(error.message)
        res.status(500).send("Server error");
    }
}

exports.getMe = async (req, res) => {
    try {
        let user = await User.findById(req.user.id).select("-password").populate("householdId")
        if (!user) {
            return res.status(404).json({ msg: "User not found" })
        }
        res.json(user)
    } catch (err) {
        res.status(500).json({ msg: "Server error", err: err.message })
    }
}
