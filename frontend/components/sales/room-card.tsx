"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Info, MoreVertical, AlertCircle, Car, Check, HandPlatter, ShoppingBag, ConciergeBell, XCircle, Tv, Flame, Wind, Lock, Sparkles, CheckCircle2, User, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

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
  hasPendingService?: boolean; // Indica si hay consumos pendientes de entrega
  isCriticalService?: boolean; // Indica si el servicio lleva más de 15 min pendiente
  valetId?: string | null; // For debugging
  onInfo: () => void;
  onActions: () => void;
  onAddProduct?: () => void;
  onViewServices?: () => void;
  onCancelStay?: () => void;
  tvRemoteStatus?: string; // e.g. PENDIENTE_ENCENDIDO, TV_ENCENDIDA, EN_HABITACION, EXTRAVIADO
  onAssignRemote?: () => void;
}

import { memo } from "react";

export function RoomCardComponent({
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
  hasPendingService,
  isCriticalService,
  valetId,
  onInfo,
  onActions,
  onAddProduct,
  onViewServices,
  onCancelStay,
  tvRemoteStatus,
  onAssignRemote,
}: RoomCardProps) {
  /* FIX: Solo alertar si la puerta está abierta Y la habitación está OCUPADA */
  const isDoorOpen = sensorStatus?.isOpen;
  const showDoorAlert = isDoorOpen && status === "OCUPADA";

  // Clases dinámicas para alerta de puerta abierta
  const containerClasses = showDoorAlert
    ? "bg-red-950/90 border-red-500 ring-4 ring-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse z-20 scale-105 transition-transform duration-300"
    : `${bgClass || "bg-white/5 dark:bg-black/40"} ${accentClass || ""} ${hasPendingPayment ? "ring-2 ring-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]" : "border-white/20 dark:border-white/10 hover:border-white/40 dark:hover:border-white/20"}`;

  return (
    <div
      id="tour-room-card"
      data-room-status={status}
      data-room-number={number}
      className={`relative rounded-xl p-3 text-sm flex flex-col min-h-[90px] h-auto cursor-pointer shadow-lg hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:hover:shadow-[0_8px_30px_rgba(255,255,255,0.04)] backdrop-blur-xl border transition-all duration-300 ease-out hover:-translate-y-1 ${containerClasses} group/card`}
    >
      {/* Glassmorphism subtle glow overlay */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent dark:from-white/5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none" />
        
        {/* Animated Bubbles for LIMPIANDO status */}
        {status === "LIMPIANDO" && (
          <div className="absolute inset-0 overflow-hidden rounded-xl opacity-60">
            <div className="absolute bottom-1 left-[10%] w-2 h-2 rounded-full bg-cyan-300 animate-bubble" style={{ animationDelay: '0.2s', animationDuration: '3s' }} />
            <div className="absolute bottom-2 left-[30%] w-3 h-3 rounded-full bg-cyan-200 animate-bubble" style={{ animationDelay: '1.5s', animationDuration: '4s' }} />
            <div className="absolute bottom-0 left-[60%] w-2.5 h-2.5 rounded-full bg-white animate-bubble" style={{ animationDelay: '0.8s', animationDuration: '3.5s' }} />
            <div className="absolute bottom-1 left-[80%] w-1.5 h-1.5 rounded-full bg-sky-300 animate-bubble" style={{ animationDelay: '2.1s', animationDuration: '2.8s' }} />
          </div>
        )}

        {/* Realistic Shining Sparkle (Destello Reluciente) for LIBRE status */}
        {status === "LIBRE" && (
          <div className="absolute inset-0 overflow-hidden rounded-xl opacity-80 pointer-events-none">
            {/* Reflejo de cristal pulido cruzando la tarjeta */}
            <div className="absolute top-0 bottom-0 left-[-50%] w-[40%] bg-gradient-to-r from-transparent via-white/50 to-transparent animate-[sweepReflection_6s_ease-in-out_infinite]" />
            
            {/* Destello/Estrella principal pulsante */}
            <div className="absolute top-[20%] left-[25%] w-6 h-6 animate-[flarePulse_4s_ease-in-out_infinite]">
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.8)] -translate-y-1/2" />
              <div className="absolute left-1/2 top-0 h-full w-[1px] bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.8)] -translate-x-1/2" />
              <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_10px_4px_rgba(255,255,255,1)] -translate-x-1/2 -translate-y-1/2" />
            </div>
            
            {/* Destello secundario más pequeño */}
            <div className="absolute bottom-[30%] right-[30%] w-3 h-3 animate-[flarePulse_5s_ease-in-out_infinite]" style={{ animationDelay: '2s' }}>
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-cyan-200 shadow-[0_0_5px_1px_rgba(165,243,252,0.8)] -translate-y-1/2" />
              <div className="absolute left-1/2 top-0 h-full w-[1px] bg-cyan-200 shadow-[0_0_5px_1px_rgba(165,243,252,0.8)] -translate-x-1/2" />
              <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-white rounded-full shadow-[0_0_5px_2px_rgba(255,255,255,1)] -translate-x-1/2 -translate-y-1/2" />
            </div>

            {/* Aura de limpieza radial de fondo */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_var(--tw-gradient-stops))] from-blue-400/10 via-transparent to-transparent" />
            
            {/* Soft Ambient Glows for premium feel */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-400/10 blur-xl rounded-full" />
            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-cyan-400/10 blur-xl rounded-full" />
          </div>
        )}

        {/* Immersive Warm Aura for OCUPADA status */}
        {status === "OCUPADA" && (
          <div className="absolute inset-0 overflow-hidden rounded-xl opacity-40 pointer-events-none">
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-rose-500/30 blur-[30px] rounded-full animate-[orbFloat_8s_ease-in-out_infinite]" />
            <div className="absolute top-[10%] -left-8 w-24 h-24 bg-orange-500/20 blur-[25px] rounded-full animate-[orbFloat_10s_ease-in-out_infinite_reverse]" />
            <div className="absolute top-[40%] left-[30%] w-32 h-32 bg-red-500/15 blur-[35px] rounded-full animate-[orbFloat_12s_ease-in-out_infinite]" style={{ animationDelay: '2s' }} />
          </div>
        )}

        {/* Drifting Mist and Dust Motes for SUCIA status */}
        {status === "SUCIA" && (
          <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
            {/* Mist gradient at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-purple-900/30 to-transparent opacity-60" />
            
            {/* Dust motes */}
            <div className="absolute top-[10%] left-[20%] w-1.5 h-1.5 bg-amber-200/40 rounded-sm animate-[dustDrift_6s_linear_infinite]" />
            <div className="absolute top-[20%] left-[60%] w-1 h-1 bg-white/30 rounded-sm animate-[dustDrift_8s_linear_infinite]" style={{ animationDelay: '1s' }} />
            <div className="absolute top-[5%] left-[80%] w-2 h-2 bg-purple-200/30 rounded-sm animate-[dustDrift_7s_linear_infinite]" style={{ animationDelay: '2.5s' }} />
            <div className="absolute top-[30%] left-[40%] w-1.5 h-1.5 bg-white/20 rounded-sm animate-[dustDrift_9s_linear_infinite]" style={{ animationDelay: '0.5s' }} />
            <div className="absolute top-[15%] left-[10%] w-1 h-1 bg-amber-100/30 rounded-sm animate-[dustDrift_5s_linear_infinite]" style={{ animationDelay: '3s' }} />
          </div>
        )}

        {/* Digital Grid and Scanner for BLOQUEADA status */}
        {status === "BLOQUEADA" && (
          <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
            {/* Caution stripes (hardware accelerated transform) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
              <div 
                className="absolute w-[200%] h-[200%] top-0 left-0"
                style={{ 
                  backgroundImage: 'linear-gradient(45deg, rgba(250, 204, 21, 0.4) 25%, transparent 25%, transparent 50%, rgba(250, 204, 21, 0.4) 50%, rgba(250, 204, 21, 0.4) 75%, transparent 75%, transparent)',
                  backgroundSize: '60px 60px',
                  animation: 'stripeTranslate 2s linear infinite'
                }} 
              />
            </div>
            
            {/* Scanning laser line */}
            <div className="absolute left-0 right-0 h-[2px] bg-amber-500 z-10 shadow-[0_0_12px_3px_rgba(245,158,11,0.8)]" style={{ animation: 'scanLine 4s ease-in-out infinite' }} />
            
            {/* Subtle digital lock node glow */}
            <div className="absolute bottom-[-10%] right-[-10%] w-24 h-24 bg-amber-500/15 blur-2xl rounded-full animate-pulse" />
          </div>
        )}
        
        {/* Animated Water for LIMPIANDO status */}
        {status === "LIMPIANDO" && (
          <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none opacity-80">
            {/* Olas de agua rotando (técnica de fluido realista CSS) */}
            <div className="absolute left-1/2 bottom-0 w-[400px] h-[400px] -ml-[200px] mb-[-330px] rounded-[40%] bg-cyan-400/20 animate-[waveSpin_8s_linear_infinite]" />
            <div className="absolute left-1/2 bottom-0 w-[420px] h-[420px] -ml-[210px] mb-[-345px] rounded-[43%] bg-blue-500/20 animate-[waveSpin_11s_linear_infinite_reverse]" />
            <div className="absolute left-1/2 bottom-0 w-[380px] h-[380px] -ml-[190px] mb-[-310px] rounded-[38%] bg-sky-300/30 animate-[waveSpin_14s_linear_infinite]" />
            
            {/* Burbujitas dentro del agua */}
            <div className="absolute bottom-2 left-[20%] w-2 h-2 rounded-full bg-white/60 animate-bubble" style={{ animationDelay: '0.2s', animationDuration: '3s' }} />
            <div className="absolute bottom-1 left-[50%] w-3 h-3 rounded-full bg-cyan-200/60 animate-bubble" style={{ animationDelay: '1.5s', animationDuration: '4s' }} />
            <div className="absolute bottom-3 left-[80%] w-1.5 h-1.5 rounded-full bg-white/50 animate-bubble" style={{ animationDelay: '0.8s', animationDuration: '2.5s' }} />
          </div>
        )}
      </div>
      {/* Indicador de pago pendiente (Solo si NO está la alerta de puerta para no saturar) */}
      {hasPendingPayment && !showDoorAlert && (
        <div className="absolute -top-1.5 -right-1.5 bg-amber-500 rounded-full p-0.5 animate-pulse z-50" title="Pago pendiente">
          <AlertCircle className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Indicador de Servicio de Consumo Pendiente (Charola de Comida) - Ahora Clickable */}
      {hasPendingService && !showDoorAlert && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewServices?.();
          }}
          className={cn(
            "absolute rounded-full p-1 shadow-lg z-50 ring-2 ring-background hover:scale-110 active:scale-95 transition-transform duration-200 cursor-pointer",
            isCriticalService ? "bg-red-600 animate-[pulse_0.8s_infinite] shadow-red-500/50" : "bg-orange-500 animate-pulse",
            hasPendingPayment ? "-top-1.5 right-4" : "-top-1.5 -right-1.5"
          )}
          title={isCriticalService ? "¡SERVICIO CRÍTICO! (>15 min) - Click para ver detalles" : "Servicio de consumo en proceso - Click para ver detalles"}
        >
          <HandPlatter className={cn("h-2.5 w-2.5 text-white", isCriticalService && "animate-bounce")} />
        </button>
      )}

      {/* Indicador de Valet Pendiente (Workflow Estricto) - Bloqueo Visual */}
      {isValetPending && !showDoorAlert && (
        <>
          <div className="absolute inset-0 z-40 bg-background/60 backdrop-blur-sm rounded-xl border-2 border-orange-500/50 flex flex-col items-center justify-center gap-1.5 cursor-not-allowed transition-colors">
            <span className="bg-orange-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-lg animate-pulse">
              Esperando Cochero
            </span>
          </div>
          {onCancelStay && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancelStay();
              }}
              className="absolute -top-1.5 -left-1.5 z-50 flex items-center justify-center h-5 w-5 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg ring-2 ring-background transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
              title="Cancelar estancia (requiere autorización)"
            >
              <XCircle className="h-3 w-3" />
            </button>
          )}
          <div className="absolute -top-1.5 -right-1.5 z-50 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 ring-2 ring-background animate-pulse" title="Esperando registro de vehículo por Valet">
            <span className="h-2 w-2 rounded-full bg-white" />
          </div>
        </>
      )}

      {/* Indicador de BLOQUEO DE SALIDA (Pago Pendiente) - SOP 4 */}
      {hasPendingPayment && !showDoorAlert && status === "OCUPADA" && !isValetPending && (
        <>
          <div className="absolute inset-0 z-40 pointer-events-none bg-amber-950/40 backdrop-blur-[1px] rounded-xl border-2 border-amber-500/40 flex flex-col items-center justify-center animate-pulse transition-colors">
            <div className="bg-amber-600 text-white text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full shadow-lg border border-amber-400/50 flex items-center gap-1">
              <AlertCircle size={10} />
              BLOQUEO DE SALIDA
            </div>
            <span className="text-[8px] text-amber-200/80 font-bold mt-1 uppercase tracking-widest">Pago Pendiente</span>
          </div>
        </>
      )}

      {/* Indicador de Sensor (Puerta Abierta) - Solo si está ocupada */}
      {showDoorAlert && (
        <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-red-400 z-50 animate-bounce">
          ¡PUERTA ABIERTA!
        </div>
      )}

      {/* Indicador de Valet solicitando salida (Notificación del cochero) */}
      {vehicleStatus?.isWaitingAuthorization && !showDoorAlert && (
        <div className="absolute -top-2 -left-2 bg-amber-600 text-white p-1 rounded-md shadow-lg border border-amber-400 z-50 animate-pulse" title="Valet avisa que el cliente está saliendo">
          <Car className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Fila superior: Número + Estado */}
      <div className="flex items-start justify-between gap-1 mb-2 relative z-50">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-black text-xl leading-none tracking-tighter text-foreground drop-shadow-sm">{number}</span>

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
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Indicador de Control de TV */}
          {tvRemoteStatus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAssignRemote?.();
              }}
              title={
                tvRemoteStatus === "PENDIENTE_ENCENDIDO" ? "TV: Esperando encendido por cochero" :
                tvRemoteStatus === "TV_ENCENDIDA" ? "TV: Encendida" :
                tvRemoteStatus === "EXTRAVIADO" ? "TV: Control extraviado" :
                "TV: Control en habitación"
              }
              className={cn(
                "h-5 w-5 flex items-center justify-center rounded-md border shadow-sm transition-all hover:scale-110 cursor-pointer",
                tvRemoteStatus === "PENDIENTE_ENCENDIDO" ? "bg-orange-500 border-orange-400 text-white animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.6)]" :
                tvRemoteStatus === "TV_ENCENDIDA" ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_8px_rgba(16,185,129,0.6)]" :
                tvRemoteStatus === "EXTRAVIADO" ? "bg-red-600 border-red-500 text-white animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.6)]" :
                "bg-zinc-800 border-zinc-600 text-zinc-200 hover:bg-zinc-700 hover:text-white" // EN_HABITACION / SIN_REGISTRO
              )}
            >
              <Tv className="h-3 w-3" />
            </button>
          )}
          {statusBadge}
        </div>
      </div>

      {/* Fila inferior: Tipo + Botones */}
      <div className="flex items-center justify-between mt-auto flex-wrap gap-y-1">
        {/* Badge de tipo de habitación */}
        {roomTypeName ? (
          <span
            className={`text-[8px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm border border-white/10 ${getRoomTypeConfig(roomTypeName).color} text-white`}
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

        {/* Botones de acción directos */}
        <div className="flex items-center gap-0.5 z-50 relative flex-wrap justify-end mt-auto">
          {status === "OCUPADA" && (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 hover:from-orange-300 hover:to-orange-500 text-white transition-all duration-300 active:scale-95 border border-orange-300/50 shadow-[0_0_15px_rgba(249,115,22,0.6)] hover:shadow-[0_0_25px_rgba(249,115,22,0.8)]"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewServices?.();
                }}
                aria-label={`Ver seguimiento habitación ${number}`}
                title="Seguimiento de Servicios"
              >
                <ConciergeBell className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white transition-all duration-300 active:scale-95 border border-emerald-300/50 shadow-[0_0_15px_rgba(52,211,153,0.6)] hover:shadow-[0_0_25px_rgba(52,211,153,0.8)]"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddProduct?.();
                }}
                aria-label={`Agregar consumo habitación ${number}`}
                title="Agregar Consumo"
              >
                <ShoppingBag className="h-3 w-3" />
              </Button>
            </>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 hover:from-cyan-300 hover:to-cyan-500 text-white transition-all duration-300 active:scale-95 border border-cyan-300/50 shadow-[0_0_15px_rgba(34,211,238,0.6)] hover:shadow-[0_0_25px_rgba(34,211,238,0.8)]"
            onClick={(e) => {
              e.stopPropagation();
              onInfo();
            }}
            aria-label={`Información habitación ${number}`}
            title="Información"
          >
            <Info className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-full bg-gradient-to-br from-fuchsia-400 to-fuchsia-600 hover:from-fuchsia-300 hover:to-fuchsia-500 text-white transition-all duration-300 active:scale-95 border border-fuchsia-300/50 shadow-[0_0_15px_rgba(232,121,249,0.6)] hover:shadow-[0_0_25px_rgba(232,121,249,0.8)]"
            onClick={(e) => {
              e.stopPropagation();
              onActions();
            }}
            aria-label={`Acciones habitación ${number}`}
            title="Acciones"
          >
            <MoreVertical className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Comparación profunda y selectiva para evitar renders innecesarios.
