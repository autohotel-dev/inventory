"use client";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Trash2, Percent, MoreHorizontal, AlertTriangle, ArrowRightLeft, Clock, CheckCircle2, X } from "lucide-react";
import { CONCEPT_ICONS, CONCEPT_LABELS, OrderItem } from "./payment-constants";
import { formatCurrency } from "./utils";

interface OrderItemsListProps {
  items: OrderItem[];
  pendingItems: OrderItem[];
  paidItems: OrderItem[];
  selectedItems: Set<string>;
  valetPayments: any[];
  discounts: Record<string, number>;
  showDiscountInput: string | null;
  deletingItemId: string | null;
  confirmDeleteId: string | null;
  totalDiscount: number;
  getItemDescription: (item: OrderItem) => string;
  getItemTotal: (item: OrderItem) => number;
  isItemPayable: (item: OrderItem) => boolean;
  toggleItem: (itemId: string) => void;
  applyDiscount: (itemId: string, amount: number) => void;
  removeDiscount: (itemId: string) => void;
  deleteUnpaidItem: (itemId: string) => void;
  forceUnlockItem: (itemId: string) => void;
  setShowDiscountInput: (id: string | null) => void;
  setConfirmDeleteId: (id: string | null) => void;
  isRefundItem: (item: OrderItem) => boolean;
  getPaymentInfo: (item: OrderItem) => any;
  setAuthDialog: (dialog: any) => void;
  hasPendingCorroboration?: boolean;
}

