/**
 * Tuya Cloud Sensor Monitor v2 (Local Daemon)
 * 
 * Polls the Tuya Cloud API using the UID endpoint (/v1.0/users/{uid}/devices)
 * which returns ALL device statuses in a single call. This avoids the 
 * "permission deny" error on individual device status endpoints.
 * 
 * Runs LOCALLY in the hotel computer. Detects door open/close events and
 * syncs to Supabase in real-time so the reception dashboard shows live status.
 * 
 * Run with PM2: pm2 start ecosystem.config.js
 * Or directly:  node scripts/tuya-sensor-monitor.js
 */

const { TuyaContext } = require('@tuya/tuya-connector-nodejs');
const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- ENV LOADING ---
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '../.env.local');
        if (!fs.existsSync(envPath)) return {};
        const envConfig = {};
        fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
            const m = line.match(/^([^=]+)=(.*)$/);
            if (m) envConfig[m[1].trim()] = m[2].trim().replace(/^["'](.*?)["']$/, '$1');
        });
        return envConfig;
    } catch (e) {
        console.error("Error loading .env.local:", e);
        return {};
    }
}

const env = loadEnv();

// --- CONFIGURATION ---
const POLL_INTERVAL_MS = 3000;         // Poll every 3 seconds (avoid API rate limits)
const DB_REFRESH_INTERVAL_MS = 60000;  // Refresh sensor list from DB every minute
const HTTP_PORT = process.env.SENSOR_PORT || 5002;

// Anti-false-positive configuration
const DEBOUNCE_POLLS = 2;              // State must be stable for N consecutive polls before confirming
const RECONNECT_COOLDOWN_MS = 15000;   // Ignore state changes for 15s after sensor reconnects
const MASS_RECONNECT_THRESHOLD = 0.30; // If >30% of sensors change in 1 poll, it's a reconnection event

// Tuya UID (from IoT platform → linked app account)
const TUYA_UID = process.env.TUYA_UID || env.TUYA_UID || 'az1779410416241VvePg';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

const TUYA_CREDENTIALS = {
    ACCESS_ID: process.env.TUYA_ACCESS_ID || env.TUYA_ACCESS_ID,
    ACCESS_SECRET: process.env.TUYA_ACCESS_SECRET || env.TUYA_ACCESS_SECRET,
    REGION_URL: process.env.TUYA_REGION_URL || env.TUYA_REGION_URL || 'https://openapi.tuyaus.com'
};

// Validate
if (!TUYA_CREDENTIALS.ACCESS_ID || !TUYA_CREDENTIALS.ACCESS_SECRET) {
    console.error("❌ Missing TUYA credentials.");
    process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase credentials.");
    process.exit(1);
}

// --- INIT CLIENTS ---
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const tuya = new TuyaContext({
    baseUrl: TUYA_CREDENTIALS.REGION_URL,
    accessKey: TUYA_CREDENTIALS.ACCESS_ID,
    secretKey: TUYA_CREDENTIALS.ACCESS_SECRET,
});

// --- STATE ---
const stateCache = new Map();  // deviceId -> { isOpen, battery, online, lastSeen, name, room }
let sensorDbMap = new Map();   // deviceId -> { id (uuid), name, room_number }
let stats = {
    pollCount: 0,
    eventsDetected: 0,
    eventsSuppressed: 0,
    massReconnections: 0,
    errorsCount: 0,
    apiCalls: 0,
    lastPoll: null,
    startTime: new Date().toISOString(),
    consecutiveApiErrors: 0,
    lastApiError: null,
    pendingDbWrites: 0,
};

// Pending DB writes queue (for Supabase failures)
const pendingDbWrites = [];

// Anti-false-positive state
const pendingChanges = new Map();    // deviceId -> { newState, pollsSeen, firstSeen }
const reconnectCooldown = new Map(); // deviceId -> timestamp when cooldown expires

// --- LOAD SENSORS FROM DB ---
async function refreshSensorList() {
    try {
        const { data, error } = await supabase
            .from('sensors')
            .select('id, device_id, name, room:rooms(number)');

        if (error) throw error;

        const newMap = new Map();
        data.filter(d => d.device_id && d.device_id.length > 5).forEach(d => {
            newMap.set(d.device_id, {
                id: d.id,
                device_id: d.device_id,
                name: d.name,
                room_number: d.room?.number || null,
            });
        });

        if (newMap.size !== sensorDbMap.size) {
            console.log(`[DB] Sensor list refreshed: ${newMap.size} sensors monitored`);
        }

        sensorDbMap = newMap;
    } catch (e) {
        console.error("[DB] Error refreshing sensor list:", e.message);
        stats.errorsCount++;
    }
}

