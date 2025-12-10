// Tipos compartidos para los componentes de habitaciones

// Configuración de colores por estado
export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  LIBRE: {
    label: "Libre",
    color: "bg-blue-950/50 text-blue-100 border-blue-400/40",
  },
  OCUPADA: {
    label: "Ocupada",
    color: "bg-red-950/50 text-red-100 border-red-400/40",
  },
  SUCIA: {
    label: "Sucia",
    color: "bg-purple-950/50 text-purple-100 border-purple-400/40",
  },
  BLOQUEADA: {
    label: "Bloqueada",
    color: "bg-emerald-950/50 text-emerald-100 border-emerald-400/40",
  },
};

// Fondo de las cards por estado
export const ROOM_STATUS_BG: Record<string, string> = {
  LIBRE: "bg-blue-900/80",
  OCUPADA: "bg-red-900/80",
  SUCIA: "bg-purple-900/80",
  BLOQUEADA: "bg-emerald-900/80",
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
  expected_check_out_at?: string | null;
  current_people?: number;
  total_people?: number;
  // Campos para tolerancia de salida (solo motel, no torre/hotel)
  tolerance_started_at?: string | null; // Cuando inició la tolerancia de 1 hora
  tolerance_type?: 'PERSON_LEFT' | 'ROOM_EMPTY' | null; // Tipo de tolerancia activa
  sales_orders?: {
    remaining_amount?: number;
  } | null;
}

export interface Room {
  id: string;
  number: string;
  status: "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA" | string;
  room_types: RoomType | null;
  room_stays?: RoomStay[];
}

export interface TimeInfo {
  eta: string;
  remaining: string;
  minutesToCheckout?: number;
}

// Métodos de pago disponibles
export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo', icon: '💵' },
  { value: 'TARJETA', label: 'Tarjeta', icon: '💳' },
  { value: 'TRANSFERENCIA', label: 'Transferencia', icon: '🏦' },
];
