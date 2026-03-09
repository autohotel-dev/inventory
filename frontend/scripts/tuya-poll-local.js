/**
 * Tuya Local Polling Script
 * Comunicación directa con Gateway Zigbee (sin Cloud API)
 * 
 * Este script reemplaza tuya-poll.js para evitar los costos del API de Tuya Cloud ($5,500 USD)
 */

const TuyAPI = require('tuyapi');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

// --- CONFIGURATION ---
const POLL_INTERVAL_MS = 3000; // Poll cada 3 segundos
const DB_REFRESH_INTERVAL_MS = 60000; // Recargar lista de sensores cada minuto

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

// Gateway Zigbee Configuration (obtenido de TinyTuya)
const GATEWAY_CONFIG = {
    id: 'eb752faeb525ac46057p0t',
    key: '3{;8f0U4XLXwV#EY',
    ip: '172.16.1.99',
    version: '3.4'
};

// Sensor mappings (obtenido de TinyTuya)
// Cuando lleguen los 50 sensores nuevos, agrégalos aquí
const SENSORS = [
    {
        id: 'eb4f3a0f8e79e8e96fsovm',
        name: 'Door Sensor',
        nodeId: 'a4c138670c440b9e',
        // Mapping: 101 = switch (boolean), 103 = battery (integer)
    }
];

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ CRITICAL ERROR: Missing Supabase Credentials in .env.local");
    console.error("Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
    process.exit(1);
}

// --- INIT CLIENTS ---
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let gateway = null;
const stateCache = new Map();

// --- GATEWAY CONNECTION ---
async function connectToGateway() {
    console.log('[GATEWAY] Connecting to Zigbee Gateway...');

    gateway = new TuyAPI({
        id: GATEWAY_CONFIG.id,
        key: GATEWAY_CONFIG.key,
        ip: GATEWAY_CONFIG.ip,
        version: GATEWAY_CONFIG.version,
        issueRefreshOnConnect: true
    });

    // Add event listeners
    gateway.on('connected', () => {
        console.log('[GATEWAY] ✅ Connected to Gateway!');
    });

    gateway.on('disconnected', () => {
        console.log('[GATEWAY] ❌ Disconnected from Gateway. Reconnecting in 5s...');
        setTimeout(connectToGateway, 5000);
    });

    gateway.on('error', (error) => {
        console.error('[GATEWAY] Error:', error);
    });

    gateway.on('data', (data) => {
        console.log('[GATEWAY] Data received:', JSON.stringify(data, null, 2));
        processGatewayData(data);
    });

    try {
        await gateway.connect();
        console.log('[GATEWAY] Connection established. Requesting status...');

        // Request current status
        const status = await gateway.get({ schema: true });
        console.log('[GATEWAY] Initial status:', JSON.stringify(status, null, 2));
        processGatewayData(status);

    } catch (error) {
        console.error('[GATEWAY] Failed to connect:', error.message);
        console.log('[GATEWAY] Retrying in 10 seconds...');
        setTimeout(connectToGateway, 10000);
    }
}

// --- PROCESS GATEWAY DATA ---
async function processGatewayData(data) {
    if (!data || !data.dps) return;

    // For Zigbee gateways, sub-device data comes in special DPS format
    // We need to parse it to find our sensor states

    for (const [dpId, value] of Object.entries(data.dps)) {
        console.log(`[DPS] ${dpId}: ${JSON.stringify(value)}`);

        // Check if this is a sub-device update
        // The exact format depends on your gateway model
        // Common patterns:
        // - DPS 101 for door sensor switch state
        // - DPS 103 for battery level

        // For now, let's log everything to understand the data format
    }
}

// --- UPDATE SENSOR IN DB ---
async function updateSensorInDB(deviceId, isOpen, batteryLevel = null) {
    try {
        const updateData = {
            is_open: isOpen,
            last_seen: new Date().toISOString(),
            status: 'ONLINE'
        };

        if (batteryLevel !== null && batteryLevel !== undefined) {
            updateData.battery_level = batteryLevel;
        }

        const { error } = await supabase
            .from('sensors')
            .update(updateData)
            .eq('device_id', deviceId);

        if (error) throw error;

        console.log(`[DB] Updated sensor ${deviceId}: ${isOpen ? 'OPEN 🔴' : 'CLOSED 🟢'}`);
    } catch (e) {
        console.error("[DB] Error updating sensor:", e.message);
    }
}

// --- LOG EVENT ---
async function logSensorEvent(deviceId, isOpen) {
    try {
        // Get sensor internal ID
        const { data: sensor } = await supabase
            .from('sensors')
            .select('id')
            .eq('device_id', deviceId)
            .single();

        if (!sensor) return;

        await supabase.from('sensor_events').insert({
            sensor_id: sensor.id,
            event_type: isOpen ? 'OPEN' : 'CLOSE',
            payload: { source: 'local_polling' },
            timestamp: new Date().toISOString()
        });

        console.log(`[EVENT] Logged ${isOpen ? 'OPEN' : 'CLOSE'} for sensor ${deviceId}`);
    } catch (e) {
        console.error("[EVENT] Error logging event:", e.message);
    }
}

// --- ALTERNATIVE: Direct Status Polling (if event-based doesn't work) ---
async function pollGatewayStatus() {
    if (!gateway || !gateway.isConnected()) {
        return;
    }

    try {
        const status = await gateway.get({ schema: true });
        console.log(`[POLL] Gateway status:`, JSON.stringify(status, null, 2));
        processGatewayData(status);
    } catch (error) {
        console.error('[POLL] Error polling gateway:', error.message);
    }
}

// --- BOOTSTRAP ---
console.log("=================================================");
console.log("=== Tuya LOCAL Sensor Manager (No Cloud API) ===");
console.log("=================================================");
console.log(`Gateway IP: ${GATEWAY_CONFIG.ip}`);
console.log(`Sensors: ${SENSORS.length}`);
console.log("");

// Connect to gateway
connectToGateway();

// Set up polling interval as backup
setInterval(pollGatewayStatus, POLL_INTERVAL_MS);

console.log("[INFO] Waiting for gateway connection...");
console.log("[INFO] Open/close a door to see sensor events!");
