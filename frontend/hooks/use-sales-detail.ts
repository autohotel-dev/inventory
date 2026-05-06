import { apiClient } from "@/lib/api/client";
/**
 * Hook for sales order detail: fetching, payments, item management, and status updates.
 * Extracted from advanced-sales-detail.tsx for separation of concerns.
 */
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";

// ─── Types ───────────────────────────────────────────────────────────

export interface SalesOrderDetail {
  id: string;
  created_at: string;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
  customer_id: string | null;
  warehouse_id: string;
  customers: { name: string; email: string; phone: string } | null;
  warehouses: { code: string; name: string } | null;
  remaining_amount: number;
}

export interface SalesOrderItem {
  id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  total: number;
  payment_method?: string | null;
  is_paid?: boolean;
  paid_at?: string | null;
  concept_type?: string | null;
  products: { name: string; sku: string } | null;
  is_courtesy?: boolean;
  courtesy_reason?: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  price?: number;
}

export interface PaymentHistoryItem {
  id: string;
  amount: number;
  payment_method: string;
  reference: string;
  concept: string;
  status: string;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function generatePaymentReference(prefix: string = "PAY"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export const formatCurrency = (amount: number, currency: string = 'MXN') =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount);

export const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

// ─── Hook ────────────────────────────────────────────────────────────

interface UseSalesDetailProps {
  orderId: string;
}

export function useSalesDetail({ orderId }: UseSalesDetailProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showGranularPaymentModal, setShowGranularPaymentModal] = useState(false);
  const [order, setOrder] = useState<SalesOrderDetail | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockWarnings, setStockWarnings] = useState<string[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, itemId: '', itemName: '' });
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);

  // ─── Data Fetching ───────────────────────────────────────────────

  const fetchOrderDetail = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data: orderData, error: orderError } = await supabase
        .from("sales_orders").select("*");
      if (orderError) throw orderError;
      if (!orderData) return;

      let customerData = null;
      let warehouseData = null;

      if (orderData.customer_id) {
        const { data: customer } = await supabase
          .from("customers").select("name, email, phone");
        customerData = customer;
      }
      if (orderData.warehouse_id) {
        const { data: warehouse } = await supabase
          .from("warehouses").select("code, name");
        warehouseData = warehouse;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("sales_order_items")
        .select("id, product_id, qty, unit_price, total, payment_method, is_paid, paid_at, concept_type, products:product_id(name, sku)")
        ;
      if (itemsError) throw itemsError;

      const { data: productsData } = await supabase
        .from("products").select("id, name, sku, price");

      const { data: paymentsData } = await supabase
        .from("payments")
        .select("id, amount, payment_method, reference, concept, status, created_at")
        ;

      setOrder({ ...orderData, customers: customerData, warehouses: warehouseData } as any);
      setItems(itemsData as any || []);
      setProducts(productsData || []);
      setPaymentHistory(paymentsData || []);
      setStockWarnings([]);
    } catch (error) {
      console.error('Error fetching order detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrderDetail(); }, [orderId]);

  // ─── Item Expand ──────────────────────────────────────────────────

  const toggleItemExpand = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) newExpanded.delete(itemId);
    else newExpanded.add(itemId);
    setExpandedItems(newExpanded);
  };

  // ─── Payment Modal ────────────────────────────────────────────────

  const handlePaymentModalOpen = () => {
    if (!order || typeof order.remaining_amount !== "number") {
      toast.error("No se pudo obtener el saldo pendiente"); return;
    }
    if (order.remaining_amount <= 0) {
      toast.error("No hay saldo pendiente", { description: "Esta orden ya está pagada al 100%." }); return;
    }
    setPayments(createInitialPayment(order.remaining_amount));
    setShowPaymentModal(true);
  };

  const handlePaymentModalClose = () => setShowPaymentModal(false);

  const resetPaymentForm = () => { setShowPaymentModal(false); setPayments([]); };

  // ─── Payment Submit ───────────────────────────────────────────────

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    if (totalAmount <= 0) { toast.error('El monto debe ser mayor a 0'); return; }

    try {
      const supabase = createClient();
      const validPayments = payments.filter(p => p.amount > 0);
      const isMultipago = validPayments.length > 1;

      if (isMultipago) {
        const { data: mainPayment, error: mainError } = await supabase
          .from("payments")
          .insert({ sales_order_id: orderId, amount: totalAmount, payment_method: "PENDIENTE", reference: generatePaymentReference("ABN"), concept: "ABONO", status: "PAGADO", payment_type: "COMPLETO" })
          .select("id");

        if (mainError) console.error("Error inserting main payment:", mainError);
        else if (mainPayment) {
          const subpayments = validPayments.map((p: any) => ({
            sales_order_id: orderId, amount: p.amount, payment_method: p.method,
            reference: p.reference || generatePaymentReference("SUB"),
            concept: "ABONO", status: "PAGADO", payment_type: "PARCIAL", parent_payment_id: mainPayment.id,
          }));
          const { error: subError } = await apiClient.post("/system/crud/payments", subpayments) as any;
          if (subError) console.error("Error inserting subpayments:", subError);
        }
      } else if (validPayments.length === 1) {
        const p = validPayments[0];
        const { error } = await apiClient.post("/system/crud/payments", {
          sales_order_id: orderId, amount: p.amount, payment_method: p.method,
          reference: p.reference || generatePaymentReference("ABN") as any,
          concept: "ABONO", status: "PAGADO", payment_type: "COMPLETO",
        });
        if (error) console.error("Error inserting payment:", error);
      }

      const { apiClient } = await import("@/lib/api/client");
      let data;
      try {
        const response = await apiClient.post('/sales/process-payment', {
          order_id: orderId,
          payment_amount: totalAmount
        });
        data = [response.data]; // Wrap in array to match old expected format `data[0]`
      } catch (err: any) {
        toast.error('Error al crear el pago', {
          description: err.response?.data?.detail || err.message
        });
        return;
      }

      const result = data[0] as any;
      if (result.success === true) {
        const methodsSummary = payments.map(p => `${p.method}: $${p.amount.toFixed(2)}`).join(', ');
        toast.success('Pago creado exitosamente', { description: `Total: $${totalAmount.toFixed(2)} MXN (${methodsSummary})` });
        fetchOrderDetail();
        resetPaymentForm();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Error al crear el pago');
    }
  };

  // ─── Status Updates ───────────────────────────────────────────────

  const updateOrderStatus = async (newStatus: string) => {
    const supabase = createClient();
    try {
      if ((newStatus === 'COMPLETED' || newStatus === 'PARTIAL') && order) {
        const { data: existingMovements } = await supabase
          .from("inventory_movements").select("id").limit(1);

        if (!existingMovements || existingMovements.length === 0) {
          const { data: { user } } = await supabase.auth.getUser();
          const movements = items.map((item: any) => ({
            product_id: item.product_id, warehouse_id: order.warehouse_id,
            quantity: item.qty, movement_type: 'OUT', reason_id: 6, reason: 'SALE',
            notes: `Vendido en orden ${orderId}`, reference_table: 'sales_orders',
            reference_id: orderId, created_by: user?.id || null
          }));
          const { error: movError } = await apiClient.post("/system/crud/inventory_movements", movements) as any;
          if (movError) console.error('Error creating inventory movements:', movError);
        }
      }

      const { error } = await apiClient.patch(`/system/crud/sales_orders/${orderId}`, { status: newStatus }) as any;
      if (error) throw error;
      await fetchOrderDetail();
      toast.success("Estado actualizado", { description: `La orden ahora está en estado: ${newStatus}` });
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error("Error al actualizar el estado", { description: "Por favor intenta nuevamente" });
    }
  };

  // ─── Add Products ─────────────────────────────────────────────────

  const addProductToOrder = async (newItems: { product: Product; quantity: number; unit_price: number; payments: PaymentEntry[]; is_courtesy?: boolean; courtesy_reason?: string }[]) => {
    if (!order || newItems.length === 0) return;
    const supabase = createClient();

    try {
      if (!order.warehouse_id) {
        toast.error("Error de configuración", { description: "La orden no tiene almacén asignado" }); return;
      }

      const { validateStockAvailability } = await import("@/lib/utils/stock-helpers");
      const stockErrors = await validateStockAvailability(
        newItems.map(i => ({ product_id: i.product.id, product_name: i.product.name, quantity: i.quantity })),
        order.warehouse_id
      );
      if (stockErrors.length > 0) {
        toast.error("Stock insuficiente", { description: stockErrors.join(" | "), duration: 5000 }); return;
      }

      const newItemsTotal = newItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
      const productosNota = newItems.map(i => `${i.quantity}x ${i.product.name}`).join(", ");

      const { apiClient } = await import("@/lib/api/client");
      const sessionUser = await supabase.auth.getUser();
      await apiClient.post(`/sales/orders/${orderId}/items/bulk`, {
        items: newItems.map(i => ({
          product_id: i.product.id,
          qty: i.quantity,
          unit_price: i.unit_price,
          is_courtesy: i.is_courtesy || false,
          courtesy_reason: i.courtesy_reason || null
        })),
        warehouse_id: order.warehouse_id,
        employee_id: sessionUser.data?.user?.id
      });

      await fetchOrderDetail();
      setShowAddProduct(false);
      const totalItemsCount = newItems.reduce((sum, i) => sum + i.quantity, 0);
      toast.success(`${totalItemsCount} producto(s) agregado(s)`, {
        description: `${productosNota} - Total: $${newItemsTotal.toFixed(2)} (pendiente de pago)`
      });
    } catch (error) {
      console.error('Error adding products:', error);
      toast.error("Error al agregar productos", { description: "Por favor intenta nuevamente" });
    }
  };

  // ─── Remove Item ──────────────────────────────────────────────────

  const recalculateOrderTotals = async () => {
    const supabase = createClient();
    try {
      const { data: orderData } = await supabase
        .from("sales_orders").select("subtotal, tax, total, paid_amount, remaining_amount");
      if (!orderData) return;

      const { data: itemsData } = await supabase
        .from("sales_order_items").select("qty, unit_price");
      const itemsSubtotal = itemsData?.reduce((sum: number, item: any) =>
        sum + (Number(item.qty) || 0) * (Number(item.unit_price) || 0), 0) || 0;

      const { data: paymentsData } = await supabase
        .from("payments").select("amount, concept").is("parent_payment_id", null);
      const nonItemCharges = paymentsData?.reduce((sum: number, p: any) =>
        p.concept !== "CONSUMO" ? sum + (Number(p.amount) || 0) : sum, 0) || 0;

      const subtotal = nonItemCharges + itemsSubtotal;
      const tax = Number(orderData.tax) || 0;
      const total = subtotal + tax;
      const paid_amount = Number(orderData.paid_amount) || 0;
      await apiClient.patch(`/system/crud/sales_orders/${orderId}`, {
        subtotal, tax, total, remaining_amount: Math.max(total - paid_amount, 0)
      });
    } catch (error) {
      console.error('Error recalculating totals:', error);
    }
  };

  const handleRemoveClick = (itemId: string, itemName: string) => {
    setConfirmDialog({ isOpen: true, itemId, itemName });
  };

  const removeItemFromOrder = async () => {
    const supabase = createClient();
    try {
      const { apiClient } = await import("@/lib/api/client");
      await apiClient.delete(`/sales/orders/items/${confirmDialog.itemId}`);
      await fetchOrderDetail();
      toast.success("Producto eliminado", { description: "El producto ha sido removido de la orden" });
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error("Error al eliminar el producto", { description: "Por favor intenta nuevamente" });
    }
  };

  // ─── Computed ─────────────────────────────────────────────────────

  const calculateProfitMargin = () => {
    if (!order || !items.length) return 0;
    const totalCost = items.reduce((sum, item) => {
      const estimatedCost = item.unit_price * 0.7;
      return sum + (estimatedCost * item.qty);
    }, 0);
    const profit = order.total - totalCost;
    return totalCost > 0 ? (profit / order.total) * 100 : 0;
  };

  const exportToPDF = () => {
    if (!order) return;
    const printContent = `
      <html><head><title>Orden de Venta #${order.id.slice(0, 8)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 24px; margin-bottom: 10px; }
        .info { margin-bottom: 20px; } .info p { margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; }
        .total { font-weight: bold; font-size: 18px; margin-top: 20px; }
      </style></head><body>
        <h1>Orden de Venta #${order.id.slice(0, 8)}</h1>
        <div class="info">
          <p><strong>Fecha:</strong> ${formatDate(order.created_at)}</p>
          <p><strong>Cliente:</strong> ${order.customers?.name || 'Cliente general'}</p>
          <p><strong>Almacén:</strong> ${order.warehouses?.code} - ${order.warehouses?.name}</p>
          <p><strong>Estado:</strong> ${order.status}</p>
        </div>
        <table><thead><tr><th>Producto</th><th>SKU</th><th>Cantidad</th><th>Precio Unit.</th><th>Total</th></tr></thead>
        <tbody>${items.map(item => `<tr><td>${item.products?.name || '-'}</td><td>${item.products?.sku || '-'}</td><td>${item.qty}</td><td>${formatCurrency(item.unit_price, order.currency)}</td><td>${formatCurrency(item.total, order.currency)}</td></tr>`).join('')}</tbody></table>
        <p class="total">Total: ${formatCurrency(order.total, order.currency)}</p>
        ${order.notes ? `<p><strong>Notas:</strong> ${order.notes}</p>` : ''}
      </body></html>`;
    const printWindow = window.open('', '_blank');
    if (printWindow) { printWindow.document.write(printContent); printWindow.document.close(); printWindow.print(); }
  };

  return {
    // State
    order, items, products, loading, stockWarnings, paymentHistory,
    showPaymentModal, showGranularPaymentModal, showAddProduct, confirmDialog,
    payments, expandedItems,
    // Setters
    setShowPaymentModal, setShowGranularPaymentModal, setShowAddProduct, setConfirmDialog,
    setPayments, setExpandedItems,
    // Actions
    fetchOrderDetail, handlePaymentModalOpen, handlePaymentModalClose, handlePaymentSubmit, resetPaymentForm,
    updateOrderStatus, addProductToOrder, handleRemoveClick, removeItemFromOrder,
    toggleItemExpand, exportToPDF,
    // Computed
    calculateProfitMargin,
    // Formatters
    formatCurrency, formatDate,
  };
}
