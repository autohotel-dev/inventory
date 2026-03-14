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

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
};
