const mongoose = require('mongoose')

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI || 'mongodb://localhost:27017/smarthome_manager'
    let conn = await mongoose.connect(uri)
    console.log(`MongoDB Connected: ${conn.connection.host}`)
  } catch (err) {
    console.error(err.message);
    process.exit(1)
  }
}

module.exports = connectDB
