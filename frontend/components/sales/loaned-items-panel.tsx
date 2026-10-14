"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Ban, HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLoanChanges } from "@/hooks/use-loan-changes";
import {
  type LoanedItem,
  LOAN_STATUS_LABEL,
  fetchStayLoans,
  resolveLoanedItem,
  decideLoanDamage,
  isMissingUndecided,
  suggestedDamageAmount,
} from "@/lib/services/loaned-items-service";

interface LoanedItemsPanelProps {
  stayId: string;
  title?: string;
  /** false si la estancia ya cerró: no hay cuenta abierta donde cargar, solo se puede perdonar */
  canCharge?: boolean;
  /** Llamado tras cobrar un faltante, para refrescar cargos y totales de la cuenta */
  onCharged?: () => void;
  /** Llamado tras cualquier cambio (p.ej. para refrescar la lista de pendientes) */
  onChanged?: () => void;
}

/**
 * Loza y artículos prestados de una estancia, con las acciones de recepción:
 * revisar (Recuperado/Faltante) y decidir un faltante (Cobrar con monto editable / Perdonar con motivo).
 */
export function LoanedItemsPanel({ stayId, title = "Préstamos y Loza", canCharge = true, onCharged, onChanged }: LoanedItemsPanelProps) {
  const [loans, setLoans] = useState<LoanedItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Formulario abierto para decidir un faltante
  const [deciding, setDeciding] = useState<{ id: string; mode: "COBRADO" | "PERDONADO"; amount: string; note: string } | null>(null);

  const load = useCallback(async () => {
    const result = await fetchStayLoans(stayId);
    if (result.success) setLoans(result.data);
  }, [stayId]);

  useEffect(() => { load(); }, [load]);
  // El cochero revisa desde su app: reflejarlo sin recargar
  useLoanChanges(load, stayId);

  const run = async (loanId: string, action: () => ReturnType<typeof resolveLoanedItem>, okMessage: string) => {
    setBusyId(loanId);
    const result = await action();
    setBusyId(null);
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    toast.success(okMessage);
    await load();
    onChanged?.();
    return true;
  };

  const submitDecision = async () => {
    if (!deciding) return;
    const loan = loans.find(l => l.id === deciding.id);
    const name = loan?.loan_item?.name || "artículo";
    if (deciding.mode === "COBRADO") {
      const amount = Number(deciding.amount);
      if (!(amount > 0)) { toast.error("El monto debe ser mayor a 0"); return; }
      const ok = await run(deciding.id, () => decideLoanDamage(deciding.id, "COBRADO", { amount, note: deciding.note }), `Cargo de $${amount.toFixed(2)} por ${name} agregado a la cuenta`);
      if (ok) { setDeciding(null); onCharged?.(); }
    } else {
      if (!deciding.note.trim()) { toast.error("Indica el motivo para perdonar el faltante"); return; }
      const ok = await run(deciding.id, () => decideLoanDamage(deciding.id, "PERDONADO", { note: deciding.note }), `${name}: faltante perdonado`);
      if (ok) setDeciding(null);
    }
  };

  if (loans.length === 0) return null;

  return (
    <div className="space-y-4 pt-4">
      <div className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 px-2">{title}</div>
      <div className="bg-zinc-900/60 border border-white/10 rounded-3xl p-4 space-y-3">
        {loans.map((loan) => {
          const missing = loan.status === "PERDIDO";
          const undecided = isMissingUndecided(loan);
          const busy = busyId === loan.id;
          const isDeciding = deciding?.id === loan.id;
          return (
            <div key={loan.id} className={cn(
              "p-3 rounded-2xl border transition-all space-y-2",
              missing ? "bg-red-500/10 border-red-500/30" :
              loan.status === "RECUPERADO" ? "bg-emerald-500/5 border-emerald-500/20 opacity-60" :
              loan.status === "PRESTADO" ? "bg-white/5 border-white/5" : "bg-white/[0.02] border-white/5 opacity-50"
            )}>
              <div className="flex items-center gap-3">
                <div className="text-xl w-8 text-center">{loan.loan_item?.icon || "🍽️"}</div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-bold", missing ? "text-red-400" : "text-white")}>
                    {loan.loan_item?.name || "Artículo prestado"} x{loan.quantity}
                  </p>
                  <p className={cn(
                    "text-[10px] font-black tracking-widest uppercase mt-1",
                    missing ? "text-red-500" : loan.status === "RECUPERADO" ? "text-emerald-500" : loan.status === "PRESTADO" ? "text-amber-500" : "text-zinc-500"
                  )}>
                    {loan.damage_decision === "COBRADO" ? `Faltante · cobrado $${Number(loan.damage_amount || 0).toFixed(2)}` :
                     loan.damage_decision === "PERDONADO" ? "Faltante · perdonado" :
                     LOAN_STATUS_LABEL[loan.status]}
                    {loan.checker?.first_name && loan.status !== "PRESTADO" && <span className="text-zinc-500 normal-case tracking-normal font-medium"> · {loan.checker.first_name}</span>}
                  </p>
                </div>

                {loan.status === "PRESTADO" && (
                  <div className="flex gap-1.5">
                    <button disabled={busy} onClick={() => run(loan.id, () => resolveLoanedItem(loan.id, "RECUPERADO"), `${loan.loan_item?.name || "Artículo"} recuperado`)}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Recuperado
                    </button>
                    <button disabled={busy} onClick={() => run(loan.id, () => resolveLoanedItem(loan.id, "PERDIDO"), "Faltante registrado: decide si se cobra o se perdona")}
                      className="px-2.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-[10px] font-black uppercase tracking-wider text-red-400 hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-1">
                      <X className="h-3 w-3" /> Faltante
                    </button>
                  </div>
                )}

                {undecided && !isDeciding && (
                  <div className="flex gap-1.5">
                    {canCharge && (
                      <button disabled={busy} onClick={() => setDeciding({ id: loan.id, mode: "COBRADO", amount: suggestedDamageAmount(loan).toFixed(2), note: "" })}
                        className="px-2.5 py-1.5 rounded-xl bg-red-500/20 border border-red-500/40 text-[10px] font-black uppercase tracking-wider text-red-300 hover:bg-red-500/30 disabled:opacity-50 flex items-center gap-1">
                        <HandCoins className="h-3 w-3" /> Cobrar
                      </button>
                    )}
                    <button disabled={busy} onClick={() => setDeciding({ id: loan.id, mode: "PERDONADO", amount: "", note: "" })}
                      className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider text-zinc-300 hover:bg-white/10 disabled:opacity-50 flex items-center gap-1">
                      <Ban className="h-3 w-3" /> Perdonar
                    </button>
                  </div>
                )}
              </div>

              {isDeciding && (
                <div className="flex flex-wrap items-center gap-2 pl-11">
                  {deciding.mode === "COBRADO" && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-zinc-400">$</span>
                      <input type="number" min={0} step="0.01" value={deciding.amount} autoFocus
                        onChange={e => setDeciding({ ...deciding, amount: e.target.value })}
                        className="w-24 h-8 px-2 rounded-lg bg-black/30 border border-white/10 text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500/50" />
                    </div>
                  )}
                  <input type="text" value={deciding.note} autoFocus={deciding.mode === "PERDONADO"}
                    placeholder={deciding.mode === "PERDONADO" ? "Motivo (obligatorio)" : "Nota (opcional)"}
                    onChange={e => setDeciding({ ...deciding, note: e.target.value })}
                    onKeyDown={e => { if (e.key === "Enter") submitDecision(); }}
                    className="flex-1 min-w-[140px] h-8 px-2 rounded-lg bg-black/30 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20" />
                  <button disabled={busy} onClick={submitDecision}
                    className={cn("h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider disabled:opacity-50",
                      deciding.mode === "COBRADO" ? "bg-red-600 hover:bg-red-500 text-white" : "bg-zinc-200 hover:bg-white text-zinc-900")}>
                    {busy ? "..." : deciding.mode === "COBRADO" ? "Cargar a la cuenta" : "Perdonar"}
                  </button>
                  <button disabled={busy} onClick={() => setDeciding(null)} className="h-8 px-2 text-[10px] font-bold uppercase text-zinc-500 hover:text-zinc-300">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
