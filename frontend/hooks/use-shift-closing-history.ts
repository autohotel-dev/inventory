import { apiClient } from "@/lib/api/client";
/**
 * Hook for shift closing history: list, filter, detail, approve/reject, correction.
 * Extracted from shift-closing.tsx (ShiftClosingHistory).
 */
"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ShiftClosing } from "@/components/employees/types";
import { usePrintClosing } from "@/hooks/use-print-closing";

// ─── Formatters ──────────────────────────────────────────────────────

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

// ─── Hook ────────────────────────────────────────────────────────────

export function useShiftClosingHistory() {
    const { success, error: showError } = useToast();
  const { printClosing } = usePrintClosing();

  const [closings, setClosings] = useState<ShiftClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedClosing, setSelectedClosing] = useState<ShiftClosing | null>(null);
  const [closingDetails, setClosingDetails] = useState<any[]>([]);
  const [closingSalesOrders, setClosingSalesOrders] = useState<any[]>([]);
  const [closingReviews, setClosingReviews] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [processingAction, setProcessingAction] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionClosing, setCorrectionClosing] = useState<ShiftClosing | null>(null);
  const [correctionCountedCash, setCorrectionCountedCash] = useState(0);
  const [correctionDeclaredBBVA, setCorrectionDeclaredBBVA] = useState("");
  const [correctionDeclaredGetnet, setCorrectionDeclaredGetnet] = useState("");
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);

  // ─── Load Closings ────────────────────────────────────────────────

  const loadClosings = async () => {
    setLoading(true);
    try {
      const authRes = await apiClient.get('/hr/manager/data') as any;
      const isAdminUser = authRes.data?.user_role in ['admin', 'manager'];
      
      const { data } = await apiClient.get('/hr/shift-closings/history', {
        params: {
          page: currentPage,
          limit: pageSize,
          status_filter: statusFilter,
          employee_id: currentEmployeeId
        }
      }) as any;
      
      setClosings(data.data || []);
      setTotalCount(data.total || 0);
    } catch (error) {
      console.error("Error loading closings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClosings(); }, [statusFilter, currentPage, pageSize]);

  // ─── Detail Loading ───────────────────────────────────────────────

  const loadClosingDetails = async (closingId: string, periodStart: string, periodEnd: string) => {
    setLoadingDetails(true);
    const { data, error } = await apiClient.get(`/hr/shift-closings/${closingId}/details`).then(res => ({ data: res.data?.details, error: null })).catch(err => ({ data: null, error: err })) as any;
    if (!error) setClosingDetails(data || []);

    const detailSalesOrderIds = [...new Set((data || []).filter((d: any) => d.sales_order_id).map((d: any) => d.sales_order_id))];
    let salesOrders: any[] = [];
    if (detailSalesOrderIds.length > 0) {
      const { data: ordersData } = await apiClient.post(`/system/crud/sales_orders/batch`, { ids: detailSalesOrderIds }).then(res => ({ data: res.data })).catch(() => ({ data: null })) as any;
      salesOrders = ordersData || [];
    }
    setClosingSalesOrders(salesOrders);
    setLoadingDetails(false);
  };

  const loadClosingReviews = async (closingId: string) => {
    const { data } = await apiClient.get(`/hr/shift-closings/${closingId}/reviews`).then(res => ({ data: res.data?.reviews })) as any;
    setClosingReviews(data || []);
  };

  const openDetail = async (closing: ShiftClosing) => {
    setSelectedClosing(closing);
    await Promise.all([
      loadClosingDetails(closing.id, closing.period_start, closing.period_end),
      loadClosingReviews(closing.id)
    ]);
  };

  // ─── Review Actions ───────────────────────────────────────────────

  const recordReview = async (closingId: string, action: string, reason?: string) => {
    await apiClient.post(`/system/crud/shift_closing_reviews`, {
      shift_closing_id: closingId, reviewer_id: currentEmployeeId, action, reason
    });
  };

  const approveClosing = async (closingId: string) => {
    setProcessingAction(true);
    try {
      await apiClient.patch(`/system/crud/shift_closings/${selectedClosing?.id || correctionClosing?.id || closingId}`, { status: "approved", reviewed_by: currentEmployeeId, reviewed_at: new Date().toISOString() })
        ;
      if (error) throw error;
      await recordReview(closingId, "approved");
      await loadClosings();
      success("Corte aprobado", "El corte ha sido aprobado exitosamente");
      setSelectedClosing(null);
    } catch (err) {
      console.error("Error approving closing:", err);
      showError("Error", "No se pudo aprobar el corte");
    } finally { setProcessingAction(false); }
  };

  const openRejectModal = () => { setRejectionReason(""); setShowRejectModal(true); };

  const confirmRejectClosing = async () => {
    if (!selectedClosing || !rejectionReason.trim()) { showError("Error", "Debe proporcionar un motivo de rechazo"); return; }
    setProcessingAction(true);
    try {
      await apiClient.patch(`/system/crud/shift_closings/${selectedClosing?.id || correctionClosing?.id || closingId}`, { status: "rejected", reviewed_by: currentEmployeeId, reviewed_at: new Date().toISOString(), rejection_reason: rejectionReason.trim() })
        ;
      if (error) throw error;
      await recordReview(selectedClosing.id, "rejected", rejectionReason.trim());
      await loadClosings();
      success("Corte rechazado", "El corte ha sido marcado como rechazado");
      setShowRejectModal(false); setSelectedClosing(null);
    } catch (err) {
      console.error("Error rejecting closing:", err);
      showError("Error", "No se pudo rechazar el corte");
    } finally { setProcessingAction(false); }
  };

  // ─── Correction ───────────────────────────────────────────────────

  const openCorrectionModal = (closing: ShiftClosing) => {
    setCorrectionClosing(closing);
    setCorrectionCountedCash(closing.counted_cash || 0);
    setCorrectionDeclaredBBVA(""); setCorrectionDeclaredGetnet("");
    setCorrectionNotes(`Corrección del corte del ${new Date(closing.period_start).toLocaleDateString("es-MX")}`);
    setShowCorrectionModal(true);
    setSelectedClosing(null);
  };

  const calculateCorrectionCashTotal = () => correctionCountedCash;

  const saveCorrectionClosing = async () => {
    if (!correctionClosing || !currentEmployeeId) return;
    setSavingCorrection(true);
    try {
      const correctionCashTotal = calculateCorrectionCashTotal();
      const expectedCash = correctionClosing.total_cash || 0;
      const cashDifference = correctionCashTotal - expectedCash;
      const bbvaAmount = parseFloat(correctionDeclaredBBVA) || 0;
      const getnetAmount = parseFloat(correctionDeclaredGetnet) || 0;
      const diffBBVA = bbvaAmount - (correctionClosing.total_card_bbva || 0);
      const diffGetnet = getnetAmount - (correctionClosing.total_card_getnet || 0);

      await apiClient.patch(`/system/crud/shift_closings/${selectedClosing?.id || correctionClosing?.id || closingId}`, {
        counted_cash: correctionCashTotal, cash_difference: cashDifference, cash_breakdown: null,
        notes: correctionNotes.trim() || null, declared_card_bbva: bbvaAmount,
        declared_card_getnet: getnetAmount, card_difference_bbva: diffBBVA,
        card_difference_getnet: diffGetnet, status: "pending", rejection_reason: null,
        reviewed_by: null, reviewed_at: null, is_correction: true,
      });
      if (error) throw error;

      success("Corrección enviada", "El corte ha sido actualizado y enviado para revisión");
      setShowCorrectionModal(false); setCorrectionClosing(null); loadClosings();
    } catch (err) {
      console.error("Error creating correction:", err);
      showError("Error", "No se pudo crear el corte corregido");
    } finally { setSavingCorrection(false); }
  };

  // ─── Print/Export (via print-server API, silencioso) ───────────────

  const CONCEPT_LABELS: Record<string, string> = {
    ROOM_BASE: "Habitación", EXTRA_HOUR: "Hora Extra", EXTRA_PERSON: "Persona Extra",
    CONSUMPTION: "Consumo", PRODUCT: "Producto", RENEWAL: "Renovación", PROMO_4H: "Promo 4H",
  };

  const exportClosing = async (closing: ShiftClosing) => {
    try {
      const { data } = await apiClient.get(`/hr/shift-closings/${closing.id}/details`) as any;
      const details = data.details || [];
      const allItems = data.sales_orders?.flatMap((so: any) => so.sales_order_items || []) || [];
      
      const itemsBySalesOrder = allItems.reduce((acc: any, item: any) => {
        if (!acc[item.sales_order_id]) acc[item.sales_order_id] = [];
        acc[item.sales_order_id].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      const transactions = details.map((detail: any) => {
        const payment = detail.payments;
        if (!payment) return null;

        let items: any[] = [];
        if (payment.sales_order_id && itemsBySalesOrder[payment.sales_order_id]) {
          const paymentTime = new Date(payment.created_at).getTime();
          const relatedItems = itemsBySalesOrder[payment.sales_order_id].filter((item: any) => {
            if (!item.paid_at) return false;
            return Math.abs(paymentTime - new Date(item.paid_at).getTime()) / 1000 / 60 <= 5;
          });
          items = relatedItems.map((item: any) => {
            const product = Array.isArray(item.products) ? item.products[0] : item.products;
            return {
              name: product?.name || CONCEPT_LABELS[item.concept_type || "PRODUCT"] || "Item",
              qty: item.qty,
              unitPrice: item.unit_price,
              total: item.qty * item.unit_price,
            };
          });
        }

        const concept = items.length > 0
          ? items.map((i: any) => i.qty > 1 ? `${i.qty}x ${i.name}` : i.name).join(", ")
          : payment.concept || undefined;

        return {
          time: new Date(payment.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          amount: payment.amount,
          paymentMethod: detail.payment_method || payment.payment_method || 'N/A',
          terminalCode: detail.terminal_code || payment.payment_terminals?.code || payment.terminal_code,
          reference: payment.reference || undefined,
          concept,
          items: items.length > 0 ? items : undefined,
        };
      }).filter(Boolean);

      await printClosing({
        employeeName: `${closing.employees?.first_name || ''} ${closing.employees?.last_name || ''}`,
        shiftName: closing.shift_definitions?.name || 'Turno',
        periodStart: closing.period_start,
        periodEnd: closing.period_end,
        totalCash: closing.total_cash || 0,
        totalCardBBVA: closing.total_card_bbva || 0,
        totalCardGetnet: closing.total_card_getnet || 0,
        totalSales: closing.total_sales || 0,
        totalTransactions: closing.total_transactions || 0,
        countedCash: closing.counted_cash || 0,
        cashDifference: closing.cash_difference || 0,
        notes: closing.notes || undefined,
        transactions,
      });
    } catch (err) {
      console.error("Error al imprimir:", err);
    }
  };

  // ─── Computed ─────────────────────────────────────────────────────

  const rejectedClosings = closings.filter(c => c.status?.toLowerCase() === "rejected" && c.employee_id === currentEmployeeId);
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    // State
    closings, loading, currentEmployeeId, isAdmin, selectedClosing,
    closingDetails, closingSalesOrders, closingReviews, loadingDetails,
    statusFilter, processingAction, currentPage, pageSize, totalCount,
    showRejectModal, rejectionReason, showCorrectionModal, correctionClosing,
    correctionCountedCash, correctionDeclaredBBVA, correctionDeclaredGetnet,
    correctionNotes, savingCorrection,
    // Setters
    setSelectedClosing, setStatusFilter, setCurrentPage, setPageSize,
    setShowRejectModal, setRejectionReason, setShowCorrectionModal,
    setCorrectionClosing, setCorrectionCountedCash, setCorrectionDeclaredBBVA,
    setCorrectionDeclaredGetnet, setCorrectionNotes,
    // Actions
    loadClosings, openDetail, approveClosing, openRejectModal, confirmRejectClosing,
    openCorrectionModal, saveCorrectionClosing, exportClosing, calculateCorrectionCashTotal,
    // Computed
    rejectedClosings, totalPages,
    // Formatters
    formatCurrency,
  };
}
