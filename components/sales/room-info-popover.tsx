"use client";

import { useState, useEffect } from "react";
import { X, Users, Clock, DollarSign, Home, ChevronDown, ChevronUp, CreditCard, Receipt, Banknote, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Room, RoomStay, STATUS_CONFIG } from "@/components/sales/room-types";
import { createClient } from "@/lib/supabase/client";

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  created_at: string;
}

interface RoomInfoPopoverProps {
  room: Room | null;
  isOpen: boolean;
  onClose: () => void;
  getActiveStay: (room: Room) => RoomStay | null;
  getRemainingTimeLabel: (room: Room) => { eta: string; remaining: string; minutesToCheckout: number } | null;
  getExtraHoursLabel: (room: Room) => number;
}

export function RoomInfoPopover({
  room,
  isOpen,
  onClose,
  getActiveStay,
  getRemainingTimeLabel,
  getExtraHoursLabel,
}: RoomInfoPopoverProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Cargar pagos cuando se expande la sección
  useEffect(() => {
    if (showPayments && room?.status === "OCUPADA") {
      const activeStay = getActiveStay(room);
      if (activeStay?.sales_order_id) {
        fetchPayments(activeStay.sales_order_id);
      }
    }
  }, [showPayments, room]);

  const fetchPayments = async (salesOrderId: string) => {
    setLoadingPayments(true);
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("sales_order_id", salesOrderId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPayments(data);
    }
    setLoadingPayments(false);
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "EFECTIVO": return <Banknote className="h-3 w-3 text-green-400" />;
      case "TARJETA": return <CreditCard className="h-3 w-3 text-blue-400" />;
      case "TRANSFERENCIA": return <Building2 className="h-3 w-3 text-purple-400" />;
      default: return <Receipt className="h-3 w-3 text-gray-400" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  };

  if (!isOpen || !room) return null;

  const activeStay = room.status === "OCUPADA" ? getActiveStay(room) : null;
  const timeInfo = room.status === "OCUPADA" ? getRemainingTimeLabel(room) : null;
  const extraHours = room.status === "OCUPADA" ? getExtraHoursLabel(room) : 0;
  const currentPeople = activeStay?.current_people ?? 2;
  const maxPeople = room.room_types?.max_people ?? 2;
  const remainingAmount = Number(activeStay?.sales_orders?.remaining_amount ?? 0);
  const statusConfig = STATUS_CONFIG[room.status] || { label: room.status, color: "bg-muted" };

  return (
    <>
      {/* Overlay transparente para cerrar */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Popover centrado */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div 
          className="pointer-events-auto bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-72 overflow-hidden animate-in zoom-in-95 fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header compacto */}
          <div className="relative px-4 py-3 bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                  <span className="text-lg font-bold">{room.number}</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Habitación</p>
                  <p className="text-sm font-medium">{room.room_types?.name || "Sin tipo"}</p>
                </div>
              </div>
              <Badge variant="outline" className={`${statusConfig.color} border text-[10px]`}>
                {statusConfig.label}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6 rounded-full text-white/50 hover:text-white hover:bg-white/10"
              onClick={onClose}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Contenido principal */}
          <div className="p-3 space-y-2">
            {room.status === "OCUPADA" && activeStay ? (
              <>
                {/* Grid de métricas principales */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Personas */}
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Users className="h-3 w-3 text-purple-400" />
                      <span className="text-[10px] text-purple-300">Personas</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-white">{currentPeople}</span>
                      <span className="text-xs text-white/50">/{maxPeople}</span>
                    </div>
                  </div>

                  {/* Tiempo */}
                  {timeInfo && (
                    <div className={`rounded-lg p-2 border ${
                      timeInfo.minutesToCheckout <= 5 
                        ? "bg-red-500/10 border-red-500/20" 
                        : timeInfo.minutesToCheckout <= 20 
                          ? "bg-amber-500/10 border-amber-500/20"
                          : "bg-emerald-500/10 border-emerald-500/20"
                    }`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className={`h-3 w-3 ${
                          timeInfo.minutesToCheckout <= 5 ? "text-red-400" :
                          timeInfo.minutesToCheckout <= 20 ? "text-amber-400" : "text-emerald-400"
                        }`} />
                        <span className={`text-[10px] ${
                          timeInfo.minutesToCheckout <= 5 ? "text-red-300" :
                          timeInfo.minutesToCheckout <= 20 ? "text-amber-300" : "text-emerald-300"
                        }`}>Restante</span>
                      </div>
                      <span className={`text-xl font-bold ${
                        timeInfo.minutesToCheckout <= 5 ? "text-red-400" :
                        timeInfo.minutesToCheckout <= 20 ? "text-amber-400" : "text-emerald-400"
                      }`}>
                        {timeInfo.remaining}
                      </span>
                    </div>
                  )}
                </div>

                {/* Saldo - siempre visible */}
                <div className={`rounded-lg p-2 border ${
                  remainingAmount > 0 
                    ? "bg-amber-500/10 border-amber-500/20" 
                    : "bg-emerald-500/10 border-emerald-500/20"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className={`h-3 w-3 ${remainingAmount > 0 ? "text-amber-400" : "text-emerald-400"}`} />
                      <span className={`text-[10px] ${remainingAmount > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                        Saldo pendiente
                      </span>
                    </div>
                    <span className={`text-lg font-bold ${remainingAmount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                      ${remainingAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Horas extra si aplica */}
                {extraHours > 0 && (
                  <div className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-pink-400" />
                        <span className="text-[10px] text-pink-300">Horas extra</span>
                      </div>
                      <span className="text-lg font-bold text-pink-400">+{extraHours}h</span>
                    </div>
                  </div>
                )}

                {/* Detalles expandibles */}
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors"
                >
                  {showDetails ? (
                    <>
                      <ChevronUp className="h-3 w-3" />
                      Menos detalles
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      Más detalles
                    </>
                  )}
                </button>

                {showDetails && timeInfo && (
                  <div className="bg-slate-800/50 rounded-lg p-2 space-y-1 text-[10px] animate-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between">
                      <span className="text-white/50">Salida estimada</span>
                      <span className="text-white/80">{timeInfo.eta}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Precio base</span>
                      <span className="text-white/80">${room.room_types?.base_price?.toFixed(2) || "0.00"} MXN</span>
                    </div>
                  </div>
                )}

                {/* Historial de pagos */}
                <button
                  onClick={() => setShowPayments(!showPayments)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors border-t border-white/5 mt-2"
                >
                  <Receipt className="h-3 w-3" />
                  {showPayments ? "Ocultar pagos" : "Ver historial de pagos"}
                  {showPayments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {showPayments && (
                  <div className="bg-slate-800/50 rounded-lg p-2 space-y-2 animate-in slide-in-from-top-2 duration-200 max-h-40 overflow-y-auto">
                    {loadingPayments ? (
                      <div className="text-center py-2">
                        <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto" />
                        <p className="text-[10px] text-white/50 mt-1">Cargando...</p>
                      </div>
                    ) : payments.length === 0 ? (
                      <div className="text-center py-2">
                        <Receipt className="h-5 w-5 mx-auto text-white/20 mb-1" />
                        <p className="text-[10px] text-white/50">Sin pagos registrados</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center pb-1 border-b border-white/10">
                          <span className="text-[10px] text-white/50">Total cobrado</span>
                          <span className="text-sm font-bold text-emerald-400">
                            ${payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2)}
                          </span>
                        </div>
                        {payments.map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                            <div className="flex items-center gap-2">
                              {getPaymentIcon(payment.payment_method)}
                              <div>
                                <p className="text-[10px] text-white/80">{payment.payment_method}</p>
                                <p className="text-[9px] text-white/40">{formatTime(payment.created_at)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium text-white">${Number(payment.amount).toFixed(2)}</p>
                              {payment.reference && (
                                <p className="text-[9px] text-white/40">Ref: {payment.reference}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Habitación no ocupada */
              <div className="text-center py-4">
                <Home className="h-8 w-8 mx-auto mb-2 text-white/20" />
                <p className="text-xs text-white/50">
                  {room.status === "LIBRE" && "Disponible"}
                  {room.status === "SUCIA" && "Pendiente de limpieza"}
                  {room.status === "BLOQUEADA" && "En mantenimiento"}
                </p>
                {room.room_types?.base_price && (
                  <p className="text-sm font-medium text-white/70 mt-1">
                    ${room.room_types.base_price.toFixed(2)} MXN
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
