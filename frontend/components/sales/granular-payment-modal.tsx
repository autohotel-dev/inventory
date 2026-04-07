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
    employeeId
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
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-zinc-950/95 backdrop-blur-xl border-white/5 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] rounded-none md:rounded-[2rem] h-[100dvh] md:h-[85vh] w-full md:w-auto flex flex-col">
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

          <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
            {/* Columna Izquierda: Conceptos */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 bg-zinc-950/20 custom-scrollbar">
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
            <div className="w-full md:w-[400px] border-t md:border-t-0 md:border-l border-white/5 bg-zinc-950 flex flex-col shrink-0 relative z-10 max-h-[45dvh] md:max-h-none">
              <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <div className="space-y-8">
                  <div className="flex items-center justify-between pb-4 border-b border-white/5">
                    <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-primary">RESUMEN DE COBRO</h3>
                    {selectedItems.size > 0 && !hasActiveValetReports && (
                      <Button variant="ghost" size="sm" onClick={deselectAll} className="h-7 text-[10px] font-black uppercase text-red-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg px-3 underline-offset-4 hover:underline">
                        Limpiar Selección
                      </Button>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] bg-zinc-900/40 border border-white/10 shadow-2xl relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none"></div>
                      <div className="relative space-y-4">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-zinc-500 uppercase tracking-widest">Subtotal Acumulado</span>
                          <span className="font-black text-zinc-300 text-lg tracking-tight">{formatCurrency(selectedTotal)}</span>
                        </div>
                        {step === 'pay' && tipAmount > 0 && (
                          <div className="flex justify-between items-center text-xs text-emerald-400 font-bold animate-in fade-in slide-in-from-right-2">
                            <span className="flex items-center gap-1 uppercase tracking-[0.2em]">Gratificación</span>
                            <span className="font-black text-lg tracking-tight">+{formatCurrency(tipAmount)}</span>
                          </div>
                        )}
                        <div className="pt-6 mt-2 border-t border-white/10">
                          <span className="font-black text-[10px] uppercase tracking-[0.3em] text-primary block mb-2">Total a Recibir</span>
                          <span className="font-black text-3xl md:text-5xl text-white tracking-tighter drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                            {formatCurrency(selectedTotal + (step === 'pay' ? tipAmount : 0))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {step === 'select' ? (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {!hasActiveValetReports ? (
                          selectedItems.size > 0 ? (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" onClick={selectAllPending} className="font-black text-[10px] uppercase tracking-[0.2em] border-white/10 bg-white/5 h-12 rounded-2xl hover:bg-white/10 hover:border-white/20 transform transition-all active:scale-95">
                                  Seleccionar Todo
                                </Button>
                                <Button variant="outline" onClick={deselectAll} className="font-black text-[10px] uppercase tracking-[0.2em] border-white/10 bg-transparent h-12 rounded-2xl hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-500 transform transition-all active:scale-95">
                                  Limpiar
                                </Button>
                              </div>

                              <div className="relative group p-[1px] bg-gradient-to-br from-zinc-700 via-primary to-zinc-700 bg-[length:200%_200%] animate-[gradient:3s_linear_infinite] rounded-[1.8rem] shadow-2xl transition-all hover:scale-[1.02]">
                                <Button
                                  className="w-full h-16 bg-zinc-950 hover:bg-zinc-900 text-white rounded-[1.7rem] border-none flex items-center justify-center gap-3 overflow-hidden group"
                                  disabled={!canProceed}
                                  onClick={() => setStep('pay')}
                                >
                                  {hasPendingCorroboration ? (
                                    <div className="flex items-center gap-3 text-amber-500">
                                      <AlertTriangle className="h-6 w-6 animate-pulse" />
                                      <span className="font-black uppercase tracking-[0.2em] text-sm">Validar Corroboración</span>
                                    </div>
                                  ) : !allSelectedPayable ? (
                                    <div className="flex items-center gap-3 text-zinc-500">
                                      <Clock className="h-6 w-6 animate-spin-slow" />
                                      <span className="font-black uppercase tracking-[0.2em] text-sm">Esperando Datos</span>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="font-black uppercase tracking-[0.1em] text-lg">Continuar al Pago</span>
                                      <ArrowRightCircle className="h-6 w-6 text-primary group-hover:translate-x-1.5 transition-transform duration-300" />
                                    </>
                                  )}
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="p-10 rounded-[2.5rem] bg-zinc-900/20 border border-white/5 text-center space-y-4 animate-in fade-in zoom-in duration-500">
                              <div className="flex justify-center">
                                <div className="h-16 w-16 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 shadow-inner">
                                  <Receipt className="h-8 w-8 text-zinc-600" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Esperando Selección</p>
                                <p className="text-[10px] font-bold text-zinc-600 leading-normal max-w-[180px] mx-auto">
                                  Selecciona los conceptos en el panel izquierdo para iniciar el proceso de cobro.
                                </p>
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="p-8 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/20 text-center space-y-4 animate-in fade-in zoom-in duration-500 shadow-[0_0_30px_-10px_rgba(99,102,241,0.1)]">
                            <div className="flex justify-center">
                              <div className="h-16 w-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-[0_0_20px_-5px_rgba(99,102,241,0.2)]">
                                <AlertTriangle className="h-8 w-8 text-indigo-400" />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-300">Prioridad Cochero</p>
                              <p className="text-[10px] font-bold text-indigo-300/60 leading-relaxed px-4">
                                Se han detectado reportes del cochero pendientes. Por seguridad, utiliza los datos informados en la sección izquierda para proceder.
                              </p>
                            </div>
                            <div className="pt-2">
                              <div className="h-1 w-12 bg-indigo-500/30 rounded-full mx-auto" />
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center px-6 py-4 rounded-2xl bg-zinc-900/40 border border-white/5">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Saldo Restante</span>
                          <span className="text-sm font-black text-zinc-400 tracking-tight">{formatCurrency(pendingTotal)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-4">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setStep('select')} className="h-8 rounded-lg">
                            <ArrowLeftCircle className="h-4 w-4 mr-2" />
                            Regresar
                          </Button>
                          <div className="h-1 flex-1 bg-muted rounded-full">
                            <div className="h-full w-full bg-primary rounded-full animate-in slide-in-from-left duration-500"></div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-black uppercase text-muted-foreground mb-2 block">Método de Pago</label>
                            <MultiPaymentInput
                              totalAmount={selectedTotal}
                              payments={payments}
                              onPaymentsChange={setPayments}
                            />
                          </div>
                        </div>

                        <div className="pt-4 space-y-3">
                          <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-muted-foreground uppercase">Monto Total</span>
                              <span className="text-lg font-black text-primary">{formatCurrency(selectedTotal + tipAmount)}</span>
                            </div>
                          </div>
                          <Button
                            className="w-full h-12 md:h-14 text-base md:text-xl font-black rounded-2xl shadow-2xl relative overflow-hidden group"
                            disabled={processing || Math.abs(payments.reduce((s, p) => s + p.amount, 0) - (selectedTotal + tipAmount)) > 0.1}
                            onClick={() => processPayment()}
                          >
                            {processing ? (
                              <span className="flex items-center gap-3">
                                <RefreshCcw className="h-6 w-6 animate-spin" />
                                PROCESANDO...
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <Wallet className="h-6 w-6" />
                                CONFIRMAR PAGO
                              </span>
                            )}
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted/10 border-t shrink-0">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-black tracking-widest px-2">
                  <span>Modo Granular Activado</span>
                  <div className="flex gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span>Live Data Sync</span>
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
