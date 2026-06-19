// ─── Ticket Data Builders ────────────────────────────────────────────
// Funciones puras que construyen los datos para tickets de impresión.
// Centraliza la lógica de breakdowns de cierre y formateo de items.

import { getTicketItemName } from "@/components/sales/payment/utils";

// ─── Types ───────────────────────────────────────────────────────────

/** Estructura de un accrual item como viene de Supabase joins */
export interface AccrualItem {
  id: string;
  concept_type: string;
  unit_price?: number;
  qty?: number;
  is_cancelled?: boolean;
  is_courtesy?: boolean;
  courtesy_reason?: string;
  products?: { name: string } | { name: string }[];
  sales_orders?: any; // Nested join structure varies
}

export interface BreakdownEntry {
  count: number;
  total: number;
}

export interface ClosingBreakdowns {
  roomBreakdown: Record<string, BreakdownEntry>;
  extraBreakdown: Record<string, BreakdownEntry>;
  consumptionBreakdown: Record<string, BreakdownEntry>;
  damageBreakdown: Record<string, BreakdownEntry>;
}

// ─── Concept Labels ──────────────────────────────────────────────────

/** Labels cortos para conceptos en contexto de cierres de turno */
export const CONCEPT_LABELS: Record<string, string> = {
  ROOM_BASE: "Habitación", EXTRA_HOUR: "Hora Extra", EXTRA_PERSON: "Persona Extra",
  CONSUMPTION: "Consumo", PRODUCT: "Producto", RENEWAL: "Renovación", PROMO_4H: "Promo 4H",
  ROOM_CHANGE_ADJUSTMENT: "Cambio de Habitación", DAMAGE_CHARGE: "Cargo por Daños",
  LATE_CHECKOUT: "Salida Tarde", RESTAURANT: "Restaurante",
};

/** Labels para conceptos de pago (payment.concept) */
export const CONCEPT_DISPLAY: Record<string, string> = {
  ESTANCIA: "Estancia", CONSUMPTION: "Consumo", EXTRA_PERSON: "Pers. Extra",
  EXTRA_HOUR: "Hora Extra", RENEWAL: "Renovación", CHECKOUT: "Salida",
  ROOM_BASE: "Habitación", PROMO_4H: "Promo 4H",
  ROOM_CHANGE_ADJUSTMENT: "Cambio de Hab.",
};

/** Labels detallados para reportes HP impresos en carta */
export const CONCEPT_LABELS_DETAILED: Record<string, string> = {
  ROOM_BASE: "Renta de Habitación", EXTRA_HOUR: "Hora Extra", EXTRA_PERSON: "Persona Extra",
  CONSUMPTION: "Consumo", PRODUCT: "Producto", RENEWAL: "Renovación", PROMO_4H: "Promo 4H",
  DAMAGE_CHARGE: "Cobro por Daños", LATE_CHECKOUT: "Salida Tarde",
  ROOM_CHANGE_ADJUSTMENT: "Ajuste Cambio de Habitación",
};

/** Labels verbosos para UI de operaciones en vivo */
export const CONCEPT_LABELS_VERBOSE: Record<string, string> = {
  PROMO_4H: "Promoción de 4 Horas", EXTRA_PERSON: "Persona Extra",
  EXTRA_HOUR: "Hora Extra", DAMAGE: "Cargo por Daño", DAMAGE_CHARGE: "Cargo por Daño",
  LATE_CHECKOUT: "Salida Tardía", RENEWAL: "Renovación",
  PRODUCT: "Producto / Servicio", ROOM: "Habitación", ROOM_BASE: "Renta de Habitación",
  CONSUMPTION: "Consumo", RESTAURANT: "Restaurante",
};

// ─── Helpers para extraer room data de joins ─────────────────────────

function extractRoomData(item: AccrualItem): { roomNumber?: string; roomTypeName?: string } {
  const order = Array.isArray(item.sales_orders) ? item.sales_orders[0] : item.sales_orders;
  const roomStay = order?.room_stays;
  const stay = Array.isArray(roomStay) ? roomStay[0] : roomStay;
  const room = stay?.rooms;
  const resolvedRoom = Array.isArray(room) ? room[0] : room;
  const roomType = resolvedRoom?.room_types;
  const resolvedType = Array.isArray(roomType) ? roomType[0] : roomType;

  return {
    roomNumber: resolvedRoom?.number,
    roomTypeName: resolvedType?.name,
  };
}