function arePropsEqual(oldProps: RoomCardProps, newProps: RoomCardProps) {
  // Ignorar statusBadge porque está garantizado que cambia cuando bgClass cambia.
  // Ignorar callbacks porque la grilla los vuelve a inyectar por closure, pero su rol no afecta lo visual hasta ser invocados.
  if (oldProps.id !== newProps.id) return false;
  if (oldProps.status !== newProps.status) return false;
  if (oldProps.bgClass !== newProps.bgClass) return false;
  if (oldProps.accentClass !== newProps.accentClass) return false;
  if (oldProps.hasPendingPayment !== newProps.hasPendingPayment) return false;
  if (oldProps.isValetPending !== newProps.isValetPending) return false;
  if (oldProps.hasPendingService !== newProps.hasPendingService) return false;
  if (oldProps.isCriticalService !== newProps.isCriticalService) return false;
  if (oldProps.valetId !== newProps.valetId) return false;
  if (oldProps.notes !== newProps.notes) return false;
  if (oldProps.roomTypeName !== newProps.roomTypeName) return false;
  if (oldProps.tvRemoteStatus !== newProps.tvRemoteStatus) return false;

  // Shallow Compare for objects
  const oldSensor = oldProps.sensorStatus;
  const newSensor = newProps.sensorStatus;
  if (!!oldSensor !== !!newSensor) return false;
  if (oldSensor && newSensor) {
    if (oldSensor.isOpen !== newSensor.isOpen) return false;
    if (oldSensor.batteryLevel !== newSensor.batteryLevel) return false;
    if (oldSensor.isOnline !== newSensor.isOnline) return false;
  }

  const oldVehicle = oldProps.vehicleStatus;
  const newVehicle = newProps.vehicleStatus;
  if (!!oldVehicle !== !!newVehicle) return false;
  if (oldVehicle && newVehicle) {
    if (oldVehicle.hasVehicle !== newVehicle.hasVehicle) return false;
    if (oldVehicle.isReady !== newVehicle.isReady) return false;
    if (oldVehicle.plate !== newVehicle.plate) return false;
    if (oldVehicle.brand !== newVehicle.brand) return false;
    if (oldVehicle.model !== newVehicle.model) return false;
    if (oldVehicle.isWaitingAuthorization !== newVehicle.isWaitingAuthorization) return false;
  }

  return true;
}

export const RoomCard = memo(RoomCardComponent, arePropsEqual);
