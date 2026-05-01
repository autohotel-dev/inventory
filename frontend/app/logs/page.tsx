"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield, Clock, CreditCard, AlertTriangle, User, Home, ShoppingBag,
  XCircle, Gift, RotateCcw, Timer, UserPlus, UserMinus, Wrench, Zap,
  DoorOpen, LogIn, LogOut, RefreshCw, Search, Filter, ChevronDown,
  Activity, CalendarDays, Download, RotateCw,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useLogCenter, LogCategory, LogEntry, NameMap } from "@/hooks/use-log-center";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Dictionaries ────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CANCEL_ITEM: <XCircle className="h-4 w-4" />,
  CANCEL_CHARGE: <XCircle className="h-4 w-4" />,
  COURTESY: <Gift className="h-4 w-4" />,
  RENEWAL: <RotateCcw className="h-4 w-4" />,
  EXTRA_HOUR: <Timer className="h-4 w-4" />,
  EXTRA_PERSON: <UserPlus className="h-4 w-4" />,
  PROMO_4H: <Zap className="h-4 w-4" />,
  DAMAGE_CHARGE: <Wrench className="h-4 w-4" />,
  CHECKOUT: <DoorOpen className="h-4 w-4" />,
  ADD_PERSON: <UserPlus className="h-4 w-4" />,
  REMOVE_PERSON: <UserMinus className="h-4 w-4" />,
  TOLERANCE: <Timer className="h-4 w-4" />,
  CONSUMPTION_ADDED: <ShoppingBag className="h-4 w-4" />,
  PAYMENT_METHOD_CHANGE: <CreditCard className="h-4 w-4" />,
  UPDATE: <Home className="h-4 w-4" />,
  LOGIN: <LogIn className="h-4 w-4" />,
  LOGOUT: <LogOut className="h-4 w-4" />,
  LOGIN_FAILED: <AlertTriangle className="h-4 w-4" />,
  INSERT: <RefreshCw className="h-4 w-4" />,
  DELETE: <XCircle className="h-4 w-4" />,
  PURGE_SYSTEM: <AlertTriangle className="h-4 w-4" />,
};

const ACTION_TITLES: Record<string, string> = {
  CANCEL_ITEM: "Item Cancelado", CANCEL_CHARGE: "Cargo Cancelado",
  COURTESY: "Cortesía", RENEWAL: "Renovación", EXTRA_HOUR: "Hora Extra",
  EXTRA_PERSON: "Persona Extra", PROMO_4H: "Promo 4H", DAMAGE_CHARGE: "Daño",
  CHECKOUT: "Check-out", ADD_PERSON: "Persona +", REMOVE_PERSON: "Persona -",
  TOLERANCE: "Tolerancia", CONSUMPTION_ADDED: "Consumo", UPDATE: "Actualización",
  PAYMENT_METHOD_CHANGE: "Cambio Pago", LOGIN: "Login", LOGOUT: "Logout",
  LOGIN_FAILED: "Login Fallido", INSERT: "Creado", DELETE: "Eliminado",
  PURGE_SYSTEM: "Purga", MAINTENANCE: "Mantenimiento",
};

const ACTION_COLORS: Record<string, string> = {
  CANCEL_ITEM: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  CANCEL_CHARGE: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  COURTESY: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  RENEWAL: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  EXTRA_HOUR: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  EXTRA_PERSON: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
  PROMO_4H: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
  DAMAGE_CHARGE: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  CHECKOUT: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  ADD_PERSON: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  REMOVE_PERSON: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400",
  TOLERANCE: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
  CONSUMPTION_ADDED: "bg-lime-100 text-lime-600 dark:bg-lime-900/30 dark:text-lime-400",
  LOGIN: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  LOGOUT: "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400",
  LOGIN_FAILED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  ERROR: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  WARNING: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  INFO: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  DEBUG: "bg-gray-500/10 text-gray-500 border-gray-500/20 dark:text-gray-400",
};

const CATEGORY_CONFIGS: { key: LogCategory; label: string; icon: React.ReactNode; statKey: keyof ReturnType<typeof useLogCenter>["stats"] }[] = [
  { key: "all", label: "Todos", icon: <Activity className="h-3.5 w-3.5" />, statKey: "total" },
  { key: "reception", label: "Recepción", icon: <Home className="h-3.5 w-3.5" />, statKey: "reception" },
  { key: "payments", label: "Pagos", icon: <CreditCard className="h-3.5 w-3.5" />, statKey: "payments" },
  { key: "auth", label: "Sesiones", icon: <User className="h-3.5 w-3.5" />, statKey: "auth" },
  { key: "alerts", label: "Alertas", icon: <AlertTriangle className="h-3.5 w-3.5" />, statKey: "alerts" },
];