// --- FETCH ALL DEVICES VIA UID (single API call) ---
async function fetchAllDeviceStatuses() {
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 2000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            stats.apiCalls++;
            const res = await tuya.request({
                method: 'GET',
                path: `/v1.0/users/${TUYA_UID}/devices`
            });

            if (!res.success) {
                console.error(`[Tuya] Error: ${res.code} - ${res.msg} (attempt ${attempt}/${MAX_RETRIES})`);
                stats.errorsCount++;
                stats.consecutiveApiErrors++;
                stats.lastApiError = `${res.code}: ${res.msg}`;

                if (attempt < MAX_RETRIES) {
                    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                    console.log(`[Tuya] Retrying in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                return null;
            }

            // Success - reset consecutive errors
            if (stats.consecutiveApiErrors > 0) {
                console.log(`[Tuya] ✅ Reconectado después de ${stats.consecutiveApiErrors} errores consecutivos`);
                // Flush pending DB writes on reconnection
                await flushPendingDbWrites();
            }
            stats.consecutiveApiErrors = 0;
            stats.lastApiError = null;

            return res.result;
        } catch (e) {
            console.error(`[Tuya] Request failed (attempt ${attempt}/${MAX_RETRIES}): ${e.message}`);
            stats.errorsCount++;
            stats.consecutiveApiErrors++;
            stats.lastApiError = e.message;

            if (attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                console.log(`[Tuya] Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    if (stats.consecutiveApiErrors >= 10) {
        console.error(`[Tuya] ⚠️ ${stats.consecutiveApiErrors} errores consecutivos. La API podría estar caída.`);
    }

    return null;
}

// --- PARSE DEVICE STATUS ---
function parseDoorState(device) {
    // The device.status array contains current DP values
    const statusArray = device.status || [];
    
    let isOpen = null;
    let battery = null;

    for (const s of statusArray) {
        // Door state (DP code varies by model)
        if (['door_contact_state', 'doorcontact_state', 'switch', 'switch_1', 'door_state'].includes(s.code)) {
            if (typeof s.value === 'boolean') {
                isOpen = s.value;
            } else if (typeof s.value === 'string') {
                isOpen = s.value === 'true' || s.value === 'open';
            }
        }
        // Battery
        if (['battery', 'battery_percentage', 'battery_state', 'va_battery'].includes(s.code)) {
            battery = typeof s.value === 'number' ? s.value : parseInt(s.value) || null;
        }
    }

    return { isOpen, battery, online: device.online || false };
}

// --- UPDATE DB ---
async function updateSensorState(sensor, isOpen, battery, online) {
    const updateData = {
        is_open: isOpen,
        last_seen: new Date().toISOString(),
        status: online ? 'ONLINE' : 'OFFLINE',
    };

    if (battery !== null && battery !== undefined) {
        updateData.battery_level = battery;
    }

    try {
        const { error } = await supabase
            .from('sensors')
            .update(updateData)
            .eq('device_id', sensor.device_id);

        if (error) throw error;
    } catch (e) {
        console.error(`[DB] Update error ${sensor.name}: ${e.message}. Queuing for retry.`);
        stats.errorsCount++;
        pendingDbWrites.push({
            type: 'update',
            table: 'sensors',
            data: updateData,
            filter: { device_id: sensor.device_id },
            timestamp: Date.now(),
        });
        stats.pendingDbWrites = pendingDbWrites.length;
    }
}

async function logSensorEvent(sensor, isOpen) {
    const eventData = {
        sensor_id: sensor.id,
        event_type: isOpen ? 'OPEN' : 'CLOSE',
        new_state: isOpen,
        payload: { source: 'local_cloud_monitor' },
        created_at: new Date().toISOString()
    };

    try {
        const { error } = await supabase.from('sensor_events').insert(eventData);
        if (error) throw error;
    } catch (e) {
        console.error(`[DB] Event log error ${sensor.name}: ${e.message}. Queuing.`);
        stats.errorsCount++;
        pendingDbWrites.push({
            type: 'insert',
            table: 'sensor_events',
            data: eventData,
            timestamp: Date.now(),
        });
        stats.pendingDbWrites = pendingDbWrites.length;
    }
}

// --- FLUSH PENDING DB WRITES ---
async function flushPendingDbWrites() {
    if (pendingDbWrites.length === 0) return;
    
    console.log(`[DB] Flushing ${pendingDbWrites.length} pending writes...`);
    const toFlush = [...pendingDbWrites];
    pendingDbWrites.length = 0;

    let success = 0;
    let failed = 0;

    for (const write of toFlush) {
        try {
            if (write.type === 'update') {
                const { error } = await supabase
                    .from(write.table)
                    .update(write.data)
                    .eq(Object.keys(write.filter)[0], Object.values(write.filter)[0]);
                if (error) throw error;
            } else if (write.type === 'insert') {
                const { error } = await supabase.from(write.table).insert(write.data);
                if (error) throw error;
            }
            success++;
        } catch (e) {
            console.error(`[DB] Flush failed for ${write.table}: ${e.message}`);
            failed++;
            // Re-queue only if less than 1 hour old
            if (Date.now() - write.timestamp < 3600000) {
                pendingDbWrites.push(write);
            }
        }
    }

    stats.pendingDbWrites = pendingDbWrites.length;
    console.log(`[DB] Flush complete: ${success} OK, ${failed} failed, ${pendingDbWrites.length} still pending`);
}

// --- MAIN POLL LOOP ---
async function pollAllSensors() {
    if (sensorDbMap.size === 0) return;

    stats.pollCount++;
    stats.lastPoll = new Date().toISOString();

    // Single API call to get ALL devices
    const devices = await fetchAllDeviceStatuses();
    if (!devices || !Array.isArray(devices)) return;

    // --- PHASE 1: Collect all state changes this cycle ---
    const changesThisCycle = [];

    for (const device of devices) {
        const deviceId = device.id;
        const sensor = sensorDbMap.get(deviceId);
        if (!sensor) continue;

        const { isOpen, battery, online } = parseDoorState(device);
        const cached = stateCache.get(deviceId);

        // First run: initialize cache and sync to DB (no alerts)
        if (!cached) {
            stateCache.set(deviceId, {
                isOpen,
                battery,
                online,
                lastSeen: new Date().toISOString(),
                name: sensor.name,
                room: sensor.room_number,
            });

            if (isOpen !== null) {
                await updateSensorState(sensor, isOpen, battery, online);
                console.log(`[INIT] ${sensor.name} (Hab ${sensor.room_number || '?'}): ${isOpen ? 'ABIERTA \u{1F534}' : 'CERRADA \u{1F7E2}'} | Bat: ${battery}% | ${online ? 'Online' : 'Offline'}`);
            }
            continue;
        }

        // --- RECONNECTION COOLDOWN ---
        // When a sensor comes back online, start a cooldown period
        if (!cached.online && online) {
            const cooldownUntil = Date.now() + RECONNECT_COOLDOWN_MS;
            reconnectCooldown.set(deviceId, cooldownUntil);
            console.log(`[RECONNECT] ${sensor.name} (Hab ${sensor.room_number}): OFFLINE \u2192 ONLINE. Cooldown ${RECONNECT_COOLDOWN_MS / 1000}s`);
            // Update online status but DON'T trigger door state change
            await updateSensorState(sensor, cached.isOpen, battery, online);
            stateCache.set(deviceId, {
                ...cached,
                online,
                battery: battery ?? cached.battery,
                lastSeen: new Date().toISOString(),
            });
            continue;
        }

        // Check if still in cooldown
        const cooldownExpiry = reconnectCooldown.get(deviceId);
        if (cooldownExpiry && Date.now() < cooldownExpiry) {
            // Still in cooldown — silently update state without alerts
            if (isOpen !== null && cached.isOpen !== isOpen) {
                stats.eventsSuppressed++;
                console.log(`[SUPPRESSED] ${sensor.name} (Hab ${sensor.room_number}): Cambio ignorado (cooldown reconexion)`);
            }
            stateCache.set(deviceId, {
                ...cached,
                isOpen: isOpen ?? cached.isOpen,
                battery: battery ?? cached.battery,
                online,
                lastSeen: new Date().toISOString(),
            });
            // Update DB state silently (no event log)
            await updateSensorState(sensor, isOpen ?? cached.isOpen, battery, online);
            continue;
        } else if (cooldownExpiry) {
            reconnectCooldown.delete(deviceId);
        }

        // --- DETECT STATE CHANGE ---
        if (isOpen !== null && cached.isOpen !== isOpen) {
            changesThisCycle.push({ deviceId, sensor, isOpen, battery, online, cached });
        } else {
            // No door change — clear any pending debounce
            if (pendingChanges.has(deviceId)) {
                const pending = pendingChanges.get(deviceId);
                if (pending.newState !== (isOpen ?? cached.isOpen)) {
                    // The pending change reverted — it was a glitch
                    stats.eventsSuppressed++;
                    console.log(`[DEBOUNCE] ${sensor.name} (Hab ${sensor.room_number}): Cambio revertido, falso positivo descartado`);
                    pendingChanges.delete(deviceId);
                }
            }

            // Update online/battery changes silently
            if (cached.online !== online) {
                console.log(`[STATUS] ${sensor.name}: ${online ? '\u{1F7E2} ONLINE' : '\u{1F534} OFFLINE'}`);
                await updateSensorState(sensor, isOpen ?? cached.isOpen, battery, online);
            } else if (battery !== null && cached.battery !== battery) {
                await updateSensorState(sensor, isOpen ?? cached.isOpen, battery, online);
            }
        }

        // Update cache (always)
        stateCache.set(deviceId, {
            isOpen: isOpen ?? cached.isOpen,
            battery: battery ?? cached.battery,
            online,
            lastSeen: new Date().toISOString(),
            name: sensor.name,
            room: sensor.room_number,
        });
    }

    // --- PHASE 2: Mass reconnection detection ---
    if (changesThisCycle.length > 0) {
        const monitoredCount = sensorDbMap.size;
        const changeRatio = changesThisCycle.length / monitoredCount;

        if (changeRatio >= MASS_RECONNECT_THRESHOLD) {
            // Too many sensors changed at once — this is a connectivity event, not real activity
            stats.massReconnections++;
            stats.eventsSuppressed += changesThisCycle.length;
            console.log(`\n[MASS RECONNECT] \u26a0\ufe0f ${changesThisCycle.length}/${monitoredCount} sensores cambiaron (${(changeRatio * 100).toFixed(0)}%). Suprimiendo todos como falsos positivos.\n`);

            // Update DB state silently for all (no events logged)
            for (const change of changesThisCycle) {
                await updateSensorState(change.sensor, change.isOpen, change.battery, change.online);
                pendingChanges.delete(change.deviceId);
            }
            return;
        }
    }

    // --- PHASE 3: Debounce individual changes ---
    for (const change of changesThisCycle) {
        const { deviceId, sensor, isOpen, battery, online } = change;
        const pending = pendingChanges.get(deviceId);

        if (!pending || pending.newState !== isOpen) {
            // First time seeing this change — start debounce
            pendingChanges.set(deviceId, {
                newState: isOpen,
                pollsSeen: 1,
                firstSeen: Date.now(),
            });
            // Update DB immediately (UI shows current state) but don't log event yet
            await updateSensorState(sensor, isOpen, battery, online);
        } else {
            // Same change seen again — increment counter
            pending.pollsSeen++;

            if (pending.pollsSeen >= DEBOUNCE_POLLS) {
                // Confirmed real change!
                const emoji = isOpen ? '\u{1F534} ABIERTA' : '\u{1F7E2} CERRADA';
                const room = sensor.room_number || '?';
                const time = new Date().toLocaleTimeString('es-MX');

                console.log(`\n*** [${time}] [CONFIRMADO] ${sensor.name} (Hab ${room}): ${emoji} (estable ${pending.pollsSeen} polls) ***\n`);

                await updateSensorState(sensor, isOpen, battery, online);
                await logSensorEvent(sensor, isOpen);
                stats.eventsDetected++;
                pendingChanges.delete(deviceId);
            } else {
                // Not yet confirmed — waiting for more polls
                console.log(`[DEBOUNCE] ${sensor.name} (Hab ${sensor.room_number}): Cambio visto ${pending.pollsSeen}/${DEBOUNCE_POLLS} polls`);
                await updateSensorState(sensor, isOpen, battery, online);
            }
        }
    }
}

// --- HTTP STATUS SERVER ---
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = req.url.split('?')[0];

    if (url === '/status' || url === '/api/status' || url === '/' ||
        url === '/sensors/status' || url === '/sensors/api/status') {

        const sensorStatus = {};
        let onlineCount = 0;
        let openCount = 0;

        stateCache.forEach((value, key) => {
            sensorStatus[key] = {
                name: value.name,
                room: value.room,
                isOpen: value.isOpen,
                battery: value.battery,
                online: value.online,
                lastSeen: value.lastSeen,
            };
            if (value.online) onlineCount++;
            if (value.isOpen) openCount++;
        });

        const response = {
            success: true,
            service: 'Luxor IoT Sensor Monitor v3 (Anti False-Positive)',
            timestamp: new Date().toISOString(),
            stats: {
                ...stats,
                uptime: Math.floor((Date.now() - new Date(stats.startTime).getTime()) / 1000) + 's',
                sensorsMonitored: sensorDbMap.size,
                sensorsOnline: onlineCount,
                doorsOpen: openCount,
                pendingDebounce: pendingChanges.size,
                activeCooldowns: reconnectCooldown.size,
            },
            antifalsePositive: {
                debouncePollsRequired: DEBOUNCE_POLLS,
                reconnectCooldownSec: RECONNECT_COOLDOWN_MS / 1000,
                massReconnectThreshold: `${(MASS_RECONNECT_THRESHOLD * 100).toFixed(0)}%`,
            },
            sensors: sensorStatus,
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response, null, 2));
    } else if (url === '/health') {
        const healthy = stats.consecutiveApiErrors < 10;
        res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: healthy ? 'ok' : 'degraded',
            sensors: sensorDbMap.size,
            consecutiveErrors: stats.consecutiveApiErrors,
            pendingWrites: pendingDbWrites.length,
            uptime: Math.floor((Date.now() - new Date(stats.startTime).getTime()) / 1000) + 's',
        }));
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end([
            '🏨 Luxor IoT Sensor Monitor v2',
            '',
            'Endpoints:',
            '  GET /status  - Estado de todos los sensores (JSON)',
            '  GET /health  - Health check',
            '',
            `Sensores monitoreados: ${sensorDbMap.size}`,
            `Sensores online: ${Array.from(stateCache.values()).filter(s => s.online).length}`,
            `Eventos detectados: ${stats.eventsDetected}`,
            `Llamadas API: ${stats.apiCalls}`,
            `Último poll: ${stats.lastPoll || 'N/A'}`,
        ].join('\n'));
    }
});

