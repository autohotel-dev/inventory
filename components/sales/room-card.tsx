"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Info, MoreVertical, AlertCircle, Car, Check } from "lucide-react";

export type RoomCardStatus = "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA" | string;

// Configuración de tipos de habitación con abreviatura y color
const ROOM_TYPE_CONFIG: Record<string, { abbr: string; color: string }> = {
  "Sencilla": { abbr: "SEN", color: "bg-slate-500" },
  "Jacuzzi": { abbr: "JAC", color: "bg-pink-500" },
  "Jacuzzi y Sauna": { abbr: "J&S", color: "bg-purple-600" },
  "Alberca": { abbr: "ALB", color: "bg-cyan-600" },
  "Torre": { abbr: "TRE", color: "bg-indigo-500" },
};

// Obtener config de tipo de habitación (con fallback inteligente)
function getRoomTypeConfig(typeName: string | undefined): { abbr: string; color: string } {
  // Robust check to prevent "substring of undefined" error
  const safeTypeName = (typeName && typeof typeName === 'string') ? typeName :
    (typeName ? String(typeName) : "");

  if (!safeTypeName || safeTypeName.length === 0) {
    return { abbr: "---", color: "bg-slate-600" };
  }

  // Buscar coincidencia exacta
  if (ROOM_TYPE_CONFIG[safeTypeName]) {
    return ROOM_TYPE_CONFIG[safeTypeName];
  }

  // Buscar coincidencia parcial (ej: "Habitación Sencilla" -> "Sencilla")
  const lowerName = safeTypeName.toLowerCase();
  for (const [key, config] of Object.entries(ROOM_TYPE_CONFIG)) {
    if (lowerName.includes(key.toLowerCase())) {
      return config;
    }
  }

  // Fallback: usar primeras 3 letras
  return {
    abbr: safeTypeName.substring(0, 3).toUpperCase(),
    color: "bg-slate-600"
  };
}

export interface RoomCardProps {
  id: string;
  number: string;
  status: RoomCardStatus;
  bgClass: string;
  accentClass?: string;
  statusBadge: ReactNode;
  hasPendingPayment?: boolean; // Indica si tiene pago pendiente
  roomTypeName?: string; // Nombre del tipo de habitación (Sencilla, Jacuzzi, etc)
  notes?: string | null; // Notas de mantenimiento o bloqueo
  sensorStatus?: { isOpen: boolean; batteryLevel?: number; isOnline: boolean } | null;
  vehicleStatus?: {
    hasVehicle: boolean;
    isReady: boolean;
    plate?: string;
    model?: string;
    brand?: string;
    isWaitingAuthorization?: boolean;
  } | null;
  isValetPending?: boolean; // New prop for strict workflow
  onInfo: () => void;
  onActions: () => void;
}

