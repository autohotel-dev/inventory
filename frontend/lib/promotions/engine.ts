/**
 * Motor de promociones de productos (consumos de habitación).
 *
 * Funciones puras: reciben el producto, las promociones vigentes y lo ya consumido en la
 * estancia, y devuelven los renglones a cobrar. Un renglón con promoción se separa del renglón
 * a precio normal para que ticket, renglones y total de la orden cuadren al centavo:
 *   - % de descuento / precio fijo → renglón con precio unitario rebajado (redondeado a centavos)
 *   - NxM → las piezas que paga a precio normal + las piezas de regalo como cortesía "Promoción …"
 *
 * Regla "Solo primera orden" (first_order_only), decidida 2026-10-14: la promoción aplica a
 * UNA pieza (un paquete en NxM) y solo si en la estancia todavía no se ha consumido ese
 * producto (o algo de esa subcategoría/categoría, según el alcance de la promoción).
 */

export type PromoType = "NxM" | "PERCENT_DISCOUNT" | "FIXED_PRICE";

export interface Promotion {
  id: string;
  name: string;
  promo_type: PromoType;
  buy_quantity: number | null;
  pay_quantity: number | null;
  discount_percent: number | null;
  fixed_price: number | null;
  product_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  conditions?: Record<string, unknown> | null;
}

export interface PromoProduct {
  id: string;
  price: number;
  category_id?: string | null;
  subcategory_id?: string | null;
}

/** Lo que ya se consumió en la estancia (renglones no cancelados) */
export interface ConsumedItem {
  productId: string;
  categoryId: string | null;
  subcategoryId: string | null;
}

export interface PricedLine {
  qty: number;
  unitPrice: number;
  /** Pieza regalada por un NxM: se registra como cortesía con el nombre de la promoción */
  isPromoGift: boolean;
  promo: Promotion | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const isFirstOrderOnly = (p: Promotion) => p.conditions?.first_order_only === true;

/** ¿Ya se consumió algo dentro del alcance de la promoción en esta estancia? */
function consumedInScope(p: Promotion, consumed: ConsumedItem[]): boolean {
  if (p.product_id) return consumed.some((c) => c.productId === p.product_id);
  if (p.subcategory_id) return consumed.some((c) => c.subcategoryId === p.subcategory_id);
  if (p.category_id) return consumed.some((c) => c.categoryId === p.category_id);
  return false;
}

/**
 * La promoción que aplica al producto: la de producto gana a la de subcategoría y esta a la de
 * categoría; con dos del mismo nivel gana la de mayor ahorro por pieza (determinista).
 */
export function findPromotion(product: PromoProduct, promos: Promotion[], consumed: ConsumedItem[]): Promotion | null {
  const eligible = promos.filter((p) => !(isFirstOrderOnly(p) && consumedInScope(p, consumed)));
  const levels = [
    eligible.filter((p) => p.product_id === product.id),
    eligible.filter((p) => !p.product_id && p.subcategory_id && p.subcategory_id === product.subcategory_id),
    eligible.filter((p) => !p.product_id && !p.subcategory_id && p.category_id && p.category_id === product.category_id),
  ];
  for (const level of levels) {
    if (level.length > 0) {
      return [...level].sort((a, b) => unitSaving(product, b) - unitSaving(product, a) || a.id.localeCompare(b.id))[0];
    }
  }
  return null;
}

function unitSaving(product: PromoProduct, p: Promotion): number {
  switch (p.promo_type) {
    case "PERCENT_DISCOUNT": return product.price * (p.discount_percent || 0) / 100;
    case "FIXED_PRICE": return Math.max(0, product.price - (p.fixed_price ?? product.price));
    case "NxM": {
      const n = p.buy_quantity || 2, m = p.pay_quantity || 1;
      return product.price * (n - m) / n;
    }
  }
}

/** Renglones a cobrar por `qty` piezas del producto */
export function priceLines(product: PromoProduct, qty: number, promo: Promotion | null): PricedLine[] {
  const normal = (n: number): PricedLine[] => (n > 0 ? [{ qty: n, unitPrice: round2(product.price), isPromoGift: false, promo: null }] : []);
  if (!promo || qty <= 0) return normal(qty);

  const limited = isFirstOrderOnly(promo);

  if (promo.promo_type === "NxM") {
    const n = promo.buy_quantity || 2;
    const m = promo.pay_quantity || 1;
    const bundles = limited ? Math.min(1, Math.floor(qty / n)) : Math.floor(qty / n);
    if (bundles === 0) return normal(qty);
    const gifts = bundles * (n - m);
    return [
      ...normal(qty - gifts),
      { qty: gifts, unitPrice: 0, isPromoGift: true, promo },
    ];
  }

  const promoQty = limited ? Math.min(1, qty) : qty;
  const unitPrice = promo.promo_type === "PERCENT_DISCOUNT"
    ? round2(product.price * (1 - (promo.discount_percent || 0) / 100))
    : round2(Math.min(promo.fixed_price ?? product.price, product.price));
  if (unitPrice >= product.price) return normal(qty);
  return [
    { qty: promoQty, unitPrice, isPromoGift: false, promo },
    ...normal(qty - promoQty),
  ];
}

export const linesTotal = (lines: PricedLine[]) => round2(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));

export function describePromotion(p: Pick<Promotion, "promo_type" | "buy_quantity" | "pay_quantity" | "discount_percent" | "fixed_price">): string {
  switch (p.promo_type) {
    case "NxM": return `${p.buy_quantity}x${p.pay_quantity}`;
    case "PERCENT_DISCOUNT": return `${p.discount_percent}% desc.`;
    case "FIXED_PRICE": return `precio especial $${Number(p.fixed_price).toFixed(2)}`;
  }
}
