"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaymentMethod } from "@/components/sales/room-types";
import { MultiPaymentInput, PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { AlertTriangle, CheckCircle2, Clock, Bed, Users, ShoppingBag, UserCog } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";

interface PendingItem {
  concept_type: string;
  total: number;
  count: number;
}

export interface RoomCheckoutModalProps {
  isOpen: boolean;
  roomNumber: string;
  roomTypeName: string;
  remainingAmount: number;
  checkoutAmount: number;
  actionLoading: boolean;
  pendingItems?: PendingItem[];
  onAmountChange: (amount: number) => void;
  onClose: () => void;
  onConfirm: (data: { payments: PaymentEntry[]; checkoutValetId?: string | null; checkoutValetName?: string }) => void;
  defaultValetId?: string | null;
  vehiclePlate?: string | null;
  onRequestValet?: () => Promise<void>;
  checkoutPaymentData?: PaymentEntry[];
  hasUndeliveredItems?: boolean;
}

export function RoomCheckoutModal({
  isOpen,
  roomNumber,
  roomTypeName,
  remainingAmount,
  checkoutAmount,
  actionLoading,
  pendingItems = [],
  onAmountChange,
  onClose,
  onConfirm,
  defaultValetId,
  vehiclePlate,
  onRequestValet,
  hasUndeliveredItems,
  ...props
}: RoomCheckoutModalProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [showPendingWarning, setShowPendingWarning] = useState(false);
  const [checkoutValetId, setCheckoutValetId] = useState<string>("none");
  const [valets, setValets] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);

  const conceptLabels: Record<string, string> = {
    ROOM_BASE: "Habitación",
    EXTRA_HOUR: "Horas Extra",
    EXTRA_PERSON: "Personas Extra",
    CONSUMPTION: "Consumos",
    PRODUCT: "Productos",
    OTHER: "Otros",
    DAMAGE_CHARGE: "Cargos por Daños",
    TOLERANCE_EXPIRED: "Tolerancia Expirada",
  };

  const conceptIcons: Record<string, React.ReactNode> = {
    ROOM_BASE: <Bed className="h-3 w-3" />,
    EXTRA_HOUR: <Clock className="h-3 w-3" />,
    EXTRA_PERSON: <Users className="h-3 w-3" />,
    CONSUMPTION: <ShoppingBag className="h-3 w-3" />,
    PRODUCT: <ShoppingBag className="h-3 w-3" />,
    OTHER: <ShoppingBag className="h-3 w-3" />,
    DAMAGE_CHARGE: <AlertTriangle className="h-3 w-3" />,
    TOLERANCE_EXPIRED: <Clock className="h-3 w-3" />,
  };

  const hasPendingItems = pendingItems.length > 0 && pendingItems.some(item => item.total > 0);

  // Cargar cocheros disponibles
  useEffect(() => {
    const loadValets = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        
        
        ;

      if (data) {
        setValets(data);
      }
    };

    if (isOpen) {
      loadValets();
      setCheckoutValetId(defaultValetId || "none");

      // Check for pre-filled payment data from Valet
      if (props.checkoutPaymentData && Array.isArray(props.checkoutPaymentData) && props.checkoutPaymentData.length > 0) {
        setPayments(props.checkoutPaymentData);
      } else if (remainingAmount > 0) {
        setPayments(createInitialPayment(remainingAmount));
      }
    }
  }, [isOpen, remainingAmount, defaultValetId, props.checkoutPaymentData]);

  useEffect(() => {
    if (isOpen) {
      console.log("💰 [CheckoutModal] Open. Rem:", remainingAmount, "Data:", props.checkoutPaymentData);
    }
  }, [isOpen, remainingAmount, props.checkoutPaymentData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative bg-background border rounded-lg shadow-lg w-[95vw] sm:w-full sm:max-w-4xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Processing overlay */}
        <ProcessingOverlay
          isVisible={actionLoading}
          title="Procesando checkout"
          steps={[
            { label: "Procesando pagos...", icon: "payment" },
            { label: "Liberando habitación...", icon: "room" },
            { label: "Imprimiendo ticket...", icon: "printer" },
          ]}
          autoCycleMs={2000}
        />
        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold">Cobrar / Check-out</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={actionLoading}
          >
            ✕
          </Button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Habitación</p>
            <p className="text-base font-semibold">
              Hab. {roomNumber} – {roomTypeName}
            </p>
          </div>

          {/* Alerta de items pendientes */}
          {hasPendingItems && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
                <AlertTriangle className="h-4 w-4" />
                <span>Conceptos pendientes por pagar</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {pendingItems.filter(item => item.total > 0).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-background/50 p-2 rounded border border-amber-200/50">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {conceptIcons[item.concept_type]}
                      <span>{conceptLabels[item.concept_type] || item.concept_type}</span>
                    </div>
                    <span className="font-bold text-sm text-amber-600">${item.total.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerta de bloqueo por entregas pendientes */}
          {hasUndeliveredItems && (
            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-4 space-y-2 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 font-medium">
                <Clock className="h-5 w-5" />
                <span>Cobro Bloqueado: Servicios Pendientes</span>
              </div>
              <p className="text-sm text-orange-600/90 dark:text-orange-400/90">
                No se puede realizar el cobro ni finalizar la estancia porque hay <strong>consumos o servicios que no han sido marcados como ENTREGADOS</strong> por el staff.
              </p>
            </div>
          )}

          {/* Validación de Vehículo - Muestra advertencia si hay auto pero no cochero de salida */}
          {!!vehiclePlate && !defaultValetId && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-300">
                    Vehículo en resguardo ({vehiclePlate})
                  </p>
                  <p className="text-sm text-red-600/80 dark:text-red-400/80">
                    El cochero debe confirmar la revisión y entrega del vehículo antes de finalizar la salida.
                  </p>
                </div>
              </div>

              {onRequestValet && (
                <Button
                  variant="outline"
                  className="w-full border-red-200 hover:bg-red-100 text-red-700"
                  onClick={onRequestValet}
                >
                  📡 Solicitar Revisión al Cochero
                </Button>
              )}
            </div>
          )}

          {!!vehiclePlate && !!defaultValetId && (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Vehículo verificado por cochero
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1 p-4 bg-muted/20 rounded-lg border">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-muted-foreground">Saldo pendiente</p>
              {remainingAmount <= 0 && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Pagado
                </Badge>
              )}
            </div>
            <p className={`text-3xl font-bold ${remainingAmount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              ${remainingAmount.toFixed(2)}
            </p>
          </div>
          {remainingAmount > 0 && (
            <div className={!!vehiclePlate && !defaultValetId ? "opacity-50 pointer-events-none grayscale relative" : ""}>
              <MultiPaymentInput
                totalAmount={remainingAmount}
                payments={payments}
                onPaymentsChange={setPayments}
                disabled={actionLoading || (!!vehiclePlate && !defaultValetId)}
              />
              {!!vehiclePlate && !defaultValetId && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <span className="bg-background/80 backdrop-blur-sm border border-red-200 text-red-600 px-3 py-1 rounded-md text-sm font-medium shadow-sm">
                    🔒 Verifica salida primero
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Cochero de Salida
            </p>
            <div className="space-y-1">
              {defaultValetId ? (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <span className="text-sm font-medium text-green-700 dark:text-green-300 block">
                      Cochero asignado para salida
                    </span>
                    <span className="text-xs text-green-600 dark:text-green-400">
                      {valets.find(v => v.id === defaultValetId)
                        ? `${valets.find(v => v.id === defaultValetId)?.first_name} ${valets.find(v => v.id === defaultValetId)?.last_name}`
                        : "Cochero verificado"}
                    </span>
                  </div>
                </div>
              ) : vehiclePlate ? (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    Esperando confirmación del cochero...
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2 flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={actionLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const selectedValet = valets.find(v => v.id === checkoutValetId);
              const valetName = selectedValet ? `${selectedValet.first_name} ${selectedValet.last_name}` : undefined;

              if (hasUndeliveredItems) {
                toast.error("Entregas pendientes", {
                  description: "No se puede finalizar la estancia. Hay productos marcados como 'Por Entregar'. El cochero debe confirmar la entrega o se deben eliminar de la orden.",
                  duration: 5000
                });
                return;
              }

              onConfirm({
                payments,
                checkoutValetId: checkoutValetId === "none" ? null : checkoutValetId,
                checkoutValetName: valetName
              });
            }}
            disabled={actionLoading || (remainingAmount > 0 && payments.reduce((s, p) => s + p.amount, 0) < remainingAmount) || hasUndeliveredItems || (!!vehiclePlate && !defaultValetId)}
            className={hasUndeliveredItems || (!!vehiclePlate && !defaultValetId) ? "opacity-90 cursor-not-allowed bg-orange-600 hover:bg-orange-700 text-white" : ""}
          >
            {actionLoading ? "Procesando..." : hasUndeliveredItems ? "Entrega Pendiente" : (!!vehiclePlate && !defaultValetId) ? "Esperando Revisión" : "Confirmar Salida"}
          </Button>
        </div>
      </div>
    </div>
  );
}
