"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { XCircle, X, AlertTriangle, Loader2, Package, DollarSign, RotateCcw } from "lucide-react";
import { SupervisorAuthDialog } from "@/components/auth/supervisor-auth-dialog";

interface CancelItemModalProps {
  isOpen: boolean;
  itemName: string;
  itemQty: number;
  itemPrice: number;
  itemTotal: number;
  isPaid: boolean;
  conceptType?: string | null;
  onClose: () => void;
  onConfirm: (reason: string, supervisorName: string) => Promise<void>;
}

/**
 * Modal premium para cancelar un item individual.
 * Requiere motivo obligatorio y autorización de supervisor.
 * Si el item ya fue pagado, advierte sobre el reembolso.
 */
export function CancelItemModal({
  isOpen,
  itemName,
  itemQty,
  itemPrice,
  itemTotal,
  isPaid,
  conceptType,
  onClose,
  onConfirm,
}: CancelItemModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  if (!isOpen) return null;

  const getConceptLabel = (type: string | null | undefined) => {
    switch (type) {
      case "CONSUMPTION": return "Consumo";
      case "EXTRA_HOUR": return "Hora Extra";
      case "EXTRA_PERSON": return "Persona Extra";
      case "PROMO_4H": return "Promoción 4H";
      case "RENEWAL": return "Renovación";
      case "ROOM_BASE": return "Estancia Base";
      case "DAMAGE": return "Daño";
      case "TOLERANCE_EXPIRED": return "Tolerancia Expirada";
      default: return type || "Producto";
    }
  };

  const handleRequestCancel = () => {
    if (!reason.trim()) return;
    setShowAuth(true);
  };

  const handleAuthorized = async (supervisorName: string) => {
    setShowAuth(false);
    setLoading(true);
    try {
      await onConfirm(reason.trim(), supervisorName);
      setReason("");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto" onClick={onClose}>
        <div className="bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl w-[95vw] sm:w-full sm:max-w-md mx-4 overflow-hidden pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          {/* Accent bar */}
          <div className="h-1 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500" />

          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-500/15 rounded-xl border border-red-500/20">
                  <XCircle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-white uppercase italic">
                    Cancelar Item
                  </h2>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    Requiere autorización
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-zinc-500 hover:text-white h-8 w-8"
                disabled={loading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Item info card */}
            <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4 mb-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-zinc-800 rounded-xl flex items-center justify-center border border-white/5">
                  <Package className="h-5 w-5 text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{itemName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className="text-[9px] font-black tracking-widest bg-zinc-800 text-zinc-400 border-white/5">
                      {getConceptLabel(conceptType)}
                    </Badge>
                    <span className="text-[10px] font-mono text-zinc-500">x{itemQty}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Monto a cancelar
                </span>
                <span className="text-xl font-black text-red-400 italic tracking-tight">
                  ${itemTotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Estado de pago
                </span>
                <Badge className={`text-[9px] font-black tracking-widest border-0 ${
                  isPaid 
                    ? "bg-emerald-500/10 text-emerald-400" 
                    : "bg-amber-500/10 text-amber-400"
                }`}>
                  {isPaid ? "PAGADO" : "PENDIENTE"}
                </Badge>
              </div>
            </div>

            {/* Refund warning (only if paid) */}
            {isPaid && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                <div className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="text-amber-400 font-bold">Este item ya fue pagado</p>
                    <p className="text-zinc-400 mt-0.5">
                      Se generará un registro de reembolso por <strong className="text-amber-300">${itemTotal.toFixed(2)}</strong>. 
                      El dinero deberá devolverse al cliente manualmente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Inventory return info (for consumptions) */}
            {conceptType === "CONSUMPTION" && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4">
                <div className="flex items-start gap-2">
                  <RotateCcw className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="text-blue-400 font-bold">Devolución de inventario</p>
                    <p className="text-zinc-400 mt-0.5">
                      El producto se devolverá al stock automáticamente.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Warning */}
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-300 font-medium">
                  Esta acción no se puede deshacer. El item quedará marcado como cancelado.
                </p>
              </div>
            </div>

            {/* Reason */}
            <div className="mb-5">
              <Label htmlFor="cancel-reason" className="text-zinc-400 text-xs font-black uppercase tracking-widest">
                Motivo de cancelación <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Error en captura, cliente cambió de opinión, producto defectuoso..."
                className="mt-2 min-h-[80px] bg-zinc-900/60 border-white/10 text-white placeholder:text-zinc-600 rounded-xl resize-none"
                disabled={loading}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 font-bold h-12"
                disabled={loading}
              >
                Volver
              </Button>
              <Button
                onClick={handleRequestCancel}
                disabled={loading || !reason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest text-xs h-12"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cancelando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <XCircle className="h-4 w-4" /> Cancelar Item
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Supervisor authorization dialog */}
      <SupervisorAuthDialog
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onAuthorized={(supervisorName) => handleAuthorized(supervisorName)}
        title="Autorizar Cancelación"
        description="La cancelación de items requiere autorización de un supervisor."
        actionLabel="Autorizar Cancelación"
        variant="danger"
        requireReason={false}
      />
    </>,
    document.body
  );
}
