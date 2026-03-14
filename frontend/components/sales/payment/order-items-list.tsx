"use client";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Trash2, Percent, MoreHorizontal, AlertTriangle, ArrowRightLeft, Clock, CheckCircle2 } from "lucide-react";
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
            {totalDiscount > 0 && (
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
              const isLocked = !isPayable || hasUnconfirmedValetPayments;

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
                  {hasUnconfirmedValetPayments && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-[1px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded shadow-sm border border-red-500/20">
                        Corrobora el cobro del cochero primero
                      </span>
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
                            Entrega Pendiente
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
