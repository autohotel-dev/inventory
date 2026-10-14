"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLoanChanges } from "@/hooks/use-loan-changes";
import {
  fetchLoanHistory,
  suggestedDamageAmount,
  isMissingUndecided,
  type LoanHistoryEntry,
} from "@/lib/services/loaned-items-service";

const RANGES = [
  { id: "1", label: "Hoy" },
  { id: "7", label: "7 días" },
  { id: "30", label: "30 días" },
  { id: "90", label: "90 días" },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

type Outcome = "RECUPERADO" | "POR_DECIDIR" | "COBRADO" | "PERDONADO";
const OUTCOME_LABEL: Record<Outcome, string> = {
  RECUPERADO: "Recuperado",
  POR_DECIDIR: "Faltante · por decidir",
  COBRADO: "Faltante · cobrado",
  PERDONADO: "Faltante · perdonado",
};
const OUTCOME_CLS: Record<Outcome, string> = {
  RECUPERADO: "text-emerald-400",
  POR_DECIDIR: "text-red-400",
  COBRADO: "text-amber-300",
  PERDONADO: "text-white/50",
};
const ALL = "__all__";

const outcomeOf = (l: LoanHistoryEntry): Outcome =>
  l.status === "RECUPERADO" ? "RECUPERADO" : (l.damage_decision ?? "POR_DECIDIR");

const fullName = (e: { first_name: string | null; last_name: string | null } | null) =>
  e ? [e.first_name, e.last_name].filter(Boolean).join(" ") || "—" : "—";

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const startOfRange = (days: RangeId) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (Number(days) - 1));
  return d;
};

interface Tally { checked: number; recovered: number; missing: number; charged: number; forgiven: number }
const emptyTally = (): Tally => ({ checked: 0, recovered: 0, missing: 0, charged: 0, forgiven: 0 });

function addTo(t: Tally, l: LoanHistoryEntry) {
  t.checked += l.quantity;
  if (l.status === "RECUPERADO") t.recovered += l.quantity;
  else {
    t.missing += l.quantity;
    if (l.damage_decision === "COBRADO") t.charged += Number(l.damage_amount || 0);
    if (l.damage_decision === "PERDONADO") t.forgiven += suggestedDamageAmount(l);
  }
}

