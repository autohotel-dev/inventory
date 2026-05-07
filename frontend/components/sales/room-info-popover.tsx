"use client";

import { useState, useEffect } from "react";
import { X, Users, Clock, DollarSign, Home, ChevronDown, ChevronUp, CreditCard, Receipt, Banknote, Building2, Bed, ShoppingBag, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Room, RoomStay, STATUS_CONFIG } from "@/components/sales/room-types";
import { cn } from "@/lib/utils";

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  created_at: string;
}

interface ConceptSummary {
  concept_type: string;
  total: number;
  count: number;
  paid: number;
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
  const [conceptSummary, setConceptSummary] = useState<ConceptSummary[]>([]);

  // Cargar resumen de conceptos al abrir
  useEffect(() => {
    if (isOpen && room?.status === "OCUPADA") {
      const activeStay = getActiveStay(room);
      if (activeStay?.sales_order_id) {
        fetchConceptSummary(activeStay.sales_order_id);
      }
    }
  }, [isOpen, room]);

  // Cargar pagos cuando se expande la sección
  useEffect(() => {
    if (showPayments && room?.status === "OCUPADA") {
      const activeStay = getActiveStay(room);
      if (activeStay?.sales_order_id) {
        fetchPayments(activeStay.sales_order_id);
      }
    }
  }, [showPayments, room]);

  const fetchConceptSummary = async (salesOrderId: string) => {
    try {
      const { apiClient } = await import("@/lib/api/client");
      const { data } = await apiClient.get(`/system/crud/sales_order_items?sales_order_id=${salesOrderId}`);

      if (data) {
        // Agrupar por concepto
        const summary: Record<string, ConceptSummary> = {};
        data.forEach((item: any) => {
          const type = item.concept_type || "PRODUCT";
          if (!summary[type]) {
            summary[type] = { concept_type: type, total: 0, count: 0, paid: 0 };
          }
          summary[type].total += item.total || 0;
          summary[type].count += 1;
          if (item.is_paid) {
            summary[type].paid += item.total || 0;
          }
        });
        setConceptSummary(Object.values(summary));
      }
    } catch (error) {
      console.error("Error fetching concept summary:", error);
    }
  };

