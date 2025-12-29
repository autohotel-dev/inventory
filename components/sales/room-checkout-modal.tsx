"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaymentMethod } from "@/components/sales/room-types";
import { MultiPaymentInput, PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { AlertTriangle, CheckCircle2, Clock, Bed, Users, ShoppingBag, UserCog } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  onConfirm: (data: { payments: PaymentEntry[]; checkoutValetId?: string | null }) => void;
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
  };

  const conceptIcons: Record<string, React.ReactNode> = {
    ROOM_BASE: <Bed className="h-3 w-3" />,
    EXTRA_HOUR: <Clock className="h-3 w-3" />,
    EXTRA_PERSON: <Users className="h-3 w-3" />,
    CONSUMPTION: <ShoppingBag className="h-3 w-3" />,
    PRODUCT: <ShoppingBag className="h-3 w-3" />,
    OTHER: <ShoppingBag className="h-3 w-3" />,
  };

  const hasPendingItems = pendingItems.length > 0 && pendingItems.some(item => item.total > 0);

  // Cargar cocheros disponibles
  useEffect(() => {
    const loadValets = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('role', 'cochero')
        .eq('is_active', true)
        .order('first_name');

      if (data) {
        setValets(data);
      }
    };

    if (isOpen) {
      loadValets();
      setCheckoutValetId("none");
      if (remainingAmount > 0) {
        setPayments(createInitialPayment(remainingAmount));
      }
    }
  }, [isOpen, remainingAmount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
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
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium text-sm">Conceptos pendientes de pago</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {pendingItems.filter(item => item.total > 0).map((item, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30"
                  >
                    {conceptIcons[item.concept_type]}
                    <span className="ml-1">{conceptLabels[item.concept_type] || item.concept_type}</span>
                    <span className="ml-1 font-bold">${item.total.toFixed(0)}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Saldo pendiente</p>
            <p className={`text-base font-semibold ${remainingAmount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {remainingAmount > 0 ? (
                <>{remainingAmount.toFixed(2)} MXN</>
              ) : (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Todo pagado
                </span>
              )}
            </p>
          </div>
          {remainingAmount > 0 && (
            <MultiPaymentInput
              totalAmount={remainingAmount}
              payments={payments}
              onPaymentsChange={setPayments}
              disabled={actionLoading}
            />
          )}

          {/* Cochero de Salida */}
          <div className="space-y-3 pt-2 border-t">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Cochero de Salida
            </p>
            <Select
              value={checkoutValetId}
              onValueChange={setCheckoutValetId}
              disabled={actionLoading || valets.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={valets.length === 0 ? "No hay cocheros registrados" : "Selecciona cochero de salida"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {valets.map((valet) => (
                  <SelectItem key={valet.id} value={valet.id}>
                    {valet.first_name} {valet.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Opcional: Registra qué cochero entregó el vehículo al cliente
            </p>
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
          <Button onClick={() => onConfirm({ payments, checkoutValetId: checkoutValetId === "none" ? null : checkoutValetId })} disabled={actionLoading || (remainingAmount > 0 && payments.reduce((s, p) => s + p.amount, 0) <= 0)}>
            {actionLoading
              ? "Procesando..."
              : remainingAmount <= 0
                ? "Dar salida"
                : "Confirmar pago"}
          </Button>
        </div>
      </div>
    </div>
  );
}
