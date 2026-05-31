/**
 * Tuya Device Listing - Using known UID
 * UID: az1779410416241VvePg (45 devices linked)
 */

const { TuyaContext } = require('@tuya/tuya-connector-nodejs');
const fs = require('fs');
const path = require('path');

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

const tuya = new TuyaContext({
    baseUrl: env.TUYA_REGION_URL || 'https://openapi.tuyaus.com',
    accessKey: env.TUYA_ACCESS_ID,
    secretKey: env.TUYA_ACCESS_SECRET,
});

async function req(method, apiPath, query = {}) {
    try {
        const opts = { method, path: apiPath };
        if (Object.keys(query).length > 0) opts.query = query;
        const res = await tuya.request(opts);
        return res;
    } catch (e) {
        return { success: false, msg: e.message, code: 'ERROR' };
    }
}

async function main() {
    const UID = 'az1779410416241VvePg';
    const saveFlag = process.argv.includes('--save');

    console.log("══════════════════════════════════════════════════════");
    console.log("    📡 Tuya Cloud — Device Listing (UID Direct)");
    console.log("══════════════════════════════════════════════════════");
    console.log(`  UID:       ${UID}`);
    console.log(`  Region:    ${env.TUYA_REGION_URL}`);
    console.log(`  Save mode: ${saveFlag ? '✅ YES' : '❌ NO (use --save)'}\n`);

    // Strategy 1: Get devices by UID
    console.log("🔍 Fetching devices for UID...\n");
    
    let allDevices = [];

    // Try v1.0 user devices
    const r1 = await req('GET', `/v1.0/users/${UID}/devices`);
    if (r1.success && Array.isArray(r1.result)) {
        allDevices = r1.result;
        console.log(`  ✅ /v1.0/users/{uid}/devices → ${r1.result.length} devices\n`);
    } else {
        console.log(`  ❌ /v1.0/users/{uid}/devices → ${r1.code} ${r1.msg}`);
        
        // Try v1.1
        const r2 = await req('GET', `/v1.1/users/${UID}/devices`);
        if (r2.success && Array.isArray(r2.result)) {
            allDevices = r2.result;
            console.log(`  ✅ /v1.1/users/{uid}/devices → ${r2.result.length} devices\n`);
        } else {
            console.log(`  ❌ /v1.1/users/{uid}/devices → ${r2.code} ${r2.msg}`);
        }
    }

    // If UID didn't work, try getting devices via space + thing API
    if (allDevices.length === 0) {
        console.log("\n🔄 Trying space-based device listing...\n");
        const SPACE_ID = '299463976';
        
        // Try authorized device list
        const endpoints = [
            { path: `/v2.0/cloud/thing/device`, query: { space_id: SPACE_ID, page_size: 100 } },
            { path: `/v1.3/iot-03/devices`, query: { space_id: SPACE_ID, page_no: 1, page_size: 100 } },
            { path: `/v2.0/cloud/thing/device/authorization`, query: { space_id: SPACE_ID, page_size: 100 } },
        ];

        for (const ep of endpoints) {
            const r = await req('GET', ep.path, ep.query);
            console.log(`  ${r.success ? '✅' : '❌'} ${ep.path} → ${r.code || ''} ${r.msg || ''}`);
            
            if (r.success) {
                const list = r.result?.list || r.result?.data || (Array.isArray(r.result) ? r.result : []);
                if (list.length > 0) {
                    allDevices = list;
                    console.log(`     Found ${list.length} devices!`);
                    break;
                } else {
                    console.log(`     Result: ${JSON.stringify(r.result).slice(0, 200)}`);
                }
            }
        }
    }

    // If still nothing, try fetching each known device individually  
    if (allDevices.length === 0) {
        console.log("\n🔄 Fetching known devices individually from tuya-devices.json...\n");
        
        const jsonPath = path.resolve(__dirname, '../tuya-devices.json');
        if (fs.existsSync(jsonPath)) {
            const known = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            
            for (const device of known) {
                const r = await req('GET', `/v1.0/devices/${device.id}`);
                if (r.success && r.result) {
                    allDevices.push(r.result);
                    process.stdout.write(`  ✅ ${r.result.name || device.id}\r`);
                } else {
                    process.stdout.write(`  ❌ ${device.name || device.id}: ${r.code}\r`);
                }
            }
            console.log(`\n  Fetched ${allDevices.length}/${known.length} devices from API`);
        }
    }

    if (allDevices.length === 0) {
        console.log("\n⚠️  Could not retrieve devices.");
        console.log("  The API permissions may need to be enabled.");
        console.log("  Go to iot.tuya.com → Project → Service API → Authorize:");
        console.log("    ✓ Device Management");  
        console.log("    ✓ Smart Home Device Management");
        console.log("    ✓ IoT Core\n");
        return;
    }

    // --- Classify ---
    const hubs = [];
    const sensors = [];
    const other = [];

    for (const d of allDevices) {
        const name = (d.name || '').toLowerCase();
        const model = (d.model || '').toLowerCase();
        const productName = (d.product_name || '').toLowerCase();
        const cat = (d.category || '').toLowerCase();

        if (model.includes('gateway') || model.includes('shgateway') || 
            productName.includes('gateway') || name.includes('hub') ||
            cat === 'wg' || cat === 'wg2') {
            hubs.push(d);
        } else if (model.includes('sensor') || model.includes('shscz') ||
                   productName.includes('sensor') || productName.includes('contact') ||
                   cat === 'mcs' || cat === 'dgnbj') {
            sensors.push(d);
        } else {
            other.push(d);
        }
    }

    // Sort sensors numerically
    sensors.sort((a, b) => {
        const numA = parseInt((a.name || '').match(/\d+/)?.[0] || '0');
        const numB = parseInt((b.name || '').match(/\d+/)?.[0] || '0');
        return numA - numB;
    });

    // --- DISPLAY ---
    console.log("\n" + "═".repeat(70));
    console.log(`  📊 TOTAL DEVICES: ${allDevices.length}`);
    console.log(`     🏠 Hubs/Gateways: ${hubs.length}`);
    console.log(`     📡 Sensors:       ${sensors.length}`);
    if (other.length > 0) console.log(`     ❓ Other:         ${other.length}`);
    console.log("═".repeat(70));

    if (hubs.length > 0) {
        console.log("\n🏠 HUBS / GATEWAYS:");
        console.log("─".repeat(100));
        console.log(
            "  #".padEnd(5) +
            "Name".padEnd(20) +
            "Device ID".padEnd(28) +
            "Model".padEnd(18) +
            "Category".padEnd(10) +
            "Online"
        );
        console.log("─".repeat(100));
        hubs.forEach((h, i) => {
            console.log(
                `  ${(i + 1)}`.padEnd(5) +
                (h.name || 'N/A').padEnd(20) +
                (h.id || 'N/A').padEnd(28) +
                (h.model || h.product_name || 'N/A').padEnd(18) +
                (h.category || 'N/A').padEnd(10) +
                (h.online ? '✅ YES' : '❌ NO')
            );
        });
    }

    if (sensors.length > 0) {
        console.log(`\n📡 SENSORS (${sensors.length}):`);
        console.log("─".repeat(120));
        console.log(
            "  #".padEnd(5) +
            "Name".padEnd(18) +
            "Device ID".padEnd(28) +
            "Model".padEnd(14) +
            "Node ID".padEnd(20) +
            "Cat".padEnd(6) +
            "Online".padEnd(8) +
            "Gateway ID"
        );
        console.log("─".repeat(120));
        sensors.forEach((s, i) => {
            console.log(
                `  ${String(i + 1).padStart(2)}`.padEnd(5) +
                (s.name || 'N/A').padEnd(18) +
                (s.id || 'N/A').padEnd(28) +
                (s.model || 'N/A').padEnd(14) +
                (s.node_id || s.uuid || 'N/A').padEnd(20) +
                (s.category || 'N/A').padEnd(6) +
                (s.online ? '✅' : '❌').padEnd(8) +
                (s.gateway_id || 'N/A')
            );
        });
    }

    if (other.length > 0) {
        console.log(`\n❓ OTHER DEVICES (${other.length}):`);
        console.log("─".repeat(90));
        other.forEach((d, i) => {
            console.log(`  ${i + 1}. ${d.name || 'N/A'} | ID: ${d.id} | Model: ${d.model || 'N/A'} | Cat: ${d.category || 'N/A'} | Online: ${d.online ? 'YES' : 'NO'}`);
        });
    }

    // --- SAVE ---
    if (saveFlag) {
        const outputPath = path.resolve(__dirname, '../tuya-devices.json');
        
        // Backup current file
        if (fs.existsSync(outputPath)) {
            const backupPath = path.resolve(__dirname, `../tuya-devices.backup-${Date.now()}.json`);
            fs.copyFileSync(outputPath, backupPath);
            console.log(`\n📦 Backup saved: ${backupPath}`);
        }

        const saveData = allDevices.map(d => ({
            id: d.id,
            name: d.name || '',
            local_key: d.local_key || '',
            product_name: d.product_name || '',
            model: d.model || '',
            node_id: d.node_id || d.uuid || '',
            online: d.online || false,
            category: d.category || '',
            ...(d.gateway_id ? { gateway_id: d.gateway_id } : {}),
        }));

        fs.writeFileSync(outputPath, JSON.stringify(saveData, null, 2), 'utf8');
        console.log(`✅ Updated tuya-devices.json with ${saveData.length} devices\n`);
    } else {
        console.log(`\n💡 Run with --save to update tuya-devices.json:`);
        console.log(`   node scripts/tuya-list-devices.js --save\n`);
    }
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
