/**
 * Tuya Local Sensor Daemon (Multi-Gateway, 100% LAN)
 *
 * Runs on the hotel computer. Keeps a persistent connection to every Zigbee
 * gateway listed in tuya-devices.json and receives door sensor changes as
 * PUSH events (no Tuya Cloud, no polling). State is synced to Supabase so the
 * reception dashboard updates in real time via Supabase Realtime, and exposed
 * on a local HTTP server (port 5002) that the print-server proxies at /sensors.
 *
 * Flow:
 *   1. Connect to each gateway (fixed IP if known, otherwise UDP discovery).
 *   2. On connect, query every sub-device by its Zigbee node_id (cid) to get
 *      its REAL current state — never assume.
 *   3. Listen for push events; update the DB immediately, log an OPEN/CLOSE
 *      event once the state is stable for EVENT_CONFIRM_MS.
 *   4. Every RESYNC_INTERVAL_MS re-query all sub-devices to catch anything missed.
 *   5. If a gateway stays disconnected > OFFLINE_GRACE_MS its sensors go OFFLINE.
 *
 * Run:  node scripts/sensors/daemon.js        (or pm2 start ecosystem.config.js)
 * Test without touching the DB:  SENSOR_DRY_RUN=1 node scripts/sensors/daemon.js
 * Debug raw gateway traffic:     SENSOR_DEBUG=1 node scripts/sensors/daemon.js
 */

const TuyAPI = require('tuyapi');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const os = require('os');

