// Tipos para el sistema de empleados y turnos

export interface Employee {
  id: string;
  auth_user_id?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  role: 'admin' | 'receptionist' | 'manager' | 'gerente' | 'cochero' | 'camarista' | 'mantenimiento';
  is_active: boolean;
  pin_code?: string | null;
  avatar_url?: string | null;
  hired_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftDefinition {
  id: string;
  name: string;
  code: 'MORNING' | 'AFTERNOON' | 'NIGHT';
  start_time: string;
  end_time: string;
  crosses_midnight: boolean;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface EmployeeSchedule {
  id: string;
  employee_id: string;
  shift_definition_id: string;
  schedule_date: string;
  is_day_off: boolean;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones
  employees?: Employee;
  shift_definitions?: ShiftDefinition;
}

export interface PaymentTerminal {
  id: string;
  name: string;
  code: 'BBVA' | 'GETNET';
  description?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ShiftSession {
  id: string;
  employee_id: string;
  shift_definition_id: string;
  schedule_id?: string | null;
  clock_in_at: string;
  clock_out_at?: string | null;
  status: 'active' | 'pending_closing' | 'closed' | 'cancelled';
  notes?: string | null;
  created_at: string;
  // Relaciones
  employees?: Employee;
  shift_definitions?: ShiftDefinition;
}

export interface ShiftClosing {
  id: string;
  shift_session_id: string;
  employee_id: string;
  shift_definition_id: string;
  period_start: string;
  period_end: string;
  total_cash: number;
  total_card_bbva: number;
  total_card_getnet: number;
  total_sales: number;
  total_transactions: number;
  status: 'pending' | 'approved' | 'rejected' | 'reviewed';
  rejection_reason?: string | null;
  notes?: string | null;
  total_expenses?: number;
  expenses?: any[];
  // Campos para control de efectivo
  counted_cash?: number | null;
  cash_difference?: number | null;
  cash_breakdown?: CashBreakdown | null;
  // Campos para control de tarjeta (Vouchers)
  declared_card_bbva?: number | null;
  declared_card_getnet?: number | null;
  card_difference_bbva?: number | null;
  card_difference_getnet?: number | null;
  is_correction?: boolean;
  has_correction?: boolean;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones
  employees?: Employee;
  shift_definitions?: ShiftDefinition;
  shift_sessions?: ShiftSession;
}

export interface CashBreakdown {
  [denomination: string]: number; // ej: { "1000": 2, "500": 5, "200": 3 }
}

// Constantes de roles
export const EMPLOYEE_ROLES = [
  { value: 'admin', label: 'Administrador', color: 'bg-purple-500' },
  { value: 'gerente', label: 'Gerente', color: 'bg-blue-500' },
  { value: 'receptionist', label: 'Recepcionista', color: 'bg-green-500' },
  { value: 'cochero', label: 'Cochero', color: 'bg-orange-500' },
  { value: 'camarista', label: 'Camarista', color: 'bg-pink-500' },
  { value: 'mantenimiento', label: 'Mantenimiento', color: 'bg-slate-500' },
] as const;

/**
 * @deprecated Usar los valores dinámicos de useSystemConfigRead() en su lugar.
 * Estos son solo valores de respaldo. Los límites reales se configuran
 * en Settings > General > Límites de Turnos Activos y se almacenan en system_config (Supabase).
 */
export const SHIFT_LIMITS_BY_ROLE: Record<string, number> = {
  receptionist: 1,
  cochero: 4,
  admin: 2,
  manager: 2,
  camarista: 1,
  mantenimiento: 2,
};

// Constantes de turnos
export const SHIFT_COLORS: Record<string, string> = {
  MORNING: 'bg-amber-500',
  AFTERNOON: 'bg-blue-500',
  NIGHT: 'bg-purple-500',
};

export const SHIFT_LABELS: Record<string, string> = {
  MORNING: 'Mañana',
  AFTERNOON: 'Tarde',
  NIGHT: 'Noche',
};

// Denominaciones de billetes mexicanos para el conteo de caja
export const CASH_DENOMINATIONS = [
  { value: 1000, label: '$1,000' },
  { value: 500, label: '$500' },
  { value: 200, label: '$200' },
  { value: 100, label: '$100' },
  { value: 50, label: '$50' },
  { value: 20, label: '$20' },
  { value: 10, label: '$10' },
  { value: 5, label: '$5' },
  { value: 2, label: '$2' },
  { value: 1, label: '$1' },
  { value: 0.5, label: '$0.50' },
];