/** Lo que ya se revisó: cuánto regresó, cuánto faltó y qué se decidió, por artículo y por cochero. */
export function LoanHistoryTab() {
  const [range, setRange] = useState<RangeId>("30");
  const [rows, setRows] = useState<LoanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [itemFilter, setItemFilter] = useState<string>(ALL);
  const [outcomeFilter, setOutcomeFilter] = useState<string>(ALL);
  const [roomSearch, setRoomSearch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const result = await fetchLoanHistory(startOfRange(range).toISOString());
    if (result.success) { setRows(result.data); setError(null); }
    else setError(result.error);
    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);
  useLoanChanges(useCallback(() => load(true), [load]));

  const items = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.loan_item_id, `${r.loan_item?.icon || ""} ${r.loan_item?.name || "?"}`.trim());
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r =>
    (itemFilter === ALL || r.loan_item_id === itemFilter) &&
    (outcomeFilter === ALL || outcomeOf(r) === outcomeFilter) &&
    (!roomSearch.trim() || (r.stay?.room?.number || "").includes(roomSearch.trim()))
  ), [rows, itemFilter, outcomeFilter, roomSearch]);

  const { total, byItem, byValet, undecided } = useMemo(() => {
    const total = emptyTally();
    const byItem = new Map<string, { label: string; t: Tally }>();
    const byValet = new Map<string, { label: string; t: Tally }>();
    for (const r of filtered) {
      addTo(total, r);
      const itemKey = r.loan_item_id;
      if (!byItem.has(itemKey)) byItem.set(itemKey, { label: `${r.loan_item?.icon || ""} ${r.loan_item?.name || "?"}`.trim(), t: emptyTally() });
      addTo(byItem.get(itemKey)!.t, r);
      // Responsable = quien aceptó la entrega del consumo
      const valetKey = r.assignee ? fullName(r.assignee) : "Sin responsable";
      if (!byValet.has(valetKey)) byValet.set(valetKey, { label: valetKey, t: emptyTally() });
      addTo(byValet.get(valetKey)!.t, r);
    }
    const byMissing = (a: { t: Tally }, b: { t: Tally }) => b.t.missing - a.t.missing || b.t.checked - a.t.checked;
    return {
      total,
      byItem: [...byItem.values()].sort(byMissing),
      byValet: [...byValet.values()].sort(byMissing),
      undecided: filtered.filter(isMissingUndecided).length,
    };
  }, [filtered]);

  const exportCsv = () => {
    const header = ["Revisado", "Habitación", "Artículo", "Cantidad", "Resultado", "Monto cobrado", "Responsable", "Revisó", "Decidió", "Notas"];
    const lines = filtered.map(r => [
      r.checked_at ? new Date(r.checked_at).toLocaleString("es-MX") : "",
      r.stay?.room?.number || "",
      r.loan_item?.name || "",
      r.quantity,
      OUTCOME_LABEL[outcomeOf(r)],
      r.damage_decision === "COBRADO" ? Number(r.damage_amount || 0).toFixed(2) : "",
      fullName(r.assignee),
      fullName(r.checker ?? null),
      fullName(r.decider),
      r.notes || "",
    ]);
    const csv = [header, ...lines]
      .map(cols => cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `prestamos-${startOfRange(range).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const recoveryRate = total.checked ? Math.round((total.recovered / total.checked) * 100) : null;
  const selectTriggerCls = "h-9 bg-white/[0.03] border-white/10 text-sm";
  const selectContentCls = "bg-[#141420]/95 backdrop-blur-xl border-white/10 text-white";

  return (
    <div className="max-w-6xl mx-auto w-full space-y-5">
      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/10">
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={`px-2.5 h-7 rounded-md text-xs ${range === r.id ? "bg-amber-500/15 text-amber-300" : "text-white/50 hover:text-white/80"}`}>
              {r.label}
            </button>
          ))}
        </div>
        <Select value={itemFilter} onValueChange={setItemFilter}>
          <SelectTrigger className={`${selectTriggerCls} w-44`}><SelectValue /></SelectTrigger>
          <SelectContent className={selectContentCls}>
            <SelectItem value={ALL} className="cursor-pointer focus:bg-white/10">Todos los artículos</SelectItem>
            {items.map(([id, label]) => <SelectItem key={id} value={id} className="cursor-pointer focus:bg-white/10">{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className={`${selectTriggerCls} w-48`}><SelectValue /></SelectTrigger>
          <SelectContent className={selectContentCls}>
            <SelectItem value={ALL} className="cursor-pointer focus:bg-white/10">Todos los resultados</SelectItem>
            {(Object.keys(OUTCOME_LABEL) as Outcome[]).map(o => <SelectItem key={o} value={o} className="cursor-pointer focus:bg-white/10">{OUTCOME_LABEL[o]}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-white/40" />
          <input value={roomSearch} onChange={e => setRoomSearch(e.target.value)} placeholder="Hab."
            className="w-24 h-9 pl-8 pr-2 rounded-md bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-amber-500/50" />
        </div>
        <div className="flex-1" />
        <button onClick={() => load()} disabled={loading}
          className="h-9 px-3 rounded-lg border border-white/10 text-xs text-white/70 hover:bg-white/5 flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </button>
        <button onClick={exportCsv} disabled={filtered.length === 0}
          className="h-9 px-3 rounded-lg border border-white/10 text-xs text-white/70 hover:bg-white/5 flex items-center gap-1.5 disabled:opacity-40">
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {error && <p className="text-sm text-red-400">Error al cargar: {error}</p>}

      {/* RESUMEN */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Piezas revisadas", value: String(total.checked), cls: "text-white" },
          { label: "Recuperadas", value: recoveryRate === null ? "—" : `${recoveryRate}%`, sub: `${total.recovered} piezas`, cls: "text-emerald-400" },
          { label: "Faltantes", value: String(total.missing), sub: undecided ? `${undecided} por decidir` : undefined, cls: "text-red-400" },
          { label: "Cobrado", value: money(total.charged), cls: "text-amber-300" },
          { label: "Perdonado", value: money(total.forgiven), sub: "a precio sugerido", cls: "text-white/60" },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40">{card.label}</p>
            <p className={`text-xl font-semibold mt-1 tabular-nums ${card.cls}`}>{loading ? "…" : card.value}</p>
            {card.sub && !loading && <p className="text-[11px] text-white/40 mt-0.5">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* DESGLOSES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { title: "Por artículo", rows: byItem },
          { title: "Por cochero responsable", hint: "quien aceptó la entrega", rows: byValet },
        ].map(block => (
          <div key={block.title} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/10 text-sm text-white/80">
              {block.title}{block.hint && <span className="text-white/30 text-xs"> · {block.hint}</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-white/40">
                  <tr>
                    <th className="text-left font-medium px-4 py-2"></th>
                    <th className="text-right font-medium px-2 py-2">Revisadas</th>
                    <th className="text-right font-medium px-2 py-2">Faltantes</th>
                    <th className="text-right font-medium px-2 py-2">% faltante</th>
                    <th className="text-right font-medium px-4 py-2">Cobrado</th>
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map(({ label, t }) => (
                    <tr key={label} className="border-t border-white/5">
                      <td className="px-4 py-2 text-white/80 truncate max-w-[180px]">{label}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-white/60">{t.checked}</td>
                      <td className={`px-2 py-2 text-right tabular-nums ${t.missing ? "text-red-400" : "text-white/30"}`}>{t.missing}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-white/60">{t.checked ? `${Math.round((t.missing / t.checked) * 100)}%` : "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-white/60">{t.charged ? money(t.charged) : "—"}</td>
                    </tr>
                  ))}
                  {block.rows.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-white/30 text-xs">{loading ? "Cargando..." : "Sin revisiones en este periodo"}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* DETALLE */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/10 text-sm text-white/80">
          Detalle <span className="text-white/30 text-xs">· {filtered.length} revisiones</span>
        </div>
        <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-white/40 sticky top-0 bg-[#0f0f17]">
              <tr>
                <th className="text-left font-medium px-4 py-2">Revisado</th>
                <th className="text-left font-medium px-2 py-2">Hab.</th>
                <th className="text-left font-medium px-2 py-2">Artículo</th>
                <th className="text-left font-medium px-2 py-2">Resultado</th>
                <th className="text-left font-medium px-2 py-2">Responsable</th>
                <th className="text-left font-medium px-2 py-2">Revisó</th>
                <th className="text-left font-medium px-4 py-2">Nota</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const outcome = outcomeOf(r);
                return (
                  <tr key={r.id} className="border-t border-white/5 align-top">
                    <td className="px-4 py-2 text-white/60 whitespace-nowrap">
                      {r.checked_at ? new Date(r.checked_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-2 py-2 text-white/80">{r.stay?.room?.number || "?"}</td>
                    <td className="px-2 py-2 text-white/80 whitespace-nowrap">{r.loan_item?.icon} {r.loan_item?.name} x{r.quantity}</td>
                    <td className={`px-2 py-2 whitespace-nowrap ${OUTCOME_CLS[outcome]}`}>
                      {OUTCOME_LABEL[outcome]}{outcome === "COBRADO" && ` ${money(Number(r.damage_amount || 0))}`}
                      {r.decider && <span className="block text-[11px] text-white/30">decidió {fullName(r.decider)}</span>}
                    </td>
                    <td className="px-2 py-2 text-white/60 whitespace-nowrap">{fullName(r.assignee)}</td>
                    <td className="px-2 py-2 text-white/60 whitespace-nowrap">{fullName(r.checker ?? null)}</td>
                    <td className="px-4 py-2 text-white/40 text-xs max-w-[260px]">{r.notes}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-white/30 text-xs">{loading ? "Cargando..." : "No hay revisiones con estos filtros"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