// ─── Build Closing Breakdowns ────────────────────────────────────────

/**
 * Construye los breakdowns agrupados para tickets de cierre de turno.
 * Agrupa items por: tipo de habitación, extras con # hab, consumos, y daños.
 *
 * Reemplaza la lógica duplicada en:
 * - use-shift-closing.ts (buildTicketBreakdowns)
 * - use-reprint-center.ts (closing case)
 * - use-shift-closing-history.ts (exportClosing)
 * - reprint/page.tsx (loadClosingPreview)
 */
export function buildClosingBreakdowns(accrualItems: AccrualItem[]): ClosingBreakdowns {
  const roomBreakdown: Record<string, BreakdownEntry> = {};
  const extraBreakdown: Record<string, BreakdownEntry> = {};
  const consumptionBreakdown: Record<string, BreakdownEntry> = {};
  const damageBreakdown: Record<string, BreakdownEntry> = {};

  // Filter out cancelled items and items from cancelled stays
  const activeItems = (accrualItems || []).filter((item) => {
    if (item.is_cancelled) return false;
    const order = Array.isArray(item.sales_orders) ? item.sales_orders[0] : item.sales_orders;
    const roomStay = order?.room_stays;
    const stay = Array.isArray(roomStay) ? roomStay[0] : roomStay;
    return !stay || stay.status !== 'CANCELADA';
  });

  activeItems.forEach((item) => {
    const qty = item.qty || 1;
    const amount = (item.unit_price || 0) * qty;
    const conceptType = item.concept_type || "PRODUCT";

    if (conceptType === "ROOM_BASE") {
      const { roomTypeName } = extractRoomData(item);
      const typeName = roomTypeName || "Sin tipo";
      if (!roomBreakdown[typeName]) roomBreakdown[typeName] = { count: 0, total: 0 };
      roomBreakdown[typeName].count += qty;
      roomBreakdown[typeName].total += amount;

    } else if (["EXTRA_PERSON", "EXTRA_HOUR", "RENEWAL", "PROMO_4H", "ROOM_CHANGE_ADJUSTMENT"].includes(conceptType)) {
      const label = CONCEPT_LABELS[conceptType] || conceptType;
      const { roomNumber } = extractRoomData(item);
      const extraLabel = roomNumber ? `${label} · Hab ${roomNumber}` : label;
      if (!extraBreakdown[extraLabel]) extraBreakdown[extraLabel] = { count: 0, total: 0 };
      extraBreakdown[extraLabel].count += qty;
      extraBreakdown[extraLabel].total += amount;

    } else if (["CONSUMPTION", "PRODUCT", "RESTAURANT"].includes(conceptType)) {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      const productName = product?.name || "Producto";
      let displayName = productName;
      if (item.is_courtesy) {
        displayName = `${productName} (${item.courtesy_reason || "Cortesía"})`;
      }
      if (!consumptionBreakdown[displayName]) consumptionBreakdown[displayName] = { count: 0, total: 0 };
      consumptionBreakdown[displayName].count += qty;
      consumptionBreakdown[displayName].total += amount;

    } else if (conceptType === "DAMAGE_CHARGE") {
      const description = item.courtesy_reason || "Cargo por Daño";
      if (!damageBreakdown[description]) damageBreakdown[description] = { count: 0, total: 0 };
      damageBreakdown[description].count += qty;
      damageBreakdown[description].total += amount;
    }
  });

  return { roomBreakdown, extraBreakdown, consumptionBreakdown, damageBreakdown };
}

// ─── Build Closing Transactions ──────────────────────────────────────

export interface ClosingTransaction {
  time: string;
  amount: number;
  paymentMethod: string;
  terminalCode?: string;
  reference?: string;
  concept?: string;
  roomNumber?: string;
}

/**
 * Construye la lista de transacciones para el ticket de cierre.
 * Transforma los shift_closing_details con sus pagos asociados.
 *
 * Reemplaza la lógica duplicada en:
 * - use-shift-closing.ts (handlePrintClosing)
 * - use-reprint-center.ts (closing case)
 * - reprint/page.tsx (loadClosingPreview)
 */