// --- ENV LOADING ---
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '../../.env.local');
        if (!fs.existsSync(envPath)) return {};
        const envConfig = {};
        fs.readFileSync(envPath, 'utf8').replace(/\r/g, '').split('\n').forEach(line => {
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
const getEnv = (k) => process.env[k] || env[k];

// --- CONFIGURATION ---
const PORT = getEnv('SENSOR_PORT') || 5002;
const DRY_RUN = getEnv('SENSOR_DRY_RUN') === '1';
const DEBUG = getEnv('SENSOR_DEBUG') === '1';
const PROTOCOL_VERSION = getEnv('TUYA_GATEWAY_VERSION') || '3.4';  // Hub firmware switched 3.3 -> 3.4 (3.3 gets ECONNRESET)

const EVENT_CONFIRM_MS = 1500;          // State must hold this long before logging an OPEN/CLOSE event
const GW_COOLDOWN_MS = 8000;            // After (re)connect, changes update state but don't log events
const RESYNC_INTERVAL_MS = 5 * 60000;   // Re-query all sub-devices periodically
const SUBDEVICE_QUERY_GAP_MS = 150;     // Gap between sub-device queries (don't flood the gateway)
const OFFLINE_GRACE_MS = 60000;         // Gateway down this long -> its sensors are OFFLINE
const RECONNECT_MIN_MS = 5000;
const RECONNECT_MAX_MS = 60000;
const REDISCOVER_AFTER_FAILURES = 3;    // Connect failures in a row before looking for the hub at a new IP
const DB_REFRESH_INTERVAL_MS = 60000;
const DB_FLUSH_INTERVAL_MS = 15000;

// Data points of the SHSCZ100 contact sensor (seen through the gateway)
const DOOR_DPS = ['101', '1'];
const BATTERY_DPS = ['103', '102', '2', '15'];

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- LOAD DEVICES (tuya-devices.json holds local keys + Zigbee node ids) ---
const jsonPath = path.resolve(__dirname, '../../tuya-devices.json');
if (!fs.existsSync(jsonPath)) {
    console.error(`❌ ${jsonPath} not found. Copy it from the hotel computer (it contains the local keys).`);
    process.exit(1);
}

const allDevices = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const isGateway = d => d.model === 'SHGATEWAYZWB' || d.category === 'wg2' || /hub|gateway/i.test(d.product_name || '');
const isSensor = d => !isGateway(d) && (d.model === 'SHSCZ100' || d.category === 'mcs' || /sensor/i.test(d.product_name || ''));

// Optional fixed IPs (skips UDP discovery), with optional per-hub protocol version:
// TUYA_GATEWAY_IPS="HUB 139=192.168.1.47,HUB 141=192.168.1.40@3.3"
const fixedIps = new Map(
    (getEnv('TUYA_GATEWAY_IPS') || '').split(',').map(p => p.split('=').map(s => s.trim())).filter(p => p.length === 2 && p[1])
        .map(([name, target]) => {
            const [ip, version] = target.split('@').map(s => s.trim());
            return [name, { ip, version: version || null }];
        })
);

// Sub-devices share the local_key of their gateway
const gateways = allDevices.filter(isGateway).map(gw => ({
    ...gw,
    ip: (fixedIps.get(gw.name) || fixedIps.get(gw.id))?.ip || gw.ip || null,
    version: (fixedIps.get(gw.name) || fixedIps.get(gw.id))?.version || PROTOCOL_VERSION,
    sensors: allDevices.filter(d => isSensor(d) && d.local_key === gw.local_key),
    client: null,
    connected: false,
    connecting: false,
    reconnectDelay: RECONNECT_MIN_MS,
    reconnectTimer: null,
    cooldownUntil: 0,
    disconnectedSince: Date.now(),
    lastData: null,
    lastError: null,
    resolvedIp: null,
    failures: 0,
    hubOffline: new Set(),   // node ids the hub itself reports as offline
    lastStatusList: null,
}));

const sensorsByNode = new Map();  // node_id -> { device, gateway }
gateways.forEach(gw => gw.sensors.forEach(s => sensorsByNode.set(s.node_id, { device: s, gateway: gw })));

const orphanSensors = allDevices.filter(d => isSensor(d) && !sensorsByNode.has(d.node_id));
const warnedUnknownNodes = new Set();

// --- STATE ---
let sensorDbMap = new Map();       // device_id -> { id (uuid), name, room_number }
const stateCache = new Map();      // device_id -> { name, room, isOpen, battery, online, lastSeen, gateway }
const pendingEvents = new Map();   // device_id -> { isOpen, timer }
const pendingDbWrites = [];
const loggedRawDps = new Set();
const stats = {
    startTime: new Date().toISOString(),
    eventsLogged: 0,
    eventsSuppressed: 0,
    pushMessages: 0,
    resyncs: 0,
    dbErrors: 0,
};

const now = () => new Date().toISOString();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- DATABASE ---
async function refreshSensorList() {
    try {
        const { data, error } = await supabase.from('sensors').select('id, device_id, name, room:rooms(number)');
        if (error) throw error;
        const next = new Map();
        data.forEach(d => next.set(d.device_id, { id: d.id, name: d.name, room_number: d.room?.number || null }));
        if (next.size !== sensorDbMap.size) console.log(`[DB] ${next.size} sensors registered in Supabase`);
        sensorDbMap = next;
    } catch (e) {
        console.error("[DB] Error loading sensors:", e.message);
    }
}

async function runDbWrite(write) {
    if (DRY_RUN) return;
    if (write.type === 'update') {
        const { error } = await supabase.from('sensors').update(write.data).eq('device_id', write.deviceId);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('sensor_events').insert(write.data);
        if (error) throw error;
    }
}

async function dbWrite(write) {
    try {
        await runDbWrite(write);
    } catch (e) {
        stats.dbErrors++;
        console.error(`[DB] Write failed (${write.type} ${write.deviceId || ''}): ${e.message}. Queued.`);
        pendingDbWrites.push({ ...write, timestamp: Date.now() });
    }
}

async function flushPendingDbWrites() {
    if (pendingDbWrites.length === 0) return;
    const toFlush = pendingDbWrites.splice(0);
    let ok = 0;
    for (const write of toFlush) {
        try {
            await runDbWrite(write);
            ok++;
        } catch (e) {
            if (Date.now() - write.timestamp < 3600000) pendingDbWrites.push(write);
        }
    }
    console.log(`[DB] Flush: ${ok} OK, ${pendingDbWrites.length} still queued`);
}

function writeSensorState(deviceId, fields) {
    const data = { last_seen: now(), ...fields };
    return dbWrite({ type: 'update', deviceId, data });
}

function logSensorEvent(deviceId, isOpen) {
    const dbSensor = sensorDbMap.get(deviceId);
    if (!dbSensor) return;
    stats.eventsLogged++;
    return dbWrite({
        type: 'insert',
        data: {
            sensor_id: dbSensor.id,
            event_type: isOpen ? 'OPEN' : 'CLOSE',
            payload: { source: 'local_gateway', new_state: isOpen },
            created_at: now(),
        },
    });
}

// --- PARSING ---
function parseDps(dps) {
    let isOpen = null;
    let battery = null;
    for (const dp of DOOR_DPS) {
        if (dps[dp] === undefined) continue;
        const v = dps[dp];
        if (typeof v === 'boolean') isOpen = v;
        else if (typeof v === 'string') isOpen = v === 'true' || v === 'open';
        if (isOpen !== null) break;
    }
    for (const dp of BATTERY_DPS) {
        const v = Number(dps[dp]);
        if (dps[dp] !== undefined && Number.isFinite(v) && v >= 0 && v <= 100) {
            battery = v;
            break;
        }
    }
    return { isOpen, battery };
}

function label(deviceId) {
    const c = stateCache.get(deviceId);
    const db = sensorDbMap.get(deviceId);
    return `${c?.name || db?.name || deviceId} (Hab ${db?.room_number || '?'})`;
}

// --- STATE HANDLING ---
function handleSubdeviceData(gw, cid, dps, source) {
    const entry = sensorsByNode.get(cid);
    if (!entry) {
        if (DEBUG) console.log(`[${gw.name}] Unknown sub-device cid=${cid} dps=${JSON.stringify(dps)}`);
        return;
    }
    const deviceId = entry.device.id;
    if (source === 'push') gw.hubOffline.delete(cid);
    const online = !gw.hubOffline.has(cid);

    if (!loggedRawDps.has(deviceId)) {
        loggedRawDps.add(deviceId);
        if (DEBUG) console.log(`[DPS] ${entry.device.name}: ${JSON.stringify(dps)}`);
    }

    const { isOpen, battery } = parseDps(dps);
    const prev = stateCache.get(deviceId);
    const known = prev && prev.isOpen !== null && prev.isOpen !== undefined;

    const next = {
        name: entry.device.name,
        room: sensorDbMap.get(deviceId)?.room_number || null,
        isOpen: isOpen ?? prev?.isOpen ?? null,
        battery: battery ?? prev?.battery ?? null,
        online,
        lastSeen: online ? now() : prev?.lastSeen ?? null,
        gateway: gw.name,
    };
    stateCache.set(deviceId, next);

    const doorChanged = isOpen !== null && (!known || prev.isOpen !== isOpen);
    const batteryChanged = battery !== null && prev?.battery !== battery;
    const cameOnline = online && (!prev || !prev.online);

    if (doorChanged || batteryChanged || cameOnline) {
        const fields = online ? { status: 'ONLINE' } : {};
        if (next.isOpen !== null) fields.is_open = next.isOpen;
        if (next.battery !== null) fields.battery_level = next.battery;
        writeSensorState(deviceId, fields);
    }

    if (!doorChanged) {
        // Door went back to its previous state before confirmation -> glitch
        const pending = pendingEvents.get(deviceId);
        if (pending && isOpen !== null && pending.isOpen !== isOpen) {
            clearTimeout(pending.timer);
            pendingEvents.delete(deviceId);
            stats.eventsSuppressed++;
            console.log(`[GLITCH] ${label(deviceId)}: revertido, evento descartado`);
        }
        return;
    }

    const emoji = isOpen ? 'ABIERTA 🔴' : 'CERRADA 🟢';

    // Initial sync / resync / gateway cooldown: update state, don't log an event
    if (!known || source !== 'push' || Date.now() < gw.cooldownUntil) {
        if (known) stats.eventsSuppressed++;
        console.log(`[SYNC] ${label(deviceId)}: ${emoji} | Bat: ${next.battery ?? '?'}%`);
        return;
    }

    console.log(`[PUSH] ${label(deviceId)}: ${emoji}`);
    const existing = pendingEvents.get(deviceId);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
        pendingEvents.delete(deviceId);
        if (stateCache.get(deviceId)?.isOpen !== isOpen) return;
        console.log(`*** [${new Date().toLocaleTimeString('es-MX')}] [EVENTO] ${label(deviceId)}: ${emoji} ***`);
        logSensorEvent(deviceId, isOpen);
    }, EVENT_CONFIRM_MS);
    pendingEvents.set(deviceId, { isOpen, timer });
}

