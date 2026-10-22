const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'smarthome_super_secret_jwt_key_2026'
}
const express = require("express")
const cors = require('cors');
const connectDB = require('./config/db')

const { initScheduler } = require('./utils/scheduler')

connectDB();
initScheduler();

const app = express();

app.use(cors())
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

app.get('/api', (req, res) => {
  res.json({
    project: "SmartHome_Manager",
    status: "online",
    message: "Smart Home Management API is running"
  })
})

app.get('/api/health', (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
})

app.use('/api/auth', require('./routes/authRoutes'));
app.use("/api/household", require("./routes/householdRoutes"))
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use("/api/devices", require('./routes/deviceRoutes'))
app.use('/api/dashboard', require("./routes/dashboardRoutes"));
app.use("/api/routines", require('./routes/routineRoutes'))
app.use('/api/energy', require('./routes/energyRoutes'));
app.use('/api/alerts', require("./routes/alertRoutes"))
app.use("/api/voice", require('./routes/voiceRoutes'));
app.use('/api/emergency', require("./routes/emergencyRoutes"))
app.use('/api/groups', require('./routes/groupRoutes'))

let PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});
