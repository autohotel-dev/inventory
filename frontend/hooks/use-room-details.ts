/**
 * Hook for room details data and cancel operations.
 * Extracts data fetching and business logic from the presentational component.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Room, RoomStay } from "@/components/sales/room-types";

// ─── Types ───────────────────────────────────────────────────────────

export interface Payment {
  id: string;
  payment_number: string | null;
  amount: number;
  payment_method: string;
  reference: string | null;
  concept: string | null;
  status: string;
  payment_type: string;
  parent_payment_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface SalesOrderItem {
  id: string;
  qty: number;
  unit_price: number;
  products: {
    name: string;
    sku: string;
  } | null;
  is_courtesy?: boolean;
  courtesy_reason?: string | null;
  concept_type?: string;
  delivery_status?: string;
  is_paid?: boolean;
  is_cancelled?: boolean;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
}

export interface SalesOrder {
  id: string;
  notes: string | null;
  subtotal: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  created_at: string;
}

export interface RoomAsset {
  id: string;
  asset_type: string;
  status: string;
  assigned_employee_id: string | null;
}

interface UseRoomDetailsProps {
  isOpen: boolean;
  room: Room | null;
  activeStay: RoomStay | null;
  onCancelCharge?: (paymentId: string, room: Room, concept: string, amount: number) => Promise<boolean>;
  onCancelItem?: (itemId: string, room: Room, reason: string) => Promise<boolean>;
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useRoomDetails({ isOpen, room, activeStay, onCancelCharge, onCancelItem }: UseRoomDetailsProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [salesOrder, setSalesOrder] = useState<SalesOrder | null>(null);
  const [tvRemoteAsset, setTvRemoteAsset] = useState<RoomAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"payments" | "items">("payments");

  // Single cancel state
  const [cancellingItemId, setCancellingItemId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingLoading, setCancellingLoading] = useState(false);

  // Bulk cancel state
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedForCancel, setSelectedForCancel] = useState<Set<string>>(new Set());
  const [bulkCancelReason, setBulkCancelReason] = useState("");
  const [bulkCancelLoading, setBulkCancelLoading] = useState(false);

  // Asset modal
  const [isAssignAssetModalOpen, setIsAssignAssetModalOpen] = useState(false);

  // ─── Data Fetching ───────────────────────────────────────────────

  const fetchAssetDetails = useCallback(async () => {
    if (!room) return;
    const supabase = createClient();
    try {
      const { data } = await supabase
        .from('room_assets')
        .select('id, asset_type, status, assigned_employee_id')
        .eq('room_id', room.id)
        .eq('asset_type', 'TV_REMOTE')
        .maybeSingle();

      setTvRemoteAsset(data);
    } catch (err) {
      console.error("Error fetching asset:", err);
    }
  }, [room]);

  const fetchDetails = useCallback(async (salesOrderId: string) => {
    setLoading(true);
    const supabase = createClient();

    try {
      const [paymentsRes, itemsRes, orderRes] = await Promise.all([
        supabase
          .from("payments")
          .select("id, payment_number, amount, payment_method, reference, concept, status, payment_type, parent_payment_id, notes, created_at")
          .eq("sales_order_id", salesOrderId)
          .order("created_at", { ascending: true }),
        supabase
          .from("sales_order_items")
          .select("id, qty, unit_price, products(name, sku), is_courtesy, courtesy_reason, concept_type, delivery_status, is_paid, is_cancelled, cancellation_reason, cancelled_at")
          .eq("sales_order_id", salesOrderId)
          .order("created_at", { ascending: true }),
        supabase
          .from("sales_orders")
          .select("id, notes, subtotal, total, paid_amount, remaining_amount, status, created_at")
          .eq("id", salesOrderId)
          .single(),
      ]);

      setPayments((paymentsRes.data || []) as Payment[]);
      setItems((itemsRes.data || []) as SalesOrderItem[]);
      setSalesOrder(orderRes.data as SalesOrder);
    } catch (err) {
      console.error("Error fetching room details:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (activeStay?.sales_order_id) fetchDetails(activeStay.sales_order_id);
      fetchAssetDetails();
    }
  }, [isOpen, activeStay, fetchDetails, fetchAssetDetails]);

  // ─── Cancel Operations ────────────────────────────────────────────

  const handleCancelPayment = async (paymentId: string, concept: string, amount: number) => {
    if (!room || !onCancelCharge) return;
    const confirmed = window.confirm(`¿Estás seguro de cancelar este cargo de $${amount.toFixed(2)}?`);
    if (!confirmed) return;

    const success = await onCancelCharge(paymentId, room, concept, amount);
    if (success && activeStay?.sales_order_id) {
      await fetchDetails(activeStay.sales_order_id);
    }
  };

  const handleSingleCancel = async () => {
    if (!room || !onCancelItem || !cancellingItemId || !cancelReason.trim()) return;
    setCancellingLoading(true);

    const success = await onCancelItem(cancellingItemId, room, cancelReason.trim());
    if (success && activeStay?.sales_order_id) {
      await fetchDetails(activeStay.sales_order_id);
    }

    setCancellingLoading(false);
    setCancellingItemId(null);
    setCancelReason("");
  };

  const handleBulkCancel = async () => {
    if (!room || !onCancelItem || !bulkCancelReason.trim() || selectedForCancel.size === 0) return;
    setBulkCancelLoading(true);

    let successCount = 0;
    let failCount = 0;

    for (const itemId of Array.from(selectedForCancel)) {
      try {
        const ok = await onCancelItem(itemId, room, bulkCancelReason.trim());
        if (ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    if (activeStay?.sales_order_id) await fetchDetails(activeStay.sales_order_id);

    setBulkCancelLoading(false);
    setBulkSelectMode(false);
    setSelectedForCancel(new Set());
    setBulkCancelReason("");

    if (failCount === 0) toast.success(`${successCount} item(s) cancelado(s)`);
    else toast.warning(`${successCount} cancelado(s), ${failCount} fallaron`);
  };

  // ─── Bulk Select Helpers ──────────────────────────────────────────

  const cancellableItems = items.filter(i => !i.is_cancelled);

  const toggleBulkSelect = (itemId: string) => {
    setSelectedForCancel(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectAllCancellable = () => {
    setSelectedForCancel(new Set(cancellableItems.map(i => i.id)));
  };

  const deselectAllCancel = () => setSelectedForCancel(new Set());

  // ─── Computed Values ──────────────────────────────────────────────

  const totalPayments = payments
    .filter(p => p.status !== "CANCELADO" && !p.parent_payment_id)
    .reduce((sum, p) => sum + p.amount, 0);

  const totalItems = items
    .filter(i => !i.is_cancelled)
    .reduce((sum, i) => sum + i.unit_price * i.qty, 0);

  const cancelledCount = items.filter(i => i.is_cancelled).length;
  const selectedCancelTotal = items
    .filter(i => selectedForCancel.has(i.id))
    .reduce((sum, i) => sum + i.unit_price * i.qty, 0);

  // ─── Format Helpers ───────────────────────────────────────────────

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'EFECTIVO': return '💵';
      case 'TARJETA': return '💳';
      case 'TRANSFERENCIA': return '🏦';
      case 'PENDIENTE': return '⏳';
      default: return '💰';
    }
  };

  const getConceptLabel = (concept: string | null) => {
    const labels: Record<string, string> = {
      ROOM_BASE: "Habitación",
      EXTRA_PERSON: "Persona extra",
      EXTRA_HOUR: "Hora extra",
      PROMO_4H: "Promo 4 horas",
      RENEWAL: "Renovación",
      DAMAGE_CHARGE: "Cargo por daño",
      TOLERANCIA_EXPIRADA: "Tolerancia expirada",
      CONSUMPTION: "Consumo",
      CHECKOUT: "Cobro salida",
      PERSONA_EXTRA: "Persona extra",
    };
    return labels[concept || ""] || concept || "General";
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-MX", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  };

  const getAssetStatusColor = (status: string) => {
    switch(status) {
      case 'EN_HABITACION': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'CON_COCHERO': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'EN_RECEPCION': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'EXTRAVIADO': return 'text-red-400 bg-red-500/10 border-red-500/20 animate-pulse';
      default: return 'text-zinc-400 bg-white/5 border-white/10';
    }
  };

  return {
    // Data
    payments, items, salesOrder, tvRemoteAsset, loading, activeTab,
    // Cancel state
    cancellingItemId, cancelReason, cancellingLoading,
    bulkSelectMode, selectedForCancel, bulkCancelReason, bulkCancelLoading,
    // Asset modal
    isAssignAssetModalOpen,
    // Computed
    totalPayments, totalItems, cancelledCount, cancellableItems,
    selectedCancelCount: selectedForCancel.size, selectedCancelTotal,
    // Actions
    setActiveTab, setCancellingItemId, setCancelReason,
    setBulkSelectMode, setBulkCancelReason,
    setIsAssignAssetModalOpen,
    handleCancelPayment, handleSingleCancel, handleBulkCancel,
    toggleBulkSelect, selectAllCancellable, deselectAllCancel,
    fetchDetails, fetchAssetDetails,
    // Formatters
    getPaymentIcon, getConceptLabel, formatDateTime, getAssetStatusColor,
    formatAssetStatus: (status: string) => status.replace('_', ' '),
  };
}
