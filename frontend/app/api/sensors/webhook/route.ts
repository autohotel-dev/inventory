import { apiClient } from "@/lib/api/client";
import { NextRequest, NextResponse } from "next/server";

// Tuya sends a signed JSON.
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("Webhook received:", JSON.stringify(body));

        const deviceId = body?.data?.deviceId || body?.deviceId;

        if (!deviceId) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });

        // Buscamos el sensor a través del backend CRUD
        const { data: sensorData } = await apiClient.get('/system/crud/sensors', {
            params: { device_id: deviceId }
        });
        const sensors = Array.isArray(sensorData) ? sensorData : (sensorData?.items || sensorData?.results || []);
        const sensor = sensors[0];

        if (!sensor) {
            console.log(`Sensor unknown: ${deviceId}`);
            return NextResponse.json({ message: "Sensor ignored" });
        }

        let isOpen: boolean | null = null;
        let battery: number | null = null;

        if (typeof body.status === 'string') {
            const s = body.status.toLowerCase();
            if (s.includes('open') || s === 'abierto' || s === 'true') isOpen = true;
            if (s.includes('close') || s === 'cerrado' || s === 'false') isOpen = false;
        } else if (typeof body.isOpen === 'boolean') {
            isOpen = body.isOpen;
        } else if (body?.data?.status && Array.isArray(body.data.status)) {
            body.data.status.forEach((s: any) => {
                if (s.code === 'door_sensor_state' || s.code === 'doorcontact_state') {
                    if (typeof s.value === 'boolean') isOpen = s.value;
                    if (s.value === 'open') isOpen = true;
                    if (s.value === 'close') isOpen = false;
                }
                if (s.code === 'battery_percentage' || s.code === 'battery_state') {
                    battery = Number(s.value);
                }
            });
        }

        if (isOpen !== null) {
            await apiClient.patch(`/system/crud/sensors/${sensor.id}`, {
                is_open: isOpen,
                last_seen: new Date().toISOString(),
                status: 'ONLINE',
                ...(battery !== null ? { battery_level: battery } : {})
            });

            await apiClient.post("/system/crud/sensor_events", {
                sensor_id: sensor.id,
                event_type: isOpen ? 'OPEN' : 'CLOSE',
                payload: body
            });

            return NextResponse.json({ success: true, state: isOpen ? 'OPEN' : 'CLOSE' });
        }

        return NextResponse.json({ message: "No relevant changes detected" });

    } catch (error) {
        console.error("Webhook Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