// ─── Metadata Humanizer ──────────────────────────────────────────────
// Convierte los datos técnicos en texto legible para personas sin
// conocimiento de programación.

const METADATA_LABELS: Record<string, string> = {
  // Habitación y estancia
  room_number: "Habitación",
  room_id: "Habitación",
  stay_id: "Estancia",
  // Montos
  amount: "Monto",
  total_amount: "Monto total",
  remaining: "Saldo restante",
  paid_amount: "Monto pagado",
  total: "Total",
  subtotal: "Subtotal",
  discount: "Descuento",
  tax: "Impuesto",
  tip: "Propina",
  change: "Cambio",
  // Pagos
  payment_method: "Método de pago",
  payment_count: "Cantidad de pagos",
  payment_type: "Tipo de pago",
  concept: "Concepto",
  reference: "Referencia",
  folio: "Folio",
  card_last_4: "Últimos 4 dígitos tarjeta",
  card_type: "Tipo de tarjeta",
  terminal_code: "Terminal",
  // Personas involucradas
  employee_id: "Empleado",
  corrected_by: "Corregido por",
  confirmed_by: "Confirmado por",
  created_by: "Creado por",
  original_collected_by: "Recolectado originalmente por",
  collected_by: "Recolectado por",
  assigned_to: "Asignado a",
  collector_name: "Cobrador",
  checkout_valet_id: "Cochero de salida",
  valet_id: "Cochero",
  action_by: "Realizado por",
  action_by_id: "Realizado por",
  assigned_to_id: "Asignado a",
  action_by_name: "Realizado por",
  assigned_to_name: "Asignado a",
  // Sesiones y turnos
  session_id: "Turno",
  shift_session_id: "Turno",
  new_session: "Sesión actual",
  old_session: "Sesión anterior",
  migrated_from: "Migrado desde",
  migrated_to: "Migrado a",
  // IDs internos (se ocultan)
  sales_order_id: "Orden",
  item_id: "Artículo",
  payment_id: "Pago",
  // Acciones de recepción
  reason: "Motivo",
  hours: "Horas",
  hours_deducted: "Horas descontadas",
  people_deducted: "Personas descontadas",
  is_courtesy: "¿Es cortesía?",
  courtesy_reason: "Motivo de cortesía",
  renewal_hours: "Horas de renovación",
  is_weekend: "¿Fin de semana?",
  previous_people: "Personas antes",
  new_people: "Personas después",
  total_historic: "Total histórico personas",
  tolerance_type: "Tipo de tolerancia",
  action: "Acción",
  minutes_elapsed: "Minutos transcurridos",
  minutes_remaining: "Minutos restantes",
  deadline: "Hora límite",
  item_count: "Artículos",
  refund_created: "¿Se creó reembolso?",
  inventory_returned: "¿Se devolvió inventario?",
  // Estados
  status: "Estado",
  new_status: "Nuevo estado",
  previous_status: "Estado anterior",
  notes: "Notas",
};

const TOLERANCE_TYPES: Record<string, string> = {
  ROOM_EMPTY: "Habitación vacía",
  PERSON_LEFT: "Persona salió",
};

const STATUS_LABELS: Record<string, string> = {
  LIBRE: "Libre", OCUPADA: "Ocupada", SUCIA: "Sucia", BLOQUEADA: "Bloqueada",
  RETURN: "Regreso", START: "Inicio",
  PAGADO: "Pagado", PENDIENTE: "Pendiente",
  COBRADO_POR_VALET: "Cobrado por cochero",
  CORROBORADO_RECEPCION: "Corroborado recepción",
  PARCIAL: "Parcial", COMPLETO: "Completo",
};

const PAYMENT_METHODS: Record<string, string> = {
  EFECTIVO: "Efectivo", TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia", PENDIENTE: "Pendiente",
  MIXTO: "Mixto",
};

const CONCEPTS: Record<string, string> = {
  PAGO_POR_CONCEPTOS: "Pago por conceptos",
  PROPINA: "Propina",
  ESTANCIA: "Estancia",
  CONSUMO: "Consumo",
  EXTRA: "Extra",
  PERSONA_EXTRA: "Persona extra",
  HORA_EXTRA: "Hora extra",
  RENOVACION: "Renovación",
  PROMO_4H: "Promoción 4 horas",
  DAMAGE: "Daño",
};

