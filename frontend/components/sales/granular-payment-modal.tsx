import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Receipt,
  Wallet,
  PlusCircle,
  X,
  ArrowRightCircle,
  Clock,
  ArrowLeftCircle,
  AlertTriangle,
  RefreshCcw
} from "lucide-react";
import { formatCurrency } from "./payment/utils";
import { MultiPaymentInput } from "./multi-payment-input";
import { usePaymentSession } from "@/hooks/payment/use-payment-session";
import { useUserRole } from "@/hooks/use-user-role";
import { logActivity } from "@/lib/activity-logger";
import { HistoricalValetPaymentsSection } from "./payment/historical-valet-payments-section";
import { OrderItemsList } from "./payment/order-items-list";
import { SupervisorAuthDialog } from "@/components/auth/supervisor-auth-dialog";

interface GranularPaymentModalProps {
  salesOrderId: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  roomNumber?: string;
}

export function GranularPaymentModal({
  salesOrderId,
  isOpen,
  onClose,
  onComplete,
  roomNumber
}: GranularPaymentModalProps) {
  const { employeeId } = useUserRole();
  const session = usePaymentSession({
    salesOrderId,
    isOpen,
    onComplete: () => {
      onComplete?.();
      onClose();
    },
    employeeId,
    roomNumber
  });

  const {
    items,
    loading,
    selectedItems,
    valetPayments,
    valetReports,
    corroboratedIds,
    hasPendingCorroboration,
    allSelectedPayable,
    isWaitingForValet,
    waitingReason,
    processing,
    payments,
    step,
    discounts,
    showDiscountInput,
    deletingItemId,
    confirmDeleteId,
    tipAmount,
    selectedTotal,
    pendingTotal,
    setPayments,
    setStep,
    setShowDiscountInput,
    setConfirmDeleteId,
    setTipAmount,
    fetchItems,
    corroborateValetPayment,
    toggleItem,
    selectAllPending,
    deselectAll,
    applyDiscount,
    removeDiscount,
    deleteUnpaidItem,
    processPayment,
    getItemTotal,
    isItemPayable,
    getItemDescription,
    getPaymentInfo,
    isRefundItem,
    canProceed
  } = session;

  const [authDialog, setAuthDialog] = useState<{
    isOpen: boolean;
    action: 'unlock' | 'delete';
    itemId: string | null;
    itemLabel: string;
  }>({ isOpen: false, action: 'unlock', itemId: null, itemLabel: '' });

  const handleApplyValet = (re_p: any) => {
    session.applyValetData(re_p);
  };

  // SOP Check: If we have ANY valet reports or payments, we should hide manual controls to prioritize valet data
  const hasActiveValetReports = (valetReports && valetReports.length > 0) ||
    (valetPayments && valetPayments.length > 0);

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[100vw] sm:w-[98vw] max-w-6xl p-0 overflow-hidden bg-zinc-950/95 backdrop-blur-xl border-white/5 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] rounded-none lg:rounded-[2rem] h-[100dvh] lg:h-[85vh] flex flex-col">
          {/* Header con glassmorphism */}
          <div className="relative p-6 shrink-0 overflow-hidden border-b border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/5"></div>
            <div className="relative flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="text-xl md:text-3xl font-black tracking-tighter flex items-center gap-3 text-white">
                  <div className="h-10 w-10 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 shadow-[0_0_15px_-5px_var(--primary)]">
                    <Receipt className="h-6 w-6 text-primary" />
                  </div>
                  Cobros de Habitación {roomNumber}
                </DialogTitle>
                <div className="flex items-center gap-2 text-zinc-500 font-bold text-[10px] uppercase tracking-widest pl-13">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Gestión de Cobros por Concepto
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
            {/* Columna Izquierda: Conceptos */}
            <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6 bg-zinc-950/20 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-6">
                  <div className="h-16 w-16 border-t-4 border-primary rounded-full animate-spin shadow-[0_0_20px_var(--primary)]"></div>
                  <p className="text-zinc-500 font-black uppercase tracking-[0.3em] animate-pulse">Sincronizando...</p>
                </div>
              ) : isWaitingForValet ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                  <div className="relative">
                    <div className="absolute -inset-10 bg-primary/10 rounded-full blur-[60px] animate-pulse"></div>
                    <div className="relative h-28 w-28 bg-zinc-900 rounded-[2.5rem] flex items-center justify-center border border-white/10 shadow-2xl">
                      <Clock className="h-12 w-12 text-primary animate-[spin_5s_linear_infinite]" />
                    </div>
                  </div>
                  <div className="space-y-4 max-w-sm">
                    <h3 className="text-2xl font-black tracking-tighter text-white">ESPERANDO AL COCHERO</h3>
                    <p className="text-zinc-500 font-bold leading-relaxed px-4">
                      {waitingReason === 'check-in'
                        ? "El cochero está registrando los datos de entrada en su dispositivo móvil."
                        : "El cochero está procesando la entrega de los productos solicitados."}
                    </p>
                  </div>
                  <Button variant="outline" size="lg" onClick={() => session.fetchItems()} className="rounded-2xl border-white/5 bg-white/5 hover:bg-white/10 px-8 font-black uppercase tracking-widest h-12">
                    <RefreshCcw className="h-4 w-4 mr-3 animate-spin-slow" />
                    Actualizar Estado
                  </Button>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-20 filter grayscale">
                  <Receipt className="h-24 w-24 mb-6 text-zinc-500" />
                  <p className="text-2xl font-black uppercase tracking-[0.2em] text-zinc-500">Sin Conceptos</p>
                </div>
              ) : (
                <div className="space-y-10 pb-20">
                  <HistoricalValetPaymentsSection
                    valetPayments={valetPayments}
                    items={items}
                    selectedItems={selectedItems}
                    corroboratedIds={corroboratedIds}
                    confirmingPaymentId={null}
                    onCorroborate={(ids) => corroborateValetPayment(ids)}
                    onApplyData={handleApplyValet}
                  />

                  {/* 3. Listado Principal de Conceptos */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <h3 className="font-black text-[11px] uppercase tracking-[0.3em] text-zinc-500 whitespace-nowrap">LISTADO DE CONCEPTOS</h3>
                      <div className="h-px w-full bg-gradient-to-r from-white/10 to-transparent"></div>
                    </div>
                    <OrderItemsList
                      items={items}
                      pendingItems={items.filter(i => !i.is_paid)}
                      paidItems={items.filter(i => i.is_paid)}
                      selectedItems={selectedItems}
                      valetPayments={valetPayments}
                      discounts={discounts}
                      showDiscountInput={showDiscountInput}
                      deletingItemId={deletingItemId}
                      confirmDeleteId={confirmDeleteId}
                      totalDiscount={Object.values(discounts).reduce((a, b) => a + b, 0)}
                      getItemDescription={getItemDescription}
                      getItemTotal={getItemTotal}
                      isItemPayable={isItemPayable}
                      toggleItem={toggleItem}
                      applyDiscount={applyDiscount}
                      removeDiscount={removeDiscount}
                      deleteUnpaidItem={(id) => deleteUnpaidItem(id, roomNumber || '')}
                      forceUnlockItem={(id) => { }}
                      setShowDiscountInput={setShowDiscountInput}
                      setConfirmDeleteId={setConfirmDeleteId}
                      isRefundItem={isRefundItem}
                      getPaymentInfo={getPaymentInfo}
                      setAuthDialog={setAuthDialog}
                      hasPendingCorroboration={hasPendingCorroboration}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Columna Derecha: Panel de Pago */}
            <div className="w-full lg:w-[380px] border-t lg:border-t-0 lg:border-l border-white/5 bg-zinc-950/80 backdrop-blur-md flex flex-col shrink-0 relative z-10 max-h-[50dvh] lg:max-h-none">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-50"></div>
              
              <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-white/5">
                    <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-primary flex items-center gap-2">
                      <Wallet className="w-3.5 h-3.5" />
                      Resumen de Cobro
                    </h3>
                    {selectedItems.size > 0 && !hasActiveValetReports && (
                      <Button variant="ghost" size="sm" onClick={deselectAll} className="h-6 text-[10px] font-bold uppercase text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md px-2 transition-colors">
                        Limpiar
                      </Button>
                    )}
                  </div>

                  <div className="space-y-5">
                    {/* Main Totals Card */}
                    <div className="relative p-5 rounded-3xl bg-zinc-900/50 border border-white/5 shadow-xl overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none"></div>
                      <div className="relative space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[11px] text-zinc-400 uppercase tracking-widest">Subtotal Acumulado</span>
                          <span className="font-mono font-medium text-zinc-300 text-base">{formatCurrency(selectedTotal)}</span>
                        </div>
                        
                        {step === 'pay' && tipAmount > 0 && (
                          <div className="flex justify-between items-center text-emerald-400/90 animate-in fade-in slide-in-from-right-2">
                            <span className="font-bold text-[11px] uppercase tracking-widest">Gratificación</span>
                            <span className="font-mono font-medium text-base">+{formatCurrency(tipAmount)}</span>
                          </div>
                        )}
                        
                        <div className="pt-4 mt-2 border-t border-dashed border-white/10">
                          <span className="font-bold text-[10px] uppercase tracking-[0.3em] text-zinc-500 block mb-1">Total a Recibir</span>
                          <span className="font-black text-4xl text-white tracking-tighter drop-shadow-md">
                            {formatCurrency(selectedTotal + (step === 'pay' ? tipAmount : 0))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {step === 'select' ? (
                      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {!hasActiveValetReports ? (
                          selectedItems.size > 0 ? (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" onClick={selectAllPending} className="font-bold text-[10px] uppercase tracking-widest border-white/5 bg-white/[0.02] h-12 rounded-xl hover:bg-white/5 hover:border-white/10 transition-all">
                                  Seleccionar Todo
                                </Button>
                                <Button variant="outline" onClick={deselectAll} className="font-bold text-[10px] uppercase tracking-widest border-white/5 bg-transparent h-12 rounded-xl hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all">
                                  Desmarcar
                                </Button>
                              </div>

                              <div className="relative group rounded-2xl shadow-[0_0_40px_-15px_var(--primary)] transition-all hover:scale-[1.02]">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-indigo-500/50 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                                <Button
                                  className="relative w-full h-14 bg-zinc-100 hover:bg-white text-zinc-950 rounded-2xl border-none flex items-center justify-center gap-3 overflow-hidden group/btn"
                                  disabled={!canProceed}
                                  onClick={() => setStep('pay')}
                                >
                                  {hasPendingCorroboration ? (
                                    <div className="flex items-center gap-2 text-amber-600">
                                      <AlertTriangle className="h-5 w-5 animate-pulse" />
                                      <span className="font-black uppercase tracking-[0.1em] text-sm">Validar Corroboración</span>
                                    </div>
                                  ) : !allSelectedPayable ? (
                                    <div className="flex items-center gap-2 text-zinc-500">
                                      <Clock className="h-5 w-5 animate-spin-slow" />
                                      <span className="font-black uppercase tracking-[0.1em] text-sm">Esperando Datos</span>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="font-black uppercase tracking-widest text-sm">Continuar al Pago</span>
                                      <ArrowRightCircle className="h-5 w-5 text-zinc-900 group-hover/btn:translate-x-1 transition-transform" />
                                    </>
                                  )}
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="py-12 px-6 rounded-3xl bg-zinc-900/30 border-2 border-dashed border-white/5 text-center flex flex-col items-center justify-center gap-5 animate-in fade-in zoom-in duration-500 group">
                              <div className="h-16 w-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center border border-white/5 group-hover:scale-110 group-hover:bg-zinc-800 transition-all duration-500">
                                <Receipt className="h-7 w-7 text-zinc-500" />
                              </div>
                              <div className="space-y-2">
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Esperando Selección</p>
                                <p className="text-[11px] font-medium text-zinc-500/80 leading-relaxed max-w-[220px] mx-auto">
                                  Selecciona los conceptos en el panel izquierdo para iniciar el proceso de cobro.
                                </p>
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="p-6 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-center space-y-4 animate-in fade-in zoom-in duration-500 shadow-[0_0_30px_-10px_rgba(99,102,241,0.1)]">
                            <div className="flex justify-center">
                              <div className="h-14 w-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/20">
                                <AlertTriangle className="h-7 w-7 text-indigo-400" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-300">Prioridad Cochero</p>
                              <p className="text-[11px] font-medium text-indigo-300/70 leading-relaxed px-2">
                                Se han detectado reportes del cochero pendientes. Utiliza los datos del panel izquierdo.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center px-5 py-4 rounded-2xl bg-zinc-900/40 border border-white/5">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Saldo Restante</span>
                          <span className="text-sm font-mono font-medium text-zinc-400">{formatCurrency(pendingTotal)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 pb-4">
                        <div className="flex items-center gap-3">
                          <Button variant="ghost" size="sm" onClick={() => setStep('select')} className="h-8 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300">
                            <ArrowLeftCircle className="h-4 w-4 mr-2" />
                            Regresar
                          </Button>
                          <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-primary w-full rounded-full animate-in slide-in-from-left duration-500"></div>
                          </div>
                        </div>

                        <div className="space-y-3 bg-zinc-900/40 p-5 rounded-3xl border border-white/5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 px-1 mb-2 block">Métodos de Pago</label>
                          <MultiPaymentInput
                            totalAmount={selectedTotal}
                            payments={payments}
                            onPaymentsChange={setPayments}
                          />
                        </div>

                        <div className="pt-2 space-y-4">
                          <div className="flex justify-between items-center px-5 py-4 bg-primary/10 rounded-2xl border border-primary/20">
                            <span className="text-[11px] font-bold text-primary uppercase tracking-widest">A Pagar</span>
                            <span className="text-xl font-black text-primary font-mono">{formatCurrency(selectedTotal + tipAmount)}</span>
                          </div>
                          <Button
                            className="w-full h-14 text-sm font-black uppercase tracking-widest rounded-2xl shadow-xl relative overflow-hidden group bg-primary hover:bg-primary/90 text-primary-foreground"
                            disabled={processing || Math.abs(payments.reduce((s, p) => s + p.amount, 0) - (selectedTotal + tipAmount)) > 0.1}
                            onClick={() => processPayment()}
                          >
                            {processing ? (
                              <span className="flex items-center gap-3">
                                <RefreshCcw className="h-5 w-5 animate-spin" />
                                Procesando...
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <Wallet className="h-5 w-5" />
                                Confirmar Pago
                              </span>
                            )}
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-zinc-950 border-t border-white/5 shrink-0 z-20">
                <div className="flex items-center justify-between text-[10px] text-zinc-600 uppercase font-black tracking-widest px-1">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    Modo Granular
                  </span>
                  <div className="flex items-center gap-1.5 bg-green-500/10 px-2 py-1 rounded-md border border-green-500/20">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                    <span className="text-green-500">Live Sync</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SupervisorAuthDialog
        isOpen={authDialog.isOpen}
        onClose={() => setAuthDialog({ ...authDialog, isOpen: false })}
        onAuthorized={(supervisor, reason) => {
          if (authDialog.action === 'unlock' && authDialog.itemId) {
            session.forceUnlockItem(authDialog.itemId);
            logActivity('ADMIN_OVERRIDE', {
              roomNumber: roomNumber || "",
              reason: reason,
              details: { action: 'unlock_item', itemId: authDialog.itemId, itemLabel: authDialog.itemLabel, supervisor }
            });
          } else if (authDialog.action === 'delete' && authDialog.itemId) {
            deleteUnpaidItem(authDialog.itemId as string, roomNumber || "");
            logActivity('ADMIN_OVERRIDE', {
              roomNumber: roomNumber || "",
              reason: reason,
              details: { action: 'delete_item', itemId: authDialog.itemId, itemLabel: authDialog.itemLabel, supervisor }
            });
          }
          setAuthDialog({ ...authDialog, isOpen: false });
        }}
        actionLabel={authDialog.action === 'unlock' ? 'Desbloquear Concepto' : 'Eliminar Concepto'}
        description={`Se requiere autorización para ${authDialog.action === 'unlock' ? 'desbloquear' : 'eliminar'} el concepto: ${authDialog.itemLabel}`}
      />
    </>
  );
}
