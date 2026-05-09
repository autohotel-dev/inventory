"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield, Clock, CreditCard, AlertTriangle, User, Home, ShoppingBag,
  XCircle, Gift, RotateCcw, Timer, UserPlus, UserMinus, Wrench, Zap,
  DoorOpen, LogIn, LogOut, RefreshCw, Search, Filter, ChevronDown,
  Activity, Download, RotateCw, CalendarDays, X, Eye, ArrowRight, GitCompare,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { LogEntry, LogFilters, LogStats, NameMap, ActionStat, EmployeeStat, HourStat } from "@/hooks/use-log-center";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Dictionaries ────────────────────────────────────────────────────

export const ACTION_ICONS: Record<string, React.ReactNode> = {
  CANCEL_ITEM: <XCircle className="h-3.5 w-3.5" />, CANCEL_CHARGE: <XCircle className="h-3.5 w-3.5" />,
  COURTESY: <Gift className="h-3.5 w-3.5" />, RENEWAL: <RotateCcw className="h-3.5 w-3.5" />,
  EXTRA_HOUR: <Timer className="h-3.5 w-3.5" />, EXTRA_PERSON: <UserPlus className="h-3.5 w-3.5" />,
  PROMO_4H: <Zap className="h-3.5 w-3.5" />, DAMAGE_CHARGE: <Wrench className="h-3.5 w-3.5" />,
  CHECKOUT: <DoorOpen className="h-3.5 w-3.5" />, CHECKOUT_REVIEW: <Eye className="h-3.5 w-3.5" />,
  ADD_PERSON: <UserPlus className="h-3.5 w-3.5" />, REMOVE_PERSON: <UserMinus className="h-3.5 w-3.5" />,
  TOLERANCE: <Timer className="h-3.5 w-3.5" />, CONSUMPTION_ADDED: <ShoppingBag className="h-3.5 w-3.5" />,
  PAYMENT_METHOD_CHANGE: <CreditCard className="h-3.5 w-3.5" />, UPDATE: <Home className="h-3.5 w-3.5" />,
  LOGIN: <LogIn className="h-3.5 w-3.5" />, LOGOUT: <LogOut className="h-3.5 w-3.5" />,
  LOGIN_FAILED: <AlertTriangle className="h-3.5 w-3.5" />, INSERT: <RefreshCw className="h-3.5 w-3.5" />,
  DELETE: <XCircle className="h-3.5 w-3.5" />, PURGE_SYSTEM: <AlertTriangle className="h-3.5 w-3.5" />,
};

export const ACTION_TITLES: Record<string, string> = {
  CANCEL_ITEM: "Item Cancelado", CANCEL_CHARGE: "Cargo Cancelado",
  COURTESY: "Cortesía", RENEWAL: "Renovación", EXTRA_HOUR: "Hora Extra",
  EXTRA_PERSON: "Persona Extra", PROMO_4H: "Promo 4H", DAMAGE_CHARGE: "Daño",
  CHECKOUT: "Check-out", CHECKOUT_REVIEW: "Revisión Salida", ADD_PERSON: "Persona +",
  REMOVE_PERSON: "Persona -", TOLERANCE: "Tolerancia", CONSUMPTION_ADDED: "Consumo",
  UPDATE: "Actualización", PAYMENT_METHOD_CHANGE: "Cambio Pago",
  LOGIN: "Login", LOGOUT: "Logout", LOGIN_FAILED: "Login Fallido",
  INSERT: "Creado", DELETE: "Eliminado", PURGE_SYSTEM: "Purga", MAINTENANCE: "Mantenimiento",
};

