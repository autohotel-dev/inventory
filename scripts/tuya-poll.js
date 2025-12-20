const { TuyaContext } = require('@tuya/tuya-connector-nodejs');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const POLL_INTERVAL_MS = 2000;
const DB_REFRESH_INTERVAL_MS = 60000; // Recargar lista de sensores cada minuto
const CREDENTIALS = {
    ACCESS_ID: 'nuupg99y4yqxxn8gmydw',
    ACCESS_SECRET: '23f8bff93f554fe1b32eb4b286c3d4fe',
    REGION_URL: 'https://openapi.tuyaus.com'
};

// --- ENV LOADING ---
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '../.env.local');
        if (!fs.existsSync(envPath)) return {};
        const envConfig = {};
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["'](.*)["']$/, '$1'); // Remove quotes
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
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ CRITICAL ERROR: Missing Supabase Credentials in .env.local");
    console.error("Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
    process.exit(1);
}

// --- INIT CLIENTS ---
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const tuya = new TuyaContext({
    baseUrl: CREDENTIALS.REGION_URL,
    accessKey: CREDENTIALS.ACCESS_ID,
    secretKey: CREDENTIALS.ACCESS_SECRET,
});

// --- STATE ---
let monitoredDevices = new Set(); // Set of device IDs
const stateCache = new Map();

// --- FUNCTIONS ---

async function fetchSensorsFromDB() {
    try {
        const { data, error } = await supabase
            .from('sensors')
            .select('device_id, name, room:rooms(number)');

        if (error) throw error;

        const newSet = new Set(data.map(d => d.device_id).filter(id => id && id.length > 5));

        // Log changes
        if (newSet.size !== monitoredDevices.size) {
            console.log(`[DB] Updated Sensor List: ${newSet.size} devices found.`);
        }

        monitoredDevices = newSet;
        return data; // Return full data for logging/names
    } catch (e) {
        console.error("Error fetching sensors from DB:", e.message);
        return [];
    }
}

async function getTuyaStatus(deviceId) {
    try {
        const res = await tuya.request({
            method: 'GET',
            path: `/v1.0/devices/${deviceId}/status`
        });
        if (!res.success) {
            // Silence common offline errors to keep logs clean, or log verbose?
            // console.log(`Error polling ${deviceId}: ${res.code}`);
            return null;
        }
        return res.result;
    } catch (e) {
        // console.error(`Error polling ${deviceId}:`, e.message);
        return null;
    }
}

async function reportToApi(deviceId, statusArray, isOpen) {
    try {
        // Update DB directly since we have the client, faster than webhook loopback
        // BUT webhook handles event logging logic. Let's stick to webhook structure or replicate it.
        // Let's replicate it here for speed/Reliability

        // 1. Update Sensor Status
        await supabase.from('sensors').update({
            is_open: isOpen,
            last_seen: new Date().toISOString(),
            status: 'ONLINE'
        }).eq('device_id', deviceId);

        // 2. Insert Event
        await supabase.from('sensor_events').insert({
            sensor_id: (await getSensorId(deviceId)), // Need internal ID? Or trigger?
            event_type: isOpen ? 'OPEN' : 'CLOSE',
            payload: { status: statusArray },
            timestamp: new Date().toISOString()
        });

        console.log(`>>> EVENT SENT: ${deviceId} -> ${isOpen ? 'OPEN' : 'CLOSE'}`);

    } catch (e) {
        console.error("Error updating DB:", e.message);
    }
}

// Helper to get internal ID (could cache this too)
async function getSensorId(deviceId) {
    const { data } = await supabase.from('sensors').select('id').eq('device_id', deviceId).single();
    return data ? data.id : null;
}

// --- MAIN LOOP ---

async function pollAll() {
    if (monitoredDevices.size === 0) {
        process.stdout.write(`\r[${new Date().toLocaleTimeString()}] No sensors to poll...`);
        return;
    }

    const promises = Array.from(monitoredDevices).map(async (deviceId) => {
        const status = await getTuyaStatus(deviceId);
        if (!status) return;

        // Logic to detect door state
        const relevant = status.find(s =>
            s.code === 'door_contact_state' ||
            s.code === 'door_sensor_state' ||
            s.code === 'switch' ||
            s.code === 'door_state'
        );

        if (relevant) {
            const cacheKey = `${deviceId}-door`;
            const lastVal = stateCache.get(cacheKey);
            const isOpen = relevant.value === true || relevant.value === 'open' || relevant.value === 'true';

            // First run? Just cache, don't alert (avoid spam on restart)
            // Unless we want to sync state immediately. 
            // Let's sync state to DB on first run but not insert event?
            // For now, simple change detection.

            if (lastVal === undefined) {
                stateCache.set(cacheKey, relevant.value);
                // Optional: Sync initial state to DB without event
                return;
            }

            if (lastVal !== relevant.value) {
                console.log(`\n[CHANGE] Device ${deviceId}: ${isOpen ? 'OPEN 🔴' : 'CLOSE 🟢'}`);
                await reportToApi(deviceId, status, isOpen);
                stateCache.set(cacheKey, relevant.value);
            }
        }
    });

    await Promise.all(promises);
    process.stdout.write(`\r[${new Date().toLocaleTimeString()}] Monitoring ${monitoredDevices.size} sensors... `);
}

// --- BOOTSTRAP ---

console.log("=== Tuya Multi-Sensor Manager ===");
console.log("1. Loading Sensors from Supabase...");

fetchSensorsFromDB().then(() => {
    // Start Polling Loop
    setInterval(pollAll, POLL_INTERVAL_MS);

    // Start DB Refresh Loop
    setInterval(fetchSensorsFromDB, DB_REFRESH_INTERVAL_MS);

    pollAll();
});
