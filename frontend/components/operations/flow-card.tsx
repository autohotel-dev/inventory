"use client";

import { OperationFlow } from "@/hooks/use-realtime-operations";
import { formatFlowId, formatElapsedTime } from "@/hooks/use-flow-timeline";

// ─── Stage Display Config ────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  ROOM_ASSIGNED: "Habitación Asignada",
  ROOM_STATUS_CHANGED: "Estado Cambiado",
  ROOM_CHANGED: "Cambio de Habitación",
  VALET_ENTRY_ACCEPTED: "Cochero Asignado",
  VALET_VEHICLE_REGISTERED: "Vehículo Registrado",
  VALET_PAYMENT_COLLECTED: "Cobro por Cochero",
  VALET_CHECKOUT_PROPOSED: "Salida Propuesta",
  VALET_CHECKOUT_CONFIRMED: "Salida Confirmada",
  CLIENT_DATA_FILLED: "Datos de Cliente",
  VEHICLE_DATA_FILLED: "Datos de Vehículo",
  PERSON_COUNT_UPDATED: "Conteo Actualizado",
  PAYMENT_PENDING_CREATED: "Pago Pendiente",
  PAYMENT_COLLECTED_VALET: "Cobro Valet",
  PAYMENT_CORROBORATED: "Pago Corroborado",
  PAYMENT_CONFIRMED: "Pago Confirmado",
  PAYMENT_METHOD_CHANGED: "Método Cambiado",
  PAYMENT_CANCELLED: "Pago Cancelado",
  PAYMENT_REFUNDED: "Reembolso",
  CONSUMPTION_ADDED: "Consumo Agregado",
  CONSUMPTION_ACCEPTED: "Consumo Aceptado",
  CONSUMPTION_DELIVERED: "Consumo Entregado",
  CONSUMPTION_PAID: "Consumo Pagado",
  CONSUMPTION_CANCELLED: "Consumo Cancelado",
  EXTRA_HOUR_ADDED: "Hora Extra",
  EXTRA_PERSON_ADDED: "Persona Extra",
  DAMAGE_REPORTED: "Daño Reportado",
  CHECKOUT_INITIATED: "Checkout Iniciado",
  CHECKOUT_COMPLETED: "Checkout Completado",
  TOLERANCE_STARTED: "Tolerancia Activa",
  COURTESY_APPLIED: "Cortesía",
  RENEWAL_APPLIED: "Renovación",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVO:
    "bg-blue-500/15 text-blue-400 border-blue-500/30 shadow-blue-500/10 shadow-sm",
  COMPLETADO:
    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  CANCELADO:
    "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVO: "Activo",
  COMPLETADO: "Completado",
  CANCELADO: "Cancelado",
};

// ─── Component ───────────────────────────────────────────────────────────────

interface FlowCardProps {
  flow: OperationFlow;
  onSelect: (flowId: string) => void;
  isSelected?: boolean;
}

export function FlowCard({ flow, onSelect, isSelected }: FlowCardProps) {
  const elapsed = formatElapsedTime(flow.started_at);
  const stageLabel = STAGE_LABELS[flow.current_stage] || flow.current_stage;
  const isActive = flow.status === "ACTIVO";

  return (
    <button
      type="button"
      onClick={() => onSelect(flow.id)}
      className={`
        group w-full text-left rounded-xl border p-4 transition-all duration-300
        hover:scale-[1.01] hover:shadow-lg cursor-pointer
        ${
          isSelected
            ? "ring-2 ring-blue-500/50 border-blue-500/40 bg-blue-500/5"
            : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
        }
        ${isActive ? "hover:shadow-blue-500/5" : ""}
      `}
    >
      {/* Top Row: ID + Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-sm font-bold text-foreground/90 tracking-wider">
            {formatFlowId(flow.flow_number)}
          </span>
          {isActive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
          )}
        </div>

        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
            STATUS_STYLES[flow.status] || STATUS_STYLES.ACTIVO
          }`}
        >
          {STATUS_LABELS[flow.status] || flow.status}
        </span>
      </div>

      {/* Room Number */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🏨</span>
        <span className="text-base font-semibold text-foreground/80">
          Hab. {flow.room_number}
        </span>
      </div>

      {/* Current Stage */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
        <span className="text-xs text-muted-foreground/70 truncate">
          {stageLabel}
        </span>
      </div>

      {/* Bottom Row: Time + Last Actor */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground/50">
        <div className="flex items-center gap-1.5">
          <span>⏱️</span>
          <span className="tabular-nums">{elapsed}</span>
        </div>

        {flow.events?.length ? (() => {
          const lastActor = flow.events[flow.events.length - 1]?.actor_name;
          return lastActor ? (
            <span className="truncate max-w-[120px]">
              👤 {lastActor}
            </span>
          ) : null;
        })() : null}

        <span className="tabular-nums">
          {new Date(flow.started_at).toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Completed time */}
      {flow.completed_at && (
        <div className="mt-2 pt-2 border-t border-white/[0.04] text-[10px] text-muted-foreground/40 text-right">
          Finalizado:{" "}
          {new Date(flow.completed_at).toLocaleString("es-MX", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
    </button>
  );
}
