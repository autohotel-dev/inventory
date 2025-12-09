"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package,
  Check
} from "lucide-react";

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
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        { product, quantity: 1, unit_price: product.price || 0 },
      ];
    });
    setSearchTerm("");
    searchInputRef.current?.focus();
  };

  // Actualizar cantidad
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  // Eliminar del carrito
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Calcular total del carrito
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

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
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto bg-background border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Agregar Productos</h3>
              {cart.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} items
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Búsqueda / Escaneo */}
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Escanea código o busca por SKU / nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 text-base"
                autoComplete="off"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
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
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-500/10 px-3 py-2 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
                <Check className="h-4 w-4" />
                <span>Agregado: {lastScanned}</span>
              </div>
            )}

            {/* Resultados de búsqueda */}
            {searchTerm && filteredProducts.length > 0 && (
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {filteredProducts.slice(0, 8).map((product) => (
                  <button
                    key={product.id}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => addToCart(product)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          SKU: {product.sku}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-600">
                        {formatCurrency(product.price || 0, currency)}
                      </p>
                      <Plus className="h-4 w-4 text-muted-foreground ml-auto" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchTerm && filteredProducts.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No se encontraron productos</p>
              </div>
            )}
          </div>

          {/* Carrito */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Barcode className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Escanea o busca productos</p>
                <p className="text-sm mt-1">
                  Los productos aparecerán aquí
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Productos a agregar
                </Label>
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(item.unit_price, currency)} c/u
                      </p>
                    </div>

                    {/* Controles de cantidad */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.product.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-medium text-sm">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateQuantity(item.product.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Total del item */}
                    <div className="text-right min-w-[80px]">
                      <p className="font-semibold text-emerald-600">
                        {formatCurrency(item.quantity * item.unit_price, currency)}
                      </p>
                    </div>

                    {/* Eliminar */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => removeFromCart(item.product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer con total */}
          <div className="p-4 border-t bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Total a agregar</span>
              <span className="text-2xl font-bold text-emerald-600">
                {formatCurrency(cartTotal, currency)}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirm}
                disabled={cart.length === 0 || isAdding}
              >
                {isAdding ? (
                  "Agregando..."
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Agregar {cart.length > 0 ? `(${cart.reduce((s, i) => s + i.quantity, 0)})` : ""}
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
