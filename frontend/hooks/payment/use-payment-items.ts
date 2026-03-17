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
        .from("sales_order_items")
        .select(`
          *,
          products(name, sku)
        `)
        .eq("sales_order_id", salesOrderId)
        .order("created_at", { ascending: true });

      if (itemsError) {
        console.error("Supabase itemsError:", itemsError);
        throw itemsError;
      }

      const mappedItems: OrderItem[] = (orderItems || []).map((item: any) => {
        // En sales_order_items ya vienen los datos is_paid, paid_at, etc.
        return {
          ...item,
          total: Number(item.unit_price) * (Number(item.qty) || 1), // Asegurar cálculo correcto
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

  const isRefundItem = (item: OrderItem) => {
    return item.concept_type === 'REFUND' || item.total < 0;
  };

  const getItemTotal = (item: OrderItem) => {
    const baseTotal = isRefundItem(item) ? -item.total : item.total;
    return baseTotal;
  };

  const getItemDescription = (item: OrderItem) => {
    // Priority: Concept label for specific system charges, then product name
    const conceptLabel = CONCEPT_LABELS[item.concept_type];
    if (conceptLabel && item.concept_type !== 'PRODUCT' && item.concept_type !== 'CONSUMPTION') {
      return conceptLabel;
    }
    return item.products?.name || item.concept_type;
  };

  const isItemPayable = (item: OrderItem) => {
    if (forcedUnlockedItems.has(item.id)) return true;
    
    // Si es un concepto de servicio (horas, personas, etc), requiere que cochero registre los datos
    const serviceConcepts = ['EXTRA_HOUR', 'EXTRA_PERSON', 'EARLY_CHECKIN', 'LATE_CHECKOUT', 'TOLERANCE_EXPIRED', 'RENEWAL', 'PROMO_4H'];
    
    if (serviceConcepts.includes(item.concept_type)) {
      // Consideramos bloqueado si:
      // 1. delivery_status es explicitly PENDING_VALET
      // 2. delivery_status es null/undefined (recién generado)
      const isPending = !item.delivery_status || item.delivery_status === 'PENDING_VALET';
      return !isPending;
    }

    // Para productos de consumo
    if (item.concept_type === 'CONSUMPTION' || item.concept_type === 'PRODUCT') {
      const isPending = item.delivery_status === 'PENDING_VALET';
      return !isPending;
    }

    // El ROOM_BASE siempre es pagable
    if (item.concept_type === 'ROOM_BASE') return true;

    return true;
  };

  // Log to debug
  useEffect(() => {
    if (isOpen && items.length > 0) {
      console.log('--- Granular Payment Debug ---');
      items.filter(i => !i.is_paid).forEach(item => {
        console.log(`Item: ${item.concept_type} (${item.id.slice(0,5)}), delivery: ${item.delivery_status}, isPayable: ${isItemPayable(item)}`);
      });
    }
  }, [isOpen, items]);

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
