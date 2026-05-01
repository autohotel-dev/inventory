import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileText, DollarSign, CreditCard, Calculator, Receipt, AlertTriangle, CheckCircle, Loader2
} from "lucide-react";
import { ShiftClosing } from "../types";
import { formatCurrency } from "@/hooks/use-shift-closing-history";

interface ShiftClosingCorrectionModalProps {
  showCorrectionModal: boolean;
  setShowCorrectionModal: (show: boolean) => void;
  correctionClosing: ShiftClosing | null;
  setCorrectionClosing: (closing: ShiftClosing | null) => void;
  correctionCountedCash: number | undefined;
  setCorrectionCountedCash: (amount: number) => void;
  correctionDeclaredBBVA: string;
  setCorrectionDeclaredBBVA: (val: string) => void;
  correctionDeclaredGetnet: string;
  setCorrectionDeclaredGetnet: (val: string) => void;
  correctionNotes: string;
  setCorrectionNotes: (notes: string) => void;
  savingCorrection: boolean;
  saveCorrectionClosing: () => void;
  calculateCorrectionCashTotal: () => number;
}

export function ShiftClosingCorrectionModal({
  showCorrectionModal,
  setShowCorrectionModal,
  correctionClosing,
  setCorrectionClosing,
  correctionCountedCash,
  setCorrectionCountedCash,
  correctionDeclaredBBVA,
  setCorrectionDeclaredBBVA,
  correctionDeclaredGetnet,
  setCorrectionDeclaredGetnet,
  correctionNotes,
  setCorrectionNotes,
  savingCorrection,
  saveCorrectionClosing,
  calculateCorrectionCashTotal
}: ShiftClosingCorrectionModalProps) {
  if (!correctionClosing) return null;

  return (
    <Dialog open={showCorrectionModal} onOpenChange={setShowCorrectionModal}>
      <DialogContent className="max-w-[90%] w-full h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="px-6 py-4 border-b bg-background z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <DialogTitle className="text-xl">Corregir Corte de Caja</DialogTitle>
                <DialogDescription className="text-sm mt-0.5">
                  Realiza un nuevo arqueo para el corte RECHAZADO del {correctionClosing && new Date(correctionClosing.period_start).toLocaleDateString("es-MX")}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="h-full grid grid-cols-1 md:grid-cols-12">

            {/* LEFT PANEL: CONTEXT (35%) */}
            <div className="hidden md:flex md:col-span-4 lg:col-span-3 flex-col border-r bg-muted/30 overflow-y-auto">
              <div className="p-6 space-y-6">

                {/* Info Original (Rejection Reason) */}
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Corte Rechazado
                  </h4>
                  {correctionClosing.rejection_reason && (
                    <p className="text-xs text-amber-800 italic">
                      &quot; {correctionClosing.rejection_reason} &quot;
                    </p>
                  )}
                </div>

                {/* Sales Summary */}
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Ventas Registradas</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight">{formatCurrency(correctionClosing.total_sales || 0)}</span>
                    <span className="text-sm text-muted-foreground">({correctionClosing.total_transactions || 0} ops)</span>
                  </div>
                </div>

                {/* Payment Breakdown (Read Only) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="font-medium text-sm">Efectivo</span>
                    </div>
                    <span className="font-bold text-green-700">{formatCurrency(correctionClosing.total_cash || 0)}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="font-medium text-sm">BBVA</span>
                    </div>
                    <span className="font-bold text-blue-700">{formatCurrency(correctionClosing.total_card_bbva || 0)}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-red-600" />
                      </div>
                      <span className="font-medium text-sm">GETNET</span>
                    </div>
                    <span className="font-bold text-red-700">{formatCurrency(correctionClosing.total_card_getnet || 0)}</span>
                  </div>
                </div>

                {/* Expenses */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Gastos</h3>
                    <span className="text-sm font-bold text-red-600">-{formatCurrency(correctionClosing.total_expenses || 0)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground italic">Gastos registrados en el turno original</p>
                </div>

                {/* EXPECTED CASH HIGHLIGHT */}
                <div className="mt-auto pt-6 border-t">
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-1">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">Efectivo Esperado en Caja</p>
                    <p className="text-2xl font-black text-foreground">{formatCurrency(correctionClosing.total_cash || 0)}</p>
                    <p className="text-[10px] text-muted-foreground">Ventas Efectivo - Gastos</p>
                  </div>
                </div>

              </div>
            </div>

            {/* RIGHT PANEL: COUNTING (65%) */}
            <div className="col-span-1 md:col-span-8 lg:col-span-9 overflow-y-auto bg-background p-6">
              <div className="max-w-4xl mx-auto space-y-8">

                {/* CASH COUNTING - Simplified for Correction */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-lg font-semibold">
                      <Calculator className="h-5 w-5 text-primary" />
                      Nuevo Conteo de Efectivo
                    </h3>
                  </div>

                  <div className="border rounded-xl p-6 bg-muted/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Efectivo esperado</p>
                      </div>
                      <span className="text-xl font-bold">{formatCurrency(correctionClosing.total_cash || 0)}</span>
                    </div>

                    <div className="border-t pt-4">
                      <Label className="text-base font-semibold">Nuevo total en efectivo</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={correctionCountedCash || ""}
                        onChange={(e) => setCorrectionCountedCash(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="text-right text-2xl font-mono h-14"
                      />
                    </div>
                  </div>
                </section>

                {/* VOUCHER COUNTING */}
                <section className="space-y-4 pt-6 border-t">
                  <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground/80">
                    <Receipt className="h-5 w-5 text-primary" />
                    Declaración de Vouchers
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* BBVA Card */}
                    <div className="group bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/10 border rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                      <div className="p-5 space-y-5">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20 flex items-center justify-center text-white">
                              <CreditCard className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="block font-bold text-base text-foreground">BBVA</span>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Terminal</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Sistema</span>
                            <Badge variant="outline" className="font-mono text-sm bg-background/50 backdrop-blur-sm border-blue-200 dark:border-blue-900">
                              {formatCurrency(correctionClosing.total_card_bbva || 0)}
                            </Badge>
                          </div>
                        </div>

                        <div className="bg-background/60 dark:bg-black/20 rounded-xl p-1.5 border border-border/50">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">Físico:</span>
                            <Input
                              type="number"
                              value={correctionDeclaredBBVA}
                              onChange={(e) => setCorrectionDeclaredBBVA(e.target.value)}
                              placeholder="0.00"
                              className="border-0 bg-transparent text-right text-lg font-mono font-bold h-10 focus-visible:ring-0 px-3 pl-16 shadow-none"
                            />
                          </div>
                        </div>
                      </div>
                      <div className={`px-5 py-3 flex justify-between items-center text-sm font-medium border-t border-border/50 ${(parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0) === 0 ? 'bg-green-100/30 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100/30 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                        <span className="flex items-center gap-2">
                          {(parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0) === 0 ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                          Diferencia
                        </span>
                        <span className="font-mono font-bold tracking-tight text-base">
                          {(parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0) > 0 ? '+' : ''}
                          {formatCurrency((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0))}
                        </span>
                      </div>
                    </div>

                    {/* GETNET Card */}
                    <div className="group bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-950/10 border rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                      <div className="p-5 space-y-5">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-red-600 shadow-lg shadow-red-600/20 flex items-center justify-center text-white">
                              <CreditCard className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="block font-bold text-base text-foreground">GETNET</span>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Terminal</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Sistema</span>
                            <Badge variant="outline" className="font-mono text-sm bg-background/50 backdrop-blur-sm border-red-200 dark:border-red-900">
                              {formatCurrency(correctionClosing.total_card_getnet || 0)}
                            </Badge>
                          </div>
                        </div>

                        <div className="bg-background/60 dark:bg-black/20 rounded-xl p-1.5 border border-border/50">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">Físico:</span>
                            <Input
                              type="number"
                              value={correctionDeclaredGetnet}
                              onChange={(e) => setCorrectionDeclaredGetnet(e.target.value)}
                              placeholder="0.00"
                              className="border-0 bg-transparent text-right text-lg font-mono font-bold h-10 focus-visible:ring-0 px-3 pl-16 shadow-none"
                            />
                          </div>
                        </div>
                      </div>
                      <div className={`px-5 py-3 flex justify-between items-center text-sm font-medium border-t border-border/50 ${(parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0) === 0 ? 'bg-green-100/30 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100/30 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                        <span className="flex items-center gap-2">
                          {(parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0) === 0 ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                          Diferencia
                        </span>
                        <span className="font-mono font-bold tracking-tight text-base">
                          {(parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0) > 0 ? '+' : ''}
                          {formatCurrency((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* NOTES & FINAL RESULT highlight */}
                <section className="bg-muted/30 rounded-2xl p-6 border flex flex-col lg:flex-row gap-8 items-stretch pt-8 mt-6">
                  <div className="flex-1 space-y-3">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Observaciones
                    </Label>
                    <textarea
                      value={correctionNotes}
                      onChange={(e) => setCorrectionNotes(e.target.value)}
                      placeholder="Describe brevemente la causa de la corrección..."
                      className="w-full bg-background border rounded-xl p-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none h-[120px]"
                    />
                    <p className="text-xs text-muted-foreground ml-1">
                      * Esta nota quedará registrada permanentemente en el historial.
                    </p>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Global Difference Card */}
                    <div className="min-w-[320px] rounded-xl border bg-muted/20 p-4 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Diferencia Global</Label>
                        <p className="text-[10px] text-muted-foreground">(Efectivo + Tarjetas)</p>
                      </div>
                      <div className={`text-xl font-bold font-mono tracking-tight ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) + ((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0)) + ((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0))) === 0 ? 'text-green-600' : (calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) + ((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0)) + ((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0))) > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                        {(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) + ((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0)) + ((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0))) > 0 ? '+' : ''}
                        {formatCurrency(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) + ((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0)) + ((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0)))}
                      </div>
                    </div>

                    {/* Cash Result Card */}
                    <div className={`min-w-[320px] rounded-2xl p-1 shadow-lg bg-gradient-to-br ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? 'from-green-500 to-emerald-700' : 'from-red-500 to-rose-700'}`}>
                      <div className="h-full bg-white dark:bg-slate-950 rounded-xl p-6 flex flex-col justify-center items-center relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? 'from-green-400 to-emerald-500' : 'from-red-400 to-rose-500'}`}></div>

                        <Label className="text-xs text-muted-foreground uppercase tracking-widest text-center mb-4 font-bold">Resultado Final (Efectivo)</Label>

                        <div className={`text-5xl font-black text-center mb-2 tracking-tighter ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? 'text-green-600 dark:text-green-400' : (calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) > 0 ? 'text-blue-600' : 'text-red-600 dark:text-red-500'}`}>
                          {formatCurrency(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0))}
                        </div>

                        <div className={`mt-2 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              <span>CORTE PERFECTO</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-4 w-4" />
                              <span>{(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) > 0 ? 'SOBRANTE' : 'FALTANTE'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-background z-10 flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setShowCorrectionModal(false);
              setCorrectionClosing(null);
            }}
            disabled={savingCorrection}
          >
            Cancelar
          </Button>
          <Button
            onClick={saveCorrectionClosing}
            disabled={savingCorrection || calculateCorrectionCashTotal() === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {savingCorrection ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Confirmar Corrección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
