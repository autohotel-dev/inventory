/**
 * Tuya Device Discovery v4 - Industry SaaS endpoints
 * Uses the correct v2.0 cloud thing APIs with space_id
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

async function req(method, apiPath, query = {}, body) {
    try {
        const opts = { method, path: apiPath };
        if (Object.keys(query).length > 0) opts.query = query;
        if (body) opts.body = body;
        const res = await tuya.request(opts);
        return res;
    } catch (e) {
        return { success: false, msg: e.message, code: 'ERROR' };
    }
}

async function main() {
    const SPACE_ID = '299463976'; // luxor
    
    console.log("══════════════════════════════════════════════════════");
    console.log("    📡 Tuya Device Discovery v4 (ALL endpoints)");
    console.log("══════════════════════════════════════════════════════\n");

    // Complete list of endpoints to try
    const tests = [
        // Industry / SaaS endpoints
        { label: "v2.0 thing device (space)", path: `/v2.0/cloud/thing/device`, query: { space_id: SPACE_ID, page_size: 100 } },
        { label: "v2.0 thing device (no space)", path: `/v2.0/cloud/thing/device`, query: { page_size: 100 } },
        { label: "v1.0 iot-03 devices", path: `/v1.0/iot-03/devices`, query: { page_no: 1, page_size: 100 } },
        { label: "v1.1 iot-03 devices", path: `/v1.1/iot-03/devices`, query: { page_no: 1, page_size: 100 } },
        { label: "v1.2 iot-03 devices", path: `/v1.2/iot-03/devices`, query: { page_no: 1, page_size: 100 } },
        { label: "v1.3 iot-03 devices", path: `/v1.3/iot-03/devices`, query: { page_no: 1, page_size: 100 } },
        { label: "v1.3 iot-03 devices (space)", path: `/v1.3/iot-03/devices`, query: { space_id: SPACE_ID, page_no: 1, page_size: 100 } },
        
        // Device management
        { label: "v1.0 devices (batch known)", path: `/v1.0/devices`, query: { device_ids: 'eba8efcb81d078aa14h4cu,ebddf1a0cb51bbc468icop' } },
        { label: "v1.0 device (single hub)", path: `/v1.0/devices/eba8efcb81d078aa14h4cu` },
        { label: "v1.0 device (single sensor)", path: `/v1.0/devices/eb3999211df939e8f9cwm2` },
        
        // Sub-devices
        { label: "v1.0 sub-devices (main hub)", path: `/v1.0/devices/eba8efcb81d078aa14h4cu/sub-devices` },
        { label: "v1.0 sub-devices (2nd hub)", path: `/v1.0/devices/ebddf1a0cb51bbc468icop/sub-devices` },
        
        // Space-related
        { label: "v2.0 space child", path: `/v2.0/cloud/space/child`, query: { space_id: SPACE_ID } },
        { label: "v2.0 space detail", path: `/v2.0/cloud/space/${SPACE_ID}` },
        { label: "v2.0 space device", path: `/v2.0/cloud/space/${SPACE_ID}/device` },
        
        // Authorization info
        { label: "v1.0 device/authorization", path: `/v2.0/cloud/thing/device/authorization`, query: { space_id: SPACE_ID, page_size: 100 } },
        
        // Smart Home / User-based
        { label: "v1.0 apps users", path: `/v1.0/apps/users`, query: { page_no: 1, page_size: 10 } },
        
        // Cloud project info
        { label: "v1.0 iot-03 space info", path: `/v1.0/iot-03/space/${SPACE_ID}` },
        
        // Thing model
        { label: "v2.0 thing model (hub)", path: `/v2.0/cloud/thing/eba8efcb81d078aa14h4cu/model` },
    ];

    let foundDevices = [];

    for (const test of tests) {
        const r = await req('GET', test.path, test.query || {});
        const status = r.success ? '✅' : '❌';
        const code = r.code || '';
        const msg = r.msg || '';
        
        let details = '';
        if (r.success && r.result) {
            const result = r.result;
            if (Array.isArray(result)) {
                details = `→ Array[${result.length}]`;
                if (result.length > 0) {
                    foundDevices.push(...result);
                    details += ` First: ${JSON.stringify(result[0]).slice(0, 120)}`;
                }
            } else if (result.list && Array.isArray(result.list)) {
                details = `→ List[${result.list.length}] total=${result.total || '?'}`;
                if (result.list.length > 0) {
                    foundDevices.push(...result.list);
                    details += `\n      First: ${JSON.stringify(result.list[0]).slice(0, 120)}`;
                }
            } else if (result.data && Array.isArray(result.data)) {
                details = `→ Data[${result.data.length}]: ${JSON.stringify(result.data).slice(0, 200)}`;
            } else if (typeof result === 'object') {
                const str = JSON.stringify(result);
                if (result.name) details = `→ name: ${result.name}`;
                else if (result.id) details = `→ id: ${result.id}`;
                else details = `→ ${str.slice(0, 150)}`;
                
                // If it's a single device object with id
                if (result.id && (result.name || result.category)) {
                    foundDevices.push(result);
                }
            } else {
                details = `→ ${String(result).slice(0, 100)}`;
            }
        }
        
        console.log(`  ${status} ${test.label}`);
        if (!r.success) {
            console.log(`     ${code} ${msg}`);
        } else if (details) {
            console.log(`     ${details}`);
        }
    }

    // Deduplicate
    const seen = new Set();
    const unique = foundDevices.filter(d => {
        const id = d.id || d.device_id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });

    console.log("\n══════════════════════════════════════════════════════");
    console.log(`  📊 Total unique devices discovered: ${unique.length}`);
    console.log("══════════════════════════════════════════════════════\n");

    if (unique.length > 0) {
        // Classify
        const hubs = [];
        const sensors = [];
        
        for (const d of unique) {
            const name = (d.name || '').toLowerCase();
            const model = (d.model || '').toLowerCase();
            const cat = (d.category || '').toLowerCase();
            
            if (model.includes('gateway') || model.includes('shgateway') || name.includes('hub') || cat === 'wg' || cat === 'wg2') {
                hubs.push(d);
            } else {
                sensors.push(d);
            }
        }

        // Sort sensors
        sensors.sort((a, b) => {
            const numA = parseInt((a.name || '').match(/\d+/)?.[0] || '0');
            const numB = parseInt((b.name || '').match(/\d+/)?.[0] || '0');
            return numA - numB;
        });

        if (hubs.length > 0) {
            console.log("🏠 HUBS / GATEWAYS:");
            hubs.forEach((h, i) => {
                console.log(`  ${i + 1}. ${h.name || 'N/A'} | ID: ${h.id} | Model: ${h.model || 'N/A'} | Online: ${h.online ?? 'N/A'} | Cat: ${h.category || 'N/A'}`);
            });
        }

        console.log(`\n📡 SENSORS (${sensors.length}):`);
        sensors.forEach((s, i) => {
            console.log(
                `  ${String(i + 1).padStart(3)}. ${(s.name || 'N/A').padEnd(18)} | ${(s.id || '').padEnd(26)} | ` +
                `Model: ${(s.model || 'N/A').padEnd(12)} | Online: ${s.online ? '✅' : '❌'} | ` +
                `Node: ${s.node_id || s.uuid || 'N/A'}`
            );
        });

        // Save
        const outputPath = path.resolve(__dirname, '../tuya-devices-discovered.json');
        const saveData = unique.map(d => ({
            id: d.id || d.device_id,
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
        console.log(`\n✅ Full list saved to: ${outputPath}`);
    } else {
        console.log("⚠️  No devices could be retrieved via any endpoint.");
        console.log("\n📝 NEXT STEPS:");
        console.log("   Your Tuya IoT project needs API permissions enabled.");
        console.log("   Go to: https://iot.tuya.com → Your Project → Service API → Authorize:");
        console.log("   ✓ Device Management");
        console.log("   ✓ Device Status Notification");
        console.log("   ✓ Smart Home Device Management");
        console.log("   ✓ IoT Core");
        console.log("   ✓ Industry SaaS Development Framework (if available)");
        console.log("\n   Also verify: Devices → Link Tuya App Account → scan QR with Smart Life app\n");
    }
}

main().catch(console.error);
