import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js"; // Usar cliente directo para Service Role

// Cliente Admin para bypass RLS
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Tipos básicos para el payload de Tuya (simplificado)
// Tuya envía un JSON firmado. Para este MVP confiamos en recibir un JSON con deviceId y status.
// En producción, se debe validar la firma (signature).

interface TuyaPayload {
    data: {
        deviceId: string;
        status: {
            code: string; // 'door_sensor_state' usually
            value: boolean | string; // true/false or 'open'/'closed'
            t: number; // timestamp
        }[];
    };
    bizCode: string; // 'edge_device_report'
}

export async function POST(req: NextRequest) {
    // const supabase = createClient(); // Ya instanciado arriba con service role

    try {
        const body = await req.json();
        console.log("Webhook received:", JSON.stringify(body));

        // Normalizar entrada (Soporta estructura compleja de Tuya o simple de IFTTT)
        // IFTTT: { "deviceId": "...", "status": "OPEN", "auth": "..." }
        let deviceId = body?.data?.deviceId || body?.deviceId;

        // Buscar sensor
        if (!deviceId) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });

        const { data: sensor } = await supabase
            .from("sensors")
            .select("id, room_id")
            .eq("device_id", deviceId)
            .single();

        if (!sensor) {
            console.log(`Sensor unknown: ${deviceId}`);
            return NextResponse.json({ message: "Sensor ignored" });
        }

        // Determinar estado
        let isOpen: boolean | null = null;
        let battery: number | null = null;

        // Caso 1: Payload IFTTT Simple (status: "OPEN" / "CLOSE")
        if (typeof body.status === 'string') {
            const s = body.status.toLowerCase();
            if (s.includes('open') || s === 'abierto' || s === 'true') isOpen = true;
            if (s.includes('close') || s === 'cerrado' || s === 'false') isOpen = false;
        }
        // Caso 2: Payload Boolean directo
        else if (typeof body.isOpen === 'boolean') {
            isOpen = body.isOpen;
        }
        // Caso 3: Payload complejo (Tuya Original)
        else if (body?.data?.status && Array.isArray(body.data.status)) {
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
            // Actualizar tabla
            await supabase
                .from("sensors")
                .update({
                    is_open: isOpen,
                    last_seen: new Date().toISOString(),
                    status: 'ONLINE',
                    ...(battery !== null ? { battery_level: battery } : {})
                })
                .eq("id", sensor.id);

            // Registrar evento
            await supabase.from("sensor_events").insert({
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
