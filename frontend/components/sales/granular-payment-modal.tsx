"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { MultiPaymentInput, PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupervisorAuthDialog } from "@/components/auth/supervisor-auth-dialog";
import {
  Bed,
  Clock,
  Users,
  ShoppingBag,
  Package,
  MoreHorizontal,
  CheckCircle2,
  Loader2,
  Receipt,
  X,
  Percent,
  Tag,
  Trash2,
  AlertTriangle,
  ArrowRightLeft
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
  ROOM_BASE: <Bed className="h-5 w-5 stroke-[1.5]" />,
  STAY: <Bed className="h-5 w-5 stroke-[1.5]" />,
  EXTRA_HOUR: <Clock className="h-5 w-5 stroke-[1.5]" />,
  EXTRA_PERSON: <Users className="h-5 w-5 stroke-[1.5]" />,
  CONSUMPTION: <ShoppingBag className="h-5 w-5 stroke-[1.5]" />,
  PRODUCT: <Package className="h-5 w-5 stroke-[1.5]" />,
  RENEWAL: <Receipt className="h-5 w-5 stroke-[1.5]" />,
  PROMO_4H: <Clock className="h-5 w-5 stroke-[1.5]" />,
  OTHER: <MoreHorizontal className="h-5 w-5 stroke-[1.5]" />,
  DAMAGE_CHARGE: <AlertTriangle className="h-5 w-5 stroke-[1.5]" />,
  TOLERANCE_EXPIRED: <Clock className="h-5 w-5 stroke-[1.5]" />,
  ROOM_CHANGE_ADJUSTMENT: <ArrowRightLeft className="h-5 w-5 stroke-[1.5]" />,
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
  issue_description?: string;
  delivery_status?: string;
  delivery_notes?: string;
  created_at?: string;
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
  const [valetPayments, setValetPayments] = useState<any[]>([]); // Pagos cobrados por valet (tabla payments)
  const [historicalPayments, setHistoricalPayments] = useState<any[]>([]); // Historial de todos los pagos de la orden
  const [valetReports, setValetReports] = useState<any[]>([]); // Reportes de pago en items (issue_description)
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "pay">("select");
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [showDiscountInput, setShowDiscountInput] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [forcedUnlockedItems, setForcedUnlockedItems] = useState<Set<string>>(new Set());

  // Estado para el dialog de autorización de supervisor
  const [authDialog, setAuthDialog] = useState<{
    isOpen: boolean;
    action: 'unlock' | 'delete';
    itemId: string | null;
    itemLabel: string;
  }>({ isOpen: false, action: 'unlock', itemId: null, itemLabel: '' });

  // Obtener nombre descriptivo del item
  const getItemDescription = (item: OrderItem) => {
    // 1. Si tiene notas de entrega explícitas (Prioridad Máxima - Ej: "Cargo por cambio...")
    if (item.delivery_notes) {
      return item.delivery_notes;
    }

    // 2. Detalles estructurados en issue_description
    if (item.issue_description) {
      try {
        const meta = JSON.parse(item.issue_description);

        // Caso específico: Cambio de Habitación
        if (item.concept_type === 'ROOM_CHANGE_ADJUSTMENT' && meta.oldRoomNumber && meta.newRoomNumber) {
          return `Cambio: Hab ${meta.oldRoomNumber} ➡ ${meta.newRoomNumber}`;
        }

        // Reportes de valet
        if (meta.valetPaymentReport?.itemDescription) {
          return meta.valetPaymentReport.itemDescription;
        }

        // Campos genéricos
        if (meta.description) return meta.description;
        if (meta.note) return meta.note;
        if (meta.details) return meta.details;
        if (meta.reason) return meta.reason;
      } catch (e) {
        if (typeof item.issue_description === 'string' && item.issue_description.length < 50) {
          return item.issue_description;
        }
      }
    }

    // 3. Si es Productos, usar el nombre (Fallback estándar)
    if (item.products?.name) return item.products.name;

    // 4. Mapeo por defecto por tipo
    if (item.concept_type === 'ROOM_CHANGE_ADJUSTMENT') {
      return "Cambio de Habitación";
    }

    // 5. Otros conceptos estándar - Mapeo amigable
    const conceptMap: Record<string, string> = {
      'DAMAGE_CHARGE': 'Cargo por Daños',
      'EXTRA_PERSON': 'Persona Extra',
      'EXTRA_HOUR': 'Hora Extra',
      'ROOM_BASE': 'Estancia',
      'EARLY_CHECKIN': 'Check-in Temprano',
      'LATE_CHECKOUT': 'Check-out Tardío',
      'TOLERANCE_EXPIRED': 'Tolerancia Expirada',
      'SERVICE': 'Servicio General'
    };

    return conceptMap[item.concept_type] || CONCEPT_LABELS[item.concept_type] || item.concept_type;
  };

  // Obtener quién cobró este item (o detalles del pago)
  const getPaymentInfo = (item: OrderItem) => {
    if (!item.is_paid || !item.paid_at) return null;

    // Buscar en historicalPayments
    // Heurística: Buscar pagos confirmados/pagados que coincidan con la fecha de pago del item
    // (Con una tolerancia minúscula, o simplemente el pago más reciente anterior a paid_at)
    // OJO: SalesOrderItem.is_paid se marca al mismo tiempo que se crea el Payment.

    // Si tenemos payments, busquemos el que tenga un 'created_at' o 'collected_at' muy cercano
    // La fecha en sales_order_items.paid_at suele ser la misma que payments.created_at/collected_at

    const itemPaidTime = new Date(item.paid_at).getTime();

    // Encontrar pagos cercanos (tolerance 2 min)
    const linkedPayment = historicalPayments.find(p => {
      const payTime = new Date(p.collected_at || p.created_at || '').getTime();
      return Math.abs(payTime - itemPaidTime) < 120000; // 2 min diff
    });

    if (linkedPayment) {
      // Preferir el empleado que lo cobró (collected_by)
      if (linkedPayment.employees) {
        return {
          name: `${linkedPayment.employees.first_name} ${linkedPayment.employees.last_name}`,
          role: 'Cochero', // Si está en payments y tiene collected_by suele ser cochero o recepcionista iniciador
          method: linkedPayment.payment_method
        };
      }
      // Si no tiene collected_by, ver confirmed_by (recepción)
      if (linkedPayment.confirmed_employee) {
        return {
          name: `${linkedPayment.confirmed_employee.first_name} ${linkedPayment.confirmed_employee.last_name}`,
          role: 'Recepción',
          method: linkedPayment.payment_method
        };
      }
    }

    // SI el item fue entregado por cochero (ROOM_CHANGE)
    if (item.concept_type === 'ROOM_CHANGE_ADJUSTMENT' && (item as any).delivered_by_employee) {
      const emp = (item as any).delivered_by_employee;
      return {
        name: `${emp.first_name} ${emp.last_name}`,
        role: 'Cochero (Entrega)',
        method: item.payment_method || 'Efectivo'
      };
    }

    return { name: 'Recepción', role: 'Caja', method: item.payment_method };
  };

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
          delivery_status,
          delivery_notes,
          delivery_accepted_by,
          issue_description,
          products:product_id(name, sku),
          delivered_by_employee:employees!sales_order_items_delivery_accepted_by_fkey(first_name, last_name)
        `)
        .eq("sales_order_id", salesOrderId);

      if (error) throw error;

      // Mapear los datos para ajustar la estructura de products
      const mappedItems = (data || []).map((item: any) => ({
        ...item,
        products: Array.isArray(item.products) ? item.products[0] : item.products,
      }));

      setItems(mappedItems as OrderItem[]);

      // Extraer reportes de pago de valets desde issue_description
      const reportsMap = new Map<string, any>();

      mappedItems.forEach((item: any) => {
        if (item.delivery_status === 'DELIVERED' && !item.is_paid && item.issue_description) {
          try {
            const meta = JSON.parse(item.issue_description);
            // Si hay un reporte de pago (cobrado por cochero)
            if (meta.valetPaymentReport && meta.valetPaymentReport.payments) {
              const valetName = item.delivered_by_employee
                ? `${item.delivered_by_employee.first_name || ''} ${item.delivered_by_employee.last_name || ''}`.trim()
                : 'Cochero Desconocido';

              // Clave única basada en los pagos reportados y quien reporta
              // Esto agrupa items que fueron pagados en conjunto
              const sig = JSON.stringify(meta.valetPaymentReport.payments) + valetName + meta.valetPaymentReport.reportedBy;

              if (!reportsMap.has(sig)) {
                reportsMap.set(sig, {
                  itemIds: [item.id],
                  amount: 0, // Se sumará abajo
                  payments: meta.valetPaymentReport.payments,
                  reportedBy: meta.valetPaymentReport.reportedBy,
                  itemDescription: [item.products?.name || item.concept_type],
                  valetName: valetName,
                  timestamp: meta.valetPaymentReport.timestamp || new Date().toISOString()
                });
              } else {
                const existing = reportsMap.get(sig);
                existing.itemIds.push(item.id);
                existing.itemDescription.push(item.products?.name || item.concept_type);
              }

              // Sumar el total de este item al reporte (aunque los pagos reportados YA deberían sumar el total de todos los items)
              // OJO: Los pagos reportados son el total GLOBAL cobrado. No debemos sumarlos.
              // El amount que mostramos debe ser la suma de los items involucrados? 
              // NO, el amount debe ser lo que el cochero reporta haber cobrado (la suma de payments).
              // Pero por consistencia visual, mostramos la suma de los items seleccionados o la suma de pagos reportados?
              // Mostremos la suma de pagos reportados, que es lo que el cochero cobró.
              const existing = reportsMap.get(sig);
              existing.amount = existing.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
            }
          } catch (e) {
            console.error("Error parsing issue_description:", e);
          }
        }
      });
      setValetReports(Array.from(reportsMap.values()));

      // 2. Cargar pagos COBRADO_POR_VALET para este sales_order
      const { data: valetPays, error: valetError } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          payment_method,
          terminal_code,
          card_last_4,
          card_type,
          reference,
          concept,
          collected_at,
          collected_by,
          confirmed_at,
          confirmed_by,
          status,
          employees:collected_by(first_name, last_name),
          confirmed_employee:confirmed_by(first_name, last_name)
        `)
        .eq("sales_order_id", salesOrderId);
      // NOTA: Traemos TODOS los pagos de la orden para poder vincular "quien cobró" a los items pagados

      if (valetError) {
        console.error("Error loading payments:", valetError);
      } else {
        // Separar entre pagos activos del valet (pendientes) y pagos históricos/confirmados
        const activeValetPayments = (valetPays || []).filter((p: any) =>
          p.status === 'COBRADO_POR_VALET' && !p.confirmed_at
        );
        setValetPayments(activeValetPayments);
        setHistoricalPayments(valetPays || []);
      }

    } catch (error) {
      console.error("Error fetching items:", error);
      toast.error("Error al cargar los conceptos");
    } finally {
      setLoading(false);
    }
  };

  // Corroborar la recepción física del dinero/voucher (solo auditoría de pago)
  const corroborateValetPayment = async (paymentIds: string[]) => {
    setConfirmingPaymentId(paymentIds[0]); // Usar el primero como ID de carga
    const supabase = createClient();
    try {
      const employeeId = await getCurrentEmployeeId(supabase);
      const shiftId = await getCurrentShiftId(supabase);

      const { data: updatedPayments, error } = await supabase
        .from("payments")
        .update({
          confirmed_by: employeeId,
          confirmed_at: new Date().toISOString(),
          shift_session_id: shiftId // Transfer financial responsibility to current shift
        })
        .in("id", paymentIds)
        .select();

      if (error) throw error;

      toast.success("Recibo corroborado", {
        description: "Los datos de pago se han aplicado automáticamente."
      });

      if (updatedPayments && updatedPayments.length > 0) {
        // Optimistic update: Quitar de la lista de pendientes INMEDIATAMENTE para desbloquear la UI
        setValetPayments(prev => prev.filter(p => !paymentIds.includes(p.id)));

        applyValetPaymentData(updatedPayments);
      }

      fetchItems();
    } catch (error) {
      console.error("Error corroborating payment:", error);
      toast.error("Error al corroborar el recibo");
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  // Pre-rellenar datos de pago desde registros de valet (puede ser uno o varios)
  const applyValetPaymentData = (paymentInput: any | any[]) => {
    const valetPaymentsList = Array.isArray(paymentInput) ? paymentInput : [paymentInput];

    const newPayments = valetPaymentsList.map((payment: any) => ({
      id: payment.id || `vp-${Date.now()}-${Math.random()}`,
      amount: payment.amount,
      method: payment.payment_method as any || "EFECTIVO",
      reference: payment.reference || "",
      terminal: payment.terminal_code || undefined,
      cardLast4: payment.card_last_4 || undefined,
      cardType: payment.card_type || undefined
    }));

    setPayments(newPayments);
    toast.success("Datos del cochero aplicados al formulario de pago");
    setStep("select"); // Mantener en select para que elija conceptods si quiere
  };

  // Aplicar datos de reporte del valet (desde issue_description)
  const applyValetReportData = (report: any) => {
    // 1. Seleccionar AUTOMÁTICAMENTE items relacionados (ahora puede ser múltiple)
    const newSelected = new Set(selectedItems);

    // Si viene como array (nueva lógica)
    if (Array.isArray(report.itemIds)) {
      report.itemIds.forEach((id: string) => newSelected.add(id));
    } else if (report.itemId) {
      // Fallback lógica antigua
      newSelected.add(report.itemId);
    }

    setSelectedItems(newSelected);

    // Determinar si el item es una devolución (usamos el primero como referencia)
    const firstItemId = Array.isArray(report.itemIds) ? report.itemIds[0] : report.itemId;
    const item = items.find(i => i.id === firstItemId);
    const isRefund = item ? isRefundItem(item) : false;

    // 2. Pre-llenar pagos con lo que reportó el cochero
    // Si es devolución, el monto a pagar debe ser negativo para que cuadre con el total
    const mappedPayments = report.payments.map((p: any, index: number) => ({
      id: `p${index + 1}-${Date.now()}`,
      amount: isRefund ? -Math.abs(p.amount) : Math.abs(p.amount),
      method: p.method,
      reference: p.reference || "",
      terminal: p.terminal,
      cardLast4: p.cardLast4,
      cardType: p.cardType
    }));

    setPayments(mappedPayments);

    // 3. Ir directo a pagar (opcional, o quedarse en select)
    setStep("pay");
    toast.success("Datos del cochero aplicados y concepto seleccionado");
  };


  useEffect(() => {
    if (isOpen && salesOrderId) {
      fetchItems();
      setSelectedItems(new Set());
      setDiscounts({});
      setShowDiscountInput(null);
      setConfirmDeleteId(null);
      setTipAmount(0);
      setForcedUnlockedItems(new Set());
      setStep("select");
    }
  }, [isOpen, salesOrderId]);

  if (!isOpen) return null;

  // Calcular totales con descuentos
  const pendingItems = items.filter(item => !item.is_paid);
  const paidItems = items.filter(item => item.is_paid);

  // Detectar si es un item de devolución
  const isRefundItem = (item: OrderItem) => {
    if (item.concept_type !== 'ROOM_CHANGE_ADJUSTMENT' || !item.issue_description) return false;
    try {
      const meta = JSON.parse(item.issue_description);
      return !!meta.isRefund;
    } catch {
      return false;
    }
  };

  const getItemTotal = (item: OrderItem) => {
    const discount = discounts[item.id] || 0;
    const baseTotal = isRefundItem(item) ? -item.total : item.total;
    // Si es negativo (devolución), no aplicamos descuentos estándar de esta forma, o sí? 
    // Asumamos que devoluciones no tienen descuento manual en el modal por ahora.
    return baseTotal;
  };

  // Helper para determinar si un item se puede pagar (Workflow Estricto)
  const isItemPayable = (item: OrderItem) => {
    // Si recepción forzó el desbloqueo, siempre es pagable
    if (forcedUnlockedItems.has(item.id)) return true;

    // Excepción: Conceptos de servicio que no requieren entrega
    const serviceConcepts = ['ROOM_BASE', 'EXTRA_HOUR', 'EXTRA_PERSON', 'EARLY_CHECKIN', 'LATE_CHECKOUT', 'DAMAGE_CHARGE', 'TOLERANCE_EXPIRED'];
    if (serviceConcepts.includes(item.concept_type)) {
      return true;
    }

    // Si tiene estado de entrega, debe estar COMPLETADO (Workflow estricto)
    // Anteriormente permitíamos DELIVERED, pero el usuario solicitó bloquear hasta completar tracking.
    if (item.delivery_status && item.delivery_status !== 'COMPLETED') {
      return false;
    }
    return true;
  };

  // Forzar desbloqueo de un item atascado (para recepción)
  const forceUnlockItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const supabase = createClient();
    try {
      // Actualizar delivery_status a DELIVERED en la base de datos
      await supabase
        .from('sales_order_items')
        .update({ delivery_status: 'DELIVERED' })
        .eq('id', itemId);

      // Actualizar el estado local inmediatamente
      setForcedUnlockedItems(prev => new Set(prev).add(itemId));

      toast.success("Concepto desbloqueado", {
        description: `${item.products?.name || CONCEPT_LABELS[item.concept_type] || 'Concepto'} ahora puede ser cobrado o eliminado.`
      });

      // Refrescar items
      await fetchItems();
    } catch (error) {
      console.error('Error force-unlocking item:', error);
      toast.error("Error al desbloquear", {
        description: "No se pudo desbloquear el concepto. Intenta de nuevo."
      });
    }
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
    setDiscounts((prev) => {
      const newDiscounts = { ...prev };
      delete newDiscounts[itemId];
      return newDiscounts;
    });
  };

  // Toggle selección de item
  const toggleItem = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    if (!isItemPayable(item)) {
      toast.error("Concepto no disponible para pago", {
        description: "El servicio o entrega debe completarse primero."
      });
      return;
    }

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
    // Solo seleccionar los que son pagables
    const allPendingIds = pendingItems
      .filter(item => isItemPayable(item))
      .map(item => item.id);

    if (allPendingIds.length < pendingItems.length) {
      toast.info("Algunos items no se seleccionaron", {
        description: "Hay conceptos con entrega o servicio pendiente."
      });
    }

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

    // Solo reiniciar si no hay datos de pago pre-llenados (ej. desde corroboración de valet)
    const hasPreFilledData = payments.length > 0 && payments.some(p => p.amount > 0 || p.method !== 'EFECTIVO');

    if (!hasPreFilledData) {
      setPayments(createInitialPayment(selectedTotal + tipAmount));
    }

    setStep("pay");
  };

  // Eliminar concepto no pagado (consumo, producto, o cualquier concepto atascado)
  const deleteUnpaidItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item || item.is_paid) {
      toast.error("Este concepto no puede eliminarse");
      return;
    }

    setDeletingItemId(itemId);
    const supabase = createClient();

    try {
      // 1. Si tiene producto asociado, revertir inventario
      if (item.product_id) {
        const { data: orderData } = await supabase
          .from('sales_orders')
          .select('warehouse_id')
          .eq('id', salesOrderId)
          .single();

        if (orderData?.warehouse_id) {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('inventory_movements').insert({
            product_id: item.product_id,
            warehouse_id: orderData.warehouse_id,
            quantity: item.qty,
            movement_type: 'IN',
            reason_id: 7, // RETURN/DEVOLUCION
            reason: 'RETURN',
            notes: `Concepto eliminado por recepción - Habitación ${roomNumber || 'N/A'} - Tipo: ${item.concept_type}`,
            reference_table: 'sales_order_items',
            reference_id: itemId,
            created_by: user?.id || null,
          });
        }
      }

      // 2. También limpiar pagos pendientes asociados a este concepto
      const conceptMapping: Record<string, string> = {
        'EXTRA_PERSON': 'PERSONA_EXTRA',
        'EXTRA_HOUR': 'HORA_EXTRA',
        'ROOM_BASE': 'ESTANCIA',
        'TOLERANCE_EXPIRED': 'TOLERANCIA_EXPIRADA',
        'DAMAGE_CHARGE': 'DAMAGE_CHARGE',
      };
      const paymentConcept = conceptMapping[item.concept_type] || item.concept_type;

      // Eliminar pagos PENDIENTES o COBRADO_POR_VALET asociados (para no dejar pagos huérfanos)
      await supabase
        .from('payments')
        .delete()
        .eq('sales_order_id', salesOrderId)
        .eq('concept', paymentConcept)
        .in('status', ['PENDIENTE', 'COBRADO_POR_VALET'])
        .is('confirmed_at', null);

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

      const conceptLabel = item.products?.name || CONCEPT_LABELS[item.concept_type] || 'Concepto';
      toast.success("Concepto eliminado", {
        description: `${conceptLabel} ha sido removido de la cuenta.${item.product_id ? ' El inventario fue restaurado.' : ''}`
      });

      // 5. Refrescar lista de items
      await fetchItems();
      setConfirmDeleteId(null);

    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error("Error al eliminar concepto", {
        description: "No se pudo eliminar el concepto. Intenta de nuevo."
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
    <>
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

                {/* Reportes de Cochero (Items entregados via app de cocheros) */}
                {valetReports.length > 0 && (
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                      <AlertTriangle className="h-5 w-5" />
                      <p className="text-sm font-medium">Información de cobros informados por Cochero pendientes de corroborar</p>
                    </div>

                    <div className="space-y-2">
                      {valetReports.map((report, idx) => {
                        const desc = Array.isArray(report.itemDescription)
                          ? report.itemDescription.length > 3
                            ? `${report.itemDescription.slice(0, 3).join(", ")} +${report.itemDescription.length - 3}`
                            : report.itemDescription.join(", ")
                          : report.itemDescription;

                        const reportDate = report.timestamp ? new Date(report.timestamp) : new Date();

                        return (
                          <div
                            key={`report-${idx}`}
                            className="flex items-center justify-between p-4 border rounded-lg bg-[#0f111a] border-indigo-500/20"
                          >
                            <div className="flex items-center gap-3">
                              {/* Mostrar pagos reportados */}
                              <div className="flex flex-col gap-1 items-start">
                                <div className="flex flex-wrap gap-1">
                                  {report.payments && report.payments.map((p: any, i: number) => (
                                    <Badge key={i} variant="outline" className="border-indigo-500 text-indigo-400 bg-indigo-500/10 px-2 h-5 text-[10px]">
                                      {p.method} ${formatCurrency(p.amount)}
                                    </Badge>
                                  ))}
                                </div>
                                <span className="font-bold text-lg text-white">
                                  {formatCurrency(report.amount)} <span className="text-xs text-muted-foreground font-normal">total reportado</span>
                                </span>
                              </div>

                              <div className="border-l border-zinc-700 h-8 mx-2"></div>

                              <div className="flex flex-col">
                                <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 text-[10px] uppercase font-bold tracking-tighter self-start mb-1 max-w-[200px] truncate">
                                  {desc}
                                </Badge>

                                <span className="text-xs text-zinc-400">
                                  Cobrado por <span className="text-indigo-400 font-medium">{report.valetName}</span>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {/* Hora simulada o real si la tenemos en metadata */}
                              <span className="text-xs text-zinc-500 italic">
                                {reportDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }).toLowerCase()}
                              </span>

                              <Button
                                size="sm"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
                                onClick={() => applyValetReportData(report)}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Corroborar Recibo
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Pagos de Cochero Pendientes de Corroboración */}
                {valetPayments.filter(p => !p.confirmed_at).length > 0 && (
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                      <AlertTriangle className="h-5 w-5" />
                      <p className="text-sm font-medium">Información de cobros informados por Cochero pendientes de corroborar</p>
                    </div>

                    <div className="space-y-2">
                      {(() => {
                        const visiblePayments = valetPayments.filter(p => !p.confirmed_at);
                        // DEDUPLICAR para evitar keys repetidas (React crash)
                        const seenIds = new Set();
                        const uniqueVisible = visiblePayments.filter(p => {
                          const duplicate = seenIds.has(p.id);
                          seenIds.add(p.id);
                          return !duplicate;
                        });

                        const groupsMap = new Map<string, any>();

                        uniqueVisible.forEach(p => {
                          // Agrupar por EMPLEADO + TIEMPO (tolerancia 1 min)
                          const timeKey = Math.floor(new Date(p.collected_at).getTime() / 60000);
                          const empKey = p.collected_by || 'unknown';
                          const key = `${empKey}-${timeKey}`;

                          if (!groupsMap.has(key)) {
                            groupsMap.set(key, {
                              payments: [],
                              totalAmount: 0,
                              employeeName: p.employees ? `${p.employees.first_name} ${p.employees.last_name}` : 'Desconocido',
                              collectedAt: p.collected_at
                            });
                          }
                          const group = groupsMap.get(key);
                          group.payments.push(p);
                          group.totalAmount += p.amount;
                        });

                        const paymentGroups = Array.from(groupsMap.values());

                        return paymentGroups.map((group, groupIdx) => (
                          <div
                            key={`group-${groupIdx}`}
                            className="flex items-center justify-between p-4 border rounded-lg bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/20"
                          >
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap gap-2 items-center">
                                {group.payments.map((payment: any) => (
                                  <Badge key={`pay-${payment.id}`} variant="outline" className="border-indigo-500 text-indigo-500 px-2 h-5 text-[10px]">
                                    {payment.payment_method} ${formatCurrency(payment.amount)}
                                  </Badge>
                                ))}
                                <span className="font-bold text-lg ml-2">
                                  {formatCurrency(group.totalAmount)}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-1">
                                {group.payments.map((payment: any) => (
                                  <Badge key={`concept-${payment.id}`} variant="secondary" className="text-[10px] uppercase font-bold tracking-tighter self-start">
                                    {payment.concept === 'CONSUMPTION' ? 'CONSUMO' :
                                      payment.concept === 'ESTANCIA' ? 'ESTANCIA' :
                                        payment.concept === 'HORA_EXTRA' ? 'HORA EXTRA' :
                                          payment.concept === 'PERSONA_EXTRA' ? 'PERS. EXTRA' :
                                            payment.concept === 'DAMAGE_CHARGE' ? 'DAÑO' :
                                              payment.concept || 'PAGO'}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div className="flex-1 ml-4 border-l border-indigo-500/20 pl-4">
                              <p className="text-sm text-muted-foreground">
                                Cobrado por <span className="font-medium text-foreground">{group.employeeName}</span>
                              </p>
                              <div className="flex flex-col gap-1 mt-1">
                                {group.payments.map((payment: any) => payment.payment_method === 'TARJETA' && (
                                  <div key={`card-${payment.id}`} className="flex items-center gap-2">
                                    {payment.terminal_code && (
                                      <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">
                                        Ter: {payment.terminal_code}
                                      </Badge>
                                    )}
                                    {payment.card_last_4 && (
                                      <Badge variant="secondary" className="text-[10px] bg-zinc-500/10 text-zinc-500 border-zinc-500/20">
                                        **** {payment.card_last_4}
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 ml-4">
                              <span className="text-xs text-muted-foreground italic">
                                {new Date(group.collectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <Button
                              size="sm"
                              className="bg-indigo-600 hover:bg-indigo-700 text-white ml-4"
                              onClick={() => corroborateValetPayment(group.payments.map((p: any) => p.id))}
                              disabled={confirmingPaymentId !== null}
                            >
                              {confirmingPaymentId === group.payments[0].id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Corroborar ({group.payments.length})
                                </>
                              )}
                            </Button>
                          </div>
                        ));
                      })()}
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

                        // Verificar si hay pagos de cochero sin confirmar
                        const hasUnconfirmedValetPayments = valetPayments.some(p => !p.confirmed_at);

                        // WORKFLOW ESTRICTO: Bloquear selección si:
                        // 1. No está entregado (isPayable)
                        // 2. Hay pagos de cochero pendientes de corroborar
                        const isPayable = isItemPayable(item);
                        const isLocked = !isPayable || hasUnconfirmedValetPayments;

                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "group relative flex flex-col gap-2 p-3 rounded-xl border transition-all duration-200",
                              selectedItems.has(item.id)
                                ? "bg-primary/5 border-primary/30 shadow-sm"
                                : isLocked
                                  ? "bg-muted/10 border-border/30 opacity-70 cursor-not-allowed" // Más opaco si está bloqueado por cochero
                                  : "bg-card border-border/50 hover:bg-muted/30 hover:border-primary/20"
                            )}
                          >
                            {/* Overlay de bloqueo explícito si hay pagos pendientes */}
                            {hasUnconfirmedValetPayments && (
                              <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-[1px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded shadow-sm border border-red-500/20">
                                  Corrobora el cobro del cochero primero
                                </span>
                              </div>
                            )}

                            <div
                              className={cn(
                                "flex items-start gap-3 select-none",
                                isLocked ? "cursor-not-allowed" : "cursor-pointer"
                              )}
                              onClick={() => {
                                // 1. Bloqueo por cochero
                                if (hasUnconfirmedValetPayments) {
                                  toast.error("Acción Requerida", {
                                    description: "Debes corroborar los cobros del cochero antes de procesar otros pagos."
                                  });
                                  return;
                                }

                                // 2. Bloqueo normal (servicio no listo)
                                if (isLocked) {
                                  toast.error("Servicio Pendiente", {
                                    description: "El servicio o entrega debe completarse primero antes de cobrar."
                                  });
                                  return;
                                }

                                toggleItem(item.id);
                              }}
                            >
                              <Checkbox
                                checked={selectedItems.has(item.id)}
                                onCheckedChange={() => toggleItem(item.id)}
                                disabled={isLocked}
                                className="mt-1 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />

                              <div className={cn(
                                "flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-muted-foreground transition-colors",
                                selectedItems.has(item.id) && "bg-primary/10 text-primary"
                              )}>
                                {CONCEPT_ICONS[item.concept_type || "PRODUCT"]}
                              </div>

                              <div className="flex-1 min-w-0 pt-0.5">
                                <div className="flex justify-between items-start gap-2">
                                  <p className={cn(
                                    "font-semibold text-sm leading-tight",
                                    selectedItems.has(item.id) ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                                  )}>
                                    {item.products?.name || CONCEPT_LABELS[item.concept_type || "PRODUCT"]}
                                  </p>
                                  <div className="text-right leading-tight">
                                    {itemDiscount > 0 ? (
                                      <>
                                        <p className="text-[10px] line-through text-muted-foreground">{formatCurrency(item.total)}</p>
                                        <p className="font-bold text-green-600 dark:text-green-400 text-sm">{formatCurrency(finalTotal)}</p>
                                      </>
                                    ) : (
                                      <p className={cn(
                                        "font-bold text-sm",
                                        isRefundItem(item) ? "text-red-500" : "text-foreground"
                                      )}>
                                        {formatCurrency(finalTotal)}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {item.courtesy_reason && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                    {item.courtesy_reason}
                                  </p>
                                )}

                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-muted/50 border-border/50 text-muted-foreground group-hover:border-primary/20">
                                    {CONCEPT_LABELS[item.concept_type || "PRODUCT"]}
                                  </Badge>

                                  {isLocked && (
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium border-orange-500/30 text-orange-500 bg-orange-500/5 animate-pulse">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Pendiente
                                    </Badge>
                                  )}

                                  <span className="text-[10px] text-muted-foreground font-medium">
                                    {item.qty} un. × {formatCurrency(item.unit_price)}
                                  </span>
                                </div>
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

                                  {/* Botón de forzar desbloqueo para items atascados */}
                                  {isLocked && !hasUnconfirmedValetPayments && !isItemPayable(item) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAuthDialog({
                                          isOpen: true,
                                          action: 'unlock',
                                          itemId: item.id,
                                          itemLabel: item.products?.name || CONCEPT_LABELS[item.concept_type] || 'Concepto',
                                        });
                                      }}
                                    >
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Desbloquear
                                    </Button>
                                  )}

                                  {/* Botón de eliminar para cualquier concepto no pagado */}
                                  {confirmDeleteId === item.id ? (
                                    <div className="flex items-center gap-1 ml-auto">
                                      <span className="text-xs text-destructive flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        ¿Eliminar{item.product_id ? ' (se restaurará inventario)' : ''}?
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-6 text-xs px-2"
                                        disabled={deletingItemId === item.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteId(null);
                                          setAuthDialog({
                                            isOpen: true,
                                            action: 'delete',
                                            itemId: item.id,
                                            itemLabel: item.products?.name || CONCEPT_LABELS[item.concept_type] || 'Concepto',
                                          });
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
                      {paidItems.map((item) => {
                        const paymentInfo = getPaymentInfo(item);
                        return (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 p-3 bg-muted/20 border border-green-900/20 rounded-lg group hover:bg-muted/30 transition-colors"
                          >
                            <div className="mt-1 h-5 w-5 rounded-full bg-green-900/20 text-green-500 flex items-center justify-center border border-green-900/30">
                              <CheckCircle2 className="h-3 w-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-green-600 dark:text-green-400">
                                {getItemDescription(item)}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20 px-1.5 py-0 h-5">
                                  {item.payment_method || "EFECTIVO"}
                                </Badge>

                                {/* Información de quien cobró */}
                                {paymentInfo && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted p-0.5 px-2 rounded-full border border-border">
                                    <span className={paymentInfo.role.includes('Cochero') ? 'text-indigo-400 font-medium' : ''}>
                                      {paymentInfo.role}:
                                    </span>
                                    <span className="text-foreground/80">{paymentInfo.name}</span>
                                  </div>
                                )}

                                {/* Detalles extra */}
                                {/* (Removido badge redundante de "Ajuste de tarifa" ya que la descripción lo dice explícitamente) */}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                "font-medium",
                                isRefundItem(item) ? "text-red-500" : "text-green-500"
                              )}>
                                {formatCurrency(getItemTotal(item))}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(item.paid_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
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
                <div className="flex items-end justify-between p-4 rounded-lg border bg-card shadow-sm">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total a cobrar</p>
                    <p className="text-3xl font-bold text-primary tracking-tight">{formatCurrency(selectedTotal)}</p>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">
                      {selectedItems.size} concepto{selectedItems.size !== 1 && 's'} seleccionado{selectedItems.size !== 1 && 's'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Label htmlFor="tip-amount" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Propina (Opcional)
                    </Label>
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                      <Input
                        id="tip-amount"
                        type="number"
                        min="0"
                        step="any"
                        className="pl-7 text-right h-9 font-semibold bg-background border-input focus-visible:ring-primary/20"
                        placeholder="0.00"
                        value={tipAmount || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          const newTip = isNaN(val) ? 0 : val;
                          setTipAmount(newTip);
                        }}
                      />
                    </div>
                    {tipAmount > 0 && (
                      <div className="text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                        Total c/ propina: {formatCurrency(selectedTotal + tipAmount)}
                      </div>
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
                          onClick={() => applyValetPaymentData([p])}
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

      {/* Dialog de autorización por supervisor */}
      <SupervisorAuthDialog
        isOpen={authDialog.isOpen}
        onClose={() => setAuthDialog(prev => ({ ...prev, isOpen: false }))}
        onAuthorized={(supervisorName) => {
          if (!authDialog.itemId) return;

          if (authDialog.action === 'unlock') {
            toast.info(`Desbloqueo autorizado por ${supervisorName}`);
            forceUnlockItem(authDialog.itemId);
          } else if (authDialog.action === 'delete') {
            toast.info(`Eliminación autorizada por ${supervisorName}`);
            deleteUnpaidItem(authDialog.itemId);
          }
        }}
        title={authDialog.action === 'unlock' ? 'Desbloquear Concepto' : 'Eliminar Concepto'}
        description={
          authDialog.action === 'unlock'
            ? `Se desbloqueará "${authDialog.itemLabel}" para poder cobrarlo o eliminarlo. Ingresa el PIN de un supervisor para continuar.`
            : `Se eliminará "${authDialog.itemLabel}" de la cuenta permanentemente. Ingresa el PIN de un supervisor para continuar.`
        }
        actionLabel={authDialog.action === 'unlock' ? 'Desbloquear' : 'Eliminar'}
        variant={authDialog.action === 'delete' ? 'danger' : 'warning'}
      />
    </>
  );
}
