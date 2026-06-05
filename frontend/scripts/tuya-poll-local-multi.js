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
const stateCache = new Map(); // sensorId -> { name: string, isOpen: bool, battery: number, lastSeen: string }
const activeGateways = [];

// Robustness and mitigation parameters
const DEBOUNCE_TIME_MS = 4000;       // 4 seconds debounce
const GW_COOLDOWN_TIME_MS = 8000;     // 8 seconds cooldown after gateway reconnects
const pendingTimeouts = new Map();    // sensorId -> timeoutId
const gatewayCooldowns = new Map();   // gatewayId -> timestamp when cooldown expires
const pendingDbWrites = [];           // Array to store failed DB write requests

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
        // Start cooldown to ignore initial connection glitches
        gatewayCooldowns.set(gw.id, Date.now() + GW_COOLDOWN_TIME_MS);

        // Mark all sensors under this gateway as ONLINE
        const gwSensors = sensors.filter(s => s.local_key === gw.local_key);
        console.log(`[GATEWAY] [${gw.name}] Marking ${gwSensors.length} sensors as ONLINE...`);

        gwSensors.forEach(s => {
            const cacheKey = s.id;
            const prev = stateCache.get(cacheKey) || {
                name: s.name,
                isOpen: false, // default to closed if not pre-seeded/known
                battery: null,
                lastSeen: null
            };

            prev.lastSeen = new Date().toISOString();
            stateCache.set(cacheKey, prev);

            // Update DB immediately
            updateSensorInDB(s.id, prev.isOpen, prev.battery);
        });
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

            // --- GATEWAY COOLDOWN CHECK ---
            const cooldownUntil = gatewayCooldowns.get(gw.id);
            if (cooldownUntil && Date.now() < cooldownUntil) {
                console.log(`[COOLDOWN] [${gw.name}] Ignoring event from ${sensor.name} (Gateway reconnecting)`);
                return;
            }

            const cacheKey = sensor.id;
            const prev = stateCache.get(cacheKey);

            // If first run, initialize in-memory and write to DB immediately
            if (!prev) {
                stateCache.set(cacheKey, {
                    name: sensor.name,
                    isOpen,
                    battery: battery || null,
                    lastSeen: new Date().toISOString()
                });
                console.log(`[INIT] ${sensor.name} -> ${isOpen ? 'OPEN 🔴' : 'CLOSED 🟢'} (Bat: ${battery || 'N/A'}%)`);
                updateSensorInDB(sensor.id, isOpen, battery);
                return;
            }

            // Silently update battery/lastSeen in cache, and update DB if battery changes
            if (battery !== null && prev.battery !== battery) {
                prev.battery = battery;
                updateSensorInDB(sensor.id, prev.isOpen, battery);
            }
            prev.lastSeen = new Date().toISOString();

            // If door state changed, apply DEBOUNCE
            if (prev.isOpen !== isOpen) {
                // Clear any pending timeout for this sensor
                if (pendingTimeouts.has(cacheKey)) {
                    clearTimeout(pendingTimeouts.get(cacheKey));
                    pendingTimeouts.delete(cacheKey);
                }

                console.log(`[DEBOUNCE] ${sensor.name} changed to ${isOpen ? 'OPEN 🔴' : 'CLOSED 🟢'}? Debouncing for ${DEBOUNCE_TIME_MS / 1000}s...`);

                // Start new debounce timeout
                const timeoutId = setTimeout(() => {
                    pendingTimeouts.delete(cacheKey);
                    
                    // Re-verify and apply change
                    prev.isOpen = isOpen;
                    prev.lastSeen = new Date().toISOString();
                    stateCache.set(cacheKey, prev);

                    console.log(`*** [EVENT CONFIRMED] ${sensor.name} -> ${isOpen ? 'OPEN 🔴' : 'CLOSED 🟢'} (Bat: ${prev.battery}%) ***`);
                    
                    updateSensorInDB(sensor.id, isOpen, prev.battery);
                    logSensorEvent(sensor.id, isOpen);
                }, DEBOUNCE_TIME_MS);

                pendingTimeouts.set(cacheKey, timeoutId);
            } else {
                // Reverted back to the stable state during debounce, cancel it
                if (pendingTimeouts.has(cacheKey)) {
                    console.log(`[DEBOUNCE CANCELLED] ${sensor.name} reverted back to ${prev.isOpen ? 'OPEN 🔴' : 'CLOSED 🟢'} (glitch filtered)`);
                    clearTimeout(pendingTimeouts.get(cacheKey));
                    pendingTimeouts.delete(cacheKey);
                }
            }
        }
    });

    // Resolve IP automatically and connect
    console.log(`[GATEWAY] [${gw.name}] Searching on local network...`);
    gateway.find().then(() => {
        console.log(`[GATEWAY] [${gw.name}] Discovered at IP: ${gateway.device.ip}. Connecting...`);
        gateway.connect().catch(err => {
            console.error(`[GATEWAY] [${gw.name}] Connection failed: ${err.message}`);
        });
    }).catch(err => {
        console.error(`[GATEWAY] [${gw.name}] Discovery failed: ${err.message}. Retrying in 10s...`);
        setTimeout(() => startGatewayConnection(gw), 10000);
    });

    activeGateways.push(gateway);
}