function onGatewayData(gw, data, source = 'push') {
    gw.lastData = now();
    stats.pushMessages++;
    if (DEBUG) console.log(`[RAW] [${gw.name}]`, JSON.stringify(data));
    if (!data || typeof data !== 'object') return;

    if (Array.isArray(data.online) || Array.isArray(data.offline)) {
        applyHubStatusList(gw, data.online || [], data.offline || []);
        return;
    }

    const payload = data.dps ? data : data.result?.dps ? data.result : data.data?.dps ? data.data : null;
    if (!payload) return;
    const cid = payload.cid || data.cid || data.data?.cid;
    if (!cid) return;  // gateway's own DPs
    handleSubdeviceData(gw, cid, payload.dps, source);
}

function setSensorOnline(gw, s, online) {
    const c = stateCache.get(s.id);
    if (c && c.online === online) return;
    stateCache.set(s.id, {
        ...(c || { name: s.name, room: sensorDbMap.get(s.id)?.room_number || null, isOpen: null, battery: null, lastSeen: null }),
        online,
        lastSeen: online ? now() : c?.lastSeen ?? null,
        gateway: gw.name,
    });
    dbWrite({ type: 'update', deviceId: s.id, data: { status: online ? 'ONLINE' : 'OFFLINE' } });
}

