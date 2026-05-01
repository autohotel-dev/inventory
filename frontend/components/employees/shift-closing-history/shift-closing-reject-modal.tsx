import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { XCircle, Loader2 } from "lucide-react";
import { ShiftClosing } from "../types";
import { formatCurrency } from "@/hooks/use-shift-closing-history";

interface ShiftClosingRejectModalProps {
  showRejectModal: boolean;
  setShowRejectModal: (show: boolean) => void;
  rejectionReason: string;
  setRejectionReason: (reason: string) => void;
  confirmRejectClosing: () => void;
  processingAction: boolean;
  selectedClosing: ShiftClosing | null;
}

export function ShiftClosingRejectModal({
  showRejectModal,
  setShowRejectModal,
  rejectionReason,
  setRejectionReason,
  confirmRejectClosing,
  processingAction,
  selectedClosing
}: ShiftClosingRejectModalProps) {
  return (
    <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
      <DialogContent className="w-[95vw] sm:w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Rechazar Corte de Caja
          </DialogTitle>
          <DialogDescription>
            Por favor, proporcione el motivo del rechazo. Esta información será visible para el empleado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Motivo del rechazo *</Label>
            <textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ej: Diferencia de $50 en efectivo no justificada, falta comprobante de pago con tarjeta..."
              className="w-full h-32 px-3 py-2 border rounded-md bg-background resize-none text-sm"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Sea específico para que el empleado pueda corregir el problema.
            </p>
          </div>

          {selectedClosing && (
            <div className="p-3 rounded-lg bg-muted/50 border text-sm">
              <p className="font-medium mb-1">Resumen del corte:</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>Empleado:</span>
                <span>{selectedClosing.employees?.first_name} {selectedClosing.employees?.last_name}</span>
                <span>Fecha:</span>
                <span>{new Date(selectedClosing.created_at).toLocaleDateString("es-MX")}</span>
                <span>Diferencia:</span>
                <span className={(selectedClosing.cash_difference || 0) !== 0 ? "text-red-500 font-medium" : "text-green-500"}>
                  {formatCurrency(selectedClosing.cash_difference || 0)}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowRejectModal(false)}
            disabled={processingAction}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={confirmRejectClosing}
            disabled={processingAction || !rejectionReason.trim()}
          >
            {processingAction ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            Confirmar Rechazo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
