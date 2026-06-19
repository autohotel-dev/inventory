import React from "react";
import {
  Bed,
  Clock,
  Users,
  ShoppingBag,
  Package,
  MoreHorizontal,
  AlertTriangle,
  ArrowRightLeft,
  Receipt
} from "lucide-react";

export const CONCEPT_ICONS: Record<string, React.ReactNode> = {
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

export const CONCEPT_LABELS: Record<string, string> = {
  ROOM_BASE: "Habitación, estancia completa",
  EXTRA_HOUR: "Hora Extra",
  EXTRA_PERSON: "Persona Extra",
  CONSUMPTION: "Consumo",
  PRODUCT: "Producto",
  RENEWAL: "Renovación de estancia",
  PROMO_4H: "Promo 4 Horas",
  OTHER: "Otro",
  DAMAGE_CHARGE: "Cargo por Daños",
  TOLERANCE_EXPIRED: "Tolerancia Expirada",
  ROOM_CHANGE_ADJUSTMENT: "Ajuste por Cambio de Habitación",
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
};

/**
 * Genera nombres descriptivos para items de ticket/recibo.
 * Incluye el número y tipo de habitación cuando es relevante.
 * Ejemplos:
 *   - "Servicio Hab. 5 Sencilla"
 *   - "Persona Extra Hab. 5 Sencilla"  
 *   - "Hora Extra Hab. 5 Sencilla"
 *   - "Renovación Hab. 5 Sencilla"
 */
export function getTicketItemName(
  conceptType: string,
  roomTypeName?: string | null,
  productName?: string | null,
  roomNumber?: string | null,
): string {
  const habLabel = roomNumber
    ? (roomTypeName ? ` Hab. ${roomNumber} ${roomTypeName}` : ` Hab. ${roomNumber}`)
    : (roomTypeName ? ` Hab. ${roomTypeName}` : '');

  switch (conceptType) {
    case 'ROOM_BASE':
    case 'STAY':
      return `Servicio${habLabel || ' de Habitación'}`;
    case 'EXTRA_PERSON':
    case 'PERSONA_EXTRA':
      return `Persona Extra${habLabel}`;
    case 'EXTRA_HOUR':
    case 'HORA_EXTRA':
      return `Hora Extra${habLabel}`;
    case 'RENEWAL':
    case 'RENOVACION':
      return `Renovación${habLabel}`;
    case 'PROMO_4H':
      return `Promo 4 Horas${habLabel}`;
    case 'TOLERANCE_EXPIRED':
    case 'TOLERANCIA_EXPIRADA':
      return `Penalización por Tolerancia${habLabel}`;
    case 'DAMAGE_CHARGE':
    case 'DAÑO':
      return `Cargo por Daños${roomNumber ? ` Hab. ${roomNumber}` : ''}`;
    case 'ROOM_CHANGE_ADJUSTMENT':
      return 'Ajuste por Cambio de Habitación';
    case 'CONSUMPTION':
    case 'CONSUMO':
      return productName || 'Consumo';
    case 'PRODUCT':
      return productName || 'Producto';
    default:
      return productName || CONCEPT_LABELS[conceptType] || conceptType;
  }
}