const ACTION_COLORS: Record<string, string> = {
  CANCEL_ITEM: "bg-red-500/15 text-red-400", CANCEL_CHARGE: "bg-red-500/15 text-red-400",
  COURTESY: "bg-purple-500/15 text-purple-400", RENEWAL: "bg-blue-500/15 text-blue-400",
  EXTRA_HOUR: "bg-amber-500/15 text-amber-400", EXTRA_PERSON: "bg-teal-500/15 text-teal-400",
  PROMO_4H: "bg-indigo-500/15 text-indigo-400", DAMAGE_CHARGE: "bg-orange-500/15 text-orange-400",
  CHECKOUT: "bg-emerald-500/15 text-emerald-400", CHECKOUT_REVIEW: "bg-cyan-500/15 text-cyan-400",
  ADD_PERSON: "bg-sky-500/15 text-sky-400", REMOVE_PERSON: "bg-slate-500/15 text-slate-400",
  TOLERANCE: "bg-yellow-500/15 text-yellow-400", CONSUMPTION_ADDED: "bg-lime-500/15 text-lime-400",
  LOGIN: "bg-green-500/15 text-green-400", LOGOUT: "bg-gray-500/15 text-gray-400",
  LOGIN_FAILED: "bg-red-500/15 text-red-400", PURGE_SYSTEM: "bg-red-500/15 text-red-400",
};

const SEVERITY_BORDER: Record<string, string> = {
  CRITICAL: "border-l-red-500", ERROR: "border-l-orange-500",
  WARNING: "border-l-amber-400", INFO: "border-l-blue-400/40", DEBUG: "border-l-zinc-700",
};

const SEVERITY_DOTS: Record<string, string> = {
  CRITICAL: "bg-red-500", ERROR: "bg-orange-500", WARNING: "bg-amber-400",
  INFO: "bg-blue-400", DEBUG: "bg-zinc-400",
};

// ─── Metadata Humanizer ──────────────────────────────────────────────

const METADATA_LABELS: Record<string, string> = {
  room_number: "Habitación", room_id: "Habitación", stay_id: "Estancia",
  amount: "Monto", total_amount: "Monto total", remaining: "Saldo restante",
  paid_amount: "Monto pagado", total: "Total", subtotal: "Subtotal",
  payment_method: "Método de pago", concept: "Concepto", reference: "Referencia",
  folio: "Folio", card_last_4: "Últimos 4 dígitos", terminal_code: "Terminal",
  employee_id: "Empleado", corrected_by: "Corregido por", confirmed_by: "Confirmado por",
  created_by: "Creado por", collector_name: "Cobrador", valet_id: "Cochero",
  action_by: "Realizado por", action_by_name: "Realizado por",
  session_id: "Turno", shift_session_id: "Turno",
  sales_order_id: "Orden", item_id: "Artículo", payment_id: "Pago",
  reason: "Motivo", hours: "Horas", is_courtesy: "¿Cortesía?",
  courtesy_reason: "Motivo cortesía", previous_people: "Personas antes",
  new_people: "Personas después", status: "Estado", new_status: "Nuevo estado",
  previous_status: "Estado anterior", notes: "Notas", error: "Error",
  hours_deducted: "Horas descontadas", tolerance_type: "Tipo tolerancia",
  minutes_elapsed: "Min. transcurridos", minutes_remaining: "Min. restantes",
};

const HIDDEN_KEYS = ["session_id", "stay_id", "sales_order_id", "item_id", "payment_id", "room_number", "room_id"];

const STATUS_LABELS: Record<string, string> = {
  LIBRE: "Libre", OCUPADA: "Ocupada", SUCIA: "Sucia", BLOQUEADA: "Bloqueada",
  PAGADO: "Pagado", PENDIENTE: "Pendiente", COBRADO_POR_VALET: "Cobrado por cochero",
};

const PAYMENT_METHODS: Record<string, string> = {
  EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia", PENDIENTE: "Pendiente", MIXTO: "Mixto",
};

function isAmountKey(key: string): boolean {
  return ["amount", "total_amount", "remaining", "paid_amount", "total", "subtotal"].includes(key);
}

function humanizeValue(key: string, value: any, nameMap?: NameMap): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string" && UUID_REGEX.test(value) && nameMap?.has(value)) return nameMap.get(value)!;
  if (isAmountKey(key) && !isNaN(Number(value))) return `$${Number(value).toFixed(2)}`;
  if (["new_status", "previous_status", "status"].includes(key)) return STATUS_LABELS[value] || value;
  if (key === "payment_method") return PAYMENT_METHODS[value] || value;
  if (["hours", "hours_deducted"].includes(key)) return `${value}h`;
  if (["minutes_elapsed", "minutes_remaining"].includes(key)) return `${value} min`;
  return String(value);
}

