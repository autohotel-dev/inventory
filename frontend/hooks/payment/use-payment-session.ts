"use client";

import { useState, useMemo, useEffect } from "react";
import { usePaymentItems } from "./use-payment-items";
import { useValetInteraction } from "./use-valet-interaction";
import { usePaymentProcessing } from "./use-payment-processing";
import { VALET_CONCEPTS, OrderItem } from "@/components/sales/payment/payment-constants";

interface UsePaymentSessionProps {
  salesOrderId: string;
  isOpen: boolean;
  onComplete?: () => void;
  employeeId?: string | null;
  roomNumber?: string;
}

export function usePaymentSession({ salesOrderId, isOpen, onComplete, employeeId, roomNumber }: UsePaymentSessionProps) {
  const [step, setStep] = useState<'select' | 'pay'>('select');
  const [forcedUnlockedItems, setForcedUnlockedItems] = useState<Set<string>>(new Set());
  
  const forceUnlockItem = (id: string) => {
    setForcedUnlockedItems(prev => new Set([...prev, id]));
  };
  const [showDiscountInput, setShowDiscountInput] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 1. Order Items Domain
  const itemDomain = usePaymentItems({ salesOrderId, isOpen, forcedUnlockedItems });
  
  // 2. Valet Interaction Domain
  const valetDomain = useValetInteraction({ salesOrderId, items: itemDomain.items, employeeId });

  // 3. Payment Processing Domain
  const paymentDomain = usePaymentProcessing({
    salesOrderId,
    items: itemDomain.items,
    selectedItems: itemDomain.selectedItems,
    discounts: itemDomain.discounts,
    onComplete: () => {
      setStep('select');
      onComplete?.();
    },
    onRefreshItems: itemDomain.fetchItems,
    roomNumber
  });

  // Business Logic: Computed Blocks
  const blockingLogic = useMemo(() => {
    const selectedItemsList = itemDomain.items.filter(i => itemDomain.selectedItems.has(i.id));
    
    // Check if any selected item is a priority valet concept (bypasses wait)
    const containsValetConcept = selectedItemsList.some(i => VALET_CONCEPTS.includes(i.concept_type));

    // A corroboration is required if there are unconfirmed valet payments AND no priority concept is being paid
    const unconfirmedValetCount = valetDomain.valetReports.length + valetDomain.valetPayments.filter(p => !p.confirmed_at).length;
    const hasPendingCorroboration = !containsValetConcept && unconfirmedValetCount > 0;

    // All selected items must be "payable" (provided data is ready)
    const allSelectedPayable = selectedItemsList.every(i => itemDomain.isItemPayable(i));

    return {
      hasPendingCorroboration,
      allSelectedPayable,
      canProceed: allSelectedPayable && !hasPendingCorroboration && itemDomain.selectedItems.size > 0
    };
  }, [itemDomain.items, itemDomain.selectedItems, itemDomain.isItemPayable, valetDomain.valetReports, valetDomain.valetPayments]);

  const applyValetData = (reportOrPayments: any) => {
    console.log('🔍 PAYMENT SESSION DEBUG: applyValetData llamado');
    const pEntries = Array.isArray(reportOrPayments) ? reportOrPayments : reportOrPayments.payments;
    if (!pEntries) return;

    console.log('🔍 PAYMENT SESSION DEBUG: pEntries recibidos:', pEntries.length);
    pEntries.forEach((p: any, i: number) => {
      console.log(`  - Entry ${i}: collected_by=${p.collected_by}, amount=${p.amount}`);
    });

    const newPayments = pEntries.map((p: any, i: number) => ({
      id: `valet-${Date.now()}-${i}`,
      amount: Number(p.amount || p.totalAmount),
      method: p.method || p.payment_method || "EFECTIVO",
      cardLast4: p.card_last_4 || p.cardLast4,
      cardType: p.card_type || p.cardType,
      terminal: p.terminal_code || p.terminal,
      reference: p.reference || "VALET-DATA",
      // PRESERVAR collected_by del cochero
      collected_by: p.collected_by,
      original_payment_id: p.id
    }));

    console.log('🔍 PAYMENT SESSION DEBUG: newPayments creados:');
    newPayments.forEach((p: any, i: number) => {
      console.log(`  - New Payment ${i}: collected_by=${p.collected_by}`);
    });

    paymentDomain.setPayments(newPayments);
    if (reportOrPayments.tip_amount) paymentDomain.setTipAmount(Number(reportOrPayments.tip_amount));
    setStep('pay');
  };

  return {
    // State
    step,
    setStep,
    ...itemDomain,
    ...valetDomain,
    ...paymentDomain,
    ...blockingLogic,
    
    // UI Helpers
    showDiscountInput,
    setShowDiscountInput,
    confirmDeleteId,
    setConfirmDeleteId,
    
    // Actions
    applyValetData,
    forceUnlockItem: (id: string) => {}, // Placeholder
    deleteUnpaidItem: (id: string, room: string) => itemDomain.deleteUnpaidItem(id, room)
  };
}
