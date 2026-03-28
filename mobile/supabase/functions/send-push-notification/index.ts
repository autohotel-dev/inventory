// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
    try {
        const payload = await req.json();
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log("🔔 [PUSH] Payload received:", JSON.stringify(payload)); // DEBUG LOG

        let title = "";
        let body = "";
        let data = {};
        let shouldNotify = false;

        // =======================================================
        // CASO 1: Tabla 'notifications' (NUEVO)
        // =======================================================
        if (payload.table === "notifications" && payload.type === "INSERT") {
            const record = payload.record;
            title = record.title;
            body = record.message;
            data = record.data || {};
            shouldNotify = true;
        }

        // =======================================================
        // CASO 2: Legacy - room_stays
        // =======================================================
        else if (payload.table === "room_stays") {
            if (payload.type === "INSERT" && payload.record.status === "ACTIVA" && !payload.record.vehicle_plate) {
                // Esta notificación ahora se maneja desde la web App para evitar duplicados.
            }
        }

        // =======================================================
        // CASO 3: Legacy - sales_order_items (YA CUBIERTO POR EL NUEVO SISTEMA)
        // =======================================================
        /* 
        // COMENTADO PARA EVITAR DUPLICADOS - Ya se envía vía tabla 'notifications'
        else if (payload.table === "sales_order_items" && payload.type === "INSERT" && payload.record.delivery_status === "PENDING") {
          title = "🛒 Nuevo Servicio";
          body = "Hay un nuevo servicio pendiente de entrega";
          shouldNotify = true;
        }
        */

        console.log("🔔 [PUSH] Should Notify?", shouldNotify);

        // Si no es un evento relevante, salir
        if (!shouldNotify) {
            console.log("🔔 [PUSH] No notification needed.");
            return new Response(JSON.stringify({ message: "No notification needed" }), { status: 200 });
        }

        // =======================================================
        // OBTENER TOKENS
        // =======================================================
        let tokens: string[] = [];

        // CASO A: Notificación dirigida a un usuario específico (NUEVO ESTÁNDAR)
        if (payload.table === "notifications" && payload.record.user_id) {
            const userId = payload.record.user_id;
            console.log(`🔔 [PUSH] Targeting specific user: ${userId}`);

            // Buscar token del usuario específico en employees
            const { data: employee, error: errEmployee } = await supabase
                .from("employees")
                .select("push_token")
                .eq("auth_user_id", userId)
                .single();

            if (errEmployee) {
                console.error("🔔 [PUSH] Error fetching user token:", errEmployee);
            } else if (employee?.push_token) {
                tokens = [employee.push_token];
            }
        }
        // CASO B: Broadcast a rol (LEGACY - Solo si NO es tabla notifications o no tiene user_id)
        else {
            console.log("🔔 [PUSH] Broadcasting to all active cocheros (Legacy Flow)");
            const { data: cocheros, error: errCocheros } = await supabase
                .from("employees")
                .select("push_token")
                .eq("role", "cochero")
                .eq("is_active", true)
                .not("push_token", "is", null);

            if (errCocheros) {
                console.error("🔔 [PUSH] Error fetching tokens:", errCocheros);
            } else {
                tokens = cocheros?.map((e) => e.push_token) || [];
            }
        }

        console.log(`🔔 [PUSH] Tokens found: ${tokens.length}`);

        if (tokens.length === 0) {
            return new Response(JSON.stringify({ message: "No tokens found" }), { status: 200 });
        }

        // =======================================================
        // ENVIAR A EXPO
        // =======================================================
        const messages = tokens.map((token) => ({
            to: token,
            sound: "default",
            title,
            body,
            data, // IMPORTANTE: Enviamos la data para que la App sepa a dónde navegar
            priority: "high",
            channelId: "default", // EXPLICITAMENTE requerimos el canal default para Android
        }));

        console.log("🔔 [PUSH] Sending to Expo...", JSON.stringify(messages));

        const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(messages),
        });

        const expoResult = await expoResponse.json();
        console.log("🔔 [PUSH] Expo Result:", JSON.stringify(expoResult));

        return new Response(JSON.stringify({ success: true, sent: tokens.length, result: expoResult }), { status: 200 });
    } catch (error) {
        console.error("🔔 [PUSH] Exception:", error);
        return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
    }
});
