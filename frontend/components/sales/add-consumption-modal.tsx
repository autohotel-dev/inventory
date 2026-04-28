"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ShoppingCart, Search, Plus, Minus, X, Loader2, Package,
  Trash2, Barcode, Check, AlertCircle, Tag
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SelectPackageDrinksModal } from "./select-package-drinks-modal";
import { useConsumptionCart } from "@/hooks/use-consumption-cart";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";

interface AddConsumptionModalProps {
  isOpen: boolean;
  salesOrderId: string;
  roomNumber?: string;
  onClose: () => void;
  onComplete: () => void;
}

export function AddConsumptionModal({
  isOpen, salesOrderId, roomNumber, onClose, onComplete,
}: AddConsumptionModalProps) {
  const hook = useConsumptionCart({ isOpen, salesOrderId, roomNumber, onComplete });

  const {
    products, loading, processing, searchValue, cartItems, lastAddedId, inputError, selectedRow,
    editingItemId, editQty, editIsCourtesy, editCourtesyReason,
    isPackageModalOpen, pendingBottle, activePackageRule,
    isPrinting, printStatus,
    totalAmount, totalItems, totalSaved, cartItemsArray,
    setSearchValue, setSelectedRow, setEditingItemId, setEditQty, setEditIsCourtesy, setEditCourtesyReason,
    setIsPackageModalOpen, setPendingBottle, setActivePackageRule,
    handleInputChange, handleSearchKeyDown,
    addToCart, removeFromCart, incrementQty, decrementQty,
    openEditQty, confirmEditQty, handlePackageConfirm,
    processConsumption, ensureFocus,
    formatCurrency, calcItemPromoTotal, findPromoForProduct,
    inputRef, editInputRef,
  } = hook;

  // Keyboard shortcuts (need onClose from props)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'F2') {
        e.preventDefault();
        if (cartItems.size > 0 && !processing) processConsumption();
      }
      if (e.key === 'Escape') {
        if (editingItemId) { setEditingItemId(null); ensureFocus(); }
        else onClose();
      }
      if (e.key === 'Delete' && selectedRow >= 0 && !editingItemId) {
        const items = Array.from(cartItems.values());
        if (items[selectedRow]) removeFromCart(items[selectedRow].product.id);
      }
      if (e.key === 'ArrowDown' && !editingItemId) {
        e.preventDefault();
        setSelectedRow(prev => Math.min(prev + 1, cartItems.size - 1));
      }
      if (e.key === 'ArrowUp' && !editingItemId) {
        e.preventDefault();
        setSelectedRow(prev => Math.max(prev - 1, -1));
      }
      if (e.key === 'Enter' && selectedRow >= 0 && !editingItemId && document.activeElement !== inputRef.current) {
        const items = Array.from(cartItems.values());
        if (items[selectedRow]) openEditQty(items[selectedRow]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, cartItems, selectedRow, editingItemId, processing, ensureFocus, onClose]);

  if (!isOpen) return null;


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={ensureFocus}
    >
      <div
        className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Processing overlay */}
        <ProcessingOverlay
          isVisible={processing || isPrinting}
          title="Registrando consumo"
          steps={[
            { label: "Guardando consumo...", icon: "payment" },
            { label: "Imprimiendo comanda...", icon: "printer" },
          ]}
          autoCycleMs={2500}
        />
        {isPackageModalOpen && pendingBottle && activePackageRule && (
          <SelectPackageDrinksModal
            isOpen={isPackageModalOpen}
            onClose={() => {
              setIsPackageModalOpen(false);
              setPendingBottle(null);
              setActivePackageRule(null);
              ensureFocus();
            }}
            onConfirm={handlePackageConfirm}
            bottleProduct={pendingBottle}
            includedCategoryId={activePackageRule.included_category_id}
            requiredQuantity={activePackageRule.quantity}
            categoryName={(activePackageRule as any).included_category?.name || "Bebidas"}
          />
        )}
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">CONSUMO</h2>
              {roomNumber && (
                <p className="text-sm text-muted-foreground">Habitación {roomNumber}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={processing}
            className="hover:bg-destructive/20 hover:text-destructive"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Input de escaneo */}
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <div className="relative">
            <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={searchValue}
              onChange={handleInputChange}
              onKeyDown={handleSearchKeyDown}
              placeholder="Escanear código de barras o buscar producto..."
              className={cn(
                "pl-12 pr-12 h-14 text-lg font-medium transition-all",
                "focus:ring-2 focus:ring-green-500 focus:border-green-500",
                inputError && "animate-shake border-red-500 focus:ring-red-500"
              )}
              autoComplete="off"
              autoFocus
              disabled={loading}
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Escanea el código de barras o escribe el nombre del producto y presiona Enter
          </p>
        </div>

        {/* Tabla de carrito */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Cargando productos...</span>
            </div>
          ) : cartItemsArray.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Sin productos</p>
              <p className="text-sm">Escanea o busca productos para agregar</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left text-sm font-medium text-muted-foreground">
                  <th className="px-6 py-3 w-12">#</th>
                  <th className="px-6 py-3">Producto</th>
                  <th className="px-6 py-3 text-right">Precio</th>
                  <th className="px-6 py-3 text-center w-36">Cantidad</th>
                  <th className="px-6 py-3 text-right">Subtotal</th>
                  <th className="px-6 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {cartItemsArray.map((item, index) => (
                  <tr
                    key={item.product.id}
                    className={cn(
                      "border-b border-border/50 transition-all",
                      selectedRow === index && "bg-green-500/10",
                      lastAddedId === item.product.id && "animate-pulse bg-green-500/20"
                    )}
                    onClick={() => setSelectedRow(index)}
                    onDoubleClick={() => openEditQty(item)}
                  >
                    <td className="px-6 py-4 text-muted-foreground">{index + 1}</td>
                    <td className="px-6 py-4">
                      {(() => {
                        const itemPromo = findPromoForProduct(item.product);
                        return (
                          <div>
                            <p className="font-medium">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground">{item.product.sku}</p>
                            {item.is_package_item && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-cyan-600 dark:text-cyan-400 font-medium">
                                <Package className="h-3 w-3" />
                                Incluido en paquete
                              </div>
                            )}
                            {itemPromo && !item.is_courtesy && (
                              <div className="flex items-center gap-1 mt-1">
                                <Badge className="text-[10px] px-1.5 py-0 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-0 gap-1">
                                  <Tag className="h-2.5 w-2.5" />
                                  {itemPromo.name}
                                </Badge>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      {formatCurrency(item.product.price)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            decrementQty(item.product.id);
                          }}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-10 text-center font-bold text-lg">
                          {item.qty}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            incrementQty(item.product.id);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                    {(() => {
                      const { total: promoTotal, promo: rowPromo } = calcItemPromoTotal(item.product, item.qty, item.is_courtesy || false);
                      const originalTotal = item.is_courtesy ? 0 : item.product.price * item.qty;
                      const hasDiscount = rowPromo && promoTotal < originalTotal;
                      return (
                        <td className="px-6 py-4 text-right font-mono font-bold">
                          {hasDiscount ? (
                            <div>
                              <span className="line-through text-xs text-muted-foreground block">{formatCurrency(originalTotal)}</span>
                              <span className="text-rose-600">{formatCurrency(promoTotal)}</span>
                            </div>
                          ) : (
                            <span className="text-green-600">{formatCurrency(promoTotal)}</span>
                          )}
                        </td>
                      );
                    })()}
                    <td className="px-6 py-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCart(item.product.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {totalItems} {totalItems === 1 ? 'producto' : 'productos'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Esc = Cerrar | F2 = Confirmar | ↑↓ = Navegar | Del = Eliminar
              </span>
            </div>
            <div className="text-right">
              {totalSaved > 0 && (
                <div className="flex items-center gap-1.5 justify-end mb-1">
                  <Tag className="h-3.5 w-3.5 text-rose-500" />
                  <span className="text-sm font-medium text-rose-500">Ahorro: {formatCurrency(totalSaved)}</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">TOTAL</p>
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(totalAmount)}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={processing}
              className="flex-1"
            >
              ← Cancelar
            </Button>
            <Button
              onClick={processConsumption}
              disabled={cartItems.size === 0 || processing || isPrinting}
              className="flex-[2] bg-green-600 hover:bg-green-700 text-white h-12 text-lg"
            >
              {processing || isPrinting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  {printStatus === 'printing_reception' && 'Imprimiendo comanda...'}
                  {printStatus === 'printing_client' && 'Imprimiendo ticket...'}
                  {printStatus !== 'printing_reception' && printStatus !== 'printing_client' && 'Procesando...'}
                </>
              ) : (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  REGISTRAR CONSUMO (F2)
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de edición de cantidad */}
      {editingItemId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          onClick={() => {
            setEditingItemId(null);
            ensureFocus();
          }}
        >
          <div
            className="bg-background border border-border rounded-xl shadow-2xl p-6 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Editar Producto</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {cartItems.get(editingItemId)?.product.name}
            </p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => setEditQty(prev => Math.max(1, prev - 1))}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <Input
                ref={editInputRef}
                type="number"
                value={editQty}
                onChange={(e) => setEditQty(Math.max(0, parseInt(e.target.value) || 0))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmEditQty();
                  if (e.key === 'Escape') {
                    setEditingItemId(null);
                    ensureFocus();
                  }
                }}
                className="w-20 h-12 text-center text-2xl font-bold"
                min={0}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => setEditQty(prev => prev + 1)}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="courtesy-mode" className="flex flex-col space-y-1">
                  <span>Es Cortesía</span>
                  <span className="font-normal text-xs text-muted-foreground">Marcar como gratuito</span>
                </Label>
                <Switch
                  id="courtesy-mode"
                  checked={editIsCourtesy}
                  onCheckedChange={setEditIsCourtesy}
                />
              </div>

              {editIsCourtesy && (
                <div className="space-y-2">
                  <Label htmlFor="courtesy-reason">Razón</Label>
                  <Input
                    id="courtesy-reason"
                    placeholder="Ej. Compensación..."
                    value={editCourtesyReason}
                    onChange={(e) => setEditCourtesyReason(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  removeFromCart(editingItemId);
                  setEditingItemId(null);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
              <Button
                className="flex-1"
                onClick={confirmEditQty}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
