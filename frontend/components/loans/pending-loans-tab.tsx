"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { LoanedItemsPanel } from "@/components/sales/loaned-items-panel";
import { useLoanChanges } from "@/hooks/use-loan-changes";
import { fetchPendingLoans, isMissingUndecided, type PendingLoan } from "@/lib/services/loaned-items-service";

/** Pendientes de préstamo, en vivo: se recargan cuando un cochero o recepción revisa algo */
export function usePendingLoans() {
  const [pending, setPending] = useState<PendingLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const result = await fetchPendingLoans();
    if (result.success) {
      setPending(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  const reload = useCallback(() => load(true), [load]);
  useEffect(() => { load(); }, [load]);
  useLoanChanges(reload);

  const totals = useMemo(() => ({
    unchecked: pending.filter(l => l.status === "PRESTADO").length,
    missing: pending.filter(isMissingUndecided).length,
  }), [pending]);

  return { pending, loading, error, reload, refresh: load, totals };
}

/**
 * Lo que recepción tiene que resolver, agrupado por estancia: artículos sin revisar
 * (normalmente de salidas que se cerraron sin revisión) y faltantes sin decidir.
 */
export function PendingLoansTab({ pending, loading, error, reload, refresh, totals }: ReturnType<typeof usePendingLoans>) {
  const stays = useMemo(() => {
    const byStay = new Map<string, { stayId: string; room: string; active: boolean; checkIn: string; unchecked: number; missing: number }>();
    for (const loan of pending) {
      const entry = byStay.get(loan.room_stay_id) || {
        stayId: loan.room_stay_id,
        room: loan.stay?.room?.number || "?",
        active: loan.stay?.status === "ACTIVA",
        checkIn: loan.stay?.check_in_at || loan.created_at,
        unchecked: 0,
        missing: 0,
      };
      if (loan.status === "PRESTADO") entry.unchecked++;
      if (isMissingUndecided(loan)) entry.missing++;
      byStay.set(loan.room_stay_id, entry);
    }
    // Faltantes primero (requieren decisión), luego activas, luego lo más reciente
    return [...byStay.values()].sort((a, b) =>
      (b.missing > 0 ? 1 : 0) - (a.missing > 0 ? 1 : 0) ||
      (b.active ? 1 : 0) - (a.active ? 1 : 0) ||
      b.checkIn.localeCompare(a.checkIn));
  }, [pending]);

  return (
    <div className="max-w-4xl mx-auto w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/50">
          {loading ? "Cargando..." : stays.length === 0 ? "" :
            `${totals.missing} ${totals.missing === 1 ? "faltante" : "faltantes"} por decidir · ${totals.unchecked} sin revisar`}
        </p>
        <button onClick={() => refresh()} disabled={loading}
          className="h-8 px-3 rounded-lg border border-white/10 text-xs text-white/70 hover:bg-white/5 flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {error && <p className="text-sm text-red-400">Error al cargar: {error}</p>}

      {!loading && !error && stays.length === 0 && (
        <div className="min-h-[240px] flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl text-center gap-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/60" />
          <p className="text-white/60 text-sm">No hay artículos pendientes.</p>
          <p className="text-white/30 text-xs">Aquí aparecen los préstamos que no se revisaron en la salida y los faltantes por decidir.</p>
        </div>
      )}

      {stays.map(stay => (
        <LoanedItemsPanel
          key={stay.stayId}
          stayId={stay.stayId}
          canCharge={stay.active}
          onChanged={reload}
          title={`Hab. ${stay.room} · ${new Date(stay.checkIn).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} · ${stay.active ? "Ocupada" : "Salida cerrada"}`}
        />
      ))}
    </div>
  );
}
