/**
 * Tuya → Supabase Sync Script
 * 
 * Replaces ALL existing sensors in the database with the ones from tuya-devices.json.
 * Sensors are matched to rooms by name (e.g., "Sensor 101" → Room "101").
 * 
 * Usage: node scripts/tuya-sync-to-db.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// --- ENV LOADING ---
function loadEnv() {
    const envPath = path.resolve(__dirname, '../.env.local');
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
    const jsonPath = path.resolve(__dirname, '../tuya-devices.json');
    if (!fs.existsSync(jsonPath)) {
        console.error("❌ tuya-devices.json not found. Run tuya-list-devices.js --save first.");
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

    // 2. Fetch existing sensors from DB
    const { data: existingSensors, error: fetchError } = await supabase
        .from('sensors')
        .select('id, device_id, name, room_id');

    if (fetchError) {
        console.error("❌ Error fetching existing sensors:", fetchError.message);
        process.exit(1);
    }

    console.log(`  📊 Current sensors in DB: ${existingSensors.length}\n`);

    // 3. Fetch rooms for matching
    const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id, number');

    if (roomsError) {
        console.error("❌ Error fetching rooms:", roomsError.message);
        process.exit(1);
    }

    console.log(`  🏨 Rooms in DB: ${rooms.length}`);
    
    // Build room lookup by number
    const roomLookup = {};
    rooms.forEach(r => {
        roomLookup[r.number] = r.id;
    });

    // 4. Delete old sensor_events first (foreign key constraint)
    if (existingSensors.length > 0) {
        console.log("\n  🗑️  Clearing old sensor events...");
        const oldIds = existingSensors.map(s => s.id);
        
        // Delete events in batches
        for (let i = 0; i < oldIds.length; i += 50) {
            const batch = oldIds.slice(i, i + 50);
            const { error: evtError } = await supabase
                .from('sensor_events')
                .delete()
                .in('sensor_id', batch);
            
            if (evtError) {
                console.error(`  ⚠️  Error deleting events batch: ${evtError.message}`);
            }
        }
        console.log("     ✅ Events cleared");

        // 5. Delete old sensors
        console.log("  🗑️  Removing old sensors...");
        const { error: delError } = await supabase
            .from('sensors')
            .delete()
            .in('id', oldIds);

        if (delError) {
            console.error("  ❌ Error deleting old sensors:", delError.message);
            process.exit(1);
        }
        console.log(`     ✅ Removed ${existingSensors.length} old sensors`);
    }

    // 6. Insert new sensors
    console.log("\n  📥 Inserting new sensors...\n");

    let inserted = 0;
    let matched = 0;
    let unmatched = 0;

    for (const sensor of sensors) {
        // Extract room number from sensor name (e.g., "Sensor 101" → "101")
        const roomNumMatch = (sensor.name || '').match(/\d+/);
        const roomNumber = roomNumMatch ? roomNumMatch[0] : null;
        const roomId = roomNumber ? (roomLookup[roomNumber] || null) : null;

        if (roomId) {
            matched++;
        } else {
            unmatched++;
        }

        const sensorData = {
            device_id: sensor.id,
            name: sensor.name || `Sensor ${roomNumber || 'Unknown'}`,
            room_id: roomId,
            status: sensor.online ? 'ONLINE' : 'OFFLINE',
            is_open: false,
            battery_level: 100,
            last_seen: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
            .from('sensors')
            .insert(sensorData);

        if (insertError) {
            console.error(`  ❌ Error inserting ${sensor.name}: ${insertError.message}`);
        } else {
            const roomLabel = roomId ? `→ Room ${roomNumber}` : '(sin habitación)';
            console.log(`  ✅ ${sensor.name} ${roomLabel}`);
            inserted++;
        }
    }

    // 7. Summary
    console.log("\n" + "═".repeat(55));
    console.log(`  📊 SYNC COMPLETE`);
    console.log(`     ✅ Inserted:       ${inserted} sensors`);
    console.log(`     🔗 Matched rooms:  ${matched}`);
    console.log(`     ❓ No room match:  ${unmatched}`);
    console.log("═".repeat(55));
    
    if (unmatched > 0) {
        console.log("\n  💡 Sensors without room match can be assigned in the");
        console.log("     Gestión de Sensores page in the admin dashboard.\n");
    }
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
