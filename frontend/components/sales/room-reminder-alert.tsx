"use client";

import { useEffect } from "react";
import { AlertTriangle, Clock, X } from "lucide-react";

interface RoomReminderAlertProps {
  isOpen: boolean;
  roomNumber: string;
  minutes: number;
  level: "20" | "5";
  onClose: () => void;
}

export function RoomReminderAlert({
  isOpen,
  roomNumber,
  minutes,
  level,
  onClose,
}: RoomReminderAlertProps) {
  // Reproducir sonido al abrir
  useEffect(() => {
    if (!isOpen) return;

    try {
      const audio = new Audio("/room-alert.mp3");
      audio.volume = level === "5" ? 1.0 : 0.6; // Más fuerte si es urgente
      audio.play().catch(() => {
        // Ignorar errores de reproducción (permisos del navegador)
      });
    } catch (e) {
      console.error("Error reproduciendo sonido de alerta", e);
    }
  }, [isOpen, level]);

  // Auto-cerrar después de 30 segundos si es nivel 20
  useEffect(() => {
    if (!isOpen || level === "5") return;
    
    const timer = setTimeout(() => {
      onClose();
    }, 30000);

    return () => clearTimeout(timer);
  }, [isOpen, level, onClose]);

  if (!isOpen) return null;

  const isUrgent = level === "5";

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={!isUrgent ? onClose : undefined}
      />

      {/* Alert */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className={`pointer-events-auto w-full max-w-xs overflow-hidden rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200 ${
            isUrgent 
              ? "bg-gradient-to-br from-red-950/95 to-red-900/95 border border-red-500/30" 
              : "bg-gradient-to-br from-amber-950/95 to-amber-900/95 border border-amber-500/30"
          } backdrop-blur-xl`}
        >
          {/* Header con animación de pulso para urgente */}
          <div className={`relative px-5 py-4 border-b ${
            isUrgent ? "border-red-500/20" : "border-amber-500/20"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                isUrgent 
                  ? "bg-red-500 animate-pulse" 
                  : "bg-amber-500"
              }`}>
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">
                  {isUrgent ? "¡Tiempo agotándose!" : "Aviso de tiempo"}
                </h3>
                <p className={`text-xs ${isUrgent ? "text-red-200/70" : "text-amber-200/70"}`}>
                  Habitación {roomNumber}
                </p>
              </div>
            </div>

            {/* Botón cerrar solo si no es urgente */}
            {!isUrgent && (
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Contenido */}
          <div className="p-5 space-y-4">
            {/* Tiempo restante grande */}
            <div className={`flex items-center justify-center gap-3 py-3 rounded-xl ${
              isUrgent ? "bg-red-500/20" : "bg-amber-500/20"
            }`}>
              <Clock className={`h-6 w-6 ${isUrgent ? "text-red-400" : "text-amber-400"}`} />
              <div className="text-center">
                <span className={`text-4xl font-bold ${isUrgent ? "text-red-400" : "text-amber-400"}`}>
                  {minutes}
                </span>
                <span className={`text-lg ml-1 ${isUrgent ? "text-red-300/70" : "text-amber-300/70"}`}>
                  min
                </span>
              </div>
            </div>

            {/* Mensaje */}
            <p className={`text-sm text-center ${isUrgent ? "text-red-100/80" : "text-amber-100/80"}`}>
              {isUrgent 
                ? "La estancia está por terminar. Prepara el cobro o extiende el tiempo."
                : "La habitación está próxima a vencer su tiempo de estancia."
              }
            </p>
          </div>

          {/* Botón */}
          <div className="px-5 pb-5">
            <button
              onClick={onClose}
              className={`w-full py-3 rounded-xl font-medium transition-all ${
                isUrgent 
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30" 
                  : "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/30"
              }`}
            >
              {isUrgent ? "Entendido" : "Aceptar"}
            </button>
          </div>

          {/* Barra de progreso animada para nivel urgente */}
          {isUrgent && (
            <div className="h-1 bg-red-900">
              <div 
                className="h-full bg-red-500 animate-pulse"
                style={{ width: `${Math.min((minutes / 5) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
