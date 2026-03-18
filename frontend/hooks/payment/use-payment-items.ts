"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { VALET_CONCEPTS, SERVICE_CONCEPTS, CONCEPT_LABELS, OrderItem } from "@/components/sales/payment/payment-constants";

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
        .from("sales_order_items")
        .select(`
          *,
          products(name, sku)
        `)
        .eq("sales_order_id", salesOrderId)
        .order("created_at", { ascending: true });

      if (itemsError) throw itemsError;

      const mappedItems: OrderItem[] = (orderItems || []).map((item: any) => ({
        ...item,
        total: Number(item.unit_price) * (Number(item.qty) || 1),
      }));

      setItems(mappedItems);

      // Auto-select unpaid items only on first load, and EXCLUDE paid items from previous selection
      setSelectedItems(prev => {
        const next = new Set();
        const isFirstLoad = prev.size === 0;

        mappedItems.forEach(item => {
          if (item.is_paid) return; // Never select paid items
          if (isFirstLoad || prev.has(item.id)) {
            next.add(item.id);
          }
        });
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
    setSelectedItems(new Set(items.filter(i => !i.is_paid).map(i => i.id)));
  };

  const deselectAll = () => setSelectedItems(new Set());

  const applyDiscount = (itemId: string, percentage: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const amount = (getItemTotal(item) * (percentage / 100));
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
        .from("sales_order_items")
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

  const isRefundItem = (item: OrderItem) => item.concept_type === 'REFUND' || item.total < 0;

  const getItemTotal = (item: OrderItem) => isRefundItem(item) ? -item.total : item.total;

  const getItemDescription = (item: OrderItem) => {
    const conceptLabel = CONCEPT_LABELS[item.concept_type];
    if (conceptLabel && !['PRODUCT', 'CONSUMPTION'].includes(item.concept_type)) {
      return conceptLabel;
    }
    return item.products?.name || item.concept_type;
  };

  const isItemPayable = (item: OrderItem) => {
    if (forcedUnlockedItems.has(item.id)) return true;
    if (item.concept_type === 'ROOM_BASE') return true;

    // Services and Consumptions require 'delivered' or 'ready' status from Valet
    if (SERVICE_CONCEPTS.includes(item.concept_type) || ['CONSUMPTION', 'PRODUCT'].includes(item.concept_type)) {
      return item.delivery_status !== 'PENDING_VALET' && !!item.delivery_status;
    }

    return true;
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
