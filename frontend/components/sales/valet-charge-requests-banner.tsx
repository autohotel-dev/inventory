"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Car, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { subscribeResilient } from "@/lib/supabase/resilient-channel";
import { cn } from "@/lib/utils";

type ChargeType = "EXTRA_HOUR" | "EXTRA_PERSON" | "DAMAGE_CHARGE";

interface ValetChargeRequest {
  id: string;
  charge_type: ChargeType;
  amount: number;
  payments: { amount: number; method: string; terminal?: string; cardLast4?: string }[];
  description: string | null;
  requested_at: string;
  stay: { room: { number: string } | null } | null;
  valet: { first_name: string | null; last_name: string | null } | null;
}

const LABEL: Record<ChargeType, string> = {
  EXTRA_HOUR: "Hora extra (+1 h a la salida)",
  EXTRA_PERSON: "Persona extra",
  DAMAGE_CHARGE: "Daño",
};

const money = (n: number) => `$${Number(n).toFixed(2)}`;

/**
 * Cobros que el cochero reporta desde la app (hora extra, persona extra, daño). Regla: el
 * cochero solo reporta; recepción aprueba (se genera el cargo, se extiende la salida o se suma
 * la persona, y los pagos quedan para corroborar como siempre) o rechaza con motivo.
 */
export function ValetChargeRequestsBanner({ onDecided, className }: { onDecided?: () => void; className?: string }) {
  const [requests, setRequests] = useState<ValetChargeRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("valet_charge_requests")
      .select("id, charge_type, amount, payments, description, requested_at, stay:room_stays(room:rooms(number)), valet:employees!valet_charge_requests_requested_by_fkey(first_name, last_name)")
      .eq("status", "PENDIENTE")
      .order("requested_at", { ascending: true });
    if (!error) setRequests((data || []) as unknown as ValetChargeRequest[]);
  }, []);

  useEffect(() => {
    load();
    return subscribeResilient(
      createClient(),
      "valet-charge-requests",
      (channel) => channel.on("postgres_changes", { event: "*", schema: "public", table: "valet_charge_requests" }, () => load()),
      () => load()
    );
  }, [load]);

  const decide = async (req: ValetChargeRequest, approve: boolean, note?: string) => {
    setBusyId(req.id);
    const { data, error } = await createClient().rpc("decide_valet_charge_request", {
      p_request_id: req.id,
      p_approve: approve,
      p_note: note || null,
    });
    setBusyId(null);
    const room = req.stay?.room?.number || "?";
    if (error || !data?.success) {
      toast.error("No se pudo completar", { description: error?.message || data?.error });
      return;
    }
    toast.success(approve ? `Hab. ${room}: ${LABEL[req.charge_type].toLowerCase()} aprobada` : `Hab. ${room}: cobro rechazado`, {
      description: approve ? `${money(req.amount)} cargado a la cuenta. Corrobora el dinero con el cochero.` : undefined,
    });
    setRejecting(null);
    await load();
    onDecided?.();
  };

  if (requests.length === 0) return null;

  return (
    <div className={cn("rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2", className)}>
      <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold uppercase tracking-wider">
        <Car className="h-4 w-4" />
        {requests.length === 1 ? "1 cobro del cochero por aprobar" : `${requests.length} cobros del cochero por aprobar`}
      </div>
      {requests.map((req) => {
        const busy = busyId === req.id;
        const isRejecting = rejecting?.id === req.id;
        const valet = [req.valet?.first_name, req.valet?.last_name].filter(Boolean).join(" ") || "Cochero";
        const payments = req.payments
          .map((p) => `${money(p.amount)} ${p.method === "TARJETA" ? `tarjeta${p.terminal ? ` ${p.terminal}` : ""}${p.cardLast4 ? ` •${p.cardLast4}` : ""}` : p.method.toLowerCase()}`)
          .join(" + ");
        return (
          <div key={req.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-black/20 px-3 py-2">
            <div className="flex-1 min-w-[220px] text-sm">
              <span className="font-semibold text-white">Hab. {req.stay?.room?.number || "?"}</span>
              <span className="text-white/70"> · {LABEL[req.charge_type]} · </span>
              <span className="font-semibold text-amber-200">{money(req.amount)}</span>
              <p className="text-xs text-white/50">
                {valet} cobró {payments} · {new Date(req.requested_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                {req.description && <> · “{req.description}”</>}
              </p>
            </div>
            {isRejecting ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  autoFocus
                  value={rejecting.note}
                  onChange={(e) => setRejecting({ id: req.id, note: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter" && rejecting.note.trim()) decide(req, false, rejecting.note); }}
                  placeholder="Motivo del rechazo"
                  className="h-8 w-48 rounded-md border border-white/10 bg-black/30 px-2 text-xs text-white placeholder:text-white/30 focus:outline-none"
                />
                <button disabled={busy || !rejecting.note.trim()} onClick={() => decide(req, false, rejecting.note)}
                  className="h-8 rounded-md bg-zinc-200 px-3 text-xs font-semibold text-zinc-900 hover:bg-white disabled:opacity-50">
                  Rechazar
                </button>
                <button disabled={busy} onClick={() => setRejecting(null)} className="h-8 px-2 text-xs text-white/50 hover:text-white/80">
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => decide(req, true)}
                  className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> {busy ? "..." : "Aprobar"}
                </button>
                <button disabled={busy} onClick={() => setRejecting({ id: req.id, note: "" })}
                  className="h-8 rounded-md border border-white/15 px-3 text-xs text-white/70 hover:bg-white/5 disabled:opacity-50 flex items-center gap-1">
                  <X className="h-3.5 w-3.5" /> Rechazar
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
