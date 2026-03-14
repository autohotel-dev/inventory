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
    fetchValetData,
    corroborateValetPayment,
    applyValetPaymentData,
    applyValetReportData,
    setCorroboratedIds
  } = useValetInteraction({ salesOrderId });

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
    isWaitingForValet,
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
    applyValetPaymentData,
    applyValetReportData,
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
