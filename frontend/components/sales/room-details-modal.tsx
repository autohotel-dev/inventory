"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Receipt, Banknote, CreditCard, Building2, Package, Clock, Users, DollarSign, Car, Calendar, ArrowRight, TrendingUp, History, Info, Check, Trash2, XCircle, AlertTriangle, ChevronDown, ChevronUp, UserCheck, Zap } from "lucide-react";
import { Room, RoomStay } from "@/components/sales/room-types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssignAssetModal } from "@/components/rooms/modals/assign-asset-modal";
import { Tv } from "lucide-react";
import { useRoomDetails } from "@/hooks/use-room-details";

export interface RoomDetailsModalProps {
  isOpen: boolean;
  room: Room | null;
  activeStay: RoomStay | null;
  onClose: () => void;
  employeeId?: string | null;
  onCancelCharge?: (paymentId: string, room: Room, concept: string, amount: number) => Promise<boolean>;
  onCancelItem?: (itemId: string, room: Room, reason: string) => Promise<boolean>;
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
  const {
    payments, items, salesOrder, tvRemoteAsset, loading, activeTab,
    cancellingItemId, cancelReason, cancellingLoading,
    bulkSelectMode, selectedForCancel, bulkCancelReason, bulkCancelLoading,
    isAssignAssetModalOpen,
    assetAuditLogs, showAuditTrail, auditLoading,
    totalPayments, totalItems, cancelledCount, cancellableItems,
    selectedCancelCount, selectedCancelTotal,
    setActiveTab, setCancellingItemId, setCancelReason,
    setBulkSelectMode, setBulkCancelReason,
    setIsAssignAssetModalOpen,
    setShowAuditTrail,
    handleCancelPayment, handleSingleCancel, handleBulkCancel,
    toggleBulkSelect, selectAllCancellable, deselectAllCancel,
    fetchAssetDetails, fetchAssetAuditTrail,
    getConceptLabel, formatDateTime, getAssetStatusColor, formatAssetStatus,
  } = useRoomDetails({ isOpen, room, activeStay, onCancelCharge, onCancelItem });

  if (!isOpen || !room) return null;

