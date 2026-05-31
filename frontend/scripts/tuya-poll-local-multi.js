/**
 * Production Tuya Local Polling Script (Multi-Gateway)
 * 
 * This script runs locally in the hotel. It connects directly to the Zigbee Gateways
 * (MAIN HUB and SECOND HUB) on the local network, bypassing the Tuya Cloud API
 * to avoid subscription costs.
 * 
 * It automatically syncs status to Supabase and exposes a local web server (port 5002)
 * for status verification, similar to the print server.
 */

const TuyAPI = require('tuyapi');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const http = require('http');

// --- ENV LOADING ---
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '../.env.local');
        if (!fs.existsSync(envPath)) return {};
        const envConfig = {};
        const lines = fs.readFileSync(envPath, 'utf8').replace(/\r/g, '').split('\n');
        for (const line of lines) {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
                envConfig[key] = value;
            }
        }
        return envConfig;
    } catch (e) {
        console.error("Error loading .env.local:", e);
        return {};
    }
}

const env = loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const PORT = process.env.SENSOR_PORT || 5002;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ CRITICAL ERROR: Missing Supabase Credentials in .env.local");
    process.exit(1);
}

// --- INIT CLIENTS ---
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- LOAD DEVICES ---
const jsonPath = path.resolve(__dirname, '../tuya-devices.json');
if (!fs.existsSync(jsonPath)) {
    console.error("❌ CRITICAL ERROR: tuya-devices.json not found. Run listing first.");
    process.exit(1);
}

const allDevices = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const gateways = allDevices.filter(d => d.model === 'SHGATEWAYZWB' || d.product_name?.toLowerCase().includes('hub') || d.product_name?.toLowerCase().includes('gateway'));
const sensors = allDevices.filter(d => d.model === 'SHSCZ100' || d.product_name?.toLowerCase().includes('sensor'));

console.log(`Loaded ${gateways.length} Gateways and ${sensors.length} Sensors from JSON.`);

// --- GLOBAL STATE ---
const stateCache = new Map(); // sensorId -> { isOpen: bool, battery: number, lastSeen: string }
const activeGateways = [];

// --- GATEWAY CONNECTIONS ---
function startGatewayConnection(gw) {
    console.log(`[GATEWAY] Preparing connection for: ${gw.name} (ID: ${gw.id})`);
    
    const gateway = new TuyAPI({
        id: gw.id,
        key: gw.local_key,
        version: '3.3',
        issueRefreshOnConnect: true
    });

    gateway.on('connected', () => {
        console.log(`[GATEWAY] ✅ Connected to ${gw.name}!`);
    });

    gateway.on('disconnected', () => {
        console.log(`[GATEWAY] ❌ Disconnected from ${gw.name}. Reconnecting in 5s...`);
        setTimeout(() => reconnect(gw, gateway), 5000);
    });

    gateway.on('error', (error) => {
        console.error(`[GATEWAY] [${gw.name}] Error:`, error.message);
    });

    gateway.on('data', (data) => {
        // Log raw data for diagnostics
        console.log(`[RAW] [${gw.name}] Received:`, JSON.stringify(data));
        
        let payload = null;
        if (data.dps) {
            payload = data;
        } else if (data.result && data.result.dps) {
            payload = data.result;
        }

        if (!payload) return;

        const cid = payload.cid || (data.data && data.data.cid);
        const dps = payload.dps;

        if (!cid || !dps) return;

        // Match sub-device by node_id / uuid
        const sensor = sensors.find(s => s.node_id === cid || s.id === cid);
        if (!sensor) {
            console.log(`[GATEWAY] [${gw.name}] Ignored event from unknown sub-device NodeID: ${cid}`);
            return;
        }

        // Check for door state (DP 101)
        if ('101' in dps || 101 in dps) {
            const val = dps['101'] !== undefined ? dps['101'] : dps[101];
            const isOpen = val === true || String(val).toLowerCase() === 'true' || val === 'open';
            
            const battery = dps['103'] || dps[103] || dps['battery_percentage'] || null;

            const cacheKey = sensor.id;
            const prev = stateCache.get(cacheKey);

            if (!prev || prev.isOpen !== isOpen) {
                stateCache.set(cacheKey, {
                    name: sensor.name,
                    isOpen,
                    battery: battery || (prev ? prev.battery : null),
                    lastSeen: new Date().toISOString()
                });

                console.log(`*** [EVENT] ${sensor.name} -> ${isOpen ? 'OPEN 🔴' : 'CLOSED 🟢'} (Bat: ${battery}%) ***`);
                
                updateSensorInDB(sensor.id, isOpen, battery);
                logSensorEvent(sensor.id, isOpen);
            }
        }
    });

    // Resolve IP automatically and connect
    console.log(`[GATEWAY] [${gw.name}] Searching on local network...`);
    gateway.find().then(() => {
        console.log(`[GATEWAY] [${gw.name}] Discovered at IP: ${gateway.device.ip}. Connecting...`);
        gateway.connect();
    }).catch(err => {
        console.error(`[GATEWAY] [${gw.name}] Discovery failed: ${err.message}. Retrying in 10s...`);
        setTimeout(() => startGatewayConnection(gw), 10000);
    });

    activeGateways.push(gateway);
}