// The hub's own view of which sub-devices are reachable over Zigbee
function applyHubStatusList(gw, onlineNodes, offlineNodes) {
    gw.lastStatusList = now();
    gw.hubOffline = new Set(offlineNodes);
    const online = new Set(onlineNodes);
    const went = { on: [], off: [] };
    gw.sensors.forEach(s => {
        const isOnline = online.has(s.node_id);
        const was = stateCache.get(s.id)?.online;
        setSensorOnline(gw, s, isOnline);
        if (was !== isOnline) (isOnline ? went.on : went.off).push(s.name);
    });
    if (went.off.length) console.warn(`[${gw.name}] ⚠️ El hub reporta OFFLINE: ${went.off.join(', ')}`);
    if (went.on.length && DEBUG) console.log(`[${gw.name}] El hub reporta ONLINE: ${went.on.join(', ')}`);

    const unknown = [...onlineNodes, ...offlineNodes].filter(n => !sensorsByNode.has(n) && !warnedUnknownNodes.has(n));
    unknown.forEach(n => warnedUnknownNodes.add(n));
    if (unknown.length) console.warn(`[${gw.name}] ⚠️ Sub-dispositivos que no están en tuya-devices.json: ${unknown.join(', ')}`);
}

// Ask the hub which sub-devices are online (LAN_EXT_STREAM "subdev_online_stat_query").
// tuyapi has no API for it (and its LAN_EXT_STREAM constant is wrong: the command is 0x40),
// so encode it as a header-less 3.4 query, then patch the command byte and re-sign the HMAC.
// The answer arrives as a 'data' event: {"online": [...node ids], "offline": [...]}.
function requestHubStatusList(gw) {
    if (!gw.connected || gw.version !== '3.4') return;
    try {
        const client = gw.client;
        const buf = client.device.parser.encode({
            data: JSON.stringify({ reqType: 'subdev_online_stat_query', data: {} }),
            commandByte: 16,  // DP_QUERY_NEW: encoded without the 3.4 version header, like 0x40
            sequenceN: ++client._currentSequenceN,
        });
        buf.writeUInt32BE(0x40, 8);
        client.device.parser.cipher.hmac(buf.slice(0, buf.length - 36)).copy(buf, buf.length - 36);
        client.client.write(buf);
    } catch (e) {
        if (DEBUG) console.log(`[${gw.name}] subdev_online_stat_query failed: ${e.message}`);
    }
}

