"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { XCircle, X, DollarSign, AlertTriangle } from "lucide-react";

interface CancelStayModalProps {
  isOpen: boolean;
  roomNumber: string;
  roomTypeName: string;
  totalPaid: number;
  elapsedMinutes: number;
  actionLoading: boolean;
  onClose: () => void;
  onConfirm: (data: {
    refundType: "full" | "partial" | "none";
    refundAmount: number;
    reason: string;
  }) => void;
}

export function CancelStayModal({
  isOpen,
  roomNumber,
  roomTypeName,
  totalPaid,
  elapsedMinutes,
  actionLoading,
  onClose,
  onConfirm,
}: CancelStayModalProps) {
  const [refundType, setRefundType] = useState<"full" | "partial" | "none">("none");
  const [customRefund, setCustomRefund] = useState<number>(0);
  const [reason, setReason] = useState("");

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setRefundType("none");
      setCustomRefund(Math.floor(totalPaid / 2));
      setReason("");
    }
  }, [isOpen, totalPaid]);

  if (!isOpen) return null;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const elapsedMins = elapsedMinutes % 60;

  // Calcular monto de reembolso según tipo
  const getRefundAmount = () => {
    switch (refundType) {
      case "full": return totalPaid;
      case "partial": return customRefund;
      case "none": return 0;
    }
  };

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm({
      refundType,
      refundAmount: getRefundAmount(),
      reason: reason.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Cancelar Estancia
              </h2>
              <p className="text-sm text-muted-foreground">
                Hab. {roomNumber} - {roomTypeName}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Advertencia */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5" />
            <div className="text-sm">
              <p className="text-red-400 font-medium">Esta acción no se puede deshacer</p>
              <p className="text-slate-400 text-xs mt-1">
                La estancia será cancelada y la habitación quedará como SUCIA.
              </p>
            </div>
          </div>
        </div>

        {/* Info de la estancia */}
        <div className="bg-slate-800/50 rounded-lg p-3 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Tiempo transcurrido:</span>
            <span className="text-white font-medium">
              {elapsedHours > 0 ? `${elapsedHours}h ` : ""}{elapsedMins} min
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Total pagado:</span>
            <span className="text-emerald-400 font-medium">${totalPaid.toFixed(2)}</span>
          </div>
        </div>

        {/* Opciones de reembolso */}
        {totalPaid > 0 && (
          <div className="mb-4">
            <Label className="text-slate-300 mb-3 block">Reembolso</Label>
            <RadioGroup value={refundType} onValueChange={(v: string) => setRefundType(v as "full" | "partial" | "none")}>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-2 rounded-lg border border-slate-600 hover:border-slate-500 cursor-pointer">
                  <RadioGroupItem value="none" id="none" />
                  <span className="text-sm text-white">Sin reembolso</span>
                  <span className="ml-auto text-xs text-slate-500">$0.00</span>
                </label>
                
                <label className="flex items-center gap-3 p-2 rounded-lg border border-slate-600 hover:border-slate-500 cursor-pointer">
                  <RadioGroupItem value="partial" id="partial" />
                  <span className="text-sm text-white">Reembolso parcial</span>
                  <input
                    type="number"
                    value={customRefund}
                    onChange={(e) => setCustomRefund(Math.min(totalPaid, Math.max(0, Number(e.target.value))))}
                    onClick={(e) => e.stopPropagation()}
                    className="ml-auto w-20 text-right text-sm bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white"
                    disabled={refundType !== "partial"}
                  />
                </label>
                
                <label className="flex items-center gap-3 p-2 rounded-lg border border-slate-600 hover:border-slate-500 cursor-pointer">
                  <RadioGroupItem value="full" id="full" />
                  <span className="text-sm text-white">Reembolso total</span>
                  <span className="ml-auto text-xs text-emerald-400">${totalPaid.toFixed(2)}</span>
                </label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Resumen de reembolso */}
        {totalPaid > 0 && getRefundAmount() > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-white">
                Devolver al cliente: <span className="font-bold text-emerald-400">${getRefundAmount().toFixed(2)}</span>
              </span>
            </div>
          </div>
        )}

        {/* Motivo */}
        <div className="mb-4">
          <Label htmlFor="reason" className="text-muted-foreground">
            Motivo de cancelación <span className="text-red-400">*</span>
          </Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Cliente insatisfecho, problema con la habitación, emergencia..."
            className="mt-1 min-h-[80px]"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Volver
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={actionLoading || !reason.trim()}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            {actionLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span> Cancelando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <XCircle className="h-4 w-4" /> Confirmar Cancelación
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