  // Map payment icon strings to JSX elements for render
  const renderPaymentIcon = (method: string) => {
    switch (method) {
      case "EFECTIVO": return <Banknote className="h-4 w-4 text-emerald-400" />;
      case "TARJETA": return <CreditCard className="h-4 w-4 text-sky-400" />;
      case "TRANSFERENCIA": return <Building2 className="h-4 w-4 text-violet-400" />;
      default: return <Receipt className="h-4 w-4 text-zinc-400" />;
    }
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
                                {renderPaymentIcon(payment.payment_method)}
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
                                        {renderPaymentIcon(payment.payment_method)}
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
                                          {renderPaymentIcon(sub.payment_method)}
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
                    <>
                    <div className="bg-zinc-900/40 border border-white/5 rounded-3xl overflow-hidden overflow-x-auto">
                      {/* Bulk cancel toolbar */}
                      {onCancelItem && (
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-900/60">
                          {bulkSelectMode ? (
                            <div className="flex items-center gap-3 w-full">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={selectedCancelCount === cancellableItems.length ? deselectAllCancel : selectAllCancellable}
                                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition-colors"
                                >
                                  {selectedCancelCount === cancellableItems.length ? 'Deseleccionar' : 'Seleccionar Todos'}
                                </button>
                                {selectedCancelCount > 0 && (
                                  <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] font-black">
                                    {selectedCancelCount} seleccionado{selectedCancelCount > 1 ? 's' : ''} · ${selectedCancelTotal.toFixed(2)}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex-1" />
                              <button
                                onClick={() => { setBulkSelectMode(false); deselectAllCancel(); setBulkCancelReason(""); }}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-white/10 transition-colors"
                              >
                                Cancelar Selección
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                                {cancellableItems.length} concepto{cancellableItems.length !== 1 ? 's' : ''} activo{cancellableItems.length !== 1 ? 's' : ''}
                              </span>
                              {cancellableItems.length > 1 && (
                                <button
                                  onClick={() => setBulkSelectMode(true)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                                >
                                  <XCircle size={12} />
                                  Cancelar Varios
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      <table className="w-full text-left min-w-0">
                        <thead>
                          <tr className="bg-white/5">
                            {bulkSelectMode && <th className="px-2 py-3 w-10"></th>}
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">CONCEPTO / PRODUCTO</th>
                            <th className="px-2 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 text-center">CANT.</th>
                            <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 text-right">PRECIO</th>
                            <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 text-right">TOTAL</th>
                            {onCancelItem && !bulkSelectMode && <th className="px-2 py-3 w-10"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {items.map((item) => {
                            const isCancelled = item.is_cancelled === true;
                            const isCancelMode = cancellingItemId === item.id;
                            const itemTotal = item.qty * Number(item.unit_price);
                            const isSelectedForBulk = selectedForCancel.has(item.id);
                            return (
                            <React.Fragment key={item.id}>
                            <tr
                              className={cn(
                                "group transition-all duration-300",
                                isCancelled ? "opacity-50" : isCancelMode ? "bg-red-500/5" : isSelectedForBulk ? "bg-red-500/10" : "hover:bg-white/5"
                              )}
                              onClick={bulkSelectMode && !isCancelled ? () => toggleBulkSelect(item.id) : undefined}
                              style={bulkSelectMode && !isCancelled ? { cursor: 'pointer' } : undefined}
                            >
                              {bulkSelectMode && (
                                <td className="px-2 py-4 text-center">
                                  {!isCancelled && (
                                    <div className={cn(
                                      "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all mx-auto",
                                      isSelectedForBulk
                                        ? "bg-red-500 border-red-500 text-white"
                                        : "border-zinc-600 hover:border-red-400"
                                    )}>
                                      {isSelectedForBulk && <Check size={12} />}
                                    </div>
                                  )}
                                </td>
                              )}
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
                              {onCancelItem && !bulkSelectMode && (
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
                                <td colSpan={(onCancelItem && !bulkSelectMode ? 5 : bulkSelectMode ? 5 : 4)} className="p-0">
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
                                        onClick={handleSingleCancel}
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
                            <td colSpan={(onCancelItem && !bulkSelectMode ? 4 : bulkSelectMode ? 4 : 3)} className="px-4 py-4 text-right">
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

                    {/* Bulk cancel confirmation panel */}
                    {bulkSelectMode && selectedCancelCount > 0 && (
                      <div className="mt-4 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border border-red-500/20 rounded-2xl p-5 animate-in slide-in-from-bottom-4 fade-in duration-300">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle size={14} className="text-red-400" />
                          <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                            Cancelar {selectedCancelCount} item{selectedCancelCount > 1 ? 's' : ''} — ${selectedCancelTotal.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={bulkCancelReason}
                            onChange={(e) => setBulkCancelReason(e.target.value)}
                            placeholder="Motivo de cancelación (obligatorio)..."
                            className="flex-1 bg-zinc-900/80 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-red-500/40"
                            disabled={bulkCancelLoading}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setBulkSelectMode(false);
                                deselectAllCancel();
                                setBulkCancelReason("");
                              }
                              if (e.key === 'Enter' && bulkCancelReason.trim()) {
                                handleBulkCancel();
                              }
                            }}
                          />
                          <button
                            disabled={!bulkCancelReason.trim() || bulkCancelLoading}
                            onClick={handleBulkCancel}
                            className={cn(
                              "px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                              bulkCancelReason.trim() && !bulkCancelLoading
                                ? "bg-red-600 hover:bg-red-700 text-white border-red-500/50 shadow-lg shadow-red-500/20"
                                : "bg-zinc-800 text-zinc-600 border-white/5 cursor-not-allowed"
                            )}
                          >
                            {bulkCancelLoading ? `Cancelando...` : `Cancelar ${selectedCancelCount}`}
                          </button>
                        </div>
                      </div>
                    )}
                    </>
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
                {(!tvRemoteAsset || tvRemoteAsset.status !== 'EXTRAVIADO') && (
                  <Button
                    onClick={() => setIsAssignAssetModalOpen(true)}
                    className="w-full mt-4 bg-primary text-black hover:bg-primary/90 font-black tracking-widest uppercase text-[10px] rounded-xl h-10"
                    size="sm"
                  >
                    Asignar Cochero para Encender TV
                  </Button>
                )}

                {/* Audit Trail Toggle */}
                <button
                  onClick={() => {
                    if (!showAuditTrail) fetchAssetAuditTrail();
                    setShowAuditTrail(!showAuditTrail);
                  }}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <History size={12} />
                  <span>Historial de Auditoría</span>
                  {showAuditTrail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {/* Audit Trail Timeline */}
                {showAuditTrail && (
                  <div className="mt-2 space-y-0 border-l-2 border-zinc-800 ml-4 pl-4">
                    {auditLoading ? (
                      <div className="flex items-center gap-2 py-4 text-zinc-500 text-xs">
                        <div className="animate-spin h-3 w-3 border border-zinc-600 rounded-full border-t-transparent" />
                        Cargando historial...
                      </div>
                    ) : assetAuditLogs.length === 0 ? (
                      <div className="py-4 text-zinc-600 text-xs text-center">Sin registros de auditoría</div>
                    ) : (
                           assetAuditLogs.map((log) => {
                        const ACTION_MAP: Record<string, { label: string; color: string; dotClass: string }> = {
                          ASSIGNED_TO_COCHERO_FOR_TV: { label: 'Asignación', color: 'text-amber-400', dotClass: 'bg-amber-500 border-amber-600' },
                          ASSIGNED_TO_COCHERO: { label: 'Asignación', color: 'text-amber-400', dotClass: 'bg-amber-500 border-amber-600' },
                          CONFIRMED_TV_ON: { label: 'TV Confirmada', color: 'text-emerald-400', dotClass: 'bg-emerald-500 border-emerald-600' },
                          DROPPED_IN_ROOM: { label: 'Dejado en Habitación', color: 'text-blue-400', dotClass: 'bg-blue-500 border-blue-600' },
                          VERIFIED_IN_ROOM: { label: 'Verificado en Habitación', color: 'text-emerald-400', dotClass: 'bg-emerald-500 border-emerald-600' },
                          MARKED_MISSING: { label: 'Extraviado', color: 'text-red-400', dotClass: 'bg-red-500 border-red-600' },
                        };
                        const STATUS_MAP: Record<string, string> = {
                          EN_HABITACION: 'En Habitación',
                          PENDIENTE_ENCENDIDO: 'Pendiente Encendido',
                          TV_ENCENDIDA: 'TV Encendida',
                          EXTRAVIADO: 'Extraviado',
                          SIN_REGISTRO: 'Sin Registro',
                        };
                        const actionMeta = ACTION_MAP[log.action_type] || { label: log.action_type.replace(/_/g, ' '), color: 'text-zinc-400', dotClass: 'bg-zinc-500 border-zinc-600' };
                        const isAssign = log.action_type.startsWith('ASSIGNED');
                        const isConfirm = log.action_type === 'CONFIRMED_TV_ON' || log.action_type === 'VERIFIED_IN_ROOM';
                        const isMissing = log.action_type === 'MARKED_MISSING';
                        return (
                          <div key={log.log_id} className="relative pb-4 last:pb-0">
                            <div className={cn(
                              "absolute -left-[calc(1rem+5px)] top-0.5 h-2.5 w-2.5 rounded-full border-2",
                              isAssign ? "bg-amber-500 border-amber-600" :
                              isConfirm ? "bg-emerald-500 border-emerald-600" :
                              isMissing ? "bg-red-500 border-red-600" :
                              actionMeta.dotClass
                            )} />
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                {isAssign && <Zap size={10} className="text-amber-400" />}
                                {isConfirm && <Check size={10} className="text-emerald-400" />}
                                {isMissing && <AlertTriangle size={10} className="text-red-400" />}
                                <span className={cn(
                                  "text-[10px] font-black uppercase tracking-wider",
                                  actionMeta.color
                                )}>
                                  {actionMeta.label}
                                </span>
                              </div>
                              <div className="text-[9px] text-zinc-500 font-mono">
                                {new Date(log.created_at).toLocaleString('es-MX', {
                                  day: '2-digit', month: 'short', year: '2-digit',
                                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                                })}
                              </div>
                              <div className="text-[10px] text-zinc-400 mt-0.5">
                                {isAssign ? (
                                  <>
                                    <span className="text-zinc-500">Por:</span>{' '}
                                    <span className="font-bold text-zinc-300">{log.action_by_name}</span>{' '}
                                    <span className="text-zinc-500">→</span>{' '}
                                    <UserCheck size={10} className="inline text-amber-400 mb-0.5" />{' '}
                                    <span className="font-bold text-amber-300">{log.assigned_to_name}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-zinc-500">Por:</span>{' '}
                                    <span className="font-bold text-zinc-300">{log.action_by_name}</span>
                                  </>
                                )}
                              </div>
                              <div className="text-[9px] text-zinc-600 flex items-center gap-1 mt-0.5">
                                <span className="font-mono">{log.previous_status ? (STATUS_MAP[log.previous_status] || log.previous_status.replace(/_/g, ' ')) : '—'}</span>
                                <ArrowRight size={8} />
                                <span className="font-mono font-bold">{STATUS_MAP[log.new_status] || log.new_status.replace(/_/g, ' ')}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
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