// Query every sub-device of a gateway for its real current state
async function syncGatewaySubdevices(gw, reason) {
    const startedAt = now();
    let ok = 0;
    for (const s of gw.sensors) {
        if (!gw.connected) return;
        try {
            const res = await gw.client.get({ cid: s.node_id, schema: true });
            if (res && typeof res === 'object' && res.dps) {
                handleSubdeviceData(gw, s.node_id, res.dps, reason);
                ok++;
            }
        } catch (e) {
            if (DEBUG) console.log(`[${gw.name}] Query ${s.name} failed: ${e.message}`);
        }
        await sleep(SUBDEVICE_QUERY_GAP_MS);
    }
    console.log(`[${gw.name}] ${reason}: ${ok}/${gw.sensors.length} sensores respondieron`);

    // Online/offline comes from the hub's own list; wait a bit for its answer
    requestHubStatusList(gw);
    for (let i = 0; i < 10 && !(gw.lastStatusList >= startedAt); i++) await sleep(500);
    if (!gw.connected || gw.lastStatusList >= startedAt) return;

    // Fallback (no list): a sensor that sent nothing during the sync is treated as OFFLINE.
    // It comes back ONLINE by itself as soon as it reports anything.
    const silent = gw.sensors.filter(s => {
        const c = stateCache.get(s.id);
        return !c || (c.online && (!c.lastSeen || c.lastSeen < startedAt));
    });
    silent.forEach(s => {
        const c = stateCache.get(s.id);
        stateCache.set(s.id, { ...(c || { name: s.name, isOpen: null, battery: null, lastSeen: null }), online: false, gateway: gw.name });
        dbWrite({ type: 'update', deviceId: s.id, data: { status: 'OFFLINE' } });
    });
    if (silent.length) console.warn(`[${gw.name}] ⚠️ Sin respuesta (OFFLINE): ${silent.map(s => s.name).join(', ')}`);
}

// --- GATEWAY CONNECTION (one client per gateway, self-healing) ---
function scheduleReconnect(gw) {
    if (gw.reconnectTimer) return;
    const delay = gw.reconnectDelay;
    gw.reconnectDelay = Math.min(gw.reconnectDelay * 2, RECONNECT_MAX_MS);
    console.log(`[${gw.name}] Reintentando en ${delay / 1000}s...`);
    gw.reconnectTimer = setTimeout(() => {
        gw.reconnectTimer = null;
        connectGateway(gw);
    }, delay);
}

function createClient_(gw) {
    const client = new TuyAPI({
        id: gw.id,
        key: gw.local_key,
        ip: gw.ip || undefined,
        version: gw.version,
        issueGetOnConnect: false,
        issueRefreshOnConnect: false,
    });

    client.on('connected', () => {
        gw.connected = true;
        gw.reconnectDelay = RECONNECT_MIN_MS;
        gw.cooldownUntil = Date.now() + GW_COOLDOWN_MS;
        gw.disconnectedSince = null;
        gw.lastError = null;
        gw.failures = 0;
        console.log(`[${gw.name}] ✅ Conectado (${client.device.ip}) — ${gw.sensors.length} sensores`);
        syncGatewaySubdevices(gw, 'sync inicial');
    });

    client.on('disconnected', () => {
        if (!gw.connected && gw.connecting) return;
        gw.connected = false;
        gw.disconnectedSince = gw.disconnectedSince || Date.now();
        console.log(`[${gw.name}] ❌ Desconectado`);
        scheduleReconnect(gw);
    });

    client.on('error', (err) => {
        gw.lastError = err?.message || String(err);
        if (DEBUG) console.error(`[${gw.name}] Error: ${gw.lastError}`);
    });

    client.on('data', (data) => onGatewayData(gw, data, 'push'));
    client.on('dp-refresh', (data) => onGatewayData(gw, data, 'push'));

    return client;
}

