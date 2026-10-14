"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ClipboardCheck, History, Minus, Plus, RefreshCw } from "lucide-react";
import { useLoanChanges } from "@/hooks/use-loan-changes";
import {
  fetchLoanInventory,
  fetchStockMovements,
  registerStockMovement,
  type LoanInventoryRow,
  type StockMovement,
  type StockMovementKind,
} from "@/lib/services/loaned-items-service";

type FormKind = "CONTEO" | "ENTRADA" | "BAJA";
interface MovementForm { itemId: string; kind: FormKind; quantity: string; reason: string }

const KIND_LABEL: Record<StockMovementKind, string> = {
  CONTEO: "Conteo",
  ENTRADA: "Entrada",
  BAJA: "Baja",
  FALTANTE: "Faltante",
  FALTANTE_REVERTIDO: "Faltante revertido",
};

const inputCls = "h-8 px-2 rounded-md bg-black/30 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-amber-500/50";

/** Cuántas piezas tiene el hotel de cada artículo, dónde están y qué se ha perdido. */
export function LoanInventoryTab() {
  const [rows, setRows] = useState<LoanInventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<MovementForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const result = await fetchLoanInventory();
    if (result.success) setRows(result.data);
    else toast.error("Error al cargar el inventario", { description: result.error });
    setLoading(false);
  }, []);

  const loadMovements = useCallback(async (itemId: string) => {
    const result = await fetchStockMovements(itemId);
    if (result.success) setMovements(result.data);
  }, []);

  useEffect(() => { load(); }, [load]);
  // Prestar, recuperar o reportar un faltante cambia lo prestado y la existencia
  useLoanChanges(useCallback(() => {
    load(true);
    if (historyFor) loadMovements(historyFor);
  }, [load, loadMovements, historyFor]));

  const toggleHistory = (itemId: string) => {
    if (historyFor === itemId) { setHistoryFor(null); return; }
    setHistoryFor(itemId);
    setMovements([]);
    loadMovements(itemId);
  };

  const openForm = (row: LoanInventoryRow, kind: FormKind) =>
    setForm({ itemId: row.id, kind, quantity: "", reason: "" });

  const submit = async (row: LoanInventoryRow) => {
    if (!form) return;
    const qty = Number(form.quantity);
    if (!Number.isInteger(qty) || qty < 0 || (form.kind !== "CONTEO" && qty === 0)) {
      toast.warning("Escribe una cantidad válida");
      return;
    }
    if (form.kind === "BAJA" && !form.reason.trim()) {
      toast.warning("Indica el motivo de la baja");
      return;
    }
    // En el conteo se cuenta lo que hay en bodega; lo prestado en habitaciones también es del hotel
    const quantity = form.kind === "CONTEO" ? qty + row.in_rooms : qty;
    setBusy(true);
    const result = await registerStockMovement(row.id, form.kind, quantity, form.reason);
    setBusy(false);
    if (!result.success) { toast.error(result.error); return; }
    const after = Number(result.data.stock_total);
    toast.success(`${row.name}: existencia ${after}`);
    setForm(null);
    await load(true);
    if (historyFor === row.id) loadMovements(row.id);
  };

  const neverCounted = rows.filter(r => r.is_active && r.stock_total === null).length;
  const low = rows.filter(r => r.is_active && r.available !== null && r.min_available !== null && r.available < r.min_available);

  return (
    <div className="max-w-6xl mx-auto w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm text-white/50 space-y-1 max-w-3xl">
          <p>
            <strong className="text-white/70">Disponibles</strong> = existencia − en habitaciones − sin revisar.
            Los faltantes que reportan cochero o recepción se descuentan solos de la existencia.
          </p>
          {neverCounted > 0 && (
            <p className="text-amber-300/80">
              {neverCounted} {neverCounted === 1 ? "artículo no tiene" : "artículos no tienen"} conteo: empieza con <strong>Conteo</strong> para llevar su existencia.
            </p>
          )}
        </div>
        <button onClick={() => load()} disabled={loading}
          className="h-8 px-3 rounded-lg border border-white/10 text-xs text-white/70 hover:bg-white/5 flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {low.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Por debajo del mínimo: {low.map(r => `${r.name} (${r.available}/${r.min_available})`).join(", ")}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Artículo</th>
              <th className="text-right font-medium px-2 py-2.5">Existencia</th>
              <th className="text-right font-medium px-2 py-2.5" title="Prestados en habitaciones ocupadas">En hab.</th>
              <th className="text-right font-medium px-2 py-2.5" title="Prestados en salidas ya cerradas que nadie revisó">Sin revisar</th>
              <th className="text-right font-medium px-2 py-2.5">Disponibles</th>
              <th className="text-right font-medium px-2 py-2.5">Faltantes 30d</th>
              <th className="text-left font-medium px-2 py-2.5">Último conteo</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isLow = row.available !== null && row.min_available !== null && row.available < row.min_available;
              const formOpen = form?.itemId === row.id;
              return (
                <Fragment key={row.id}>
                  <tr className={`border-t border-white/5 ${row.is_active ? "" : "opacity-40"}`}>
                    <td className="px-4 py-2.5 text-white/90 whitespace-nowrap">
                      <span className="mr-1.5">{row.icon}</span>{row.name}
                      {!row.is_active && <span className="ml-2 text-[10px] uppercase text-white/40">inactivo</span>}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-white/80">
                      {row.stock_total ?? <span className="text-amber-300/70 text-xs">sin conteo</span>}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-white/60">{row.in_rooms || "—"}</td>
                    <td className={`px-2 py-2.5 text-right tabular-nums ${row.unchecked_closed ? "text-amber-300" : "text-white/30"}`}>{row.unchecked_closed || "—"}</td>
                    <td className={`px-2 py-2.5 text-right tabular-nums font-medium ${isLow ? "text-red-400" : row.available === null ? "text-white/30" : "text-emerald-400"}`}>
                      {row.available ?? "—"}
                      {row.min_available !== null && <span className="block text-[10px] font-normal text-white/30">mín. {row.min_available}</span>}
                    </td>
                    <td className={`px-2 py-2.5 text-right tabular-nums ${row.lost_30d ? "text-red-400" : "text-white/30"}`}>{row.lost_30d || "—"}</td>
                    <td className="px-2 py-2.5 text-white/40 text-xs whitespace-nowrap">
                      {row.last_count_at ? new Date(row.last_count_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openForm(row, "CONTEO")} title="Conteo físico"
                          className="h-7 px-2 rounded-md text-xs text-amber-300 hover:bg-amber-500/10 flex items-center gap-1">
                          <ClipboardCheck className="h-3.5 w-3.5" /> Conteo
                        </button>
                        <button onClick={() => openForm(row, "ENTRADA")} disabled={row.stock_total === null} title="Entrada (compra)"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-30 disabled:hover:bg-transparent">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => openForm(row, "BAJA")} disabled={row.stock_total === null} title="Baja (rotura, merma)"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-red-400 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:bg-transparent">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => toggleHistory(row.id)} title="Movimientos"
                          className={`w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 ${historyFor === row.id ? "text-white" : "text-white/40"}`}>
                          <History className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {formOpen && form && (
                    <tr className="bg-black/20">
                      <td colSpan={8} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-white/60 w-full sm:w-auto">
                            {form.kind === "CONTEO" ? "Piezas contadas en bodega" : form.kind === "ENTRADA" ? "Piezas que entran" : "Piezas que se dan de baja"}
                          </span>
                          <input type="number" min={0} value={form.quantity} autoFocus
                            onChange={e => setForm({ ...form, quantity: e.target.value })}
                            onKeyDown={e => { if (e.key === "Enter") submit(row); }}
                            className={`${inputCls} w-24`} />
                          {form.kind === "CONTEO" && row.in_rooms > 0 && (
                            <span className="text-xs text-white/40">
                              + {row.in_rooms} en habitaciones = <strong className="text-white/70">{(Number(form.quantity) || 0) + row.in_rooms}</strong> de existencia
                            </span>
                          )}
                          <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                            onKeyDown={e => { if (e.key === "Enter") submit(row); }}
                            placeholder={form.kind === "BAJA" ? "Motivo (obligatorio)" : "Nota (opcional)"}
                            className={`${inputCls} flex-1 min-w-[160px]`} />
                          <button onClick={() => submit(row)} disabled={busy}
                            className="h-8 px-3 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium disabled:opacity-50">
                            {busy ? "..." : `Registrar ${KIND_LABEL[form.kind].toLowerCase()}`}
                          </button>
                          <button onClick={() => setForm(null)} disabled={busy} className="h-8 px-2 text-xs text-white/40 hover:text-white/70">Cancelar</button>
                        </div>
                        {form.kind === "CONTEO" && row.unchecked_closed > 0 && (
                          <p className="text-[11px] text-amber-300/70 mt-2">
                            Hay {row.unchecked_closed} sin revisar de salidas cerradas: resuélvelas en Pendientes para que los disponibles sean exactos.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}

                  {historyFor === row.id && (
                    <tr className="bg-black/10">
                      <td colSpan={8} className="px-4 py-3">
                        {movements.length === 0 ? (
                          <p className="text-xs text-white/30">Sin movimientos registrados.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <tbody>
                              {movements.map(m => (
                                <tr key={m.id} className="border-t border-white/5 first:border-0">
                                  <td className="py-1.5 pr-3 text-white/40 whitespace-nowrap">
                                    {new Date(m.created_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                  </td>
                                  <td className="py-1.5 pr-3 text-white/70 whitespace-nowrap">{KIND_LABEL[m.kind]}</td>
                                  <td className={`py-1.5 pr-3 text-right tabular-nums ${m.delta < 0 ? "text-red-400" : m.delta > 0 ? "text-emerald-400" : "text-white/40"}`}>
                                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right tabular-nums text-white/60">→ {m.stock_after}</td>
                                  <td className="py-1.5 pr-3 text-white/40">{m.reason}</td>
                                  <td className="py-1.5 text-white/40 whitespace-nowrap text-right">{m.employee?.first_name || ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-white/30 text-xs">{loading ? "Cargando..." : "No hay artículos en el catálogo"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
