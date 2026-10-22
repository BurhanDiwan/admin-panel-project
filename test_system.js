const http = require('http')
const { spawn } = require('child_process')
const path = require('path')

let serverProcess = null

function startServerIfNeeded() {
    return new Promise((resolve) => {
        let req = http.get('http://127.0.0.1:5000/api/health', (res) => {
            resolve(false)
        })
        req.on('error', () => {
            serverProcess = spawn('node', [path.join(__dirname, 'server.js')], {
                stdio: 'ignore'
            })
            setTimeout(() => {
                resolve(true)
            }, 2000)
        })
    })
}

function makeRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = ''
            res.on('data', (chunk) => {
                data += chunk
            })
            res.on('end', () => {
                try {
                    let parsed = data ? JSON.parse(data) : {}
                    resolve({ status: res.statusCode, data: parsed })
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data })
                }
            })
        })

        req.on('error', (err) => {
            reject(err)
        })

        if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData))
        }
        req.end()
    })
}

async function runTests() {
    await startServerIfNeeded()
    console.log("=== STARTING SMARTHOME MANAGER BACKEND API TESTS ===\n")
    let passed = 0
    let failed = 0

    function assert(name, condition, details) {
        if (condition) {
            console.log(`[PASS] ${name}`)
            passed++
        } else {
            console.error(`[FAIL] ${name} -`, details || '')
            failed++
        }
    }

    try {
        let healthRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/health',
            method: 'GET'
        })
        assert("Health check endpoint", healthRes.status === 200 && healthRes.data.status === 'healthy', healthRes)

        let loginRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { email: 'admin@smarthome.com', password: 'password123' })
        assert("Admin login returns JWT token", loginRes.status === 200 && loginRes.data.token, loginRes)
        const adminToken = loginRes.data.token

        let guestLogin = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { email: 'guest@smarthome.com', password: 'guest123' })
        assert("Guest login returns token", guestLogin.status === 200 && guestLogin.data.token, guestLogin)
        const guestToken = guestLogin.data.token

        let childLogin = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { email: 'child@smarthome.com', password: 'child123' })
        assert("Child login returns token", childLogin.status === 200 && childLogin.data.token, childLogin)
        const childToken = childLogin.data.token

        let meRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/me',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Auth /me endpoint returns user profile", meRes.status === 200 && meRes.data.email === 'admin@smarthome.com', meRes)

        let testUserEmail = `student_${Date.now()}@test.com`
        let registerRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { name: 'Student Tester', email: testUserEmail, password: 'password123', role: 'admin' })
        assert("User registration auto-creates household & JWT", registerRes.status === 201 && registerRes.data.user.householdId, registerRes)

        let householdRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/household',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Household setup fetched with rooms and members", householdRes.status === 200 && householdRes.data.household, householdRes)

        let updateHouseRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/household',
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, { name: 'Smart Villa Automation' })
        assert("Admin update household name", updateHouseRes.status === 200 && updateHouseRes.data.household.name === 'Smart Villa Automation', updateHouseRes)

        let roomsRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/rooms',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Fetch all rooms", roomsRes.status === 200 && Array.isArray(roomsRes.data) && roomsRes.data.length >= 3, roomsRes)

        let newRoomRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/rooms',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, { name: 'Balcony Garden', type: 'other' })
        assert("Create new room", newRoomRes.status === 201 && newRoomRes.data._id, newRoomRes)
        let createdRoomId = newRoomRes.data._id

        let createDevRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/devices',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, {
            name: 'Balcony Smart Light',
            type: 'lamp',
            roomId: createdRoomId,
            features: { brightness: 75, colorMode: 'Warm' }
        })
        assert("Create device with simulated features", createDevRes.status === 201 && createDevRes.data.features.brightness === 75, createDevRes)
        let newDeviceId = createDevRes.data._id

        let connectRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: `/api/devices/${newDeviceId}/connect`,
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Simulated Device Connection button/endpoint", connectRes.status === 200 && connectRes.data.device.connected === true, connectRes)

        let toggleRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: `/api/devices/${newDeviceId}/toggle`,
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Device toggle turn on", toggleRes.status === 200 && toggleRes.data.device.status === 'on', toggleRes)

        let toggleOffRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: `/api/devices/${newDeviceId}/toggle`,
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Device toggle turn off & auto log energy", toggleOffRes.status === 200 && toggleOffRes.data.device.status === 'off', toggleOffRes)

        let settingsRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: `/api/devices/${newDeviceId}/settings`,
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, { features: { brightness: 50, colorMode: 'Cold' } })
        assert("Device features setting adjustment (dimmer/color)", settingsRes.status === 200 && settingsRes.data.device.features.brightness === 50, settingsRes)

        let devicesList = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/devices',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        let thermostatDev = devicesList.data.find(d => d.type === 'thermostat')
        if (thermostatDev) {
            let invalidTemp = await makeRequest({
                hostname: 'localhost',
                port: 5000,
                path: `/api/devices/${thermostatDev._id}/settings`,
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
            }, { features: { temperature: 35 } })
            assert("Thermostat temperature limits validation (reject > 30°C)", invalidTemp.status === 400, invalidTemp)

            let validTemp = await makeRequest({
                hostname: 'localhost',
                port: 5000,
                path: `/api/devices/${thermostatDev._id}/settings`,
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
            }, { features: { temperature: 24 } })
            assert("Thermostat temperature valid update (18-30°C)", validTemp.status === 200 && validTemp.data.device.features.temperature === 24, validTemp)
        }

        let childRestricted = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: `/api/devices/${thermostatDev._id}/settings`,
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${childToken}`, 'Content-Type': 'application/json' }
        }, { features: { temperature: 20 } })
        assert("Role management: Child role blocked from thermostat adjustment", childRestricted.status === 403, childRestricted)

        let guestDeleteRestricted = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: `/api/devices/${newDeviceId}`,
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${guestToken}` }
        })
        assert("Role management: Guest blocked from deleting devices", guestDeleteRestricted.status === 403, guestDeleteRestricted)

        let malfSim = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: `/api/devices/${newDeviceId}/simulate-malfunction`,
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Device malfunction feedback simulation", malfSim.status === 200 && malfSim.data.device.status === 'malfunction', malfSim)

        let dashRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/dashboard',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Dashboard summary endpoint", dashRes.status === 200 && dashRes.data.metrics && dashRes.data.metrics.totalDevices > 0, dashRes)

        let routinesRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/routines',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Fetch routines list", routinesRes.status === 200 && Array.isArray(routinesRes.data), routinesRes)

        if (routinesRes.data.length > 0) {
            let execRoutine = await makeRequest({
                hostname: 'localhost',
                port: 5000,
                path: `/api/routines/${routinesRes.data[0]._id}/execute`,
                method: 'POST',
                headers: { 'Authorization': `Bearer ${adminToken}` }
            })
            assert("Execute routine actions across devices", execRoutine.status === 200 && execRoutine.data.actionsCount >= 0, execRoutine)
        }

        let energySum = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/energy/summary',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Simulated energy usage tracking report", energySum.status === 200 && energySum.data.summary, energySum)

        let energyRecs = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/energy/recommendations',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Energy efficiency recommendations engine", energyRecs.status === 200 && Array.isArray(energyRecs.data.recommendations), energyRecs)

        let simUsageRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/energy/simulate-usage',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, { deviceId: newDeviceId, minutes: 120 })
        assert("Simulate custom energy consumption event", simUsageRes.status === 201 && simUsageRes.data.log.consumption > 0, simUsageRes)

        let alertsRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/alerts',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Fetch system alerts", alertsRes.status === 200 && Array.isArray(alertsRes.data), alertsRes)

        let alertCheckRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/alerts/check',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Malfunction detection & safety scanner", alertCheckRes.status === 200 && alertCheckRes.data.scannedDevices > 0, alertCheckRes)

        let predictRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/devices/predictions',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Simulated usage prediction learning engine", predictRes.status === 200 && predictRes.data.predictions.length > 0, predictRes)

        let voice1 = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/voice/command',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, { command: 'turn off all lights' })
        assert("Voice interface: 'turn off all lights'", voice1.status === 200 && voice1.data.understood === true, voice1)

        let voice2 = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/voice/command',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, { command: 'turn on all lights' })
        assert("Voice interface: 'turn on all lights'", voice2.status === 200 && voice2.data.understood === true, voice2)

        let voice3 = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/voice/command',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, { command: 'what is the status of Smart Lamp' })
        assert("Voice interface: query device status", voice3.status === 200 && voice3.data.understood === true, voice3)

        let emergActivate = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/emergency/activate',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Emergency mode simulation: turn off all & lock doors", emergActivate.status === 200 && emergActivate.data.emergencyActive === true, emergActivate)

        let emergStatus = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/emergency/status',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Emergency status check", emergStatus.status === 200 && emergStatus.data.active === true, emergStatus)

        let emergDeactivate = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/emergency/deactivate',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Emergency mode deactivate", emergDeactivate.status === 200 && emergDeactivate.data.emergencyActive === false, emergDeactivate)

        let groupsRes = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: '/api/groups',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Fetch device groups", groupsRes.status === 200 && Array.isArray(groupsRes.data), groupsRes)

        if (groupsRes.data.length > 0) {
            let actGroup = await makeRequest({
                hostname: 'localhost',
                port: 5000,
                path: `/api/groups/${groupsRes.data[0]._id}/activate`,
                method: 'POST',
                headers: { 'Authorization': `Bearer ${adminToken}` }
            })
            assert("Activate device group simultaneously", actGroup.status === 200 && actGroup.data.devicesCount > 0, actGroup)
        }

        let adminDelete = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: `/api/devices/${newDeviceId}`,
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Admin delete device", adminDelete.status === 200, adminDelete)

        let deleteRoom = await makeRequest({
            hostname: 'localhost',
            port: 5000,
            path: `/api/rooms/${createdRoomId}`,
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })
        assert("Admin delete room", deleteRoom.status === 200, deleteRoom)

        console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`)
        if (serverProcess) {
            serverProcess.kill()
        }
        if (failed === 0) {
            console.log("All features and endpoints are working seamlessly!")
            process.exit(0)
        } else {
            process.exit(1)
        }
    } catch (e) {
        if (serverProcess) {
            serverProcess.kill()
        }
        console.error("Test execution error:", e)
        process.exit(1)
    }
}

runTests()
