"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Receipt, Banknote, CreditCard, Building2, Package, Clock, Users, DollarSign, Car, Calendar, ArrowRight, TrendingUp, History, Info, Check, Trash2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Room, RoomStay } from "@/components/sales/room-types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssignAssetModal } from "@/components/rooms/modals/assign-asset-modal";
import { Tv } from "lucide-react";


interface Payment {
  id: string;
  payment_number: string | null;
  amount: number;
  payment_method: string;
  reference: string | null;
  concept: string | null;
  status: string;
  payment_type: string;
  parent_payment_id: string | null;
  notes: string | null;
  created_at: string;
}

interface SalesOrderItem {
  id: string;
  qty: number;
  unit_price: number;
  products: {
    name: string;
    sku: string;
  } | null;
  is_courtesy?: boolean;
  courtesy_reason?: string | null;
  concept_type?: string;
  delivery_status?: string;
  is_paid?: boolean;
  is_cancelled?: boolean;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
}

interface SalesOrder {
  id: string;
  notes: string | null;
  subtotal: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  created_at: string;
}

export interface RoomDetailsModalProps {
  isOpen: boolean;
  room: Room | null;
  activeStay: RoomStay | null;
  onClose: () => void;
  employeeId?: string | null;
  onCancelCharge?: (paymentId: string, room: Room, concept: string, amount: number) => Promise<boolean>;
  onCancelItem?: (itemId: string, room: Room, reason: string) => Promise<boolean>;
}

interface RoomAsset {
  id: string;
  asset_type: string;
  status: string;
  assigned_employee_id: string | null;
}