function reconnect(gw, client) {
    client.find().then(() => {
        client.connect().catch(err => {
            console.error(`[GATEWAY] [${gw.name}] Reconnect failed during connection attempt: ${err.message}`);
        });
    }).catch(err => {
        console.error(`[GATEWAY] [${gw.name}] Reconnect discovery failed: ${err.message}. Retrying...`);
        setTimeout(() => reconnect(gw, client), 5000);
    });
}

// --- DATABASE SYNCS ---
// --- DATABASE SYNCS ---
async function updateSensorInDB(deviceId, isOpen, batteryLevel) {
    const updateData = {
        is_open: isOpen,
        last_seen: new Date().toISOString(),
        status: 'ONLINE'
    };

    if (batteryLevel !== null && batteryLevel !== undefined) {
        updateData.battery_level = Number(batteryLevel);
    }

    try {
        const { error } = await supabase.from('sensors').update(updateData).eq('device_id', deviceId);
        if (error) throw error;
    } catch (e) {
        console.error(`[DB] Error updating status for ${deviceId}: ${e.message}. Enqueuing for retry.`);
        pendingDbWrites.push({
            type: 'update',
            table: 'sensors',
            data: updateData,
            filter: { device_id: deviceId },
            timestamp: Date.now()
        });
    }
}

async function logSensorEvent(deviceId, isOpen) {
    const eventData = {
        sensor_id: null,
        event_type: isOpen ? 'OPEN' : 'CLOSE',
        payload: { source: 'local_multi_polling' },
        created_at: new Date().toISOString()
    };

    try {
        const { data: sensor, error: fetchError } = await supabase.from('sensors').select('id').eq('device_id', deviceId).single();
        if (fetchError) throw fetchError;
        if (!sensor) return;

        eventData.sensor_id = sensor.id;
        const { error: insertError } = await supabase.from('sensor_events').insert(eventData);
        if (insertError) throw insertError;
    } catch (e) {
        console.error(`[DB] Error logging event for ${deviceId}: ${e.message}. Enqueuing...`);
        pendingDbWrites.push({
            type: 'insert',
            table: 'sensor_events',
            data: eventData,
            deviceId: deviceId,
            timestamp: Date.now()
        });
    }
}

// --- FLUSH PENDING DB WRITES ---
async function flushPendingDbWrites() {
    if (pendingDbWrites.length === 0) return;
    
    console.log(`[DB] Offline Cache: Flushing ${pendingDbWrites.length} pending writes to Supabase...`);
    const toFlush = [...pendingDbWrites];
    pendingDbWrites.length = 0;

    let successCount = 0;
    let failCount = 0;

    for (const write of toFlush) {
        try {
            if (write.type === 'update') {
                const { error } = await supabase
                    .from(write.table)
                    .update(write.data)
                    .eq('device_id', write.filter.device_id);
                if (error) throw error;
            } else if (write.type === 'insert') {
                if (!write.data.sensor_id && write.deviceId) {
                    const { data: sensor } = await supabase
                        .from('sensors')
                        .select('id')
                        .eq('device_id', write.deviceId)
                        .single();
                    if (sensor) {
                        write.data.sensor_id = sensor.id;
                    }
                }
                
                if (!write.data.sensor_id) {
                    throw new Error("Could not resolve sensor UUID");
                }

                const { error } = await supabase.from(write.table).insert(write.data);
                if (error) throw error;
            }
            successCount++;
        } catch (e) {
            failCount++;
            // Re-enqueue if older than 1 hour, else discard
            if (Date.now() - write.timestamp < 3600000) {
                pendingDbWrites.push(write);
            }
        }
    }
    
    if (successCount > 0) {
        console.log(`[DB] Offline Cache Flush Complete: ${successCount} OK, ${pendingDbWrites.length} still queued.`);
    }
}

// --- INITIAL BOOTSTRAP ---
async function bootstrap() {
    console.log("==================================================");
    console.log("=== Tuya LOCAL MULTI-GATEWAY DAEMON (Offline) ===");
    console.log("==================================================");

    // 1. Pre-seed cache from Supabase
    try {
        console.log("[INIT] Pre-seeding sensor cache from Supabase...");
        const { data, error } = await supabase.from('sensors').select('*');
        if (error) throw error;
        if (data) {
            data.forEach(s => {
                stateCache.set(s.device_id, {
                    name: s.name,
                    isOpen: s.is_open,
                    battery: s.battery_level,
                    lastSeen: s.last_seen
                });
            });
            console.log(`[INIT] ✅ Pre-seeded cache with ${data.length} sensors from Supabase.`);
        }
    } catch (e) {
        console.error("[INIT] ⚠️ Failed to pre-seed cache from Supabase:", e.message);
    }

    // 2. Start connection for all gateways in JSON
    gateways.forEach(gw => {
        startGatewayConnection(gw);
    });

    // Periodically flush cached DB writes every 15 seconds
    setInterval(flushPendingDbWrites, 15000);
}

bootstrap();

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
            const lastSeenTime = value.lastSeen ? new Date(value.lastSeen).getTime() : 0;
            // Mark online if seen in the last 24 hours
            const online = (Date.now() - lastSeenTime) < (24 * 60 * 60 * 1000);
            data[key] = {
                ...value,
                online
            };
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
