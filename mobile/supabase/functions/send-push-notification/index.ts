import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Called only by the database webhook trigger `chat_push_notification` (AFTER INSERT ON notifications).
// The function is deployed with verify_jwt = false, so it authenticates the trigger with a shared
// secret (header x-push-secret = secret PUSH_WEBHOOK_SECRET). It never trusts the request body for
// content or recipient: it re-reads the notification by id, so even a leaked secret can't forge messages.

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const pushSecret = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function safeEqual(a: string, b: string): boolean {
    if (!a || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    // Fail closed: without the secret configured nobody can call it
    if (!pushSecret || !safeEqual(req.headers.get("x-push-secret") ?? "", pushSecret)) {
        console.warn("🔔 [PUSH] Rejected request without a valid x-push-secret");
        return json({ error: "Unauthorized" }, 401);
    }

    try {
        const payload = await req.json();
        const notificationId = payload?.record?.id;
        if (payload?.table !== "notifications" || payload?.type !== "INSERT" || !notificationId) {
            return json({ message: "No notification needed" });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: notification, error: errNotification } = await supabase
            .from("notifications")
            .select("user_id, title, message, data")
            .eq("id", notificationId)
            .maybeSingle();
        if (errNotification) throw errNotification;
        if (!notification?.user_id) return json({ message: "Notification not found or without recipient" });

        const { data: employee, error: errEmployee } = await supabase
            .from("employees")
            .select("push_token")
            .eq("auth_user_id", notification.user_id)
            .not("push_token", "is", null)
            .limit(1)
            .maybeSingle();
        if (errEmployee) throw errEmployee;
        if (!employee?.push_token) return json({ message: "No tokens found" });

        const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([{
                to: employee.push_token,
                sound: "default",
                title: notification.title,
                body: notification.message,
                data: notification.data || {}, // the app uses it to know where to navigate
                priority: "high",
                channelId: "default", // Android requires the default channel explicitly
            }]),
        });
        const expoResult = await expoResponse.json();
        if (!expoResponse.ok) console.error("🔔 [PUSH] Expo error:", JSON.stringify(expoResult));

        return json({ success: expoResponse.ok, sent: 1, result: expoResult }, expoResponse.ok ? 200 : 502);
    } catch (error) {
        console.error("🔔 [PUSH] Exception:", error);
        return json({ error: String(error) }, 500);
    }
});