export function RoomDetailsModal({
  isOpen,
  room,
  activeStay,
  onClose,
  employeeId,
  onCancelCharge,
  onCancelItem,
}: RoomDetailsModalProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [salesOrder, setSalesOrder] = useState<SalesOrder | null>(null);
  const [tvRemoteAsset, setTvRemoteAsset] = useState<RoomAsset | null>(null);
  const [isAssignAssetModalOpen, setIsAssignAssetModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"payments" | "items">("payments");
  const [cancellingItemId, setCancellingItemId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingLoading, setCancellingLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (activeStay?.sales_order_id) {
        fetchDetails(activeStay.sales_order_id);
      }
      fetchAssetDetails();
    }
  }, [isOpen, activeStay]);

  const fetchAssetDetails = async () => {
    if (!room) return;
    const supabase = createClient();
    try {
      const { data } = await supabase
        .from("room_assets")
        .select("*")
        .eq("room_id", room.id)
        .eq("asset_type", "TV_REMOTE")
        .maybeSingle();
      setTvRemoteAsset(data);
    } catch (err) {
      console.error("Error fetching asset details:", err);
    }
  };

  const fetchDetails = async (salesOrderId: string) => {
    setLoading(true);
    const supabase = createClient();

    try {
      // Fetch payments
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("*")
        .eq("sales_order_id", salesOrderId)
        .order("created_at", { ascending: false });

      // Fetch items
      const { data: itemsData } = await supabase
        .from("sales_order_items")
        .select(`
          id,
          qty,
          unit_price,
          concept_type,
          delivery_status,
          is_paid,
          is_cancelled,
          cancellation_reason,
          cancelled_at,
          products (name, sku)
        `)
        .eq("sales_order_id", salesOrderId);

      // Fetch sales order
      const { data: orderData } = await supabase
        .from("sales_orders")
        .select("id, notes, subtotal, total, paid_amount, remaining_amount, status, created_at")
        .eq("id", salesOrderId)
        .single();

      if (paymentsData) setPayments(paymentsData);
      if (itemsData) setItems(itemsData as unknown as SalesOrderItem[]);
      if (orderData) setSalesOrder(orderData);
    } catch (err) {
      console.error("Error fetching room details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPayment = async (paymentId: string, concept: string, amount: number) => {
    if (!room || !onCancelCharge || !activeStay?.sales_order_id) return;
    
    const confirmed = window.confirm(`¿Estás seguro de cancelar este cargo de $${amount.toFixed(2)}?`);
    if (!confirmed) return;

    setLoading(true);
    const success = await onCancelCharge(paymentId, room, concept, amount);
    if (success) {
      await fetchDetails(activeStay.sales_order_id);
    }
    setLoading(false);
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "EFECTIVO": return <Banknote className="h-4 w-4 text-emerald-400" />;
      case "TARJETA": return <CreditCard className="h-4 w-4 text-sky-400" />;
      case "TRANSFERENCIA": return <Building2 className="h-4 w-4 text-violet-400" />;
      default: return <Receipt className="h-4 w-4 text-zinc-400" />;
    }
  };

  const getConceptLabel = (concept: string | null) => {
    switch (concept) {
      case "ESTANCIA": return "Estancia";
      case "HORA_EXTRA": return "Hora extra";
      case "PERSONA_EXTRA": return "Persona extra";
      case "CONSUMO": return "Consumo";
      case "CHECKOUT": return "Checkout";
      case "PAGO_EXTRA": return "Pago extra";
      case "ABONO": return "Abono";
      case "VENTA": return "Venta";
      case "ABONO_CLIENTE": return "Abono cliente";
      case "TOLERANCIA_EXPIRADA": return "Tolerancia expirada";
      default: return concept || "—";
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const totalPayments = payments
    .filter(p => !p.parent_payment_id)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalItems = items
    .filter(i => !i.is_cancelled)
    .reduce((sum, i) => sum + (i.qty * Number(i.unit_price)), 0);
  const cancelledCount = items.filter(i => i.is_cancelled).length;

  if (!isOpen || !room) return null;

  const getAssetStatusColor = (status: string) => {
    switch(status) {
      case 'EN_HABITACION': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'CON_COCHERO': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'EN_RECEPCION': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'EXTRAVIADO': return 'text-red-400 bg-red-500/10 border-red-500/20 animate-pulse';
      default: return 'text-zinc-400 bg-white/5 border-white/10';
    }
  };

  const formatAssetStatus = (status: string) => {
    return status.replace('_', ' ');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden bg-zinc-950/95 backdrop-blur-2xl border-white/5 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] rounded-[2rem] h-[90vh] flex flex-col">
        {/* Header con glassmorphism */}
        <div className="relative p-8 shrink-0 overflow-hidden border-b border-white/5 bg-zinc-900/50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50"></div>
          <div className="relative flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 shadow-[0_0_15px_-5px_var(--primary)] text-primary">
                  <Info className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-3xl font-black tracking-tighter text-white uppercase italic">
                    Habitación {room.number}
                  </DialogTitle>
                  <div className="flex items-center gap-2 text-zinc-500 font-bold text-[10px] uppercase tracking-[0.2em]">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    {room.room_types?.name || "Sin tipo"}
                  </div>
                </div>
              </div>
            </div>

            {/* Status Pulse */}
            <div className="flex flex-col items-end gap-2">
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1 font-black text-[10px] tracking-widest animate-pulse">
                ESTANCIA EN VIVO
              </Badge>
              {salesOrder && (
                <div className="text-right">
                  <span className="text-zinc-500 text-[9px] font-black uppercase tracking-widest block">Iniciada el</span>
                  <span className="text-white text-xs font-bold font-mono">{formatDateTime(salesOrder.created_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-x divide-white/5">
          {/* Columna Izquierda: Listados */}
          <div className="flex-1 flex flex-col min-w-0 bg-zinc-950/20">
            {/* Tabs Premium */}
            <div className="px-8 pt-6 pb-2 shrink-0">
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 w-fit">
                <button
                  onClick={() => setActiveTab("payments")}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 flex items-center gap-2",
                    activeTab === "payments" 
                      ? "bg-primary text-black shadow-lg shadow-primary/20" 
                      : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  )}
                >
                  <DollarSign size={14} className={activeTab === "payments" ? "text-black" : "text-zinc-500"} />
                  Pagos ({payments.filter(p => !p.parent_payment_id).length})
                </button>
                <button
                  onClick={() => setActiveTab("items")}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 flex items-center gap-2",
                    activeTab === "items" 
                      ? "bg-primary text-black shadow-lg shadow-primary/20" 
                      : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  )}
                >
                  <Package size={14} className={activeTab === "items" ? "text-black" : "text-zinc-500"} />
                  Consumos ({items.length})
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="h-12 w-12 border-t-2 border-primary rounded-full animate-spin"></div>
                  <p className="text-zinc-500 font-black text-[10px] uppercase tracking-widest animate-pulse">Sincronizando...</p>
                </div>
              ) : activeTab === "payments" ? (
                <div className="space-y-4">
                  {payments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 opacity-20 filter grayscale">
                      <History className="h-16 w-16 mb-4 text-zinc-500" />
                      <p className="text-lg font-black uppercase tracking-widest text-zinc-500">Sin Movimientos</p>
                    </div>
                  ) : (
                    <>
                      {(() => {
                        const mainPayments = payments.filter(p => !p.parent_payment_id);
                        const getSubpayments = (parentId: string) => payments.filter(p => p.parent_payment_id === parentId);

                        return mainPayments.map((payment) => {
                          const subpayments = getSubpayments(payment.id);
                          const hasSubpayments = subpayments.length > 0;

                          return (
                            <div key={payment.id} className="group relative bg-zinc-900/40 border border-white/5 rounded-3xl p-5 hover:bg-zinc-900/60 hover:border-white/10 transition-all duration-500 overflow-hidden">
                              <div className="absolute top-0 right-0 p-5 opacity-5 group-hover:opacity-10 transition-opacity">
                                {getPaymentIcon(payment.payment_method)}
                              </div>
                              
                              <div className="flex items-start justify-between relative z-10">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                                      #{payment.payment_number || "---"}
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                      {getConceptLabel(payment.concept)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-3">
                                    {!hasSubpayments && (
                                      <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-xl border border-white/5">
                                        {getPaymentIcon(payment.payment_method)}
                                        <span className="text-[10px] font-black text-zinc-300 tracking-wider pr-2">{payment.payment_method}</span>
                                      </div>
                                    )}
                                    <div className="text-[10px] font-bold text-zinc-500 flex items-center gap-1.5">
                                      <Clock size={12} />
                                      {formatDateTime(payment.created_at)}
                                    </div>
                                  </div>

                                  {payment.notes && (
                                    <p className="text-[10px] font-medium text-zinc-500 italic bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 w-fit">
                                      “{payment.notes}”
                                    </p>
                                  )}
                                </div>

                                <div className="text-right">
                                  <div className="text-2xl font-black tracking-tighter text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                                    ${Number(payment.amount).toFixed(2)}
                                  </div>
                                  <div className="flex flex-col items-end gap-2 mt-2">
                                    <Badge className={cn(
                                      "text-[9px] font-black tracking-widest border-0",
                                      payment.status === "PAGADO" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                                    )}>
                                      {payment.status}
                                    </Badge>
                                    
                                    {payment.status === "PENDIENTE" && onCancelCharge && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleCancelPayment(payment.id, payment.concept || '', Number(payment.amount)); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 mt-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors border border-red-500/20"
                                        title="Cancelar Cargo"
                                      >
                                        <Trash2 size={12} />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Cancelar</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {hasSubpayments && (
                                <div className="mt-5 pt-5 border-t border-white/5 space-y-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-2">Desglose de Pago</div>
                                  {subpayments.map((sub) => (
                                    <div key={sub.id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5 group/sub hover:bg-white/10 transition-colors">
                                      <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-inner">
                                          {getPaymentIcon(sub.payment_method)}
                                        </div>
                                        <div>
                                          <div className="text-[10px] font-black text-white tracking-widest">{sub.payment_method}</div>
                                          {sub.reference && <div className="text-[9px] font-mono text-zinc-500">{sub.reference}</div>}
                                        </div>
                                      </div>
                                      <div className="text-sm font-black text-zinc-300">${Number(sub.amount).toFixed(2)}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 opacity-20 filter grayscale">
                      <Package className="h-16 w-16 mb-4 text-zinc-500" />
                      <p className="text-lg font-black uppercase tracking-widest text-zinc-500">Sin Cargos</p>
                    </div>
                  ) : (
                    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl overflow-hidden overflow-x-auto">
                      <table className="w-full text-left min-w-0">
                        <thead>
                          <tr className="bg-white/5">
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">CONCEPTO / PRODUCTO</th>
                            <th className="px-2 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 text-center">CANT.</th>
                            <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 text-right">PRECIO</th>
                            <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 text-right">TOTAL</th>
                            {onCancelItem && <th className="px-2 py-3 w-10"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {items.map((item) => {
                            const isCancelled = item.is_cancelled === true;
                            const isCancelMode = cancellingItemId === item.id;
                            const itemTotal = item.qty * Number(item.unit_price);
                            return (
                            <React.Fragment key={item.id}>
                            <tr className={cn(
                              "group transition-all duration-300",
                              isCancelled ? "opacity-50" : isCancelMode ? "bg-red-500/5" : "hover:bg-white/5"
                            )}>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "h-8 w-8 shrink-0 rounded-xl flex items-center justify-center border transition-all duration-300",
                                    isCancelled 
                                      ? "bg-red-900/20 border-red-500/20 text-red-500/50" 
                                      : isCancelMode
                                      ? "bg-red-500/20 border-red-500/30 text-red-400 animate-pulse"
                                      : "bg-zinc-900 border-white/5 text-zinc-400 group-hover:border-primary/30 group-hover:text-primary"
                                  )}>
                                    {isCancelled ? <XCircle size={14} /> : isCancelMode ? <XCircle size={14} /> : item.concept_type === 'CONSUMPTION' ? <Package size={14} /> : <Receipt size={14} />}
                                  </div>
                                  <div className="min-w-0">
                                    <div className={cn(
                                      "text-xs font-bold tracking-tight truncate",
                                      isCancelled ? "text-zinc-500 line-through" : isCancelMode ? "text-red-300" : "text-white"
                                    )}>
                                      {item.products?.name || getConceptLabel(item.concept_type || "Producto")}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[9px] font-black font-mono text-zinc-500 uppercase tracking-wider">{item.products?.sku || "SVC"}</span>
                                      {isCancelled && (
                                        <Badge className="text-[7px] font-black tracking-widest bg-red-500/10 text-red-400 border-red-500/20 px-1 py-0">
                                          CANCELADO
                                        </Badge>
                                      )}
                                    </div>
                                    {isCancelled && item.cancellation_reason && (
                                      <p className="text-[8px] text-red-400/60 italic mt-0.5 truncate max-w-[160px]" title={item.cancellation_reason}>
                                        "{item.cancellation_reason}"
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-4 text-center">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-md text-[10px] font-black font-mono border",
                                  isCancelled ? "bg-zinc-900/50 text-zinc-600 border-white/5" : "bg-zinc-900 text-zinc-300 border-white/5"
                                )}>
                                  x{item.qty}
                                </span>
                              </td>
                              <td className={cn(
                                "px-3 py-4 text-right font-mono text-xs",
                                isCancelled ? "text-zinc-600 line-through" : "text-zinc-400"
                              )}>
                                ${Number(item.unit_price).toFixed(2)}
                              </td>
                              <td className={cn(
                                "px-3 py-4 text-right font-black text-xs",
                                isCancelled ? "text-zinc-600 line-through" : isCancelMode ? "text-red-400" : "text-white"
                              )}>
                                ${itemTotal.toFixed(2)}
                              </td>
                              {onCancelItem && (
                                <td className="px-2 py-4 text-center">
                                  {!isCancelled && !isCancelMode && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCancellingItemId(item.id);
                                        setCancelReason("");
                                      }}
                                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors border border-red-500/20 opacity-0 group-hover:opacity-100"
                                      title="Cancelar item"
                                    >
                                      <XCircle size={12} />
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                            {/* Inline cancel panel */}
                            {isCancelMode && (
                              <tr>
                                <td colSpan={onCancelItem ? 5 : 4} className="p-0">
                                  <div className="bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border-t border-b border-red-500/20 px-4 py-3 animate-in slide-in-from-top-2 fade-in duration-300">
                                    <div className="flex items-center gap-2 mb-2">
                                      <AlertTriangle size={12} className="text-red-400 shrink-0" />
                                      <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                                        Cancelar — ${itemTotal.toFixed(2)} {item.is_paid ? '(REEMBOLSO)' : '(PENDIENTE)'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={cancelReason}
                                        onChange={(e) => setCancelReason(e.target.value)}
                                        placeholder="Motivo de cancelación..."
                                        className="flex-1 bg-zinc-900/80 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                                        disabled={cancellingLoading}
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') {
                                            setCancellingItemId(null);
                                            setCancelReason("");
                                          }
                                        }}
                                      />
                                      <button
                                        onClick={() => { setCancellingItemId(null); setCancelReason(""); }}
                                        className="px-3 py-2 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition-colors"
                                        disabled={cancellingLoading}
                                      >
                                        No
                                      </button>
                                      <button
                                        disabled={!cancelReason.trim() || cancellingLoading}
                                        onClick={async () => {
                                          if (!room || !onCancelItem || !cancelReason.trim()) return;
                                          setCancellingLoading(true);
                                          try {
                                            const success = await onCancelItem(item.id, room, cancelReason.trim());
                                            if (success) {
                                              setCancellingItemId(null);
                                              setCancelReason("");
                                              if (activeStay?.sales_order_id) {
                                                await fetchDetails(activeStay.sales_order_id);
                                              }
                                            }
                                          } finally {
                                            setCancellingLoading(false);
                                          }
                                        }}
                                        className={cn(
                                          "px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all",
                                          cancelReason.trim() && !cancellingLoading
                                            ? "bg-red-600 hover:bg-red-700 text-white border-red-500/50"
                                            : "bg-zinc-800 text-zinc-600 border-white/5 cursor-not-allowed"
                                        )}
                                      >
                                        {cancellingLoading ? "..." : "Cancelar"}
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                            </React.Fragment>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-white/5">
                            <td colSpan={onCancelItem ? 4 : 3} className="px-4 py-4 text-right">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                Subtotal Activo{cancelledCount > 0 && ` (${cancelledCount} cancelado${cancelledCount > 1 ? 's' : ''})`}
                              </span>
                            </td>
                            <td className="px-3 py-4 text-right">
                              <span className="text-lg font-black text-white">${totalItems.toFixed(2)}</span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Resumen y Detalles */}
          <div className="w-full md:w-[340px] shrink-0 bg-zinc-900/30 p-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            {/* Resumen de Venta Cards */}
            <div className="space-y-4">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 px-2">Resumen Financiero</div>
              
              {/* Total Card */}
              <div className="relative overflow-hidden bg-zinc-900/60 border border-white/10 rounded-3xl p-5 shadow-xl">
                <div className="absolute top-0 right-0 -mt-2 -mr-2 h-16 w-16 bg-blue-500/10 rounded-full blur-2xl"></div>
                <div className="relative flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Total de Venta</span>
                    <span className="text-2xl font-black text-white italic tracking-tighter">
                      ${Number(salesOrder?.total || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="h-10 w-10 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
                    <TrendingUp className="h-5 w-5 text-zinc-500" />
                  </div>
                </div>
              </div>

              {/* Pagado Card */}
              <div className="relative overflow-hidden bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-5 shadow-lg">
                <div className="absolute top-0 right-0 -mt-2 -mr-2 h-16 w-16 bg-emerald-500/10 rounded-full blur-2xl"></div>
                <div className="relative flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/70 block">Monto Pagado</span>
                    <span className="text-2xl font-black text-emerald-400 italic tracking-tighter">
                      ${Number(salesOrder?.paid_amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="h-10 w-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                    <Check className="h-5 w-5 text-emerald-400" />
                  </div>
                </div>
              </div>

              {/* Pendiente Card */}
              <div className={cn(
                "relative overflow-hidden border rounded-3xl p-5 shadow-lg",
                Number(salesOrder?.remaining_amount || 0) > 0
                  ? "bg-amber-500/5 border-amber-500/20"
                  : "bg-emerald-500/5 border-emerald-500/20"
              )}>
                <div className="absolute top-0 right-0 -mt-2 -mr-2 h-16 w-16 bg-amber-500/10 rounded-full blur-2xl"></div>
                <div className="relative flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-70 block">Saldo Pendiente</span>
                    <span className={cn(
                      "text-3xl font-black italic tracking-tighter",
                      Number(salesOrder?.remaining_amount || 0) > 0 ? "text-amber-400" : "text-emerald-400"
                    )}>
                      ${Number(salesOrder?.remaining_amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="h-10 w-10 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
                    <ArrowRight className="h-5 w-5 text-zinc-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Detalles de Estancia */}
            <div className="space-y-4 pt-4">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 px-2">Detalles de Estancia</div>
              
              <div className="bg-zinc-900/60 border border-white/10 rounded-3xl p-6 space-y-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 shrink-0 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 text-blue-400">
                    <Calendar size={18} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-tighter text-zinc-500">Check-In</span>
                    <div className="text-xs font-bold text-white font-mono">{activeStay?.check_in_at ? formatDateTime(activeStay.check_in_at) : '—'}</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 shrink-0 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 text-amber-400">
                    <Clock size={18} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-tighter text-zinc-500">Salida Esperada</span>
                    <div className="text-xs font-bold text-white font-mono">{activeStay?.expected_check_out_at ? formatDateTime(activeStay.expected_check_out_at) : '—'}</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 shrink-0 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20 text-purple-400">
                    <Users size={18} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-tighter text-zinc-500">Huéspedes</span>
                    <div className="text-xs font-bold text-white">{activeStay?.total_people || 2} Personas</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Activos (Controles) */}
            <div className="space-y-4 pt-4">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 px-2 flex justify-between items-center">
                <span>Activos de Habitación</span>
              </div>
              <div className={cn(
                "bg-zinc-900/60 border rounded-3xl p-6 relative overflow-hidden group transition-all",
                tvRemoteAsset?.status === 'EXTRAVIADO' ? 'border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : 'border-white/10'
              )}>
                <div className="flex items-center gap-4 relative z-10">
                  <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center border",
                    tvRemoteAsset?.status === 'EXTRAVIADO' ? 'bg-red-500/20 border-red-500/30 text-red-500' : 'bg-zinc-800 border-white/10 text-zinc-400'
                  )}>
                    <Tv size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-black text-white italic tracking-tighter leading-none mb-1">
                      Control de TV
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn(
                        "text-[10px] font-black font-mono px-2 py-0.5 rounded border uppercase tracking-widest",
                        getAssetStatusColor(tvRemoteAsset?.status || 'SIN_REGISTRO')
                      )}>
                        {formatAssetStatus(tvRemoteAsset?.status || 'SIN_REGISTRO')}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Acciones para el control */}
                {(!tvRemoteAsset || tvRemoteAsset.status === 'EN_RECEPCION' || tvRemoteAsset.status === 'EXTRAVIADO') && (
                  <Button
                    onClick={() => setIsAssignAssetModalOpen(true)}
                    className="w-full mt-4 bg-primary text-black hover:bg-primary/90 font-black tracking-widest uppercase text-[10px] rounded-xl h-10"
                    size="sm"
                  >
                    Asignar a Cochero
                  </Button>
                )}
              </div>
            </div>

            {/* Vehículo registrado */}
            {activeStay?.vehicle_plate && (
              <div className="space-y-4 pt-4">
                <div className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 px-2">Vehículo Registrado</div>
                <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 relative overflow-hidden group">
                  <div className="absolute -right-4 -bottom-4 opacity-5 transform rotate-[-15deg] group-hover:rotate-0 transition-transform duration-700">
                    <Car size={120} />
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="h-12 w-12 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 text-primary shadow-lg shadow-primary/20">
                      <Car size={24} />
                    </div>
                    <div>
                      <div className="text-sm font-black text-white italic tracking-tighter leading-none mb-1">
                        {activeStay.vehicle_brand} {activeStay.vehicle_model}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                          {activeStay.vehicle_plate}
                        </span>
                        <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">PLACAS</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 shrink-0 border-t border-white/5 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500">ID de Orden</span>
              <span className="text-[11px] font-mono text-zinc-400">{salesOrder?.id?.substring(0, 13).toUpperCase() || "—"}</span>
            </div>
          </div>
          <Button 
            onClick={onClose}
            className="rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest px-8 h-12 transition-all duration-300"
            variant="outline"
          >
            Cerrar Detalles
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <AssignAssetModal 
      isOpen={isAssignAssetModalOpen}
      onClose={() => setIsAssignAssetModalOpen(false)}
      room={room}
      assetType="TV_REMOTE"
      onSuccess={fetchAssetDetails}
    />

    {/* Cancel Item Modal */}

    </>
  );
}
