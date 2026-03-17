"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SupervisorAuthDialog } from "@/components/auth/supervisor-auth-dialog";
import {
  Receipt,
  X,
  Tag,
  Loader2,
  ArrowRight
} from "lucide-react";

import { useGranularPayment } from "@/hooks/use-granular-payment";
import { formatCurrency } from "./payment/utils";
import { WaitingForValetView } from "./payment/waiting-for-valet-view";
import { ValetReportsSection } from "./payment/valet-reports-section";
import { HistoricalValetPaymentsSection } from "./payment/historical-valet-payments-section";
import { OrderItemsList } from "./payment/order-items-list";
import { PaymentStepView } from "./payment/payment-step-view";

interface GranularPaymentModalProps {
  isOpen: boolean;
  salesOrderId: string;
  roomNumber?: string;
  onClose: () => void;
  onComplete: () => void;
}

export function GranularPaymentModal({
  isOpen,
  salesOrderId,
  roomNumber,
  onClose,
  onComplete,
}: GranularPaymentModalProps) {
  const {
    isWaitingForValet,
    loading,
    processing,
    items,
    selectedItems,
    payments,
    valetPayments,
    valetReports,
    corroboratedIds,
    confirmingPaymentId,
    step,
    discounts,
    showDiscountInput,
    deletingItemId,
    confirmDeleteId,
    tipAmount,
    selectedTotal,
    pendingTotal,
    hasPendingCorroboration,
    allSelectedPayable,
    waitingReason,
    setPayments,
    setStep,
    setShowDiscountInput,
    setConfirmDeleteId,
    setTipAmount,
    fetchItems, // Although not used directly here, it's inside the hook's useEffect
    corroborateValetPayment,
    applyValetPaymentData,
    applyValetReportData,
    forceUnlockItem,
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
    isRefundItem
  } = useGranularPayment({ isOpen, salesOrderId, onComplete });

  const [authDialog, setAuthDialog] = useState<{
    isOpen: boolean;
    action: 'unlock' | 'delete';
    itemId: string | null;
    itemLabel: string;
  }>({ isOpen: false, action: 'unlock', itemId: null, itemLabel: '' });

  if (!isOpen) return null;

  const totalDiscount = Object.values(discounts).reduce((sum, d) => sum + d, 0);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-7xl mx-4 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Cobro por Concepto
              </h2>
              {roomNumber && (
                <p className="text-sm text-muted-foreground">Habitación {roomNumber}</p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} disabled={processing}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : isWaitingForValet ? (
              <WaitingForValetView onClose={onClose} reason={waitingReason} />
            ) : step === "select" ? (
              <div className="p-6 space-y-4">
                {/* Resumen */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                  <div>
                    <p className="text-sm text-muted-foreground">Total pendiente</p>
                    <p className="text-xl font-bold text-amber-500">{formatCurrency(pendingTotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Seleccionado</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(selectedTotal)}</p>
                  </div>
                </div>

                {/* Acciones rápidas */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllPending}>Seleccionar todo</Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>Deseleccionar</Button>
                </div>

                {/* Reportes de Cochero */}
                <ValetReportsSection 
                  valetReports={valetReports}
                  selectedItems={selectedItems}
                  corroboratedIds={corroboratedIds}
                  onCorroborate={(id) => corroboratedIds.has(id) ? null : corroborateValetPayment([id])}
                  onApplyData={applyValetReportData}
                />

                <HistoricalValetPaymentsSection 
                  valetPayments={valetPayments}
                  items={items}
                  selectedItems={selectedItems}
                  corroboratedIds={corroboratedIds}
                  confirmingPaymentId={confirmingPaymentId}
                  onCorroborate={corroborateValetPayment}
                  onApplyData={applyValetPaymentData}
                />

                {/* Lista de conceptos */}
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
                  totalDiscount={totalDiscount}
                  getItemDescription={getItemDescription}
                  getItemTotal={getItemTotal}
                  isItemPayable={isItemPayable}
                  toggleItem={toggleItem}
                  applyDiscount={applyDiscount}
                  removeDiscount={removeDiscount}
                  deleteUnpaidItem={(id) => deleteUnpaidItem(id, roomNumber || "")}
                  forceUnlockItem={forceUnlockItem}
                  setShowDiscountInput={setShowDiscountInput}
                  setConfirmDeleteId={setConfirmDeleteId}
                  isRefundItem={isRefundItem}
                  getPaymentInfo={getPaymentInfo}
                  setAuthDialog={setAuthDialog}
                  hasPendingCorroboration={hasPendingCorroboration}
                />
              </div>
            ) : (
              <PaymentStepView 
                selectedTotal={selectedTotal}
                tipAmount={tipAmount}
                payments={payments}
                setPayments={setPayments}
                setTipAmount={setTipAmount}
              />
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between flex-shrink-0">
            {step === "select" ? (
              <>
                <div className="flex items-center gap-4">
                  {selectedItems.size > 0 && (
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Seleccionado</span>
                      <span className="text-lg font-black text-primary">{formatCurrency(selectedTotal)}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={onClose} disabled={processing}>Cancelar</Button>
                  <Button 
                    className="font-bold px-8 shadow-lg shadow-primary/20" 
                    disabled={selectedItems.size === 0 || processing || hasPendingCorroboration || !allSelectedPayable}
                    onClick={() => setStep("pay")}
                  >
                    {hasPendingCorroboration 
                      ? "Corroboración pendiente" 
                      : !allSelectedPayable 
                        ? "Datos pendientes"
                        : "Proceder al Pago"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setStep("select")} disabled={processing}>Volver a Conceptos</Button>
                <Button 
                  className="font-bold px-8 bg-green-600 hover:bg-green-700" 
                  disabled={processing || payments.reduce((sum: number, p) => sum + p.amount, 0) <= 0}
                  onClick={() => processPayment(selectedTotal)}
                >
                  {processing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</>
                  ) : (
                    <>Confirmar y Registrar Pago ({formatCurrency(selectedTotal + tipAmount)})</>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <SupervisorAuthDialog
        isOpen={authDialog.isOpen}
        onClose={() => setAuthDialog({ ...authDialog, isOpen: false })}
        onAuthorized={() => {
          if (authDialog.action === 'unlock' && authDialog.itemId) {
            forceUnlockItem(authDialog.itemId);
          } else if (authDialog.action === 'delete' && authDialog.itemId) {
            deleteUnpaidItem(authDialog.itemId as string, roomNumber || "");
          }
          setAuthDialog({ ...authDialog, isOpen: false });
        }}
        actionLabel={authDialog.action === 'unlock' ? 'Desbloquear Concepto' : 'Eliminar Concepto'}
        description={`Se requiere autorización para ${authDialog.action === 'unlock' ? 'desbloquear' : 'eliminar'} el concepto: ${authDialog.itemLabel}`}
      />
    </>
  );
}
