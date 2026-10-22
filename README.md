# SmartHome_Manager API

Backend simulation platform for home automation management built with Node.js, Express, and MongoDB.

## Project Structure

```
SmartHome_Manager/
├── config/
│   └── db.js
├── controllers/
│   ├── alertController.js
│   ├── authController.js
│   ├── dashboardController.js
│   ├── deviceController.js
│   ├── emergencyController.js
│   ├── groupController.js
│   ├── householdController.js
│   ├── roomController.js
│   └── routineController.js
├── middleware/
│   ├── auth.js
│   └── roleCheck.js
├── models/
│   ├── Alert.js
│   ├── Device.js
│   ├── DeviceGroup.js
│   ├── EnergyLog.js
│   ├── Household.js
│   ├── Room.js
│   ├── Routine.js
│   ├── UsageLog.js
│   └── User.js
├── routes/
│   ├── alertRoutes.js
│   ├── authRoutes.js
│   ├── dashboardRoutes.js
│   ├── deviceRoutes.js
│   ├── emergencyRoutes.js
│   ├── energyRoutes.js
│   ├── groupRoutes.js
│   ├── householdRoutes.js
│   ├── roomRoutes.js
│   ├── routineRoutes.js
│   └── voiceRoutes.js
├── seeds/
│   └── seed.js
├── utils/
│   ├── energyCalculator.js
│   ├── predictionEngine.js
│   ├── recommendations.js
│   └── scheduler.js
├── .env
├── .env.example
├── package.json
├── server.js
└── test_system.js
```

## Getting Started

### Prerequisites
- Node.js (v16+)
- MongoDB running locally on port 27017

### Installation

```bash
npm install
```

### Seed Database

Populate test household, rooms, devices, energy records, and 3 user roles:

```bash
npm run seed
```

Default credentials created by seeder:
- Admin: `admin@smarthome.com` / `password123`
- Guest: `guest@smarthome.com` / `guest123`
- Child: `child@smarthome.com` / `child123`

### Start Server

```bash
npm start
```
Server runs on port 5000: `http://localhost:5000`

### Run System Verification Tests

```bash
npm test
```

## Implemented Features Overview

### 1. User Authentication & Household Setup
- `POST /api/auth/register` - Registers user and automatically provisions a new Household for admins.
- `POST /api/auth/login` - Authenticates user and returns signed JWT token.
- `GET /api/auth/me` - Returns logged in profile.
- `GET /api/household` - Fetches household details with rooms and assigned members.
- `PUT /api/household` - Updates household name (admin only).
- `POST /api/household/members` - Adds a guest or child member by email.
- `DELETE /api/household/members/:userId` - Removes member from household.

### 2. Room Management
- `POST /api/rooms` - Creates room (bedroom, living_room, kitchen, bathroom, etc.).
- `GET /api/rooms` - Lists all rooms in household with populated devices.
- `GET /api/rooms/:id` - Single room details.
- `PUT /api/rooms/:id` - Updates room name/type.
- `DELETE /api/rooms/:id` - Deletes room and unassigns devices.
- `POST /api/rooms/:id/devices` - Assigns device to room.

### 3. Simulated Device Creation & Connection
- `POST /api/devices` - Creates device with simulated custom features:
  - Lamp: brightness (0-100), colorMode (Warm/Cold)
  - Ceiling Fan: 3 speed control (Low, Medium, High)
  - Thermostat: temperature limits (18°C to 30°C)
  - AC: temperature (16°C-30°C), operational mode
  - Heater: safety tracking
  - Washing Machine, Coffee Maker, TV, Door Lock
- `PUT /api/devices/:id/connect` - Simulates linking device before dashboard control.
- `PUT /api/devices/:id/toggle` - Toggles device On/Off and tracks active usage.
- `PUT /api/devices/:id/settings` - Updates configurable features with boundary validation.
- `PUT /api/devices/:id/status` - Sets status: On, Off, Standby, Malfunction.
- `POST /api/devices/:id/simulate-malfunction` - Simulates device failure with alert.
- `DELETE /api/devices/:id` - Removes device (admin only).

### 4. Appliance Control Dashboard
- `GET /api/dashboard` - Returns unified view:
  - Total device counts (on, off, standby, malfunctioning)
  - Devices grouped by room
  - Unassigned devices
  - Recent alerts
  - Total simulated energy consumption (kWh) and active hours

### 5. Routine Scheduling System
- `POST /api/routines` - Creates scheduled routine (e.g. night turn off at 22:00).
- `GET /api/routines` - Lists household routines.
- `POST /api/routines/:id/execute` - Manually triggers all actions in a routine.
- `PUT /api/routines/:id/toggle` - Enables or disables routine.
- Background scheduler checks every minute using `node-cron`.

### 6. Simulated Energy Usage Tracking & Recommendations
- `GET /api/energy/summary` - Aggregate consumption per device and total household kWh.
- `GET /api/energy/device/:deviceId` - Filtered historical logs (e.g. `?days=7`).
- `GET /api/energy/recommendations` - Smart efficiency suggestions based on active patterns.
- `POST /api/energy/simulate-usage` - Manual simulation of usage hours and energy calculation.

### 7. Alerts for Device Malfunctions
- `GET /api/alerts` - Lists malfunction and warning alerts (`?resolved=false`).
- `POST /api/alerts/check` - Scans continuous usage (e.g. heater on > 24 hours continuously triggers safety alert).
- `PUT /api/alerts/:id/resolve` - Resolves alert.

### 8. Simulated Usage Prediction
- `GET /api/devices/predictions` - Statistical algorithm analyzing `UsageLog` timestamps to detect repeated daily habits (e.g. turning on thermostat or coffee maker at 7 AM) and generate routine suggestions.

### 9. Simulated Voice Control Interface
- `POST /api/voice/command` - Natural text command processor:
  - "turn off all lights"
  - "turn on all lights"
  - "what is the status of [device]"
  - "set [device] temperature to [temp]"
  - "set [device] speed to [speed]"
  - "activate emergency mode"
  - "show all devices"

### 10. Emergency Mode Simulation
- `POST /api/emergency/activate` - Shuts down all appliances, locks virtual door locks, and emits security warning alert.
- `GET /api/emergency/status` - Checks current emergency state.
- `POST /api/emergency/deactivate` - Disengages emergency mode.

### 11. Simulated Device Groups
- `POST /api/groups` - Creates device group (e.g. Morning Routine).
- `GET /api/groups` - Lists groups with member devices.
- `POST /api/groups/:id/activate` - Activates all group appliances simultaneously.
- `POST /api/groups/:id/deactivate` - Turns off all appliances in group.

### 12. Simulated Role-Based Access Control
- Admin: Full system access (device creation/deletion, routines, emergency mode).
- Guest: Device operation and settings adjustment; cannot delete devices or reconfigure household.
- Child: Restrained operation; safe device toggles (lamp/fan); blocked from adjusting thermostat or hazardous appliances.