// ─── Sub-Components ──────────────────────────────────────────────────

export function HumanizedDetails({ metadata, nameMap }: { metadata: Record<string, any>; nameMap?: NameMap }) {
  if (metadata.products && Array.isArray(metadata.products)) {
    return (
      <div className="mt-1.5 space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">Productos:</p>
        {metadata.products.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-[11px] bg-muted/40 px-2 py-1 rounded">
            <span>{p.qty}x {p.name} {p.is_courtesy ? <span className="text-purple-400">(cortesía)</span> : ""}</span>
            <span className="font-mono font-medium">${(p.price * p.qty).toFixed(2)}</span>
          </div>
        ))}
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

// ─── Diff View ───────────────────────────────────────────────────────

function DiffView({ oldData, newData, changedFields, nameMap }: {
  oldData: Record<string, any>;
  newData: Record<string, any>;
  changedFields?: string[];
  nameMap?: NameMap;
}) {
  const fields = changedFields || Object.keys(newData).filter(k => {
    return JSON.stringify(oldData[k]) !== JSON.stringify(newData[k]);
  });

  const displayFields = fields.filter(k => !HIDDEN_KEYS.includes(k));
  if (displayFields.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1">
        <GitCompare className="h-3 w-3" />
        Cambios detectados
      </div>
      {displayFields.map(field => {
        const oldVal = humanizeValue(field, oldData[field], nameMap);
        const newVal = humanizeValue(field, newData[field], nameMap);
        return (
          <div key={field} className="flex items-center gap-2 text-[11px] bg-muted/20 px-2.5 py-1.5 rounded-lg">
            <span className="text-muted-foreground/60 min-w-[80px] shrink-0">{METADATA_LABELS[field] || field}</span>
            <span className="text-red-400/80 line-through font-mono text-[10px]">{oldVal}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
            <span className="text-emerald-400 font-semibold font-mono text-[10px]">{newVal}</span>
          </div>
        );
      })}
    </div>
  );
}

interface LogRowProps {
  log: LogEntry;
  nameMap?: NameMap;
  onFilterEmployee?: (id: string) => void;
  onFilterRoom?: (room: string) => void;
}

export function LogRow({ log, nameMap, onFilterEmployee, onFilterRoom }: LogRowProps) {
  const iconColor = ACTION_COLORS[log.action] || "bg-muted text-muted-foreground";
  const icon = ACTION_ICONS[log.action] || ACTION_ICONS[log.event_type] || <Clock className="h-3.5 w-3.5" />;
  const title = ACTION_TITLES[log.action] || log.action.replace(/_/g, " ");
  const dotColor = SEVERITY_DOTS[log.severity] || SEVERITY_DOTS.INFO;
  const borderColor = SEVERITY_BORDER[log.severity] || SEVERITY_BORDER.INFO;
  const hasDetails = log.metadata && Object.keys(log.metadata).filter(k => !HIDDEN_KEYS.includes(k)).length > 0;
  const hasDiff = log.old_data && log.new_data && Object.keys(log.old_data).length > 0;

  return (
    <div className={`group relative flex gap-3 px-4 py-3.5 hover:bg-muted/20 transition-all border-b border-border/5 border-l-[3px] ${borderColor}`}>
      {/* Timeline dot */}
      <div className="absolute left-[29px] top-0 bottom-0 w-px bg-border/20 group-last:hidden" />
      <div className="flex-shrink-0 relative z-10 pt-0.5">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconColor} ring-2 ring-background shadow-sm`}>
          {icon}
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[13px] tracking-tight">{title}</span>
            <div className="flex items-center gap-1">
              <div className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
              <span className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wider">{log.severity}</span>
            </div>
          </div>
          <time className="text-[10px] font-mono text-muted-foreground/50 whitespace-nowrap tabular-nums">
            {format(new Date(log.created_at), "dd MMM · HH:mm:ss", { locale: es })}
          </time>
        </div>
        {log.description && (
          <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2">{log.description}</p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {log.employee_name && (
            <button
              onClick={() => log.employee_id && onFilterEmployee?.(log.employee_id)}
              className="inline-flex items-center gap-1 text-[10px] font-medium bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full border border-violet-500/15 hover:bg-violet-500/20 hover:border-violet-500/30 transition-all cursor-pointer"
            >
              <User className="h-2.5 w-2.5" /> {log.employee_name}
            </button>
          )}
          {log.room_number && (
            <button
              onClick={() => onFilterRoom?.(log.room_number!)}
              className="inline-flex items-center gap-1 text-[10px] font-medium bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full border border-sky-500/15 hover:bg-sky-500/20 hover:border-sky-500/30 transition-all cursor-pointer"
            >
              <Home className="h-2.5 w-2.5" /> Hab. {log.room_number}
            </button>
          )}
          {log.amount != null && log.amount > 0 && (
            <span className="inline-flex items-center text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/15">
              ${Number(log.amount).toFixed(2)}
            </span>
          )}
          {log.payment_method && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/15">
              <CreditCard className="h-2.5 w-2.5" /> {PAYMENT_METHODS[log.payment_method] || log.payment_method}
            </span>
          )}
        </div>
        {(hasDetails || hasDiff) && (
          <details className="text-[11px] group/d">
            <summary className="cursor-pointer text-primary/40 hover:text-primary transition-colors font-medium inline-flex items-center gap-1 select-none">
              <ChevronDown className="h-3 w-3 transition-transform group-open/d:rotate-180" />
              {hasDiff ? "Ver cambios" : "Detalles"}
            </summary>
            <div className="mt-2 p-3 bg-muted/20 rounded-lg border border-border/10 space-y-3">
              {hasDiff && (
                <DiffView oldData={log.old_data!} newData={log.new_data!} changedFields={log.changed_fields} nameMap={nameMap} />
              )}
              {hasDetails && <HumanizedDetails metadata={log.metadata!} nameMap={nameMap} />}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export function MiniSparkline({ data, maxHeight = 24 }: { data: HourStat[]; maxHeight?: number }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const hours = Array.from({ length: 24 }, (_, i) => {
    const found = data.find(d => d.hour === i);
    return found ? found.count : 0;
  });

  return (
    <div className="flex items-end gap-px h-6" title="Actividad por hora">
      {hours.map((count, i) => (
        <div
          key={i}
          className="flex-1 bg-primary/30 rounded-t-sm min-w-[2px] transition-all hover:bg-primary/60"
          style={{ height: `${Math.max((count / max) * maxHeight, 1)}px` }}
          title={`${i}:00 — ${count} eventos`}
        />
      ))}
    </div>
  );
}

export function ActiveFilters({ filters, updateFilter, resetFilters, stats }: {
  filters: LogFilters;
  updateFilter: (key: keyof LogFilters, value: string) => void;
  resetFilters: () => void;
  stats: LogStats;
}) {
  const chips: { label: string; onRemove: () => void }[] = [];

  if (filters.employeeId) {
    const emp = stats.byEmployee.find(e => e.id === filters.employeeId);
    chips.push({ label: `👤 ${emp?.name || "Empleado"}`, onRemove: () => updateFilter("employeeId", "") });
  }
  if (filters.roomNumber) chips.push({ label: `🏠 Hab. ${filters.roomNumber}`, onRemove: () => updateFilter("roomNumber", "") });
  if (filters.actionType) chips.push({ label: `⚡ ${ACTION_TITLES[filters.actionType] || filters.actionType}`, onRemove: () => updateFilter("actionType", "") });
  if (filters.severity !== "all") chips.push({ label: `🔸 ${filters.severity}`, onRemove: () => updateFilter("severity", "all") });
  if (filters.search) chips.push({ label: `🔍 "${filters.search}"`, onRemove: () => updateFilter("search", "") });

  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">Filtros:</span>
      {chips.map((chip, i) => (
        <button
          key={i}
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1 text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/15 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/20 transition-all group/chip"
        >
          {chip.label}
          <X className="h-2.5 w-2.5 opacity-50 group-hover/chip:opacity-100" />
        </button>
      ))}
      <button onClick={resetFilters} className="text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors ml-1">
        Limpiar todo
      </button>
    </div>
  );
}
