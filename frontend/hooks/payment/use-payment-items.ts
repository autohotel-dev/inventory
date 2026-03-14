"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { OrderItem } from "../use-granular-payment";
import { CONCEPT_LABELS } from "@/components/sales/payment/utils";

interface UsePaymentItemsProps {
  salesOrderId: string;
  isOpen: boolean;
  forcedUnlockedItems: Set<string>;
}

export function usePaymentItems({ salesOrderId, isOpen, forcedUnlockedItems }: UsePaymentItemsProps) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!salesOrderId || !isOpen) return;

    try {
      setLoading(true);
      const supabase = createClient();

      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          *,
          products(name)
        `)
        .eq("sales_order_id", salesOrderId)
        .order("created_at", { ascending: true });

      if (itemsError) throw itemsError;

      const { data: payments, error: paymentsError } = await supabase
        .from("order_payments")
        .select("*")
        .eq("sales_order_id", salesOrderId);

      if (paymentsError) throw paymentsError;

      const mappedItems: OrderItem[] = (orderItems || []).map((item: any) => {
        const itemPayment = payments?.find((p: any) => p.order_item_id === item.id);
        return {
          ...item,
          is_paid: !!itemPayment,
          paid_at: itemPayment?.created_at,
          payment_method: itemPayment?.payment_method
        };
      });

      setItems(mappedItems);

      // Auto-select unpaid items that are not selected yet
      const unpaidIds = mappedItems
        .filter((item: OrderItem) => !item.is_paid)
        .map((item: OrderItem) => item.id);
      
      setSelectedItems(prev => {
        const next = new Set(prev);
        unpaidIds.forEach(id => next.add(id));
        return next;
      });

    } catch (error) {
      console.error("Error fetching items:", error);
      toast.error("Error al cargar los conceptos");
    } finally {
      setLoading(false);
    }
  }, [salesOrderId, isOpen]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectAllPending = () => {
    const pendingIds = items.filter(i => !i.is_paid).map(i => i.id);
    setSelectedItems(new Set(pendingIds));
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  const applyDiscount = (itemId: string, amount: number) => {
    setDiscounts(prev => ({ ...prev, [itemId]: amount }));
  };

  const removeDiscount = (itemId: string) => {
    setDiscounts(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const deleteUnpaidItem = async (itemId: string, roomNumber?: string) => {
    try {
      setDeletingItemId(itemId);
      const supabase = createClient();

      const { error } = await supabase
        .from("order_items")
        .delete()
        .eq("id", itemId)
        .eq("is_paid", false);

      if (error) throw error;

      toast.success("Concepto eliminado");
      fetchItems();
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Error al eliminar el concepto");
    } finally {
      setDeletingItemId(null);
    }
  };

  const isRefundItem = (item: OrderItem) => {
    return item.concept_type === 'REFUND' || item.total < 0;
  };

  const getItemTotal = (item: OrderItem) => {
    const baseTotal = isRefundItem(item) ? -item.total : item.total;
    return baseTotal;
  };

  const getItemDescription = (item: OrderItem) => {
    return item.products?.name || CONCEPT_LABELS[item.concept_type] || item.concept_type;
  };

  const isItemPayable = (item: OrderItem) => {
    if (forcedUnlockedItems.has(item.id)) return true;
    const serviceConcepts = ['ROOM_BASE', 'EXTRA_HOUR', 'EXTRA_PERSON', 'EARLY_CHECKIN', 'LATE_CHECKOUT', 'DAMAGE_CHARGE', 'TOLERANCE_EXPIRED', 'RENEWAL', 'PROMO_4H'];
    return !serviceConcepts.includes(item.concept_type);
  };

  return {
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
    deleteUnpaidItem,
    isRefundItem,
    getItemTotal,
    getItemDescription,
    isItemPayable,
    setDiscounts
  };
}
