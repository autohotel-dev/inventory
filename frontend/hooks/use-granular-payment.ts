"use client";

import { useState, useEffect } from "react";
import { usePaymentItems } from "./payment/use-payment-items";
import { useValetInteraction } from "./payment/use-valet-interaction";
import { usePaymentProcessing } from "./payment/use-payment-processing";

export interface OrderItem {
  id: string;
  concept_type: string;
  total: number;
  is_paid: boolean;
  paid_at?: string;
  payment_method?: string;
  product_id?: string;
  qty?: number;
  products?: {
    name: string;
    sku?: string;
  };
  delivery_status?: string;
}

interface UseGranularPaymentProps {
  salesOrderId: string;
  isOpen: boolean;
  onComplete?: () => void;
}

export function useGranularPayment({ salesOrderId, isOpen, onComplete }: UseGranularPaymentProps) {
  const [step, setStep] = useState<'select' | 'pay'>('select');
  const [forcedUnlockedItems] = useState<Set<string>>(new Set());
  const [showDiscountInput, setShowDiscountInput] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 1. Domain: Items & Selection
  const {
    items,
    loading,
    selectedItems,
    discounts,
    deletingItemId,
    fetchItems,
    toggleItem,
    selectAllPending,
    deselectAll,
    applyDiscount,
    removeDiscount,
    deleteUnpaidItem: originalDeleteUnpaidItem,
    isRefundItem,
    getItemTotal,
    getItemDescription,
    isItemPayable,
    setDiscounts
  } = usePaymentItems({ salesOrderId, isOpen, forcedUnlockedItems });

  // 2. Domain: Valet Interaction
  const {
    valetPayments,
    valetReports,
    corroboratedIds,
    isWaitingForValet,
    waitingReason,
    fetchValetData,
    corroborateValetPayment,
    applyValetPaymentData,
    applyValetReportData,
    setCorroboratedIds
  } = useValetInteraction({ salesOrderId, items });

  // 3. Domain: Payment Processing
  const {
    payments,
    tipAmount,
    processing,
    selectedTotal,
    pendingTotal,
    processPayment,
    getPaymentInfo,
    setPayments,
    setTipAmount
  } = usePaymentProcessing({
    salesOrderId,
    items,
    selectedItems,
    discounts,
    onComplete,
    onRefreshItems: fetchItems
  });

  // Sync Valet data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchValetData();
    }
  }, [isOpen, fetchValetData]);

  // Relax logic: If we have selected any priority valet concept, bypass valet corroboration wait
  const valetPriorityConcepts = ['ROOM_BASE', 'EXTRA_HOUR', 'EXTRA_PERSON', 'DAMAGE_CHARGE', 'ROOM_CHANGE_ADJUSTMENT'];
  const selectedContainsValetConcept = Array.from(selectedItems).some(id => {
    const item = items.find(i => i.id === id);
    return valetPriorityConcepts.includes(item?.concept_type || '');
  });

  const hasPendingCorroboration = !selectedContainsValetConcept && (
    valetReports.some(r => !corroboratedIds.has(r.id)) ||
    valetPayments.some(p => p.status === 'COBRADO_POR_VALET' && !p.confirmed_at && !corroboratedIds.has(p.id))
  );

  const allSelectedPayable = Array.from(selectedItems).every(id => {
    const item = items.find(i => i.id === id);
    const payable = !item || isItemPayable(item);
    return payable;
  });

  useEffect(() => {
    if (isOpen && selectedItems.size > 0) {
      console.log(`[useGranularPayment] Selected: ${selectedItems.size}, allPayable: ${allSelectedPayable}, pendingCorroboration: ${hasPendingCorroboration}`);
    }
  }, [isOpen, selectedItems, allSelectedPayable, hasPendingCorroboration]);

  // bridge function for unlock
  const forceUnlockItem = (itemId: string) => {
    // Current implementation uses local state in GranularPaymentModal for this
  };

  return {
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
    confirmingPaymentId: processing ? "processing" : null,
    step,
    discounts,
    showDiscountInput,
    deletingItemId,
    confirmDeleteId,
    tipAmount,
    selectedTotal,
    pendingTotal,
    setPayments,
    setStep: (s: 'select' | 'pay') => setStep(s),
    setShowDiscountInput,
    setConfirmDeleteId,
    setTipAmount,
    fetchItems,
    corroborateValetPayment: (ids: string[]) => corroborateValetPayment(ids),
    applyValetPaymentData: (reports: any[]) => {
      console.log('🔍 GRANULAR PAYMENT DEBUG: applyValetPaymentData llamado');
      console.log('  - Reports recibidos:', reports?.length || 0);
      const newPayments = applyValetPaymentData(reports);
      if (newPayments && newPayments.length > 0) {
        console.log('🔍 GRANULAR PAYMENT DEBUG: Pagos creados, setPayments llamado');
        setPayments(newPayments);
        setStep("pay");
      } else {
        console.log('🔍 GRANULAR PAYMENT DEBUG: No se crearon pagos o reports vacío');
      }
    },
    applyValetReportData: (report: any) => {
      const result = applyValetReportData(report);
      if (result && result.payments) {
        setPayments(result.payments);
        if (result.tip_amount) setTipAmount(Number(result.tip_amount));
        setStep("pay");
      }
    },

    forceUnlockItem,
    toggleItem,
    selectAllPending,
    deselectAll,
    applyDiscount,
    removeDiscount,
    deleteUnpaidItem: (itemId: string, roomNumber: string) => 
      originalDeleteUnpaidItem(itemId as string, roomNumber),
    processPayment: (total: number) => processPayment(),
    getItemTotal,
    isItemPayable,
    getItemDescription,
    getPaymentInfo,
    isRefundItem
  };
}
