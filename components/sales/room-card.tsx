"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Info, MoreVertical, AlertCircle } from "lucide-react";

export type RoomCardStatus = "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA" | string;

// Configuración de tipos de habitación con abreviatura y color
const ROOM_TYPE_CONFIG: Record<string, { abbr: string; color: string }> = {
  "Sencilla": { abbr: "SEN", color: "bg-slate-500" },
  "Doble": { abbr: "DBL", color: "bg-blue-500" },
  "Jacuzzi": { abbr: "JAC", color: "bg-pink-500" },
  "Suite": { abbr: "STE", color: "bg-amber-500" },
  "Torre": { abbr: "TRE", color: "bg-cyan-500" },
  "Hotel": { abbr: "HTL", color: "bg-indigo-500" },
  "VIP": { abbr: "VIP", color: "bg-yellow-500" },
  "Familiar": { abbr: "FAM", color: "bg-green-500" },
  "Económica": { abbr: "ECO", color: "bg-gray-500" },
};

// Obtener config de tipo de habitación (con fallback inteligente)
function getRoomTypeConfig(typeName: string | undefined): { abbr: string; color: string } {
  if (!typeName) return { abbr: "---", color: "bg-slate-600" };
  
  // Buscar coincidencia exacta
  if (ROOM_TYPE_CONFIG[typeName]) {
    return ROOM_TYPE_CONFIG[typeName];
  }
  
  // Buscar coincidencia parcial (ej: "Habitación Sencilla" -> "Sencilla")
  const lowerName = typeName.toLowerCase();
  for (const [key, config] of Object.entries(ROOM_TYPE_CONFIG)) {
    if (lowerName.includes(key.toLowerCase())) {
      return config;
    }
  }
  
  // Fallback: usar primeras 3 letras
  return { 
    abbr: typeName.substring(0, 3).toUpperCase(), 
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
  onInfo,
  onActions,
}: RoomCardProps) {
  return (
    <div
      className={`relative border border-white/5 rounded-lg p-2 text-sm flex flex-col h-[72px] cursor-pointer shadow-sm hover:shadow-md hover:border-white/20 backdrop-blur-sm transition-colors ${
        bgClass || "bg-slate-900/80"
      } ${accentClass || ""} ${hasPendingPayment ? "ring-2 ring-amber-500/50" : ""}`}
    >
      {/* Indicador de pago pendiente */}
      {hasPendingPayment && (
        <div className="absolute -top-1.5 -right-1.5 bg-amber-500 rounded-full p-0.5 animate-pulse" title="Pago pendiente">
          <AlertCircle className="h-3 w-3 text-white" />
        </div>
      )}
      
      {/* Fila superior: Número + Estado */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-lg leading-none">{number}</span>
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
        
        {/* Botones de acción */}
        <div className="flex items-center gap-0.5">
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