export function buildClosingTransactions(details: any[]): ClosingTransaction[] {
  return (details || []).map((detail: any) => {
    const payment = detail.payments;
    if (!payment) return null;

    // Extract room number from payment -> sales_orders -> room_stays -> rooms
    const order = Array.isArray(payment.sales_orders) ? payment.sales_orders[0] : payment.sales_orders;
    const roomStay = order?.room_stays?.[0] || (Array.isArray(order?.room_stays) ? order.room_stays[0] : order?.room_stays);
    const room = roomStay?.rooms;
    const roomNumber = Array.isArray(room) ? room[0]?.number : room?.number;

    const rawConcept = payment.concept || "";
    const conceptLabel = CONCEPT_DISPLAY[rawConcept] || rawConcept || undefined;

    return {
      time: new Date(payment.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      amount: payment.amount,
      paymentMethod: detail.payment_method || payment.payment_method || "N/A",
      terminalCode: detail.terminal_code || payment.payment_terminals?.code || payment.terminal_code,
      reference: payment.reference || undefined,
      concept: conceptLabel,
      roomNumber: roomNumber || undefined,
    };
  }).filter(Boolean) as ClosingTransaction[];
}

// ─── Build Checkout Ticket Items ─────────────────────────────────────

export interface TicketItem {
  name: string;
  qty: number;
  price: number;
  total: number;
}

/**
 * Construye items para el ticket de checkout a partir de pendingItems resumidos.
 */
export function buildCheckoutTicketItems(
  pendingItems: Array<{ concept_type: string; count: number; total: number }>,
  roomTypeName?: string | null,
  roomNumber?: string | null,
): TicketItem[] {
  return pendingItems.map((item) => ({
    name: getTicketItemName(item.concept_type, roomTypeName, null, roomNumber),
    qty: item.count,
    price: item.total / item.count,
    total: item.total,
  }));
}

// ─── Build Closing Transactions with Items (async) ───────────────────

export interface ClosingTransactionWithItems extends ClosingTransaction {
  items?: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    total: number;
  }>;
}

/**
 * Construye transacciones para el ticket de cierre incluyendo items detallados.
 * Requiere un cliente Supabase para hacer sub-queries por cada pago.
 *
 * Reemplaza la lógica async inline en use-shift-closing.ts handlePrintClosing.
 */
export async function buildClosingTransactionsWithItems(
  payments: any[],
  supabase: any,
): Promise<ClosingTransactionWithItems[]> {
  return Promise.all((payments || []).map(async (payment: any) => {
    let items: ClosingTransactionWithItems['items'];

    // Load related order items if payment has them
    if (payment.sales_order_id && payment.itemsCount && payment.itemsCount > 0) {
      const { data: orderItems } = await supabase
        .from("sales_order_items")
        .select("id, qty, unit_price, total, concept_type, is_paid, paid_at, products(name, sku)")
        .eq("sales_order_id", payment.sales_order_id)
        .eq("is_paid", true)
        .not("paid_at", "is", null);

      const paymentTime = new Date(payment.created_at).getTime();
      const relatedItems = (orderItems || []).filter((item: any) => {
        if (!item.paid_at) return false;
        return Math.abs(paymentTime - new Date(item.paid_at).getTime()) / 1000 / 60 <= 5;
      });

      if (relatedItems.length > 0) {
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
    }

    // Get room number from sales_order -> room_stays
    let roomNumber: string | undefined;
    if (payment.sales_order_id) {
      const { data: stayData } = await supabase
        .from("room_stays")
        .select("rooms(number)")
        .eq("sales_order_id", payment.sales_order_id)
        .limit(1)
        .maybeSingle();
      const rooms = stayData?.rooms;
      roomNumber = Array.isArray(rooms) ? rooms[0]?.number : rooms?.number;
    }

    const rawConcept = payment.concept || "";
    const conceptLabel = CONCEPT_DISPLAY[rawConcept] || payment.itemsDescription || rawConcept || undefined;

    return {
      time: new Date(payment.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      amount: payment.amount,
      paymentMethod: payment.payment_method || 'N/A',
      terminalCode: payment.payment_terminals?.code || payment.terminal_code,
      reference: payment.reference || undefined,
      concept: conceptLabel,
      roomNumber: roomNumber || undefined,
      items,
    };
  }));
}
