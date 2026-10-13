/**
 * Tuya → Supabase Sensor Sync (non-destructive)
 *
 * Adds the sensors of tuya-devices.json that are missing in the `sensors` table and
 * refreshes the names of the existing ones (matched by device_id). It never deletes
 * sensors or their event history, and never overwrites a room assigned by hand in
 * "Gestión de Sensores": new sensors get a room by name ("Sensor 101" → room "101").
 * Door/battery/status columns belong to the daemon and are not touched.
 *
 * Usage:
 *   node scripts/sensors/sync-to-db.js           # shows what would change
 *   node scripts/sensors/sync-to-db.js --apply   # applies it
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// --- ENV LOADING ---
function loadEnv() {
    const envPath = path.resolve(__dirname, '../../.env.local');
    if (!fs.existsSync(envPath)) return {};
    const envConfig = {};
    fs.readFileSync(envPath, 'utf8').replace(/\r/g, '').split('\n').forEach(line => {
        const m = line.match(/^([^=]+)=(.*)$/);
        if (m) envConfig[m[1].trim()] = m[2].trim().replace(/^["'](.*?)["']$/, '$1');
    });
    return envConfig;
}

const env = loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    console.log("══════════════════════════════════════════════════════");
    console.log("    🔄 Tuya → Supabase Sensor Sync");
    console.log("══════════════════════════════════════════════════════\n");

    // 1. Load devices from JSON
    const jsonPath = path.resolve(__dirname, '../../tuya-devices.json');
    if (!fs.existsSync(jsonPath)) {
        console.error("❌ tuya-devices.json not found. Run scripts/sensors/list-devices.js --save first.");
        process.exit(1);
    }

    const allDevices = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const sensors = allDevices.filter(d => 
        d.model === 'SHSCZ100' || 
        (d.product_name || '').toLowerCase().includes('sensor') ||
        (d.category || '') === 'mcs'
    );
    const hubs = allDevices.filter(d =>
        d.model === 'SHGATEWAYZWB' ||
        (d.name || '').toLowerCase().includes('hub') ||
        (d.category || '') === 'wg2'
    );

    console.log(`  📄 Loaded ${allDevices.length} devices from JSON`);
    console.log(`     📡 ${sensors.length} sensors`);
    console.log(`     🏠 ${hubs.length} hubs\n`);

    const apply = process.argv.includes('--apply');

    // 2. Existing sensors and rooms
    const { data: existingSensors, error: fetchError } = await supabase
        .from('sensors')
        .select('id, device_id, name, room_id');
    if (fetchError) {
        console.error("❌ Error fetching existing sensors:", fetchError.message);
        process.exit(1);
    }
    const { data: rooms, error: roomsError } = await supabase.from('rooms').select('id, number');
    if (roomsError) {
        console.error("❌ Error fetching rooms:", roomsError.message);
        process.exit(1);
    }
    console.log(`  📊 Sensores en BD: ${existingSensors.length} | Habitaciones: ${rooms.length}\n`);

    const roomLookup = Object.fromEntries(rooms.map(r => [r.number, r.id]));
    const roomNumberOf = name => ((name || '').match(/\d+/) || [])[0] || null;
    const byDeviceId = new Map(existingSensors.map(s => [s.device_id, s]));

    // Same name twice in the JSON usually means a replaced sensor still registered
    const nameCount = {};
    sensors.forEach(s => { nameCount[s.name] = (nameCount[s.name] || 0) + 1; });
    Object.entries(nameCount).filter(([, n]) => n > 1)
        .forEach(([name]) => console.warn(`  ⚠️  "${name}" aparece ${nameCount[name]} veces en tuya-devices.json (¿sensor reemplazado?)`));

    // 3. Plan
    const toInsert = [];
    const toRename = [];
    for (const sensor of sensors) {
        const existing = byDeviceId.get(sensor.id);
        if (existing) {
            if (sensor.name && existing.name !== sensor.name) toRename.push({ existing, name: sensor.name });
            continue;
        }
        const roomNumber = roomNumberOf(sensor.name);
        toInsert.push({
            device_id: sensor.id,
            name: sensor.name || `Sensor ${roomNumber || sensor.id}`,
            room_id: roomNumber ? (roomLookup[roomNumber] || null) : null,
            status: 'OFFLINE',     // the daemon sets the real state on its next sync
            is_open: null,
            battery_level: null,
            last_seen: null,
        });
    }
    const jsonIds = new Set(sensors.map(s => s.id));
    const notInJson = existingSensors.filter(s => !jsonIds.has(s.device_id));

    toInsert.forEach(s => console.log(`  ➕ Nuevo: ${s.name} ${s.room_id ? `→ Hab ${roomNumberOf(s.name)}` : '(sin habitación: asígnala en Gestión de Sensores)'}`));
    toRename.forEach(r => console.log(`  ✏️  Renombrar: "${r.existing.name}" → "${r.name}"`));
    notInJson.forEach(s => console.log(`  ❔ En BD pero no en tuya-devices.json (no se borra): ${s.name} (${s.device_id})`));
    if (!toInsert.length && !toRename.length) console.log("  ✅ Nada que cambiar.");

    if (!apply) {
        if (toInsert.length || toRename.length) console.log("\n  (Vista previa. Ejecuta con --apply para aplicar.)");
        return;
    }

    // 4. Apply
    let ok = 0;
    for (const row of toInsert) {
        const { error } = await supabase.from('sensors').insert(row);
        if (error) console.error(`  ❌ ${row.name}: ${error.message}`); else ok++;
    }
    for (const { existing, name } of toRename) {
        const { error } = await supabase.from('sensors').update({ name }).eq('id', existing.id);
        if (error) console.error(`  ❌ ${existing.name}: ${error.message}`); else ok++;
    }
    console.log(`\n  ✅ ${ok}/${toInsert.length + toRename.length} cambios aplicados. Reinicia el daemon para que tome los sensores nuevos.`);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
