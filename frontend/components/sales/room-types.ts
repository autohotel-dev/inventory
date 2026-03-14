// Tipos compartidos para los componentes de habitaciones

import { PaymentEntry } from "@/components/sales/multi-payment-input";

// Configuración de colores por estado
export const STATUS_CONFIG: Record<string, { label: string; shortLabel?: string; color: string }> = {
  LIBRE: {
    label: "Libre",
    shortLabel: "Libre",
    color: "bg-blue-950/50 text-blue-100 border-blue-400/40",
  },
  OCUPADA: {
    label: "Ocupada",
    shortLabel: "Ocup.",
    color: "bg-red-950/50 text-red-100 border-red-400/40",
  },
  SUCIA: {
    label: "Sucia",
    shortLabel: "Sucia",
    color: "bg-purple-950/50 text-purple-100 border-purple-400/40",
  },
  BLOQUEADA: {
    label: "Bloqueada",
    shortLabel: "Bloq.",
    color: "bg-emerald-950/50 text-emerald-100 border-emerald-400/40",
  },
};

// Fondo de las cards por estado
export const ROOM_STATUS_BG: Record<string, string> = {
  LIBRE: "bg-gradient-to-br from-blue-950/60 to-slate-900/40",
  OCUPADA: "bg-gradient-to-br from-red-950/60 to-rose-900/40",
  SUCIA: "bg-gradient-to-br from-purple-950/60 to-fuchsia-900/40",
  BLOQUEADA: "bg-gradient-to-br from-emerald-950/60 to-teal-900/40",
};

// Anillo suave por estado para las cards
export const ROOM_STATUS_ACCENT: Record<string, string> = {
  LIBRE: "ring-1 ring-blue-500/40",
  OCUPADA: "ring-1 ring-red-500/40",
  SUCIA: "ring-1 ring-purple-500/40",
  BLOQUEADA: "ring-1 ring-emerald-500/40",
};

export interface RoomType {
  id: string;
  name: string;
  base_price?: number;
  weekday_hours?: number;
  weekend_hours?: number;
  is_hotel?: boolean;
  extra_person_price?: number;
  extra_hour_price?: number;
  max_people?: number;
}

export interface RoomStay {
  id: string;
  sales_order_id: string;
  status: string;
  check_in_at?: string | null;
  expected_check_out_at?: string | null;
  current_people?: number;
  total_people?: number;
  actual_check_out_at?: string | null; // Hora real de salida definitiva
  // Campos para tolerancia de salida (solo motel, no torre/hotel)
  tolerance_started_at?: string | null; // Cuando inició la tolerancia de 1 hora
  tolerance_type?: 'PERSON_LEFT' | 'ROOM_EMPTY' | null; // Tipo de tolerancia activa
  // Datos del vehículo
  vehicle_plate?: string | null;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  // Cocheros
  valet_employee_id?: string | null; // Cochero de entrada
  checkout_valet_employee_id?: string | null; // Cochero de salida
  vehicle_requested_at?: string | null; // Hora de solicitud de vehículo
  valet_checkout_requested_at?: string | null; // Hora de propuesta de salida por el cochero
  guest_access_token?: string | null; // Token de acceso al portal de huéspedes
  sales_orders?: {
    id?: string;
    remaining_amount?: number;
    sales_order_items?: {
      id: string;
      delivery_status: string | null;
      concept_type: string | null;
      created_at?: string | null;
    }[];
  } | null;
  checkout_payment_data?: PaymentEntry[] | null;
}

export interface Room {
  id: string;
  number: string;
  status: "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA" | string;
  room_types: RoomType | null;
  room_stays?: RoomStay[];
  notes?: string | null;
}

export interface TimeInfo {
  eta: string;
  remaining: string;
  minutesToCheckout?: number;
}

// Métodos de pago disponibles (sin transferencia)
export type PaymentMethod = 'EFECTIVO' | 'TARJETA';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo', icon: '💵' },
  { value: 'TARJETA', label: 'Tarjeta', icon: '💳' },
];

// Terminales de pago para tarjetas
export type PaymentTerminal = 'BBVA' | 'GETNET';

export const PAYMENT_TERMINALS: { value: PaymentTerminal; label: string; color: string }[] = [
  { value: 'BBVA', label: 'BBVA', color: 'bg-blue-600' },
  { value: 'GETNET', label: 'GETNET', color: 'bg-red-600' },
];

// Tipo de tarjeta
export type CardType = 'CREDITO' | 'DEBITO';

export const CARD_TYPES: { value: CardType; label: string; icon: string }[] = [
  { value: 'CREDITO', label: 'Crédito', icon: '💳' },
  { value: 'DEBITO', label: 'Débito', icon: '💵' },
];