export function OrderItemsList({
  items,
  pendingItems,
  paidItems,
  selectedItems,
  valetPayments,
  discounts,
  showDiscountInput,
  deletingItemId,
  confirmDeleteId,
  totalDiscount,
  getItemDescription,
  getItemTotal,
  isItemPayable,
  toggleItem,
  applyDiscount,
  removeDiscount,
  deleteUnpaidItem,
  forceUnlockItem,
  setShowDiscountInput,
  setConfirmDeleteId,
  isRefundItem,
  getPaymentInfo,
  setAuthDialog,
  hasPendingCorroboration = false,
}: OrderItemsListProps) {
  return (
    <div className="space-y-8">
      {/* Conceptos Pendientes */}
      {pendingItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
              Conceptos Pendientes ({pendingItems.length})
            </h3>
            {hasPendingCorroboration && (
              <Badge variant="destructive" className="animate-pulse bg-red-500/20 text-red-500 border-red-500/30">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Corroboración Requerida
              </Badge>
            )}
            {totalDiscount > 0 && !hasPendingCorroboration && (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">
                <Tag className="h-3 w-3 mr-1" />
                Descuento: -{formatCurrency(totalDiscount)}
              </Badge>
            )}
          </div>
          
          <div className="space-y-2">
            {pendingItems.map((item) => {
              const itemDiscount = discounts[item.id] || 0;
              const finalTotal = getItemTotal(item) - itemDiscount;
              const hasUnconfirmedValetPayments = valetPayments.some(p => !p.confirmed_at);
              const isPayable = isItemPayable(item);
              const isLocked = !isPayable || hasUnconfirmedValetPayments || hasPendingCorroboration;
              const isSelected = selectedItems.has(item.id);

              return (
                <div
                  key={item.id}
                  className={cn(
                    "group relative overflow-hidden flex flex-col rounded-2xl border transition-all duration-300",
                    isSelected 
                      ? "bg-primary/10 border-primary/30 shadow-[0_0_20px_-10px_var(--primary)]" 
                      : isLocked
                        ? "bg-zinc-950/20 border-white/5 opacity-60 grayscale cursor-not-allowed"
                        : "bg-zinc-900/40 border-white/5 hover:border-white/10 hover:bg-zinc-900/60 cursor-pointer"
                  )}
                  onClick={() => !isLocked && toggleItem(item.id)}
                >
                  {/* Glass Background Pulse */}
                  {isSelected && (
                    <div className="absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 bg-primary/20 blur-3xl rounded-full animate-pulse pointer-events-none" />
                  )}

                  <div className="flex items-center gap-4 p-4 relative z-10">
                    {/* Icon Area */}
                    <div className={cn(
                      "relative flex items-center justify-center h-12 w-12 rounded-xl border transition-all duration-500 shrink-0",
                      isSelected 
                        ? "bg-primary border-primary shadow-[0_0_15px_-5px_var(--primary)] rotate-[360deg]" 
                        : "bg-zinc-800/80 border-white/5 group-hover:border-white/20"
                    )}>
                      {isSelected ? (
                        <CheckCircle2 className="h-6 w-6 text-primary-foreground stroke-[3]" />
                      ) : (
                        <div className="text-zinc-500 group-hover:text-primary transition-colors">
                          {CONCEPT_ICONS[item.concept_type] || <MoreHorizontal className="h-5 w-5" />}
                        </div>
                      )}
                      {isLocked && (
                        <div className="absolute -top-1 -right-1 bg-zinc-950 rounded-full p-0.5 border border-white/10">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
                          {isLocked ? "Contenido Bloqueado" : "Pendiente de Cobro"}
                        </span>
                        {itemDiscount > 0 && (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-1.5 h-4 text-[9px] font-black">
                            -{formatCurrency(itemDiscount)}
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-black text-base text-zinc-200 truncate tracking-tight">
                        {getItemDescription(item)}
                      </h4>
                      
                      {isLocked && (
                        <p className="text-[9px] font-bold text-amber-500/70 uppercase tracking-widest mt-1">
                          {hasPendingCorroboration 
                            ? "Falta Corroborar por Recepcionista"
                            : hasUnconfirmedValetPayments 
                              ? "Esperando que Cochero registre cobro"
                              : "Entrega o datos pendientes"}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex flex-col items-end">
                        {itemDiscount > 0 && (
                          <span className="text-[10px] line-through text-zinc-600 font-bold mb-0.5">{formatCurrency(getItemTotal(item))}</span>
                        )}
                        <span className={cn(
                          "text-xl font-black tracking-tighter transition-colors",
                          isSelected ? "text-primary drop-shadow-[0_0_10px_rgba(var(--primary),0.3)]" : "text-white"
                        )}>
                          {formatCurrency(finalTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    {!isLocked && (
                      <div className="flex flex-col gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-zinc-500 hover:text-primary hover:bg-white/5 rounded-xl transition-all" 
                          onClick={(e) => { e.stopPropagation(); setShowDiscountInput(showDiscountInput === item.id ? null : item.id); }}
                        >
                          <Percent className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all" 
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(item.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Overlays (Inside the Item Card Container) */}
                  {showDiscountInput === item.id && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md px-4 animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
                      <div className="flex items-center gap-2 w-full max-w-xs scale-105">
                        <div className="relative flex-1">
                          <Input
                            type="number"
                            placeholder="0"
                            min="0"
                            max="100"
                            className="h-10 pr-8 text-sm font-black bg-zinc-900 border-white/10 text-white rounded-xl"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = Number((e.target as HTMLInputElement).value);
                                if (val >= 0 && val <= 100) {
                                  applyDiscount(item.id, val);
                                  setShowDiscountInput(null);
                                }
                              } else if (e.key === 'Escape') {
                                setShowDiscountInput(null);
                              }
                            }}
                          />
                          <Percent className="absolute right-3 top-3 h-4 w-4 text-zinc-500" />
                        </div>
                        <Button 
                          size="sm" 
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-black h-10 px-4 rounded-xl shadow-lg shadow-primary/20"
                          onClick={(e) => {
                            const input = (e.currentTarget.previousElementSibling as HTMLElement).querySelector('input');
                            if (input) {
                              const val = Number(input.value);
                              if (val >= 0 && val <= 100) {
                                applyDiscount(item.id, val);
                                setShowDiscountInput(null);
                              }
                            }
                          }}
                        >
                          Aplicar
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-10 w-10 text-zinc-400 hover:text-white rounded-xl" 
                          onClick={(e) => { e.stopPropagation(); setShowDiscountInput(null); }}
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {confirmDeleteId === item.id && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-red-950/60 backdrop-blur-md px-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex flex-col items-center gap-3 text-center scale-105">
                        <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                          <Trash2 className="h-5 w-5 text-red-500" />
                        </div>
                        <p className="text-xs font-black text-white uppercase tracking-widest">¿Eliminar este concepto?</p>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="bg-red-500 hover:bg-red-600 text-white font-black h-9 px-6 rounded-xl shadow-lg shadow-red-500/40"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteUnpaidItem(item.id);
                              setConfirmDeleteId(null);
                            }}
                          >
                            Eliminar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="font-black h-9 px-6 bg-transparent border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white rounded-xl"
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Conceptos Pagados */}
      {paidItems.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Conceptos Pagados ({paidItems.length})
            </h3>
            <div className="h-px flex-1 bg-white/5"></div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {paidItems.map(item => (
              <div 
                key={item.id} 
                className="flex items-center gap-4 p-4 rounded-xl border bg-zinc-950/40 border-white/5 opacity-60 hover:opacity-100 transition-all duration-300"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="font-black text-sm text-zinc-300 truncate tracking-tight">{getItemDescription(item)}</p>
                    <p className="font-black text-sm text-zinc-400">{formatCurrency(item.total)}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/70 py-0.5 px-1.5 bg-emerald-500/5 rounded border border-emerald-500/10">
                      PAGADO EXITOSAMENTE
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
