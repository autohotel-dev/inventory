"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, CreditCard, Receipt, Calculator, CheckCircle, XCircle,
  AlertTriangle, Loader2, FileText, Clock, TrendingUp, TrendingDown,
  Minus, History, Printer, ArrowDownCircle, Filter, ShoppingBag,
} from "lucide-react";
import {
  Employee, ShiftDefinition, ShiftSession, ShiftClosing, SHIFT_COLORS, CashBreakdown,
} from "./types";
import { ShiftExpense, EXPENSE_TYPE_LABELS, EXPENSE_TYPE_ICONS } from "@/types/expenses";
import { useShiftClosing, formatCurrency } from "@/hooks/use-shift-closing";
import type { EnrichedPayment, PaymentSummary } from "@/hooks/use-shift-closing";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";

interface ShiftClosingProps {
  session: ShiftSession;
  onClose: () => void;
  onComplete: () => void;
}

export function ShiftClosingModal({ session, onClose, onComplete }: ShiftClosingProps) {
  const {
    loading, saving, summary, notes, showExpenses, isPrintingClosing,
    setNotes, setShowExpenses,
    handleSaveClosing, handlePrintClosing, handlePrintHP,
    netCash, shiftStart, shiftEnd, durationHours, durationMinutes,
    formatCurrency: fc,
  } = useShiftClosing({ session, onComplete });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-0 shadow-2xl">
        <DialogTitle className="sr-only">Corte de Caja</DialogTitle>
        <DialogDescription className="sr-only">Realiza el corte de caja del turno actual</DialogDescription>
        {/* Processing overlay */}
        <ProcessingOverlay
          isVisible={saving || isPrintingClosing}
          title={saving ? "Guardando corte" : "Imprimiendo"}
          steps={[
            { label: "Registrando corte...", icon: "payment" },
            { label: "Guardando detalles...", icon: "loader" },
            { label: "Imprimiendo ticket...", icon: "printer" },
          ]}
          autoCycleMs={2000}
        />

        {/* ═══ HEADER ═══ */}
        <div className="relative px-8 pt-8 pb-6 border-b border-border/50 bg-background/80 backdrop-blur-xl overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl opacity-50" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-primary/50" />
          
          <div className="relative z-10 flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-inner">
                <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-md" />
                <Receipt className="h-7 w-7 text-primary relative z-10" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Corte de Caja
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-bold bg-primary/5 text-primary border-primary/20">
                    {session.shift_definitions?.name}
                  </Badge>
                  <span className="text-sm font-medium text-muted-foreground">
                    {session.employees?.first_name} {session.employees?.last_name}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50 shadow-sm">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-mono font-bold text-foreground">
                  {shiftStart.toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-muted-foreground/50 text-xs px-1">→</span>
                <span className="text-xs font-mono font-bold text-foreground">
                  {shiftEnd.toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/50 shadow-sm">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Duración</span>
                <span className="text-xs font-mono font-bold text-foreground">{durationHours}h {durationMinutes}m</span>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Cargando datos del turno...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-muted/10">

            {/* ═══ PAYMENT CARDS ═══ */}
            <div className="grid grid-cols-3 gap-4">
              {/* Efectivo */}
              <div className="group relative rounded-2xl border border-emerald-200/50 dark:border-emerald-900/50 bg-background/60 backdrop-blur-xl p-5 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1 overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                <div className="flex items-center gap-3 mb-3 relative z-10">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/10 flex items-center justify-center shadow-inner border border-emerald-200/50 dark:border-emerald-800/50">
                    <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Efectivo</span>
                </div>
                <p className="text-3xl font-black text-foreground font-mono tracking-tighter relative z-10">
                  {formatCurrency(summary?.total_cash || 0)}
                </p>
              </div>

              {/* BBVA */}
              <div className="group relative rounded-2xl border border-blue-200/50 dark:border-blue-900/50 bg-background/60 backdrop-blur-xl p-5 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl group-hover:bg-blue-500/10 transition-colors" />
                <div className="flex items-center gap-3 mb-3 relative z-10">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/10 flex items-center justify-center shadow-inner border border-blue-200/50 dark:border-blue-800/50">
                    <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">BBVA</span>
                </div>
                <p className="text-3xl font-black text-foreground font-mono tracking-tighter relative z-10">
                  {formatCurrency(summary?.total_card_bbva || 0)}
                </p>
              </div>

              {/* GETNET */}
              <div className="group relative rounded-2xl border border-rose-200/50 dark:border-rose-900/50 bg-background/60 backdrop-blur-xl p-5 transition-all duration-300 hover:shadow-xl hover:shadow-rose-500/10 hover:-translate-y-1 overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl group-hover:bg-rose-500/10 transition-colors" />
                <div className="flex items-center gap-3 mb-3 relative z-10">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-100 to-rose-50 dark:from-rose-900/40 dark:to-rose-900/10 flex items-center justify-center shadow-inner border border-rose-200/50 dark:border-rose-800/50">
                    <CreditCard className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Getnet</span>
                </div>
                <p className="text-3xl font-black text-foreground font-mono tracking-tighter relative z-10">
                  {formatCurrency(summary?.total_card_getnet || 0)}
                </p>
              </div>
            </div>

            {/* ═══ GRAND TOTAL ═══ */}
            <div className="relative rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 p-8 text-white shadow-[0_0_40px_-10px_rgba(16,185,129,0.4)] border border-emerald-400/30 overflow-hidden transform transition-all duration-500 hover:scale-[1.01]">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute -top-10 -right-10 w-48 h-48 border-[6px] border-white/20 rounded-full blur-[2px]" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 border-[4px] border-white/10 rounded-full blur-[1px]" />
                <div className="absolute top-1/2 left-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2 opacity-90">
                    <div className="h-1 w-6 bg-white/60 rounded-full" />
                    <p className="text-[11px] font-bold text-white uppercase tracking-[0.2em]">Total Cobrado</p>
                  </div>
                  <p className="text-5xl font-black tracking-tighter drop-shadow-md">{formatCurrency(summary?.total_sales || 0)}</p>
                </div>
                <div className="text-right space-y-2 bg-black/10 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-end gap-2 text-sm text-white/90">
                    <span className="font-semibold">{summary?.total_transactions || 0}</span>
                    <span className="text-white/60">pagos</span>
                    <Receipt className="h-4 w-4 opacity-70" />
                  </div>
                  <div className="flex items-center justify-end gap-2 text-sm text-white/90">
                    <span className="font-semibold">{summary?.accrual_items?.length || 0}</span>
                    <span className="text-white/60">conceptos</span>
                    <ShoppingBag className="h-4 w-4 opacity-70" />
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ GASTOS + EFECTIVO NETO ═══ */}
            <div className="grid grid-cols-2 gap-4">
              {/* Gastos */}
              <div
                className={`rounded-2xl border bg-background/50 backdrop-blur-md p-5 transition-all duration-300 ${(summary?.expenses?.length || 0) > 0 ? 'cursor-pointer hover:shadow-lg border-amber-200/50 dark:border-amber-900/50 hover:border-amber-400/50' : 'border-border/50'}`}
                onClick={() => (summary?.expenses?.length || 0) > 0 && setShowExpenses(!showExpenses)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Gastos del Turno</span>
                  {(summary?.expenses?.length || 0) > 0 && (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold px-2">
                      {summary?.expenses?.length} REGISTROS
                    </Badge>
                  )}
                </div>
                <p className={`text-2xl font-black font-mono tracking-tighter ${(summary?.total_expenses || 0) > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}>
                  -{formatCurrency(summary?.total_expenses || 0)}
                </p>
                {showExpenses && summary?.expenses && summary.expenses.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/50 space-y-2 animate-in slide-in-from-top-2 duration-300">
                    {summary.expenses.map((expense: any) => (
                      <div key={expense.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <span className="text-muted-foreground truncate flex-1 pr-3 font-medium">{expense.description}</span>
                        <span className="font-bold text-amber-700 dark:text-amber-400 font-mono">-${Number(expense.amount).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Efectivo Neto */}
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Efectivo Neto</span>
                  </div>
                  <p className="text-3xl font-black font-mono tracking-tighter text-foreground drop-shadow-sm">{formatCurrency(netCash)}</p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-2 flex items-center gap-1 opacity-70">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Efectivo
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-1" /> Gastos
                  </p>
                </div>
              </div>
            </div>

            {/* ═══ OBSERVACIONES ═══ */}
            <div className="space-y-2 bg-background/50 backdrop-blur-md border border-border/50 rounded-2xl p-5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-3 w-3" />
                Observaciones del Turno
                <span className="text-muted-foreground/40 normal-case tracking-normal font-normal ml-1">(Opcional)</span>
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Escribe alguna nota importante para el administrador..."
                className="bg-muted/20 border-muted-foreground/10 h-11 rounded-xl focus-visible:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
              />
            </div>
          </div>
        )}

        {/* ═══ FOOTER ═══ */}
        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving} className="text-muted-foreground">
            Cancelar
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrintClosing} disabled={loading || !summary} size="sm" title="Imprimir ticket térmico">
              <Printer className="h-4 w-4 mr-2" />
              Ticket
            </Button>
            <Button variant="outline" onClick={handlePrintHP} disabled={loading || !summary} size="sm" title="Imprimir hoja de ingresos en HP">
              <FileText className="h-4 w-4 mr-2" />
              Hoja
            </Button>
            <Button
              onClick={handleSaveClosing}
              disabled={saving || loading || !summary}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[160px] h-10 font-semibold shadow-lg shadow-emerald-600/20"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Cerrar Turno
                </>
              )}
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