// Detecta si un key es un monto monetario
function isAmountKey(key: string): boolean {
  return ["amount", "total_amount", "remaining", "paid_amount", "total", "subtotal", "discount", "tax", "tip", "change"].includes(key);
}

// Detecta si un key es referencia a una persona (UUID que se debe resolver)
function isPersonKey(key: string): boolean {
  return ["employee_id", "corrected_by", "confirmed_by", "created_by", "original_collected_by",
    "collected_by", "assigned_to", "checkout_valet_id", "valet_id", "action_by", "action_by_id", "assigned_to_id"].includes(key);
}

// Detecta si un key es referencia a una sesión (UUID que se debe resolver)
function isSessionKey(key: string): boolean {
  return ["session_id", "shift_session_id", "new_session", "old_session", "migrated_from", "migrated_to"].includes(key);
}

function humanizeValue(key: string, value: any, nameMap?: NameMap): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";

  // Si es UUID, resolver a nombre
  if (typeof value === "string" && UUID_REGEX.test(value)) {
    if (nameMap?.has(value)) return nameMap.get(value)!;
    return "(cargando...)";
  }

  // Montos
  if (isAmountKey(key) && typeof value === "number") return `$${value.toFixed(2)}`;
  if (isAmountKey(key) && !isNaN(Number(value))) return `$${Number(value).toFixed(2)}`;

  // Enums conocidos
  if (key === "tolerance_type") return TOLERANCE_TYPES[value] || value;
  if (key === "new_status" || key === "previous_status" || key === "status") return STATUS_LABELS[value] || value;
  if (key === "payment_method") return PAYMENT_METHODS[value] || value;
  if (key === "payment_type") return STATUS_LABELS[value] || value;
  if (key === "concept") return CONCEPTS[value] || value;
  if (key === "is_weekend") return value ? "Sí (tarifa fin de semana)" : "No (tarifa entre semana)";

  // Horas y minutos
  if (["hours", "hours_deducted", "renewal_hours"].includes(key)) return `${value}h`;
  if (["minutes_elapsed", "minutes_remaining"].includes(key)) return `${value} min`;

  return String(value);
}

// Keys internos que no aportan valor al usuario final
const HIDDEN_KEYS = ["session_id", "stay_id", "sales_order_id", "item_id", "payment_id", "room_number", "room_id"];

