"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  X,
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package,
  Check,
  Scan
} from "lucide-react";
import { PaymentMethod, PAYMENT_METHODS } from "@/components/sales/room-types";

interface Product {
  id: string;
  name: string;
  sku: string;
  price?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  payment_method: PaymentMethod;
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  currency: string;
  onAddProducts: (items: CartItem[]) => Promise<void>;
  formatCurrency: (amount: number, currency: string) => string;
}

export function AddProductModal({
  isOpen,
  onClose,
  products,
  currency,
  onAddProducts,
  formatCurrency,
}: AddProductModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("EFECTIVO");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scanBuffer = useRef<string>("");
  const scanTimeout = useRef<NodeJS.Timeout | null>(null);

  // Filtrar productos por búsqueda
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Focus en el input de búsqueda al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
      setCart([]);
      setSearchTerm("");
      setLastScanned(null);
      setSelectedPaymentMethod("EFECTIVO");
    }
  }, [isOpen]);

  // Detectar escaneo de código de barras (entrada rápida)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Si es Enter y hay un buffer de escaneo
      if (e.key === "Enter" && scanBuffer.current.length > 3) {
        const scannedCode = scanBuffer.current.trim();
        scanBuffer.current = "";

        // Buscar producto por SKU
        const product = products.find(
          (p) => p.sku.toLowerCase() === scannedCode.toLowerCase()
        );

        if (product) {
          addToCart(product);
          setLastScanned(product.name);
          setSearchTerm("");
          setTimeout(() => setLastScanned(null), 2000);
        } else {
          setSearchTerm(scannedCode);
        }
        return;
      }

      // Acumular caracteres del escáner (entrada rápida)
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        scanBuffer.current += e.key;

        // Limpiar buffer después de 100ms de inactividad
        if (scanTimeout.current) clearTimeout(scanTimeout.current);
        scanTimeout.current = setTimeout(() => {
          scanBuffer.current = "";
        }, 100);
      }
    },
    [isOpen, products]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Agregar producto al carrito
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && item.payment_method === selectedPaymentMethod);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id && item.payment_method === selectedPaymentMethod
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        { product, quantity: 1, unit_price: product.price || 0, payment_method: selectedPaymentMethod },
      ];
    });
    setSearchTerm("");
    searchInputRef.current?.focus();
  };

  // Actualizar cantidad (usando índice para identificar item único)
  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item, i) =>
          i === index
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  // Eliminar del carrito (usando índice)
  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // Calcular total del carrito
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Confirmar y agregar productos
  const handleConfirm = async () => {
    if (cart.length === 0) return;
    setIsAdding(true);
    try {
      await onAddProducts(cart);
      setCart([]);
      onClose();
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Tema Next.js Dark */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
          
          {/* Header */}
          <div className="relative bg-neutral-900 border-b border-neutral-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                  <ShoppingCart className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-neutral-100">Agregar Productos</h3>
                  <p className="text-neutral-500 text-xs">Escanea o busca productos</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {cart.length > 0 && (
                  <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3">
                    {totalItems} items
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-neutral-500 hover:text-neutral-100 hover:bg-neutral-800"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Búsqueda / Escaneo */}
          <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 space-y-3">
            {/* Selector de método de pago */}
            <div className="space-y-1.5">
              <Label className="text-xs text-neutral-400">Método de Pago</Label>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <Button
                    key={method.value}
                    type="button"
                    variant={selectedPaymentMethod === method.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPaymentMethod(method.value)}
                    className={`flex-1 ${selectedPaymentMethod === method.value ? 'bg-blue-600 hover:bg-blue-500' : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
                  >
                    <span className="mr-1">{method.icon}</span>
                    {method.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Input de escaneo */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-violet-500/10 rounded-lg border border-violet-500/20">
                <Scan className="h-4 w-4 text-violet-400" />
              </div>
              <Input
                ref={searchInputRef}
                placeholder="Escanea código de barras o busca por SKU / nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 text-base bg-neutral-900 border-2 border-dashed border-violet-500/20 focus:border-violet-500 text-neutral-100 placeholder:text-neutral-600 rounded-xl"
                autoComplete="off"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-neutral-500 hover:text-neutral-100"
                  onClick={() => {
                    setSearchTerm("");
                    searchInputRef.current?.focus();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Indicador de escaneo exitoso */}
            {lastScanned && (
              <div className="flex items-center gap-2 text-sm bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-1 bg-emerald-500/20 rounded-full">
                  <Check className="h-3 w-3" />
                </div>
                <span className="font-medium">Agregado: {lastScanned}</span>
              </div>
            )}

            {/* Resultados de búsqueda */}
            {searchTerm && filteredProducts.length > 0 && (
              <div className="max-h-52 overflow-y-auto border border-neutral-800 rounded-xl divide-y divide-neutral-800 bg-neutral-900">
                {filteredProducts.slice(0, 8).map((product) => (
                  <button
                    key={product.id}
                    className="w-full flex items-center justify-between p-3 hover:bg-neutral-800 transition-colors text-left group"
                    onClick={() => addToCart(product)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                        <Package className="h-5 w-5 text-neutral-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-neutral-100">{product.name}</p>
                        <p className="text-xs text-neutral-500 font-mono">
                          SKU: {product.sku}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-emerald-400">
                        {formatCurrency(product.price || 0, currency)}
                      </p>
                      <div className="p-1.5 rounded-full bg-blue-500 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="h-3 w-3" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchTerm && filteredProducts.length === 0 && (
              <div className="text-center py-6 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <Search className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                <p className="text-amber-400 font-medium">No se encontró el producto</p>
                <p className="text-amber-500/70 text-xs mt-1">Verifica el código o nombre</p>
              </div>
            )}
          </div>

          {/* Carrito */}
          <div className="flex-1 overflow-y-auto p-4 bg-neutral-950">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                  <Barcode className="h-10 w-10 text-violet-400" />
                </div>
                <p className="font-medium text-neutral-300">Listo para escanear</p>
                <p className="text-sm text-neutral-600 mt-1">
                  Escanea códigos de barras o busca productos
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-[10px] text-neutral-600 uppercase tracking-wider font-semibold">
                  Productos en carrito ({cart.length})
                </Label>
                {cart.map((item, index) => (
                  <Card key={`${item.product.id}-${item.payment_method}-${index}`} className="overflow-hidden border-neutral-800 bg-neutral-900">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 p-3">
                        {/* Número de línea */}
                        <div className="w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </div>
                        
                        {/* Info del producto */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-neutral-100 truncate">
                            {item.product.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <span className="font-mono">{item.product.sku}</span>
                            <span>•</span>
                            <span>{formatCurrency(item.unit_price, currency)} c/u</span>
                            <span>•</span>
                            <span className="text-blue-400">{PAYMENT_METHODS.find(m => m.value === item.payment_method)?.icon} {item.payment_method}</span>
                          </div>
                        </div>

                        {/* Controles de cantidad */}
                        <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-1 border border-neutral-700">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700"
                            onClick={() => updateQuantity(index, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-bold text-sm text-neutral-100">
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700"
                            onClick={() => updateQuantity(index, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Total del item */}
                        <div className="text-right min-w-[90px]">
                          <p className="font-bold text-emerald-400">
                            {formatCurrency(item.quantity * item.unit_price, currency)}
                          </p>
                        </div>

                        {/* Eliminar */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => removeFromCart(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Footer con total */}
          <div className="p-4 border-t border-neutral-800 bg-neutral-900">
            {/* Resumen */}
            <div className="flex items-center justify-between mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div>
                <p className="text-xs text-emerald-400 font-medium uppercase tracking-wider">Total a agregar</p>
                <p className="text-xs text-emerald-500/70">{totalItems} producto(s)</p>
              </div>
              <p className="text-3xl font-bold text-emerald-400">
                {formatCurrency(cartTotal, currency)}
              </p>
            </div>
            
            {/* Botones */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 h-11 border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100" 
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 h-11 bg-blue-600 hover:bg-blue-500 text-white"
                onClick={handleConfirm}
                disabled={cart.length === 0 || isAdding}
              >
                {isAdding ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Agregando...
                  </span>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirmar {totalItems > 0 && `(${totalItems})`}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
