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
import { logActivity } from "@/lib/activity-logger";
import { ValetReportsSection } from "./payment/valet-reports-section";
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
  const session = usePaymentSession({ 
    salesOrderId, 
    isOpen, 
    onComplete: () => {
      onComplete?.();
      onClose();
    } 
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

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border-none shadow-2xl rounded-3xl h-[85vh] flex flex-col">
          {/* Header con degradado */}
          <div className="bg-gradient-to-r from-primary/10 via-background to-primary/5 p-6 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2 text-zinc-900 dark:text-white">
                  <Receipt className="h-6 w-6 text-primary" />
                  Diferido de Habitación {roomNumber}
                </DialogTitle>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  Gestiona y cobra conceptos de forma individual
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* Columna Izquierda: Conceptos */}
            <div className="flex-1 overflow-y-auto p-6 bg-muted/20 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-muted-foreground font-medium animate-pulse">Cargando conceptos...</p>
                </div>
              ) : isWaitingForValet ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in zoom-in duration-300">
                  <div className="relative">
                    <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
                    <div className="relative h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/30">
                      <Clock className="h-10 w-10 text-primary animate-[spin_3s_linear_infinite]" />
                    </div>
                  </div>
                  <div className="space-y-2 max-w-sm">
                    <h3 className="text-xl font-bold">Esperando al Cochero</h3>
                    <p className="text-muted-foreground">
                      {waitingReason === 'check-in' 
                        ? "El cochero está registrando los datos de entrada. La sección de cobro aparecerá automáticamente en un momento."
                        : "El cochero está entregando los productos solicitados."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => fetchItems()} className="rounded-full px-6">
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Actualizar
                    </Button>
                  </div>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-50 grayscale">
                  <Receipt className="h-16 w-16 mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium">No hay conceptos pendientes</p>
                </div>
              ) : (
                <div className="space-y-8 pb-10">
                  {/* 1. Reportes del Cochero */}
                  <ValetReportsSection 
                    valetReports={valetReports}
                    selectedItems={selectedItems}
                    corroboratedIds={corroboratedIds}
                    onCorroborate={(id) => corroborateValetPayment([id])}
                    onApplyData={handleApplyValet}
                  />

                  {/* 2. Pagos Registrados por Cochero */}
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
                    forceUnlockItem={(id) => {}}
                    setShowDiscountInput={setShowDiscountInput}
                    setConfirmDeleteId={setConfirmDeleteId}
                    isRefundItem={isRefundItem}
                    getPaymentInfo={getPaymentInfo}
                    setAuthDialog={setAuthDialog}
                    hasPendingCorroboration={hasPendingCorroboration}
                  />
                </div>
              )}
            </div>

            {/* Columna Derecha: Panel de Pago */}
            <div className="w-full md:w-[380px] border-l bg-card flex flex-col shrink-0">
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Resumen de Cobro</h3>
                    {selectedItems.size > 0 && (
                      <Button variant="ghost" size="sm" onClick={deselectAll} className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                        Limpiar
                      </Button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-muted/30 border border-border/50">
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-muted-foreground">Subtotal Seleccionado</span>
                        <span className="font-medium">{formatCurrency(selectedTotal)}</span>
                      </div>
                      {step === 'pay' && tipAmount > 0 && (
                        <div className="flex justify-between items-center text-sm text-green-600 mb-1 animate-in fade-in slide-in-from-right-2">
                          <span className="flex items-center gap-1"><PlusCircle className="h-3 w-3" /> Propina</span>
                          <span className="font-medium">+{formatCurrency(tipAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 mt-2 border-t border-dashed">
                        <span className="font-bold text-base">Total a Recibir</span>
                        <span className="font-black text-xl text-primary">{formatCurrency(selectedTotal + (step === 'pay' ? tipAmount : 0))}</span>
                      </div>
                    </div>

                    {step === 'select' ? (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" onClick={selectAllPending} className="font-bold border-2 h-10 rounded-xl hover:bg-primary/5 hover:border-primary/30">
                            Seleccionar Todo
                          </Button>
                          <Button variant="outline" onClick={deselectAll} className="font-bold border-2 h-10 rounded-xl">
                            Deseleccionar
                          </Button>
                        </div>

                        <div className="relative group p-1 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl transition-all hover:scale-[1.02]">
                          <Button 
                            className="w-full h-14 text-lg font-black tracking-tight rounded-xl shadow-xl transition-all"
                            disabled={!canProceed}
                            onClick={() => setStep('pay')}
                          >
                            {hasPendingCorroboration ? (
                              <span className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 animate-pulse" />
                                CORROBORACIÓN PENDIENTE
                              </span>
                            ) : !allSelectedPayable ? (
                              <span className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                ESPERANDO DATOS...
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                PROCEDER AL PAGO
                                <ArrowRightCircle className="h-6 w-6" />
                              </span>
                            )}
                          </Button>
                        </div>

                        <div className="flex justify-between items-center px-2">
                          <span className="text-xs text-muted-foreground">Restante de la orden</span>
                          <span className="text-xs font-bold">{formatCurrency(pendingTotal)}</span>
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
                            className="w-full h-14 text-xl font-black rounded-2xl shadow-2xl relative overflow-hidden group"
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
