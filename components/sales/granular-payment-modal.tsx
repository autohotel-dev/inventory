"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { MultiPaymentInput, PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { Input } from "@/components/ui/input";
import {
  Bed,
  Clock,
  Users,
  ShoppingBag,
  Package,
  MoreHorizontal,
  CheckCircle2,
  Circle,
  Loader2,
  Receipt,
  X,
  Percent,
  Tag,
  Trash2,
  AlertTriangle
} from "lucide-react";

// Generar referencia única para pagos
function generatePaymentReference(prefix: string = "PAY"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Helper para obtener turno activo
const getCurrentShiftId = async (supabase: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!employee) return null;

    const { data: session } = await supabase
      .from("shift_sessions")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("status", "open")
      .maybeSingle();

    return session?.id;
  } catch (err) {
    console.error("Error getting current shift id:", err);
    return null;
  }
};

// Helper para obtener employee_id del usuario actual
const getCurrentEmployeeId = async (supabase: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    return employee?.id || null;
  } catch (err) {
    console.error("Error getting current employee id:", err);
    return null;
  }
};

// Iconos por tipo de concepto
const CONCEPT_ICONS: Record<string, React.ReactNode> = {
  ROOM_BASE: <Bed className="h-4 w-4" />,
  EXTRA_HOUR: <Clock className="h-4 w-4" />,
  EXTRA_PERSON: <Users className="h-4 w-4" />,
  CONSUMPTION: <ShoppingBag className="h-4 w-4" />,
  PRODUCT: <Package className="h-4 w-4" />,
  RENEWAL: <Receipt className="h-4 w-4" />,
  PROMO_4H: <Clock className="h-4 w-4" />,
  OTHER: <MoreHorizontal className="h-4 w-4" />,
  DAMAGE_CHARGE: <AlertTriangle className="h-4 w-4" />,
  TOLERANCE_EXPIRED: <Clock className="h-4 w-4" />,
};

const CONCEPT_LABELS: Record<string, string> = {
  ROOM_BASE: "Habitación",
  EXTRA_HOUR: "Hora Extra",
  EXTRA_PERSON: "Persona Extra",
  CONSUMPTION: "Consumo",
  PRODUCT: "Producto",
  RENEWAL: "Renovación",
  PROMO_4H: "Promo 4 Horas",
  OTHER: "Otro",
  DAMAGE_CHARGE: "Cargo por Daños",
  TOLERANCE_EXPIRED: "Tolerancia Expirada",
};