  const fetchPayments = async (salesOrderId: string) => {
    setLoadingPayments(true);
    try {
      const { apiClient } = await import("@/lib/api/client");
      const { data } = await apiClient.get(`/system/crud/payments?sales_order_id=${salesOrderId}`);

      if (data) {
        setPayments(data);
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "EFECTIVO": return <Banknote className="h-3 w-3 text-emerald-400" />;
      case "TARJETA": return <CreditCard className="h-3 w-3 text-sky-400" />;
      case "TRANSFERENCIA": return <Building2 className="h-3 w-3 text-violet-400" />;
      default: return <Receipt className="h-3 w-3 text-zinc-400" />;
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
      {/* Overlay con desenfoque suave para cerrar */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Popover centrado con estética Luxor Premium */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
        <div 
          className="pointer-events-auto bg-zinc-950/95 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] w-full max-w-[320px] overflow-hidden animate-in zoom-in-95 fade-in duration-300 ring-1 ring-white/5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Luxor Style */}
          <div className="relative px-6 py-5 bg-zinc-900/50 border-b border-white/5 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-center shadow-lg group">
                  <span className="text-2xl font-black italic tracking-tighter text-white group-hover:scale-110 transition-transform duration-300">{room.number}</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-0.5">Habitación</p>
                  <p className="text-sm font-bold text-white tracking-tight">{room.room_types?.name || "Sin tipo"}</p>
                </div>
              </div>
              <Badge variant="outline" className={cn(
                "border font-black text-[9px] px-2 py-0.5 tracking-widest uppercase",
                statusConfig.color.replace('bg-', 'text-').replace('text-muted', 'text-zinc-500')
              )}>
                {statusConfig.label}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 h-7 w-7 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Contenido con Scroll Premium */}
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {room.status === "OCUPADA" && activeStay ? (
              <>
                {/* Grid de métricas clave */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Card Personas */}
                  <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-3 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-5">
                      <Users size={16} className="text-purple-400" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Users className="h-3 w-3 text-purple-400" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Gente</span>
                    </div>
                    <div className="flex items-baseline gap-1 relative z-10">
                      <span className="text-2xl font-black text-white italic tracking-tighter">{currentPeople}</span>
                      <span className="text-xs font-bold text-zinc-600">/ {maxPeople}</span>
                    </div>
                  </div>

                  {/* Card Tiempo */}
                  {timeInfo && (
                    <div className={cn(
                      "border rounded-2xl p-3 relative overflow-hidden transition-all duration-500",
                      timeInfo.minutesToCheckout <= 5 
                        ? "bg-red-500/5 border-red-500/20" 
                        : timeInfo.minutesToCheckout <= 20 
                          ? "bg-amber-500/5 border-amber-500/20"
                          : "bg-emerald-500/5 border-emerald-500/20"
                    )}>
                      <div className="absolute top-0 right-0 p-2 opacity-10 animate-pulse">
                        <Clock size={16} />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn(
                          "w-5 h-5 rounded-lg flex items-center justify-center",
                          timeInfo.minutesToCheckout <= 5 ? "bg-red-500/20" :
                          timeInfo.minutesToCheckout <= 20 ? "bg-amber-500/20" : "bg-emerald-500/20"
                        )}>
                          <Clock className={cn("h-3 w-3", 
                            timeInfo.minutesToCheckout <= 5 ? "text-red-400" :
                            timeInfo.minutesToCheckout <= 20 ? "text-amber-400" : "text-emerald-400"
                          )} />
                        </div>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest",
                          timeInfo.minutesToCheckout <= 5 ? "text-red-500/70" :
                          timeInfo.minutesToCheckout <= 20 ? "text-amber-500/70" : "text-emerald-500/70"
                        )}>Restante</span>
                      </div>
                      <span className={cn("text-2xl font-black italic tracking-tighter block",
                        timeInfo.minutesToCheckout <= 5 ? "text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]" :
                        timeInfo.minutesToCheckout <= 20 ? "text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]" : 
                        "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]"
                      )}>
                        {timeInfo.remaining}
                      </span>
                    </div>
                  )}
                </div>

                {/* Saldo Pendiente Premium Card */}
                <div className={cn(
                  "rounded-2xl p-4 border relative overflow-hidden transition-all duration-500",
                  remainingAmount > 0 
                    ? "bg-amber-500/10 border-amber-500/20 shadow-[0_4px_20px_-8px_rgba(245,158,11,0.3)]" 
                    : "bg-emerald-500/10 border-emerald-500/20 shadow-[0_4px_20px_-8px_rgba(52,211,153,0.3)]"
                )}>
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shadow-lg",
                        remainingAmount > 0 ? "bg-amber-500/20 border border-amber-500/30" : "bg-emerald-500/20 border border-emerald-500/30"
                      )}>
                        <DollarSign className={remainingAmount > 0 ? "text-amber-400" : "text-emerald-400"} />
                      </div>
                      <div>
                        <span className={cn("text-[10px] font-black uppercase tracking-[0.2em] block mb-0.5",
                          remainingAmount > 0 ? "text-amber-500/70" : "text-emerald-500/70"
                        )}>Saldo Pendiente</span>
                        <div className={cn("text-2xl font-black italic tracking-tighter",
                          remainingAmount > 0 ? "text-amber-400" : "text-emerald-400"
                        )}>
                          ${remainingAmount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    {remainingAmount > 0 && (
                      <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5 animate-pulse">
                        <ArrowRight size={14} className="text-amber-400" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Desglose de Conceptos Pendientes */}
                {conceptSummary.length > 0 && conceptSummary.some(c => c.total - c.paid > 0) && (
                  <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-3 space-y-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Receipt className="h-3.5 w-3.5 text-zinc-600" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Conceptos por Cobrar</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {conceptSummary.map((concept) => {
                        const pending = concept.total - concept.paid;
                        if (pending <= 0) return null;
                        
                        const conceptConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
                          ROOM_BASE: { label: "Hab", icon: <Bed size={10} />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
                          EXTRA_HOUR: { label: "Hora", icon: <Clock size={10} />, color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
                          EXTRA_PERSON: { label: "Gente", icon: <Users size={10} />, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
                          CONSUMPTION: { label: "Cons", icon: <ShoppingBag size={10} />, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                          PRODUCT: { label: "Prod", icon: <ShoppingBag size={10} />, color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
                        };
                        const config = conceptConfig[concept.concept_type] || conceptConfig.PRODUCT;

                        return (
                          <div 
                            key={concept.concept_type}
                            className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg border font-bold text-[10px] tracking-tight transition-all hover:scale-105", config.color)}
                          >
                            {config.icon}
                            <span>{config.label}</span>
                            <span className="opacity-40 font-black">|</span>
                            <span className="text-white">${pending.toFixed(0)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Toggle para más detalles */}
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-zinc-600" />
                    <span>Cronograma y Tarifas</span>
                  </div>
                  {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showDetails && timeInfo && (
                  <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-3 space-y-2 text-[10px] animate-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center group/item">
                      <span className="text-zinc-500 font-bold">HORARIO DE SALIDA</span>
                      <span className="text-white font-black italic tracking-tighter bg-white/5 px-2 py-0.5 rounded border border-white/5 group-hover/item:border-primary/30 transition-colors">{timeInfo.eta}</span>
                    </div>
                    <div className="flex justify-between items-center group/item">
                      <span className="text-zinc-500 font-bold">TARIFA BASE</span>
                      <span className="text-white font-bold group-hover/item:text-primary transition-colors">${Number(room.room_types?.base_price || 0).toFixed(2)} MXN</span>
                    </div>
                    {extraHours > 0 && (
                      <div className="flex justify-between items-center text-pink-400 font-bold">
                        <span>HORAS EXTRA ACUMULADAS</span>
                        <span className="bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">+{extraHours} Horas</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Historial de Pagos Section */}
                <div className="pt-2 border-t border-white/5">
                  <button
                    onClick={() => setShowPayments(!showPayments)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                      showPayments ? "bg-white/5 text-sky-400 shadow-inner" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <History className={cn("h-3.5 w-3.5", showPayments ? "text-sky-400" : "text-zinc-600")} />
                      <span>Transacciones</span>
                    </div>
                    {showPayments ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showPayments && (
                    <div className="mt-3 bg-zinc-900/60 border border-white/5 rounded-2xl p-3 space-y-3 animate-in slide-in-from-top-4 duration-500 max-h-48 overflow-y-auto custom-scrollbar shadow-inner">
                      {loadingPayments ? (
                        <div className="flex flex-col items-center justify-center py-6 gap-3">
                          <div className="w-6 h-6 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 animate-pulse">Sincronizando...</p>
                        </div>
                      ) : payments.length === 0 ? (
                        <div className="text-center py-6 space-y-3 opacity-30 filter grayscale">
                          <History className="h-8 w-8 mx-auto text-zinc-500" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sin Movimientos</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-center pb-2 border-b border-white/5">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Recaudado Total</span>
                            <span className="text-sm font-black text-emerald-400 italic tracking-tighter">
                              ${payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {payments.map((payment) => (
                              <div key={payment.id} className="group flex items-center justify-between p-2.5 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-lg bg-zinc-950 border border-white/5 flex items-center justify-center group-hover:bg-zinc-900 transition-colors">
                                    {getPaymentIcon(payment.payment_method)}
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-white/90 tracking-tight">{payment.payment_method}</p>
                                    <p className="text-[9px] font-bold text-zinc-600 font-mono italic">{formatTime(payment.created_at)}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-black text-white italic tracking-tighter">${Number(payment.amount).toFixed(2)}</p>
                                  {payment.reference && (
                                    <p className="text-[8px] font-mono text-zinc-600 truncate max-w-[60px]">{payment.reference}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Habitación no ocupada - Estilo Premium Minimal */
              <div className="flex flex-col items-center justify-center py-10 space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full"></div>
                  <div className="relative w-16 h-16 rounded-3xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-2xl">
                    <Home className="h-8 w-8 text-primary shadow-primary/50" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Estado Actual</p>
                  <p className="text-sm font-bold text-white uppercase tracking-tight">
                    {room.status === "LIBRE" && "Disponible"}
                    {room.status === "SUCIA" && "Pendiente de Limpieza"}
                    {room.status === "BLOQUEADA" && "En Mantenimiento"}
                  </p>
                </div>
                {room.room_types?.base_price && (
                  <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/5 text-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">Tarifa Inicial</span>
                    <span className="text-lg font-black text-white italic tracking-tighter">${Number(room.room_types.base_price || 0).toFixed(2)} MXN</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sutil Glow en la parte inferior */}
          <div className="h-2 bg-gradient-to-t from-primary/10 to-transparent"></div>
        </div>
      </div>
    </>
  );
}

// Icono decorativo de historial no existente en lucide-react standard
function History({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="m12 7 v5l3 2" />
    </svg>
  );
}