// --- IP RECOVERY (the router may hand a hub a new DHCP lease) ---
// Hosts on the local /24 networks with the Tuya port open
async function scanTuyaHosts() {
    const prefixes = new Set();
    for (const addrs of Object.values(os.networkInterfaces())) {
        for (const a of addrs || []) {
            if (a.family === 'IPv4' && !a.internal && a.netmask === '255.255.255.0' && !/^172\.(1[7-9]|2\d|3[01])\./.test(a.address)) {
                prefixes.add(a.address.split('.').slice(0, 3).join('.'));
            }
        }
    }
    const probe = ip => new Promise(resolve => {
        const sock = net.connect({ host: ip, port: 6668, timeout: 1000 });
        sock.on('connect', () => { sock.destroy(); resolve(ip); });
        sock.on('timeout', () => { sock.destroy(); resolve(null); });
        sock.on('error', () => resolve(null));
    });
    const ips = [...prefixes].flatMap(p => Array.from({ length: 254 }, (_, i) => `${p}.${i + 1}`));
    return (await Promise.all(ips.map(probe))).filter(Boolean);
}

// True if the device at `ip` accepts this hub's id + local key
async function isGatewayAt(gw, ip) {
    const probe = new TuyAPI({ id: gw.id, key: gw.local_key, ip, version: gw.version, issueGetOnConnect: false, issueRefreshOnConnect: false });
    probe.on('error', () => { });
    try {
        await probe.connect();
        const res = await Promise.race([probe.get({ schema: true }), sleep(5000).then(() => null)]);
        return Boolean(res);
    } catch {
        return false;
    } finally {
        try { probe.disconnect(); } catch { /* ignore */ }
    }
}

async function rediscoverGateway(gw) {
    console.log(`[${gw.name}] 🔎 No responde en ${gw.client.device.ip || '?'}, buscándolo en la red...`);
    try {
        gw.client.device.ip = undefined;
        await gw.client.find({ timeout: 10 });
        if (gw.client.device.ip) return gw.client.device.ip;
    } catch { /* UDP discovery is often blocked by firewalls/APs, fall back to a scan */ }

    const taken = new Set(gateways.filter(g => g !== gw && g.connected).map(g => g.resolvedIp));
    for (const ip of (await scanTuyaHosts()).filter(ip => !taken.has(ip))) {
        if (await isGatewayAt(gw, ip)) return ip;
    }
    return null;
}

async function connectGateway(gw) {
    if (gw.connecting || gw.connected) return;
    gw.connecting = true;
    try {
        if (!gw.client) gw.client = createClient_(gw);
        if (gw.failures >= REDISCOVER_AFTER_FAILURES) {
            const lastIp = gw.client.device.ip;
            const found = await rediscoverGateway(gw);
            gw.client.device.ip = found || gw.ip || undefined;
            if (found && found !== lastIp) {
                console.warn(`[${gw.name}] ⚠️ Cambió de IP: ${lastIp || '?'} → ${found}. Actualiza TUYA_GATEWAY_IPS (o reserva la IP en el router).`);
            }
        }
        if (!gw.client.device.ip) {
            console.log(`[${gw.name}] Buscando en la red local...`);
            await gw.client.find({ timeout: 15 });
        }
        gw.resolvedIp = gw.client.device.ip;
        await gw.client.connect();
    } catch (e) {
        gw.lastError = e.message;
        gw.failures++;
        console.error(`[${gw.name}] No se pudo conectar: ${e.message}`);
        gw.connecting = false;
        try { gw.client.disconnect(); } catch { /* ignore */ }
        // Forget a discovered IP in case the gateway got a new DHCP lease
        if (!gw.ip && gw.client) gw.client.device.ip = undefined;
        scheduleReconnect(gw);
        return;
    }
    gw.connecting = false;
}