const CONCEPT_COLORS: Record<string, string> = {
  ROOM_BASE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  EXTRA_HOUR: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  EXTRA_PERSON: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  CONSUMPTION: "bg-green-500/20 text-green-400 border-green-500/30",
  PRODUCT: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  RENEWAL: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  PROMO_4H: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  OTHER: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  DAMAGE_CHARGE: "bg-red-500/20 text-red-400 border-red-500/30",
  TOLERANCE_EXPIRED: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

interface OrderItem {
  id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  total: number;
  is_paid: boolean;
  paid_at: string | null;
  concept_type: string;
  payment_method: string | null;
  courtesy_reason?: string;
  products: { name: string; sku: string } | null;
}

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
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [valetPayments, setValetPayments] = useState<any[]>([]); // Pagos cobrados por valet
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "pay">("select");
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [showDiscountInput, setShowDiscountInput] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState<number>(0);

  // Cargar items de la orden y pagos pendientes de confirmación del valet
  const fetchItems = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Cargar items de la orden
      const { data, error } = await supabase
        .from("sales_order_items")
        .select(`
          id,
          product_id,
          qty,
          unit_price,
          total,
          is_paid,
          paid_at,
          concept_type,
          payment_method,
          courtesy_reason,
          products:product_id(name, sku)
        `)
        .eq("sales_order_id", salesOrderId);

      if (error) throw error;

      // Mapear los datos para ajustar la estructura de products
      const mappedItems = (data || []).map((item: any) => ({
        ...item,
        products: Array.isArray(item.products) ? item.products[0] : item.products,
      }));

      setItems(mappedItems as OrderItem[]);

      // 2. Cargar pagos COBRADO_POR_VALET para este sales_order
      const { data: valetPays, error: valetError } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          payment_method,
          reference,
          concept,
          collected_at,
          collected_by,
          confirmed_at,
          employees:collected_by(first_name, last_name)
        `)
        .eq("sales_order_id", salesOrderId)
        .eq("status", "COBRADO_POR_VALET");

      if (valetError) {
        console.error("Error loading valet payments:", valetError);
      } else {
        setValetPayments(valetPays || []);
      }

    } catch (error) {
      console.error("Error fetching items:", error);
      toast.error("Error al cargar los conceptos");
    } finally {
      setLoading(false);
    }
  };

  // Corroborar la recepción física del dinero/voucher (solo auditoría de pago)
  const corroborateValetPayment = async (paymentId: string) => {
    setConfirmingPaymentId(paymentId);
    const supabase = createClient();
    try {
      const employeeId = await getCurrentEmployeeId(supabase);

      const { error } = await supabase
        .from("payments")
        .update({
          confirmed_by: employeeId,
          confirmed_at: new Date().toISOString()
        })
        .eq("id", paymentId);

      if (error) throw error;

      toast.success("Recibo corroborado. Ahora puedes seleccionar los servicios a cobrar.");
      fetchItems();
    } catch (error) {
      console.error("Error corroborating payment:", error);
      toast.error("Error al corroborar el recibo");
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  // Pre-rellenar datos de pago desde un registro de valet
  const useValetPaymentData = (payment: any) => {
    setPayments([{
      id: "p1",
      amount: payment.amount,
      method: payment.payment_method as any || "EFECTIVO",
      reference: payment.reference || "",
      terminal: undefined,
      cardLast4: undefined,
      cardType: undefined
    }]);
    toast.success("Datos del cochero aplicados al formulario de pago");
  };


  useEffect(() => {
    if (isOpen && salesOrderId) {
      fetchItems();
      setSelectedItems(new Set());
      setDiscounts({});
      setShowDiscountInput(null);
      setConfirmDeleteId(null);
      setTipAmount(0);
      setStep("select");
    }
  }, [isOpen, salesOrderId]);

  if (!isOpen) return null;

  // Calcular totales con descuentos
  const pendingItems = items.filter(item => !item.is_paid);
  const paidItems = items.filter(item => item.is_paid);

  const getItemTotal = (item: OrderItem) => {
    const discount = discounts[item.id] || 0;
    return Math.max(0, item.total - discount);
  };

  const selectedTotal = items
    .filter((item: any) => selectedItems.has(item.id))
    .reduce((sum: number, item: any) => sum + getItemTotal(item), 0);
  const pendingTotal = pendingItems.reduce((sum: number, item: any) => sum + getItemTotal(item), 0);
  const totalDiscount = Object.values(discounts).reduce((sum: number, d: any) => sum + d, 0);

  // Aplicar descuento a un item
  const applyDiscount = (itemId: string, discountAmount: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const maxDiscount = item.total;
    const validDiscount = Math.min(Math.max(0, discountAmount), maxDiscount);

    setDiscounts(prev => ({
      ...prev,
      [itemId]: validDiscount
    }));
    setShowDiscountInput(null);
  };

  // Quitar descuento de un item
  const removeDiscount = (itemId: string) => {
    setDiscounts(prev => {
      const newDiscounts = { ...prev };
      delete newDiscounts[itemId];
      return newDiscounts;
    });
  };

  // Toggle selección de item
  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  // Seleccionar todos los pendientes
  const selectAllPending = () => {
    const allPendingIds = pendingItems.map(item => item.id);
    setSelectedItems(new Set(allPendingIds));
  };

  // Deseleccionar todos
  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  // Ir al paso de pago
  const goToPayment = () => {
    if (selectedItems.size === 0) {
      toast.error("Selecciona al menos un concepto para pagar");
      return;
    }
    setPayments(createInitialPayment(selectedTotal + tipAmount));
    setStep("pay");
  };

  // Eliminar consumo no pagado
  const deleteConsumption = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item || item.is_paid || item.concept_type !== 'CONSUMPTION') {
      toast.error("Este concepto no puede eliminarse");
      return;
    }

    setDeletingItemId(itemId);
    const supabase = createClient();

    try {
      // 1. Obtener el warehouse_id de la orden
      const { data: orderData } = await supabase
        .from('sales_orders')
        .select('warehouse_id')
        .eq('id', salesOrderId)
        .single();

      if (!orderData?.warehouse_id) {
        throw new Error('No se encontró el almacén de la orden');
      }

      // 2. Revertir movimiento de inventario (crear movimiento IN)
      if (item.product_id) {
        await supabase.from('inventory_movements').insert({
          product_id: item.product_id,
          warehouse_id: orderData.warehouse_id,
          quantity: item.qty,
          movement_type: 'IN',
          reason_id: 7, // RETURN/DEVOLUCION
          reason: 'RETURN',
          notes: `Consumo eliminado - Habitación ${roomNumber || 'N/A'}`,
          reference_table: 'sales_order_items',
          reference_id: itemId,
        });
      }

      // 3. Eliminar el item de la orden
      const { error: deleteError } = await supabase
        .from('sales_order_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) throw deleteError;

      // 4. Recalcular totales de la orden
      const { data: remainingItems } = await supabase
        .from('sales_order_items')
        .select('total, is_paid')
        .eq('sales_order_id', salesOrderId);

      const newSubtotal = remainingItems?.reduce((sum: number, i: any) => sum + (i.total || 0), 0) || 0;
      const newRemaining = remainingItems?.filter((i: any) => !i.is_paid).reduce((sum: number, i: any) => sum + (i.total || 0), 0) || 0;

      await supabase
        .from('sales_orders')
        .update({
          subtotal: newSubtotal,
          total: newSubtotal,
          remaining_amount: newRemaining,
        })
        .eq('id', salesOrderId);

      toast.success("Consumo eliminado", {
        description: `${item.products?.name || 'Producto'} ha sido removido y el inventario fue restaurado`
      });

      // 5. Refrescar lista de items
      await fetchItems();
      setConfirmDeleteId(null);

    } catch (error) {
      console.error('Error deleting consumption:', error);
      toast.error("Error al eliminar consumo", {
        description: "No se pudo eliminar el consumo. Intenta de nuevo."
      });
    } finally {
      setDeletingItemId(null);
    }
  };

  // Procesar el pago
  const processPayment = async () => {
    const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const totalToPay = selectedTotal + tipAmount;

    // Permitir una pequeña diferencia por redondeo
    if (Math.abs(totalPaid - totalToPay) > 0.1) {
      toast.error(`El monto pagado no coincide con el total (${formatCurrency(totalToPay)})`);
      return;
    }

    setProcessing(true);
    const supabase = createClient();

    try {
      // Obtener turno y empleado actuales
      const currentShiftId = await getCurrentShiftId(supabase);
      const currentEmployeeId = await getCurrentEmployeeId(supabase);

      const itemIds = Array.from(selectedItems);
      const validPayments = payments.filter(p => p.amount > 0);

      // 1. Actualizar items con descuentos y marcar como pagados
      for (const itemId of itemIds) {
        const item = items.find(i => i.id === itemId);
        if (!item) continue;

        const itemDiscount = discounts[itemId] || 0;
        const finalTotal = Math.max(0, item.total - itemDiscount);

        await supabase
          .from("sales_order_items")
          .update({
            is_paid: true,
            paid_at: new Date().toISOString(),
            // sales_order_items.payment_method tiene constraint y NO permite 'MIXTO'
            payment_method: validPayments.length === 1 ? validPayments[0].method : null,
            unit_price: item.qty > 0 ? finalTotal / item.qty : finalTotal,
          })
          .eq("id", itemId);
      }

      // 2. Buscar y actualiz ar pagos pendientes relacionados
      const selectedItemsData = items.filter(item => itemIds.includes(item.id));
      const conceptTypes = [...new Set(selectedItemsData.map(item => item.concept_type))];

      // Mapear concept_type a payment concept
      const conceptMapping: Record<string, string> = {
        'EXTRA_PERSON': 'PERSONA_EXTRA',
        'EXTRA_HOUR': 'HORA_EXTRA',
        'ROOM_BASE': 'ESTANCIA',
        'TOLERANCE_EXPIRED': 'TOLERANCIA_EXPIRADA',
        'DAMAGE_CHARGE': 'DAMAGE_CHARGE',
      };

      const paymentConcepts = conceptTypes
        .map(ct => conceptMapping[ct] || ct)
        .filter(Boolean);

      let hasPendingPayments = false;

      // Si hay conceptos mapeados, buscar pagos pendientes
      if (paymentConcepts.length > 0) {
        const { data: pendingPayments } = await supabase
          .from("payments")
          .select("id, amount, concept, status, confirmed_by, confirmed_at")
          .eq("sales_order_id", salesOrderId)
          .in("status", ["PENDIENTE", "COBRADO_POR_VALET"])
          .in("concept", paymentConcepts)
          .is("parent_payment_id", null);

        if (pendingPayments && pendingPayments.length > 0) {
          hasPendingPayments = true;
          const isMultipago = validPayments.length > 1;

          // Actualizar cada pago pendiente
          for (const pending of pendingPayments) {
            if (isMultipago) {
              // Multipago: Actualizar a PAGADO y crear subpagos
              const { error: pendingUpdateError } = await supabase
                .from("payments")
                .update({
                  status: "PAGADO",
                  // payments.payment_method tiene constraint; usar PENDIENTE como marcador de multipago
                  payment_method: "PENDIENTE",
                  confirmed_by: pending.status === 'COBRADO_POR_VALET' ? (pending.confirmed_by || currentEmployeeId) : (pending.confirmed_by || null),
                  confirmed_at: pending.status === 'COBRADO_POR_VALET' ? (pending.confirmed_at || new Date().toISOString()) : (pending.confirmed_at || null),
                })
                .eq("id", pending.id);

              if (pendingUpdateError) throw pendingUpdateError;

              // Crear subpagos proporcionales para evitar duplicar montos
              const ratio = totalToPay > 0 ? Number(pending.amount) / totalToPay : 0;
              const proportional = validPayments.map((p) => {
                const raw = p.amount * ratio;
                return {
                  ...p,
                  _alloc: Math.round(raw * 100) / 100,
                };
              });

              // Ajuste de redondeo para que sume exactamente al monto del pago principal
              const allocatedSum = proportional.reduce((s, p: any) => s + (p._alloc || 0), 0);
              const diff = Math.round((Number(pending.amount) - allocatedSum) * 100) / 100;
              if (proportional.length > 0 && Math.abs(diff) > 0) {
                (proportional[proportional.length - 1] as any)._alloc =
                  Math.round(((proportional[proportional.length - 1] as any)._alloc + diff) * 100) / 100;
              }

              const subpayments = proportional
                .filter((p: any) => (p._alloc || 0) > 0)
                .map((p: any) => ({
                  sales_order_id: salesOrderId,
                  amount: p._alloc,
                  payment_method: p.method,
                  terminal_code: p.method === "TARJETA" ? p.terminal : null,
                  reference: p.reference || generatePaymentReference("SUB"),
                  concept: pending.concept,
                  status: "PAGADO",
                  payment_type: "PARCIAL",
                  parent_payment_id: pending.id,
                  shift_session_id: currentShiftId,
                  employee_id: currentEmployeeId,
                  card_last_4: p.method === "TARJETA" ? p.cardLast4 : null,
                  card_type: p.method === "TARJETA" ? p.cardType : null,
                }));

              const { error: subpaymentsError } = await supabase.from("payments").insert(subpayments);
              if (subpaymentsError) throw subpaymentsError;
            } else {
              // Pago único: actualizar directamente
              const p = validPayments[0];
              const { error: pendingSingleUpdateError } = await supabase
                .from("payments")
                .update({
                  status: "PAGADO",
                  payment_method: p.method,
                  terminal_code: p.method === "TARJETA" ? p.terminal : null,
                  reference: p.reference || generatePaymentReference("GRN"),
                  card_last_4: p.method === "TARJETA" ? p.cardLast4 : null,
                  card_type: p.method === "TARJETA" ? p.cardType : null,
                  confirmed_by: pending.status === 'COBRADO_POR_VALET' ? (pending.confirmed_by || currentEmployeeId) : (pending.confirmed_by || null),
                  confirmed_at: pending.status === 'COBRADO_POR_VALET' ? (pending.confirmed_at || new Date().toISOString()) : (pending.confirmed_at || null),
                })
                .eq("id", pending.id);

              if (pendingSingleUpdateError) throw pendingSingleUpdateError;
            }
          }
        }
      }

      // 3. Solo crear nuevo pago si NO había pagos pendientes
      if (!hasPendingPayments) {
        const isMultipago = validPayments.length > 1;

        // Crear descripción de items para el concept
        const selectedItemsData = items.filter(item => itemIds.includes(item.id));
        const itemDescriptions = selectedItemsData.map(item => {
          const name = item.products?.name || CONCEPT_LABELS[item.concept_type || "PRODUCT"];
          return item.qty > 1 ? `${item.qty}x ${name}` : name;
        });
        const itemsSummary = itemDescriptions.slice(0, 3).join(", ");
        const detailedConcept = itemDescriptions.length > 3
          ? `${itemsSummary} +${itemDescriptions.length - 3} más`
          : itemsSummary;

        if (isMultipago) {
          // MULTIP AGO: Crear cargo principal + subpagos
          const { data: mainPayment, error: mainError } = await supabase
            .from("payments")
            .insert({
              sales_order_id: salesOrderId,
              amount: totalPaid,
              // payments.payment_method tiene constraint; usar PENDIENTE como marcador de multipago
              payment_method: "PENDIENTE",
              reference: generatePaymentReference("GRN"),
              concept: detailedConcept || `PAGO_GRANULAR_${itemIds.length}_CONCEPTOS`,
              status: "PAGADO",
              payment_type: "COMPLETO",
              shift_session_id: currentShiftId,
              employee_id: currentEmployeeId,
              tip_amount: tipAmount,
            })
            .select("id")
            .single();

          if (mainError) throw mainError;

          if (mainPayment) {
            const subpayments = validPayments.map(p => ({
              sales_order_id: salesOrderId,
              amount: p.amount,
              payment_method: p.method,
              terminal_code: p.method === "TARJETA" ? p.terminal : null,
              reference: p.reference || generatePaymentReference("SUB"),
              concept: detailedConcept || "PAGO_GRANULAR",
              status: "PAGADO",
              payment_type: "PARCIAL",
              parent_payment_id: mainPayment.id,
              shift_session_id: currentShiftId,
              employee_id: currentEmployeeId,
              card_last_4: p.method === "TARJETA" ? p.cardLast4 : null,
              card_type: p.method === "TARJETA" ? p.cardType : null,
            }));

            await supabase.from("payments").insert(subpayments);
          }
        } else if (validPayments.length === 1) {
          // PAGO ÚNICO
          const p = validPayments[0];
          await supabase.from("payments").insert({
            sales_order_id: salesOrderId,
            amount: p.amount,
            payment_method: p.method,
            terminal_code: p.method === "TARJETA" ? p.terminal : null,
            reference: p.reference || generatePaymentReference("GRN"),
            concept: detailedConcept || `PAGO_GRANULAR_${itemIds.length}_CONCEPTOS`,
            status: "PAGADO",
            payment_type: "COMPLETO",
            shift_session_id: currentShiftId,
            employee_id: currentEmployeeId,
            tip_amount: tipAmount,
            card_last_4: p.method === "TARJETA" ? p.cardLast4 : null,
            card_type: p.method === "TARJETA" ? p.cardType : null,
          });
        }
      }

      // 3. Recalcular remaining_amount
      const { data: unpaidItems } = await supabase
        .from("sales_order_items")
        .select("total")
        .eq("sales_order_id", salesOrderId)
        .eq("is_paid", false);

      const newRemaining = unpaidItems?.reduce((sum: number, item: any) => sum + (item.total || 0), 0) || 0;

      await supabase
        .from("sales_orders")
        .update({ remaining_amount: newRemaining })
        .eq("id", salesOrderId);

      // 4. Si ya no hay pendientes, marcar orden como completada
      if (newRemaining <= 0) {
        await supabase
          .from("sales_orders")
          .update({ status: "COMPLETED" })
          .eq("id", salesOrderId);
      }

      toast.success("Pago registrado", {
        description: `${itemIds.length} concepto(s) pagado(s) - $${totalPaid.toFixed(2)} MXN`,
      });

      onComplete();
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error("Error al procesar el pago");
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  return (
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={processing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
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
                <Button variant="outline" size="sm" onClick={selectAllPending}>
                  Seleccionar todo
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Deseleccionar
                </Button>
              </div>

              {/* Pagos de Valet Pendientes de Corroboración */}
              {valetPayments.filter(p => !p.confirmed_at).length > 0 && (
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <AlertTriangle className="h-5 w-5" />
                    <p className="text-sm font-medium">Información de cobros informados por Valet pendientes de corroborar</p>
                  </div>

                  <div className="space-y-2">
                    {valetPayments.filter(p => !p.confirmed_at).map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/20"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-indigo-500 text-indigo-500">
                            {payment.payment_method}
                          </Badge>
                          <span className="font-bold text-lg">
                            {formatCurrency(payment.amount)}
                          </span>
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-tighter">
                            {payment.concept === 'CONSUMPTION' ? 'CONSUMO' :
                              payment.concept === 'ESTANCIA' ? 'ESTANCIA' :
                                payment.concept === 'HORA_EXTRA' ? 'HORA EXTRA' :
                                  payment.concept === 'PERSONA_EXTRA' ? 'PERS. EXTRA' :
                                    payment.concept === 'DAMAGE_CHARGE' ? 'DAÑO' :
                                      payment.concept || 'PAGO'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Cobrado por <span className="font-medium text-foreground">{payment.employees?.first_name} {payment.employees?.last_name}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground italic">
                            {new Date(payment.collected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {payment.reference && !payment.reference.includes('VALET_') && (
                            <span className="text-[10px] bg-muted px-1.5 rounded-full border border-border">
                              Ref: {payment.reference}
                            </span>
                          )}
                        </div>

                        <Button
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                          onClick={() => corroborateValetPayment(payment.id)}
                          disabled={confirmingPaymentId === payment.id}
                        >
                          {confirmingPaymentId === payment.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Corroborar Recibo
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de conceptos pendientes */}
              {pendingItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                      Conceptos Pendientes ({pendingItems.length})
                    </h3>
                    {totalDiscount > 0 && (
                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">
                        <Tag className="h-3 w-3 mr-1" />
                        Descuento: -{formatCurrency(totalDiscount)}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    {pendingItems.map((item) => {
                      const itemDiscount = discounts[item.id] || 0;
                      const finalTotal = getItemTotal(item);

                      return (
                        <div
                          key={item.id}
                          className={`p-3 border rounded-lg transition-all ${selectedItems.has(item.id)
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted/50"
                            }`}
                        >
                          <div
                            className="flex items-center gap-3 cursor-pointer"
                            onClick={() => toggleItem(item.id)}
                          >
                            <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => toggleItem(item.id)}
                            />
                            <div className={`p-2 rounded-lg border ${CONCEPT_COLORS[item.concept_type || "PRODUCT"]}`}>
                              {CONCEPT_ICONS[item.concept_type || "PRODUCT"]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {item.products?.name || CONCEPT_LABELS[item.concept_type || "PRODUCT"]}
                              </p>
                              {item.courtesy_reason && (
                                <div className="flex items-start gap-1.5 mt-1">
                                  <div className="min-w-[4px] h-[4px] mt-1.5 rounded-full bg-muted-foreground/40" />
                                  <p className="text-xs text-muted-foreground/80 leading-snug">
                                    {item.courtesy_reason}
                                  </p>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${CONCEPT_COLORS[item.concept_type || "PRODUCT"]}`}>
                                  {CONCEPT_LABELS[item.concept_type || "PRODUCT"]}
                                </Badge>
                                <span className="text-xs">×{item.qty}</span>
                                <span className="text-xs">•</span>
                                <span className="text-xs">@ {formatCurrency(item.unit_price)}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              {itemDiscount > 0 ? (
                                <>
                                  <p className="text-xs line-through text-muted-foreground">{formatCurrency(item.total)}</p>
                                  <p className="font-bold text-green-600 dark:text-green-400 text-sm">{formatCurrency(finalTotal)}</p>
                                </>
                              ) : (
                                <p className="font-bold text-sm">{formatCurrency(item.total)}</p>
                              )}
                            </div>
                          </div>

                          {/* Controles de descuento */}
                          <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2">
                            {showDiscountInput === item.id ? (
                              <div className="flex items-center gap-2 flex-1">
                                <Input
                                  type="number"
                                  placeholder="Monto descuento"
                                  className="h-8 text-sm w-32"
                                  max={item.total}
                                  min={0}
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      applyDiscount(item.id, parseFloat((e.target as HTMLInputElement).value) || 0);
                                    } else if (e.key === 'Escape') {
                                      setShowDiscountInput(null);
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                    applyDiscount(item.id, parseFloat(input?.value) || 0);
                                  }}
                                >
                                  Aplicar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDiscountInput(null);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                {itemDiscount > 0 ? (
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-green-500/10 text-green-500 border-green-500/30 cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeDiscount(item.id);
                                    }}
                                  >
                                    <Tag className="h-3 w-3 mr-1" />
                                    -{formatCurrency(itemDiscount)}
                                    <X className="h-3 w-3 ml-1" />
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-muted-foreground hover:text-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowDiscountInput(item.id);
                                    }}
                                  >
                                    <Percent className="h-3 w-3 mr-1" />
                                    Descuento
                                  </Button>
                                )}

                                {/* Botón de eliminar para consumos no pagados */}
                                {item.concept_type === 'CONSUMPTION' && (
                                  confirmDeleteId === item.id ? (
                                    <div className="flex items-center gap-1 ml-auto">
                                      <span className="text-xs text-destructive flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        ¿Eliminar?
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-6 text-xs px-2"
                                        disabled={deletingItemId === item.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteConsumption(item.id);
                                        }}
                                      >
                                        {deletingItemId === item.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          "Sí"
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 text-xs px-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteId(null);
                                        }}
                                      >
                                        No
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs text-muted-foreground hover:text-destructive ml-auto"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteId(item.id);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Eliminar
                                    </Button>
                                  )
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lista de conceptos pagados */}
              {paidItems.length > 0 && (
                <div className="space-y-2 opacity-60">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                    Ya Pagados ({paidItems.length})
                  </h3>
                  <div className="space-y-2">
                    {paidItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 border rounded-lg bg-green-500/10 border-green-500/30"
                      >
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <div className={`p-2 rounded-lg ${CONCEPT_COLORS[item.concept_type || "PRODUCT"]}`}>
                          {CONCEPT_ICONS[item.concept_type || "PRODUCT"]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-green-400">
                            {item.products?.name || CONCEPT_LABELS[item.concept_type || "PRODUCT"]}
                          </p>
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                              {item.payment_method || "Pagado"}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-400">{formatCurrency(item.total)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingItems.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p className="font-medium">¡Todo pagado!</p>
                  <p className="text-sm text-muted-foreground">No hay conceptos pendientes</p>
                </div>
              )}
            </div>
          ) : (
            /* Paso de pago */
            <div className="p-6 space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground">Total a pagar</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(selectedTotal)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedItems.size} concepto(s) seleccionado(s)
                </p>

                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <label htmlFor="tip-amount" className="text-sm font-medium">Propina (Opcional)</label>
                    <div className="relative w-32">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                      <Input
                        id="tip-amount"
                        type="number"
                        min="0"
                        step="any"
                        className="pl-7 text-right"
                        value={tipAmount || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          const newTip = isNaN(val) ? 0 : val;
                          setTipAmount(newTip);
                          // Actualizar pagos para reflejar el nuevo total si hay un solo pago por defecto
                          // o si payments coincide con el total anterior.
                          // Pero MultiPaymentInput no reacciona automáticamente a cambios externos de totalAmount preservando distribución custom.
                          // Sin embargo, si reseteamos payments cuando cambia el tip, perdemos entradas del usuario.
                          // Lo ideal es dejar que el usuario ajuste los pagos en el componente MultiPaymentInput.
                          // PERO hemos actualizado createInitialPayment en goToPayment, no aquí.
                          // Al cambiar tipAmount, el totalToPay cambia.
                          // MultiPaymentInput recibe totalAmount={selectedTotal + tipAmount} renderizado abajo.
                          // Si el usuario cambia tipAmount aquí, el MultiPaymentInput mostrará "Faltan $X" o "Sobran $X".
                        }}
                      />
                    </div>
                  </div>
                  {tipAmount > 0 && (
                    <p className="text-right text-xs text-green-500 font-medium mt-1">
                      + {formatCurrency(tipAmount)} propina
                    </p>
                  )}
                </div>
              </div>

              {/* Sugerencias de Valet en el paso de pago */}
              {valetPayments.length > 0 && (
                <div className="space-y-2 mb-6">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cobros sugeridos por cochero:</p>
                  <div className="flex flex-wrap gap-2">
                    {valetPayments.map(p => (
                      <Button
                        key={p.id}
                        variant="outline"
                        size="sm"
                        className="h-auto py-2 px-3 flex flex-col items-start gap-1 border-indigo-500/30 hover:bg-indigo-500/5"
                        onClick={() => useValetPaymentData(p)}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1 h-4 border-indigo-500/50 text-indigo-500">
                            {p.confirmed_at && <CheckCircle2 className="h-2 w-2 mr-1 inline" />}
                            {p.payment_method}
                          </Badge>
                          <span className="font-bold text-sm tracking-tight">{formatCurrency(p.amount)}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {p.confirmed_at ? "Usar cobro corroborado" : "Usar cobro (Pendiente corrob.)"}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <MultiPaymentInput
                totalAmount={selectedTotal + tipAmount}
                payments={payments}
                onPaymentsChange={setPayments}
                disabled={processing}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-between gap-2 flex-shrink-0">
          {step === "select" ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={processing}>
                Cancelar
              </Button>
              <Button
                onClick={goToPayment}
                disabled={selectedItems.size === 0 || processing}
              >
                Continuar al Pago ({formatCurrency(selectedTotal)})
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("select")} disabled={processing}>
                ← Volver
              </Button>
              <Button
                onClick={processPayment}
                disabled={processing || Math.abs(payments.reduce((s: number, p: any) => s + p.amount, 0) - (selectedTotal + tipAmount)) > 0.1}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Procesando...
                  </>
                ) : (
                  "Confirmar Pago"
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