function reconnect(gw, client) {
    client.find().then(() => {
        client.connect();
    }).catch(err => {
        console.error(`[GATEWAY] [${gw.name}] Reconnect failed: ${err.message}. Retrying...`);
        setTimeout(() => reconnect(gw, client), 5000);
    });
}

// --- DATABASE SYNCS ---
async function updateSensorInDB(deviceId, isOpen, batteryLevel) {
    try {
        const updateData = {
            is_open: isOpen,
            last_seen: new Date().toISOString(),
            status: 'ONLINE'
        };

        if (batteryLevel !== null && batteryLevel !== undefined) {
            updateData.battery_level = Number(batteryLevel);
        }

        await supabase.from('sensors').update(updateData).eq('device_id', deviceId);
    } catch (e) {
        console.error(`[DB] Error updating status for ${deviceId}:`, e.message);
    }
}

async function logSensorEvent(deviceId, isOpen) {
    try {
        const { data: sensor } = await supabase.from('sensors').select('id').eq('device_id', deviceId).single();
        if (!sensor) return;

        await supabase.from('sensor_events').insert({
            sensor_id: sensor.id,
            event_type: isOpen ? 'OPEN' : 'CLOSE',
            payload: { source: 'local_multi_polling' },
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error(`[DB] Error logging event for ${deviceId}:`, e.message);
    }
}

// --- INITIAL BOOTSTRAP ---
console.log("==================================================");
console.log("=== Tuya LOCAL MULTI-GATEWAY DAEMON (Offline) ===");
console.log("==================================================");

// Start connection for all gateways in JSON
gateways.forEach(gw => {
    startGatewayConnection(gw);
});

// --- HTTP SERVER (Expose to web/local just like Print Server) ---
const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = req.url.split('?')[0];
    if (
        parsedUrl === '/status' || 
        parsedUrl === '/api/status' || 
        parsedUrl === '/sensors' || 
        parsedUrl === '/sensors/' || 
        parsedUrl === '/sensors/status' || 
        parsedUrl === '/sensors/api/status'
    ) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const data = {};
        stateCache.forEach((value, key) => {
            data[key] = value;
        });
        res.end(JSON.stringify({
            success: true,
            timestamp: new Date().toISOString(),
            gateways: gateways.map(g => ({ name: g.name, id: g.id })),
            sensors: data
        }, null, 2));
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end("Luxor IoT Sensor Server is running offline.\n\nEndpoints:\n- GET /status o /sensors/status : Muestra el estado en tiempo real de todos los sensores.");
    }
});

server.listen(PORT, () => {
    console.log(`[SERVER] Local Sensor Web Server listening on port ${PORT}`);
    console.log(`[SERVER] Access status at: http://localhost:${PORT}/status`);
});
