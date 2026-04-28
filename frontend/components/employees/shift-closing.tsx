"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, CreditCard, Receipt, Calculator, CheckCircle, XCircle,
  AlertTriangle, Loader2, FileText, Clock, TrendingUp, TrendingDown,
  Minus, History, Printer, ArrowDownCircle, Filter, ShoppingBag, ChevronDown,
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
      <DialogContent className="relative max-w-2xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-0 shadow-2xl">
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
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Corte de Caja</h2>
                  <p className="text-sm text-white/70">
                    {session.employees?.first_name} {session.employees?.last_name} <span className="text-white/40">•</span> {session.shift_definitions?.name}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-white/60">
              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <Clock className="h-3 w-3" />
                <span>{shiftStart.toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-white/30">→</span>
                <span>{shiftEnd.toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                <span className="font-medium text-white/80">{durationHours}h {durationMinutes}min</span>
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
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* ═══ PAYMENT CARDS ═══ */}
            <div className="grid grid-cols-3 gap-3">
              {/* Efectivo */}
              <div className="group relative rounded-xl border border-emerald-200/50 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50 to-emerald-50/30 dark:from-emerald-950/30 dark:to-emerald-950/10 p-4 transition-all hover:shadow-md hover:scale-[1.02]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Efectivo</span>
                </div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 font-mono tracking-tight">
                  {formatCurrency(summary?.total_cash || 0)}
                </p>
              </div>

              {/* BBVA */}
              <div className="group relative rounded-xl border border-blue-200/50 dark:border-blue-800/50 bg-gradient-to-br from-blue-50 to-blue-50/30 dark:from-blue-950/30 dark:to-blue-950/10 p-4 transition-all hover:shadow-md hover:scale-[1.02]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">BBVA</span>
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 font-mono tracking-tight">
                  {formatCurrency(summary?.total_card_bbva || 0)}
                </p>
              </div>

              {/* GETNET */}
              <div className="group relative rounded-xl border border-rose-200/50 dark:border-rose-800/50 bg-gradient-to-br from-rose-50 to-rose-50/30 dark:from-rose-950/30 dark:to-rose-950/10 p-4 transition-all hover:shadow-md hover:scale-[1.02]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">GETNET</span>
                </div>
                <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 font-mono tracking-tight">
                  {formatCurrency(summary?.total_card_getnet || 0)}
                </p>
              </div>
            </div>

            {/* ═══ GRAND TOTAL ═══ */}
            <div className="relative rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 p-5 text-white shadow-lg overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-6 -right-6 w-32 h-32 border-4 border-white/20 rounded-full" />
                <div className="absolute -bottom-4 -left-4 w-24 h-24 border-4 border-white/10 rounded-full" />
              </div>
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80 uppercase tracking-widest mb-1">Total Cobrado</p>
                  <p className="text-4xl font-black tracking-tight">{formatCurrency(summary?.total_sales || 0)}</p>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center gap-1.5 text-sm text-white/80">
                    <Receipt className="h-3.5 w-3.5" />
                    <span className="font-medium">{summary?.total_transactions || 0} pagos</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-white/80">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span className="font-medium">{summary?.accrual_items?.length || 0} conceptos</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ GASTOS + EFECTIVO NETO ═══ */}
            <div className="grid grid-cols-2 gap-3">
              {/* Gastos */}
              <div
                className={`rounded-xl border p-4 transition-all ${(summary?.expenses?.length || 0) > 0 ? 'cursor-pointer hover:shadow-sm border-amber-200/50 dark:border-amber-800/50' : 'border-border'}`}
                onClick={() => (summary?.expenses?.length || 0) > 0 && setShowExpenses(!showExpenses)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gastos</span>
                  {(summary?.expenses?.length || 0) > 0 && (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                      {summary?.expenses?.length}
                    </Badge>
                  )}
                </div>
                <p className={`text-xl font-bold font-mono ${(summary?.total_expenses || 0) > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  -{formatCurrency(summary?.total_expenses || 0)}
                </p>
                {showExpenses && summary?.expenses && summary.expenses.length > 0 && (
                  <div className="mt-3 pt-3 border-t space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                    {summary.expenses.map((expense: any) => (
                      <div key={expense.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground truncate flex-1 pr-2">{expense.description}</span>
                        <span className="font-medium text-amber-600 font-mono">-${Number(expense.amount).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Efectivo Neto */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Efectivo Neto</span>
                </div>
                <p className="text-xl font-bold font-mono text-foreground">{formatCurrency(netCash)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Efectivo − Gastos</p>
              </div>
            </div>

            {/* ═══ OBSERVACIONES ═══ */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Observaciones <span className="text-muted-foreground/50 normal-case tracking-normal font-normal">(opcional)</span>
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Agregar nota rápida..."
                className="bg-muted/30 border-muted-foreground/10 h-10"
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={loading || !summary} size="sm">
                  <Printer className="h-4 w-4 mr-2" />
                  Pre-Corte
                  <ChevronDown className="h-3 w-3 ml-1.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={handlePrintClosing} className="cursor-pointer">
                  <Receipt className="h-4 w-4 mr-2 text-orange-500" />
                  Ticket (térmica)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrintHP} className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2 text-blue-500" />
                  Hoja completa (HP)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