export function RoomCard({
  number,
  status,
  bgClass,
  accentClass,
  statusBadge,
  hasPendingPayment,
  roomTypeName,
  notes,
  sensorStatus,
  vehicleStatus,
  isValetPending,
  onInfo,
  onActions,
}: RoomCardProps) {
  /* FIX: Solo alertar si la puerta está abierta Y la habitación está OCUPADA */
  const isDoorOpen = sensorStatus?.isOpen;
  const showDoorAlert = isDoorOpen && status === "OCUPADA";

  // Clases dinámicas para alerta de puerta abierta
  const containerClasses = showDoorAlert
    ? "bg-red-950/90 border-red-500 ring-4 ring-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse z-20 scale-105 transition-transform duration-300"
    : `${bgClass || "bg-slate-900/80"} ${accentClass || ""} ${hasPendingPayment ? "ring-2 ring-amber-500/50" : "border-white/5 hover:border-white/20"}`;

  return (
    <div
      id="tour-room-card"
      data-room-status={status}
      data-room-number={number}
      className={`relative rounded-lg p-2 text-sm flex flex-col min-h-[82px] h-auto cursor-pointer shadow-sm hover:shadow-md border transition-colors duration-200 ${containerClasses}`}
    >
      {/* Indicador de pago pendiente (Solo si NO está la alerta de puerta para no saturar) */}
      {hasPendingPayment && !showDoorAlert && (
        <div className="absolute -top-1.5 -right-1.5 bg-amber-500 rounded-full p-0.5 animate-pulse" title="Pago pendiente">
          <AlertCircle className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Indicador de Valet Pendiente (Workflow Estricto) - Bloqueo Visual */}
      {isValetPending && !showDoorAlert && (
        <>
          <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-[1px] rounded-lg border-2 border-orange-500/50 flex flex-col items-center justify-center animate-pulse cursor-not-allowed group-hover:bg-background/60 transition-colors">
            <span className="bg-orange-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm">
              Esperando Cochero
            </span>
          </div>
          <div className="absolute -top-1.5 -right-1.5 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 ring-2 ring-background animate-pulse" title="Esperando registro de vehículo por Valet">
            <span className="h-2 w-2 rounded-full bg-white" />
          </div>
        </>
      )}

      {/* Indicador de Sensor (Puerta Abierta) - Solo si está ocupada */}
      {showDoorAlert && (
        <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-red-400 z-30 animate-bounce">
          ¡PUERTA ABIERTA!
        </div>
      )}

      {/* Indicador de Valet solicitando salida (Notificación del cochero) */}
      {vehicleStatus?.isWaitingAuthorization && !showDoorAlert && (
        <div className="absolute -top-2 -left-2 bg-amber-600 text-white p-1 rounded-md shadow-lg border border-amber-400 z-30 animate-pulse" title="Valet avisa que el cliente está saliendo">
          <Car className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Fila superior: Número + Estado */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-bold text-lg leading-none">{number}</span>

          {/* Indicador de Vehículo */}
          {vehicleStatus?.hasVehicle && (
            <div className="relative group/vehicle">
              <div
                className={`flex items-center justify-center h-5 w-5 rounded-md shadow-sm border cursor-help ${vehicleStatus.isReady
                  ? "bg-emerald-500 border-emerald-400 text-white animate-pulse"
                  : "bg-blue-600 border-blue-500 text-white"
                  }`}
              >
                <Car className="h-3 w-3" />
              </div>

              {/* Rich Tooltip (Premium Modern Dark) */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 opacity-0 invisible group-hover/vehicle:opacity-100 group-hover/vehicle:visible transition-all duration-300 z-50 pointer-events-none transform group-hover/vehicle:-translate-y-1">
                <div className="bg-[#0a0a0a] text-white text-xs rounded-xl shadow-2xl border border-white/10 p-0 overflow-hidden ring-1 ring-white/5 relative">
                  {/* Subtle Gradient Glow at top */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-70"></div>

                  <div className="p-3.5 flex flex-col gap-3">
                    {/* Header */}
                    <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
                      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 rounded-lg shadow-lg shadow-indigo-500/20">
                        <Car className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold tracking-tight text-sm text-white">Vehículo</span>
                        <span className="text-[10px] text-zinc-500 font-medium">Detalles Registrados</span>
                      </div>
                    </div>

                    {/* Grid Info */}
                    <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
                        <span className="font-medium">Marca</span>
                      </div>
                      <span className="font-medium text-zinc-300 truncate tracking-wide">{vehicleStatus.brand || '---'}</span>

                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
                        <span className="font-medium">Modelo</span>
                      </div>
                      <span className="font-medium text-zinc-300 truncate tracking-wide">{vehicleStatus.model || '---'}</span>

                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <div className="w-1 h-1 rounded-full bg-indigo-500/50 shadow-[0_0_5px_rgba(99,102,241,0.5)]"></div>
                        <span className="font-medium text-indigo-300">Placa</span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 blur-sm rounded"></div>
                        <span className="relative font-mono font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/10 w-fit block shadow-sm tracking-wider">
                          {vehicleStatus.plate || '---'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Flechita decorativa */}
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0a0a0a] border-r border-b border-white/10 rotate-45 transform"></div>
                </div>
              </div>
            </div>
          )}
        </div>
        {statusBadge}
      </div>

      {/* Fila inferior: Tipo + Botones */}
      <div className="flex items-center justify-between mt-auto">
        {/* Badge de tipo de habitación */}
        {roomTypeName ? (
          <span
            className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${getRoomTypeConfig(roomTypeName).color} text-white`}
            title={roomTypeName}
          >
            {getRoomTypeConfig(roomTypeName).abbr}
          </span>
        ) : (
          <span />
        )}

        {/* Indicador de notas */}
        {notes && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 group" title={notes}>
            <div className="bg-yellow-500/20 text-yellow-200 text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/30 max-w-[120px] truncate cursor-help">
              {notes}
            </div>
          </div>
        )}

        {/* Botones de acción (ocultos si hay alerta para limpieza visual, o mantenidos con z-index alto) */}
        <div className="flex items-center gap-0.5 z-20">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onInfo();
            }}
            aria-label={`Información habitación ${number}`}
          >
            <Info className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onActions();
            }}
            aria-label={`Acciones habitación ${number}`}
          >
            <MoreVertical className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
