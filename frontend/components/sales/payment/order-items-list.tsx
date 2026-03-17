"use client";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Trash2, Percent, MoreHorizontal, AlertTriangle, ArrowRightLeft, Clock, CheckCircle2, X } from "lucide-react";
import { OrderItem } from "@/hooks/use-granular-payment";
import { CONCEPT_ICONS, CONCEPT_LABELS, formatCurrency } from "./utils";

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

              return (
                <div
                  key={item.id}
                  className={cn(
                    "group relative flex flex-col gap-2 p-3 rounded-xl border transition-all duration-200",
                    selectedItems.has(item.id)
                      ? "bg-primary/5 border-primary/30 shadow-sm"
                      : isLocked
                        ? "bg-muted/10 border-border/30 opacity-70 cursor-not-allowed"
                        : "bg-card border-border/50 hover:bg-muted/30 hover:border-primary/20"
                  )}
                >
                  {isLocked && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity border-2 border-dashed border-destructive/30">
                      <div className="flex flex-col items-center gap-2 px-4 py-2 bg-destructive/10 rounded-lg border border-destructive/50 shadow-lg">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <span className="text-sm font-black text-destructive uppercase tracking-tighter">
                          {hasPendingCorroboration 
                            ? "Corroboración Requerida"
                            : hasUnconfirmedValetPayments 
                                ? "Cobro de Cochero Pendiente"
                                : item.concept_type === 'CONSUMPTION' || item.concept_type === 'PRODUCT'
                                  ? "Entrega Pendiente"
                                  : "Pendiente de Datos de Pago"
                          }
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3 select-none">
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                      disabled={isLocked}
                      className="mt-1 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />

                    <div className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-muted-foreground transition-colors",
                      selectedItems.has(item.id) && "bg-primary/10 text-primary"
                    )}>
                      {CONCEPT_ICONS[item.concept_type] || <MoreHorizontal />}
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex justify-between items-start gap-2">
                        <p className={cn(
                          "font-semibold text-sm leading-tight",
                          selectedItems.has(item.id) ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )}>
                          {getItemDescription(item)}
                        </p>
                        <div className="text-right leading-tight">
                          {itemDiscount > 0 ? (
                            <>
                              <p className="text-[10px] line-through text-muted-foreground">{formatCurrency(getItemTotal(item))}</p>
                              <p className="font-bold text-green-600 dark:text-green-400 text-sm">{formatCurrency(finalTotal)}</p>
                            </>
                          ) : (
                            <p className={cn("font-bold text-sm", isRefundItem(item) ? "text-red-500" : "text-foreground")}>
                              {formatCurrency(finalTotal)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Info adicional (descuentos, estado entrega, etc) */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {!isPayable && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500 bg-amber-500/5 px-1 h-5">
                            <Clock className="h-3 w-3 mr-1" />
                            {item.concept_type === 'CONSUMPTION' || item.concept_type === 'PRODUCT' 
                              ? "Entrega Pendiente" 
                              : "Pendiente de Datos de Pago"}
                          </Badge>
                        )}
                        {itemDiscount > 0 && (
                          <Badge variant="secondary" className="text-[10px] bg-green-500/20 text-green-600 px-1 h-5 cursor-pointer hover:bg-green-500/30" onClick={() => removeDiscount(item.id)}>
                            Desc: -{formatCurrency(itemDiscount)} ×
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Acciones del item */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!item.is_paid && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setShowDiscountInput(showDiscountInput === item.id ? null : item.id)}>
                            <Percent className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDeleteId(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Input de Descuento Overlay */}
                  {showDiscountInput === item.id && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl px-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-2 w-full max-w-xs">
                        <div className="relative flex-1">
                          <Input
                            type="number"
                            placeholder="0"
                            min="0"
                            max="100"
                            className="h-9 pr-8 text-sm font-bold bg-muted"
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
                          <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        </div>
                        <Button 
                          size="sm" 
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-9"
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
                          className="h-9 w-9" 
                          onClick={() => setShowDiscountInput(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Confirmación de Eliminación Overlay */}
                  {confirmDeleteId === item.id && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-destructive/10 backdrop-blur-sm rounded-xl px-4 animate-in fade-in zoom-in-95 duration-200 border-2 border-destructive/20 shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <p className="text-xs font-black text-destructive uppercase tracking-widest">¿Eliminar este concepto?</p>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="font-bold h-8 px-4 shadow-lg shadow-destructive/20"
                            onClick={() => {
                              deleteUnpaidItem(item.id);
                              setConfirmDeleteId(null);
                            }}
                          >
                            Sí, Eliminar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="font-bold h-8 px-4 bg-background hover:bg-muted"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            No
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
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
            Conceptos Pagados ({paidItems.length})
          </h3>
          <div className="space-y-2">
            {paidItems.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30 border-border/50 opacity-80">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-sm text-foreground">{getItemDescription(item)}</p>
                    <p className="font-bold text-sm text-muted-foreground">{formatCurrency(item.total)}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600 bg-green-500/5 px-1 h-5">
                      PAGADO
                    </Badge>
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
