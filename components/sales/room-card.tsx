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
    isWaitingAuthorization?: boolean;
  } | null;
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
  onInfo,
  onActions,
}: RoomCardProps) {
  const isDoorOpen = sensorStatus?.isOpen;

  // Clases dinámicas para alerta de puerta abierta
  const containerClasses = isDoorOpen
    ? "bg-red-950/90 border-red-500 ring-4 ring-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse z-20 scale-105 transition-all duration-300"
    : `${bgClass || "bg-slate-900/80"} ${accentClass || ""} ${hasPendingPayment ? "ring-2 ring-amber-500/50" : "border-white/5 hover:border-white/20"}`;

  return (
    <div
      id="tour-room-card"
      data-room-status={status}
      data-room-number={number}
      className={`relative rounded-lg p-2 text-sm flex flex-col min-h-[82px] h-auto cursor-pointer backdrop-blur-sm shadow-sm hover:shadow-md border transition-all ${containerClasses}`}
    >
      {/* Indicador de pago pendiente (Solo si NO está la puerta abierta para no saturar) */}
      {hasPendingPayment && !isDoorOpen && (
        <div className="absolute -top-1.5 -right-1.5 bg-amber-500 rounded-full p-0.5 animate-pulse" title="Pago pendiente">
          <AlertCircle className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Indicador de Sensor (Puerta Abierta) */}
      {isDoorOpen && (
        <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-red-400 z-30 animate-bounce">
          ¡PUERTA ABIERTA!
        </div>
      )}

      {/* Indicador de Valet solicitando salida (Notificación del cochero) */}
      {vehicleStatus?.isWaitingAuthorization && !isDoorOpen && (
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
            <div
              className={`flex items-center justify-center h-5 w-5 rounded-md shadow-sm border ${vehicleStatus.isReady
                ? "bg-emerald-500 border-emerald-400 text-white animate-pulse"
                : "bg-blue-600 border-blue-500 text-white"
                }`}
              title={vehicleStatus.isReady ? `Auto listo! Placa: ${vehicleStatus.plate}` : `Auto en custodia. Placa: ${vehicleStatus.plate}`}
            >
              <Car className="h-3 w-3" />
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
