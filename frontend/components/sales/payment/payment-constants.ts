"use client";

import { 
  Clock, 
  UserPlus, 
  AlertTriangle, 
  ArrowRightLeft, 
  PlusCircle, 
  Tag, 
  Calendar,
  Home,
  CheckCircle2,
  Package,
  Coffee,
  MoreHorizontal
} from "lucide-react";
import React from "react";

export interface OrderItem {
  id: string;
  concept_type: string;
  unit_price?: number;
  total: number;
  is_paid: boolean;
  paid_at?: string;
  payment_method?: string;
  product_id?: string;
  qty?: number;
  products?: {
    name: string;
    sku?: string;
  };
  delivery_status?: string;
  is_cancelled?: boolean;
}

/**
 * Concepts that are explicitly managed or reported by the Valet.
 * These trigger the corroboration and "waiting for valet" logic.
 */
export const VALET_CONCEPTS = [
  'ROOM_BASE',
  'EXTRA_HOUR',
  'EXTRA_PERSON',
  'DAMAGE_CHARGE',
  'EARLY_CHECKIN',
  'ROOM_CHANGE_ADJUSTMENT',
  'RENEWAL',
  'PROMO_4H',
  'ENTRADA',
  'DAÑO',
  'PERSONA_EXTRA'
];

/**
 * Concepts that represent services (not physical products).
 * These usually require data registration before payment.
 */
export const SERVICE_CONCEPTS = [
  ...VALET_CONCEPTS,
  'TOLERANCE_EXPIRED',
  'LATE_CHECKOUT',
  'PROMO_4H'
];

/**
 * Maps database concept_type or concept strings to human-readable labels.
 */
export const CONCEPT_LABELS: Record<string, string> = {
  // System / Base Concepts
  'ROOM_BASE': 'Estancia de Habitación',
  'STAY': 'Estancia de Habitación',
  'ENTRADA': 'Cobro de Entrada',
  'ROOM_CHANGE_ADJUSTMENT': 'Ajuste de Cambio de Habitación',
  'RENEWAL': 'Renovación de Estancia',
  'RENOVACION': 'Renovación de Estancia',
  
  // Extra Services
  'EXTRA_HOUR': 'Hora Extra',
  'HORA_EXTRA': 'Hora Extra',
  'EXTRA_PERSON': 'Persona Extra',
  'PERSONA_EXTRA': 'Persona Extra',
  'EARLY_CHECKIN': 'Entrada Anticipada',
  'LATE_CHECKOUT': 'Salida Tardía',
  'TOLERANCE_EXPIRED': 'Tiempo de Tolerancia Expirado',
  'PROMO_4H': 'Promoción 4 Horas',
  
  // Incidents
  'DAMAGE_CHARGE': 'Cargo por Daños',
  'DAÑO': 'Cargo por Daños',
  'VALET_DAMAGE': 'Cargo por Daños',
  
  // Products
  'PRODUCT': 'Producto de Venta/Bar',
  'CONSUMPTION': 'Consumo',
  'CONSUMO': 'Consumo',
  
  // Financial
  'REFUND': 'Reembolso / Ajuste a Favor',
  'ADJUSTMENT': 'Ajuste Manual',
  'DISCOUNT': 'Descuento Aplicado',
  'PROPINA': 'Propina'
};

/**
 * Maps concept types to visual indicators.
 */
export const CONCEPT_ICONS: Record<string, React.ReactNode> = {
  'ROOM_BASE': React.createElement(Home, { className: "h-4 w-4" }),
  'STAY': React.createElement(Home, { className: "h-4 w-4" }),
  'EXTRA_HOUR': React.createElement(Clock, { className: "h-4 w-4" }),
  'HORA_EXTRA': React.createElement(Clock, { className: "h-4 w-4" }),
  'EXTRA_PERSON': React.createElement(UserPlus, { className: "h-4 w-4" }),
  'PERSONA_EXTRA': React.createElement(UserPlus, { className: "h-4 w-4" }),
  'DAMAGE_CHARGE': React.createElement(AlertTriangle, { className: "h-4 w-4" }),
  'DAÑO': React.createElement(AlertTriangle, { className: "h-4 w-4" }),
  'ROOM_CHANGE_ADJUSTMENT': React.createElement(ArrowRightLeft, { className: "h-4 w-4" }),
  'CONSUMPTION': React.createElement(Coffee, { className: "h-4 w-4" }),
  'PRODUCT': React.createElement(Package, { className: "h-4 w-4" }),
  'RENEWAL': React.createElement(Calendar, { className: "h-4 w-4" }),
  'REFUND': React.createElement(PlusCircle, { className: "h-4 w-4" }),
  'DISCOUNT': React.createElement(Tag, { className: "h-4 w-4" }),
  'CHECK': React.createElement(CheckCircle2, { className: "h-4 w-4" })
};

/**
 * Helper to map valet-reported concepts to system concept_types for comparison.
 */
export const VALET_TO_SYSTEM_MAP: Record<string, string[]> = {
  'PERSONA_EXTRA': ['EXTRA_PERSON'],
  'EXTRA_PERSON': ['EXTRA_PERSON'],
  'HORA_EXTRA': ['EXTRA_HOUR'],
  'EXTRA_HOUR': ['EXTRA_HOUR'],
  'ESTANCIA': ['ROOM_BASE', 'STAY'],
  'ENTRADA': ['ROOM_BASE', 'STAY'],
  'STAY': ['ROOM_BASE', 'STAY'],
  'TOLERANCIA_EXPIRADA': ['TOLERANCE_EXPIRED'],
  'TOLERANCE_EXPIRED': ['TOLERANCE_EXPIRED'],
  'DAMAGE_CHARGE': ['DAMAGE_CHARGE'],
  'CARGO_DANO': ['DAMAGE_CHARGE'],
  'DAÑO': ['DAMAGE_CHARGE'],
  'VALET_DAMAGE': ['DAMAGE_CHARGE'],
  'CONSUMO': ['CONSUMPTION', 'PRODUCT'],
  'CONSUMPTION': ['CONSUMPTION', 'PRODUCT'],
  'RENEWAL': ['RENEWAL', 'STAY', 'EXTRA_HOUR'],
  'RENOVACION': ['RENEWAL'],
  'PRODUCT': ['PRODUCT'],
  'EARLY_CHECKIN': ['EARLY_CHECKIN'],
  'LATE_CHECKOUT': ['LATE_CHECKOUT'],
  'ROOM_CHANGE': ['ROOM_CHANGE_ADJUSTMENT'],
  'PROMO_4H': ['PROMO_4H']
};