// --- BOOTSTRAP ---
async function start() {
    console.log("══════════════════════════════════════════════════════════════");
    console.log("    \u{1F3E8} Luxor IoT — Sensor Monitor v3 (Anti False-Positive)");
    console.log("══════════════════════════════════════════════════════════════");
    console.log(`  Tuya Region: ${TUYA_CREDENTIALS.REGION_URL}`);
    console.log(`  Tuya UID:    ${TUYA_UID}`);
    console.log(`  Supabase:    ${SUPABASE_URL}`);
    console.log(`  Poll Rate:   ${POLL_INTERVAL_MS}ms`);
    console.log(`  HTTP Port:   ${HTTP_PORT}`);
    console.log("");

    // Load sensors from DB
    console.log("[BOOT] Loading sensors from database...");
    await refreshSensorList();
    console.log(`[BOOT] ${sensorDbMap.size} sensors to monitor\n`);

    // Initial poll
    console.log("[BOOT] Running initial status sync...\n");
    await pollAllSensors();

    // Start polling loop
    console.log(`\n[RUNNING] Monitoring ${sensorDbMap.size} sensors every ${POLL_INTERVAL_MS / 1000}s...`);
    console.log(`[RUNNING] Using single API call per poll (efficient)\n`);
    setInterval(pollAllSensors, POLL_INTERVAL_MS);

    // Refresh sensor list periodically
    setInterval(refreshSensorList, DB_REFRESH_INTERVAL_MS);

    // Start HTTP server
    server.listen(HTTP_PORT, () => {
        console.log(`[SERVER] Status API: http://localhost:${HTTP_PORT}/status`);
        console.log("[SERVER] Proxy via print-server: https://print.autohoteluxor.com/sensors/status\n");
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log("\n[SHUTDOWN] Stopping sensor monitor...");
    server.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log("\n[SHUTDOWN] Stopping sensor monitor...");
    server.close();
    process.exit(0);
});

start().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
