"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DollarSign, DoorOpen, Sparkles, Lock, FileText, Clock } from "lucide-react";
import { Room } from "@/components/sales/room-types";

export interface RoomActionsDockProps {
  room: Room | null;
  isOpen: boolean;
  isVisible: boolean;
  actionLoading: boolean;
  statusBadge: ReactNode;
  onClose: () => void;
  onStartStay: () => void;
  onCheckout: () => void;
  onViewSale: () => void;
  onAddPerson: () => void;
  onAddHour: () => void;
  onMarkClean: () => void;
  onBlock: () => void;
  onUnblock: () => void;
}

export function RoomActionsDock({
  room,
  isOpen,
  isVisible,
  actionLoading,
  statusBadge,
  onClose,
  onStartStay,
  onCheckout,
  onViewSale,
  onAddPerson,
  onAddHour,
  onMarkClean,
  onBlock,
  onUnblock,
}: RoomActionsDockProps) {
  if (!isOpen || !room) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className={`relative w-72 h-72 rounded-full bg-slate-950/80 border border-white/15 backdrop-blur-lg flex items-center justify-center shadow-xl transform transition-all duration-200 ease-out ${
          isVisible ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Círculo central con info básica */}
        <div className="w-32 h-32 rounded-full bg-background/90 border border-white/30 flex flex-col items-center justify-center text-center px-2 overflow-hidden">
          <div className="text-xs text-muted-foreground leading-none mb-1">Hab.</div>
          <div className="text-2xl font-bold leading-none mb-1 truncate max-w-[7rem]">
            {room.number}
          </div>
          <div className="mt-1 scale-100">
            {statusBadge}
          </div>
        </div>

        {/* Botones circulares alrededor */}
        {room.status === "LIBRE" && (
          <>
            {/* Iniciar estancia (arriba) */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-blue-500/80"
                title="Iniciar estancia"
                onClick={onStartStay}
                disabled={actionLoading || !room.room_types}
              >
                <DoorOpen className="h-4 w-4" />
              </Button>
            </div>
            {/* Bloquear (abajo) */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-amber-500/80"
                title="Bloquear (mantenimiento)"
                onClick={onBlock}
                disabled={actionLoading}
              >
                <Lock className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {room.status === "OCUPADA" && (
          <>
            {/* Cobrar / Check-out (arriba) */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-emerald-500/80"
                title="Cobrar / Check-out"
                onClick={onCheckout}
                disabled={actionLoading}
              >
                <DollarSign className="h-4 w-4" />
              </Button>
            </div>

            {/* Ver venta (derecha) */}
            <div className="absolute right-5 top-1/2 -translate-y-1/2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-cyan-500/80"
                title="Ver venta / consumos"
                onClick={onViewSale}
                disabled={actionLoading}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </div>

            {/* + Persona (izquierda) */}
            <div className="absolute left-5 top-1/2 -translate-y-1/2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-purple-500/80"
                title="Agregar persona extra"
                onClick={onAddPerson}
                disabled={actionLoading}
              >
                +
              </Button>
            </div>

            {/* + Hora extra (abajo) */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-pink-500/80"
                title="Agregar 1 hora extra"
                onClick={onAddHour}
                disabled={actionLoading}
              >
                <Clock className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {room.status === "SUCIA" && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-emerald-500/80"
              title="Marcar como limpia"
              onClick={onMarkClean}
              disabled={actionLoading}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
        )}

        {room.status === "BLOQUEADA" && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full !bg-transparent text-white/80 shadow-none transition-colors hover:!bg-blue-500/80"
              title="Liberar habitación"
              onClick={onUnblock}
              disabled={actionLoading}
            >
              <DoorOpen className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Botón de cierre del dock */}
        <Button
          variant="outline"
          size="icon"
          className="absolute top-2 right-2 rounded-full border-white/50 bg-black/40 text-white/80 hover:bg-black/70 hover:text-white"
          onClick={onClose}
          disabled={actionLoading}
          title="Cerrar acciones"
        >
          ✕
        </Button>
      </div>
    </div>
  );
}