function HumanizedDetails({ metadata, action, nameMap }: { metadata: Record<string, any>; action: string; nameMap?: NameMap }) {
  // Renderizar productos como lista especial
  if (metadata.products && Array.isArray(metadata.products)) {
    return (
      <div className="mt-1.5 space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">Productos incluidos:</p>
        <div className="space-y-1">
          {metadata.products.map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-[11px] bg-muted/40 px-2 py-1 rounded">
              <span>{p.qty}x {p.name} {p.is_courtesy ? <span className="text-purple-500 font-medium">(cortesía)</span> : ""}</span>
              <span className="font-mono font-medium">${(p.price * p.qty).toFixed(2)}</span>
            </div>
          ))}
        </div>
        {Object.entries(metadata)
          .filter(([k]) => k !== "products" && k !== "item_count" && !HIDDEN_KEYS.includes(k))
          .map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{METADATA_LABELS[k] || k}</span>
              <span className="font-medium text-foreground">{humanizeValue(k, v, nameMap)}</span>
            </div>
          ))}
      </div>
    );
  }

  // Renderizar campos normales como pares clave-valor legibles
  const entries = Object.entries(metadata).filter(([k]) => !HIDDEN_KEYS.includes(k));
  if (entries.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-0.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{METADATA_LABELS[key] || key}</span>
          <span className="font-medium text-foreground">{humanizeValue(key, value, nameMap)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────

const SEVERITY_DOTS: Record<string, string> = {
  CRITICAL: "bg-red-500 shadow-red-500/50",
  ERROR: "bg-orange-500 shadow-orange-500/50",
  WARNING: "bg-amber-400 shadow-amber-400/50",
  INFO: "bg-blue-400 shadow-blue-400/50",
  DEBUG: "bg-zinc-400 shadow-zinc-400/30",
};

const SEVERITY_BORDER: Record<string, string> = {
  CRITICAL: "border-l-red-500",
  ERROR: "border-l-orange-500",
  WARNING: "border-l-amber-400",
  INFO: "border-l-blue-400/50",
  DEBUG: "border-l-zinc-300 dark:border-l-zinc-700",
};

function LogRow({ log, nameMap }: { log: LogEntry; nameMap?: NameMap }) {
  const iconColor = ACTION_COLORS[log.action] || "bg-muted text-muted-foreground";
  const icon = ACTION_ICONS[log.action] || ACTION_ICONS[log.event_type] || <Clock className="h-4 w-4" />;
  const title = ACTION_TITLES[log.action] || log.action.replace(/_/g, " ");
  const dotColor = SEVERITY_DOTS[log.severity] || SEVERITY_DOTS.INFO;
  const borderColor = SEVERITY_BORDER[log.severity] || SEVERITY_BORDER.INFO;
  const hasDetails = log.metadata && Object.keys(log.metadata).filter(k => !HIDDEN_KEYS.includes(k)).length > 0;

  return (
    <div className={`flex gap-4 px-5 py-4 hover:bg-muted/20 transition-all duration-200 group border-b border-border/10 last:border-0 border-l-[3px] ${borderColor}`}>
      <div className="flex-shrink-0 pt-0.5">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${iconColor} ring-2 ring-background shadow-sm transition-transform group-hover:scale-105`}>
          {icon}
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-bold text-[13px] tracking-tight">{title}</span>
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${dotColor} shadow-[0_0_6px]`} />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{log.severity}</span>
            </div>
          </div>
          <time className="text-[10px] font-mono text-muted-foreground/70 whitespace-nowrap tabular-nums bg-muted/30 px-2 py-0.5 rounded-md">
            {format(new Date(log.created_at), "dd MMM · HH:mm:ss", { locale: es })}
          </time>
        </div>
        {log.description && (
          <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">{log.description}</p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {log.employee_name && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-violet-500/8 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full border border-violet-500/15">
              <User className="h-2.5 w-2.5" /> {log.employee_name}
            </span>
          )}
          {log.room_number && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-sky-500/8 text-sky-700 dark:text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/15">
              <Home className="h-2.5 w-2.5" /> Hab. {log.room_number}
            </span>
          )}
          {log.amount != null && log.amount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/15">
              ${Number(log.amount).toFixed(2)}
            </span>
          )}
          {log.payment_method && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-500/8 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/15">
              <CreditCard className="h-2.5 w-2.5" /> {PAYMENT_METHODS[log.payment_method] || log.payment_method}
            </span>
          )}
        </div>
        {hasDetails && (
          <details className="text-[11px] group/details">
            <summary className="cursor-pointer text-primary/50 hover:text-primary transition-colors font-medium inline-flex items-center gap-1 select-none">
              <ChevronDown className="h-3 w-3 transition-transform group-open/details:rotate-180" />
              Más información
            </summary>
            <div className="mt-2 p-3 bg-muted/30 rounded-lg border border-border/20">
              <HumanizedDetails metadata={log.metadata!} action={log.action} nameMap={nameMap} />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function LogsPage() {
  const { logs, stats, filters, loading, hasMore, nameMap, updateFilter, resetFilters, loadMore, refetch } = useLogCenter();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-primary/15 to-violet-500/20 flex items-center justify-center border border-primary/10 shadow-inner">
            <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-lg" />
            <Activity className="h-7 w-7 text-primary relative z-10" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-transparent">
              Registro de Actividad
            </h1>
            <p className="text-sm text-muted-foreground/70">
              Historial completo y unificado — todas las acciones del sistema
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-bold bg-emerald-500/5 text-emerald-600 border-emerald-500/20 px-3 py-1.5 hidden sm:flex">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Tiempo Real
          </Badge>
          <Button variant="outline" size="sm" onClick={refetch} className="gap-1.5 h-9 rounded-xl">
            <RotateCw className="h-3.5 w-3.5" /> Actualizar
          </Button>
        </div>
      </div>

      {/* ─── Category Tabs ─── */}
      <div className="flex gap-2 flex-wrap p-1 bg-muted/30 rounded-2xl border border-border/30 backdrop-blur-sm">
        {CATEGORY_CONFIGS.map(cat => {
          const count = typeof stats[cat.statKey] === "number" ? stats[cat.statKey] as number : 0;
          const isActive = filters.category === cat.key;
          return (
            <Button
              key={cat.key}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              onClick={() => updateFilter("category", cat.key)}
              className={`gap-1.5 h-9 rounded-xl text-xs font-semibold transition-all ${
                isActive ? "shadow-lg shadow-primary/25" : "hover:bg-muted/60 text-muted-foreground"
              }`}
            >
              {cat.icon}
              {cat.label}
              <span className={`text-[10px] tabular-nums font-mono px-1.5 py-0.5 rounded-md ${
                isActive ? "bg-primary-foreground/20" : "bg-muted"
              }`}>{count}</span>
            </Button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="space-y-5">
          <Card className="border-0 shadow-lg bg-background/80 backdrop-blur-xl ring-1 ring-border/20 overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent border-b border-border/30">
              <CardTitle className="text-sm flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Filter className="h-3.5 w-3.5 text-primary" />
                </div>
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em] mb-1.5 block">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/50" />
                  <Input
                    placeholder="Texto, empleado, acción..."
                    value={filters.search}
                    onChange={e => updateFilter("search", e.target.value)}
                    className="pl-9 h-9 text-xs rounded-xl border-border/30 focus:ring-2 focus:ring-primary/20 bg-muted/20"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em] mb-2 block">Severidad</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: "all", label: "Todas", dot: "bg-gradient-to-r from-blue-400 to-emerald-400" },
                    { value: "CRITICAL", label: "Crítico", dot: "bg-red-500" },
                    { value: "ERROR", label: "Error", dot: "bg-orange-500" },
                    { value: "WARNING", label: "Alerta", dot: "bg-amber-400" },
                    { value: "INFO", label: "Info", dot: "bg-blue-400" },
                    { value: "DEBUG", label: "Debug", dot: "bg-zinc-400" },
                  ].map(sev => {
                    const isActive = filters.severity === sev.value;
                    return (
                      <button
                        key={sev.value}
                        onClick={() => updateFilter("severity", sev.value)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                          isActive
                            ? "bg-foreground text-background shadow-md"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                        }`}
                      >
                        <div className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                        {sev.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em] mb-1.5 block">Habitación</label>
                <Input placeholder="Ej: 5" value={filters.roomNumber} onChange={e => updateFilter("roomNumber", e.target.value)} className="h-9 text-xs rounded-xl border-border/30 bg-muted/20" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em] mb-1.5 block">Desde</label>
                  <Input type="date" value={filters.dateFrom} onChange={e => updateFilter("dateFrom", e.target.value)} className="h-9 text-[10px] rounded-xl border-border/30 bg-muted/20" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.15em] mb-1.5 block">Hasta</label>
                  <Input type="date" value={filters.dateTo} onChange={e => updateFilter("dateTo", e.target.value)} className="h-9 text-[10px] rounded-xl border-border/30 bg-muted/20" />
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={resetFilters} className="w-full text-xs text-muted-foreground/60 hover:text-foreground rounded-xl h-8">
                Limpiar filtros
              </Button>
            </CardContent>
          </Card>

          {/* Top Employees — ranked with progress bars */}
          {stats.byEmployee.length > 0 && (
            <Card className="border-0 shadow-lg bg-background/80 backdrop-blur-xl ring-1 ring-border/20 overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-violet-500/5 to-transparent border-b border-border/30">
                <CardTitle className="text-sm flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-violet-500" />
                  </div>
                  Actividad por Empleado
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-2.5">
                {stats.byEmployee.map((emp, i) => {
                  const maxCount = stats.byEmployee[0]?.count || 1;
                  const pct = Math.round((emp.count / maxCount) * 100);
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-muted-foreground/50 w-4">{i + 1}.</span>
                          {emp.name}
                        </span>
                        <span className="text-[10px] font-bold tabular-nums text-primary">{emp.count}</span>
                      </div>
                      <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Log List */}
        <div className="lg:col-span-3">
          <Card className="border-0 shadow-xl bg-background/80 backdrop-blur-xl overflow-hidden ring-1 ring-border/30">
            <CardHeader className="pb-3 border-b border-border/30 bg-muted/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Registros
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md tabular-nums">
                    {logs.length} cargados
                  </span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-muted" />
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary absolute inset-0" />
                  </div>
                  <p className="text-xs text-muted-foreground animate-pulse">Cargando registros...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-24 text-muted-foreground">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Activity className="h-8 w-8 opacity-30" />
                  </div>
                  <p className="font-semibold text-sm">Sin registros</p>
                  <p className="text-xs mt-1 text-muted-foreground/60">No hay logs que coincidan con los filtros seleccionados</p>
                  <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4 text-xs">
                    Limpiar filtros
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[720px]">
                  <div className="divide-y-0">
                    {logs.map(log => <LogRow key={log.id} log={log} nameMap={nameMap} />)}
                  </div>
                  {hasMore && (
                    <div className="p-5 text-center border-t border-border/20">
                      <Button variant="outline" size="sm" onClick={loadMore} className="text-xs gap-1.5 rounded-xl h-9 px-6">
                        <ChevronDown className="h-3.5 w-3.5" /> Cargar más registros
                      </Button>
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