// Sensors of a gateway that has been down too long are marked OFFLINE
function checkOfflineGateways() {
    gateways.forEach(gw => {
        if (gw.connected || !gw.disconnectedSince) return;
        if (Date.now() - gw.disconnectedSince < OFFLINE_GRACE_MS) return;
        gw.sensors.forEach(s => {
            const c = stateCache.get(s.id);
            if (c && !c.online) return;
            stateCache.set(s.id, { ...(c || { name: s.name, isOpen: null, battery: null, lastSeen: null }), online: false, gateway: gw.name });
            dbWrite({ type: 'update', deviceId: s.id, data: { status: 'OFFLINE' } });
        });
    });
}

// --- HTTP STATUS SERVER (proxied by print-server at /sensors) ---
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    const url = req.url.split('?')[0].replace(/\/+$/, '') || '/';
    const gatewaysInfo = gateways.map(g => ({
        name: g.name,
        id: g.id,
        ip: g.resolvedIp || g.ip,
        connected: g.connected,
        sensors: g.sensors.length,
        lastData: g.lastData,
        lastError: g.lastError,
    }));

    if (['/', '/status', '/api/status', '/sensors', '/sensors/status', '/sensors/api/status'].includes(url)) {
        const sensors = {};
        stateCache.forEach((v, k) => { sensors[k] = v; });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            service: 'Luxor IoT Local Gateway Daemon',
            timestamp: now(),
            dryRun: DRY_RUN,
            stats: {
                ...stats,
                uptime: Math.floor((Date.now() - new Date(stats.startTime).getTime()) / 1000) + 's',
                gatewaysConnected: gateways.filter(g => g.connected).length,
                gatewaysTotal: gateways.length,
                sensorsKnown: stateCache.size,
                sensorsOnline: [...stateCache.values()].filter(s => s.online).length,
                doorsOpen: [...stateCache.values()].filter(s => s.isOpen).length,
                pendingDbWrites: pendingDbWrites.length,
            },
            gateways: gatewaysInfo,
            sensors,
        }, null, 2));
    } else if (url === '/health' || url === '/sensors/health') {
        const healthy = gateways.every(g => g.connected);
        res.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: healthy ? 'ok' : 'degraded', gateways: gatewaysInfo, pendingDbWrites: pendingDbWrites.length }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Endpoints: GET /status, GET /health');
    }
});

// --- BOOTSTRAP ---
async function start() {
    console.log("══════════════════════════════════════════════════════════════");
    console.log("   🏨 Luxor IoT — Local Gateway Daemon (sin nube, tiempo real)");
    console.log("══════════════════════════════════════════════════════════════");
    console.log(`  Gateways: ${gateways.length} | Sensores: ${sensorsByNode.size} | Protocolo: ${PROTOCOL_VERSION}`);
    gateways.forEach(g => console.log(`   • ${g.name}: ${g.sensors.length} sensores${g.ip ? ` @ ${g.ip}` : ''}${g.version !== PROTOCOL_VERSION ? ` (v${g.version})` : ''}`));
    if (orphanSensors.length) console.warn(`  ⚠️ Sensores sin gateway: ${orphanSensors.map(s => s.name).join(', ')}`);
    if (DRY_RUN) console.log("  🧪 DRY RUN: no se escribe nada en Supabase");
    console.log("");

    await refreshSensorList();
    const notInDb = [...sensorsByNode.values()].filter(e => !sensorDbMap.has(e.device.id));
    if (notInDb.length) console.warn(`[DB] ⚠️ Sensores sin registro en Supabase: ${notInDb.map(e => e.device.name).join(', ')}`);

    server.listen(PORT, () => console.log(`[SERVER] http://localhost:${PORT}/status\n`));

    gateways.forEach(connectGateway);

    setInterval(refreshSensorList, DB_REFRESH_INTERVAL_MS);
    setInterval(flushPendingDbWrites, DB_FLUSH_INTERVAL_MS);
    setInterval(checkOfflineGateways, 10000);
    setInterval(() => {
        stats.resyncs++;
        gateways.filter(g => g.connected).forEach(g => syncGatewaySubdevices(g, 'resync'));
    }, RESYNC_INTERVAL_MS);
}

function shutdown() {
    console.log("\n[SHUTDOWN] Cerrando conexiones...");
    gateways.forEach(g => { try { g.client?.disconnect(); } catch { /* ignore */ } });
    server.close();
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
