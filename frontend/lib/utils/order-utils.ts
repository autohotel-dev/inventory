/**
 * Centralized utilities for filtering and processing sales order items.
 * Eliminates scattered is_cancelled checks across the codebase.
 */

/** Filtra items activos (no cancelados) */
export function getActiveItems<T extends { is_cancelled?: boolean }>(items: T[]): T[] {
  return items.filter(i => !i.is_cancelled);
}

/** Filtra items pendientes de pago (no pagados, no cancelados) */
export function getPendingItems<T extends { is_paid?: boolean; is_cancelled?: boolean }>(items: T[]): T[] {
  return items.filter(i => !i.is_paid && !i.is_cancelled);
}

/** Verifica si un item bloquea el checkout (pendiente de entrega y no cancelado) */
export function isItemBlockingCheckout(item: {
  delivery_status?: string;
  is_cancelled?: boolean;
}): boolean {
  return (
    !item.is_cancelled &&
    !!item.delivery_status &&
    item.delivery_status !== "DELIVERED" &&
    item.delivery_status !== "COMPLETED" &&
    item.delivery_status !== "CANCELLED"
  );
}

/**
 * Agrupa items pendientes por concept_type para mostrar en checkout
 */
export interface PendingItemSummary {
  concept_type: string;
  total: number;
  count: number;
}

export function summarizePendingItems(
  items: Array<{ concept_type?: string; total?: number; is_paid?: boolean; is_cancelled?: boolean }>
): { pendingItems: PendingItemSummary[]; hasUndeliveredItems: boolean } {
  const pendingByType: Record<string, { total: number; count: number }> = {};
  let hasUndeliveredItems = false;

  for (const item of items) {
    if (item.is_cancelled) continue;

    if (!item.is_paid) {
      const type = item.concept_type || "PRODUCT";
      if (!pendingByType[type]) {
        pendingByType[type] = { total: 0, count: 0 };
      }
      pendingByType[type].total += item.total || 0;
      pendingByType[type].count += 1;
    }
  }

  const pendingItems = Object.entries(pendingByType).map(([concept_type, data]) => ({
    concept_type,
    total: data.total,
    count: data.count,
  }));

  return { pendingItems, hasUndeliveredItems };
}

/**
 * Checks if items have undelivered blocking entries (for checkout validation)
 */
export function hasBlockingDeliveries(
  items: Array<{ delivery_status?: string; is_cancelled?: boolean; is_paid?: boolean }>
): boolean {
  return items.some(item => !item.is_cancelled && !item.is_paid && isItemBlockingCheckout(item));
}
