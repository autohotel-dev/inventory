"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  X,
  Loader2,
  Package,
  Trash2,
  Barcode,
  Check,
  AlertCircle
} from "lucide-react";
import { useThermalPrinter } from "@/hooks/use-thermal-printer";
import { usePOSConfigRead } from "@/hooks/use-pos-config";
import { useSoundFeedback } from "@/hooks/use-sound-feedback";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  barcode?: string | null;
}

interface CartItem {
  product: Product;
  qty: number;
  is_courtesy?: boolean;
  courtesy_reason?: string;
}

interface AddConsumptionModalProps {
  isOpen: boolean;
  salesOrderId: string;
  roomNumber?: string;
  onClose: () => void;
  onComplete: () => void;
}

// Hook para sonidos de feedback


export function AddConsumptionModal({
  isOpen,
  salesOrderId,
  roomNumber,
  onClose,
  onComplete,
}: AddConsumptionModalProps) {
  // Estados principales
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [cartItems, setCartItems] = useState<Map<string, CartItem>>(new Map());
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [inputError, setInputError] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number>(-1);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(1);
  const [editIsCourtesy, setEditIsCourtesy] = useState<boolean>(false);
  const [editCourtesyReason, setEditCourtesyReason] = useState<string>("");

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Para detección de escaneo automático (sin Enter)
  const lastInputTimeRef = useRef<number>(0);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rapidInputRef = useRef<boolean>(false);

  // Hooks
  const { printConsumptionTickets, isPrinting, printStatus } = useThermalPrinter();
  const { playSuccess, playError, playClick } = useSoundFeedback();
  const posConfig = usePOSConfigRead();

  // Usar configuración del sistema (valores dinámicos)
  const SCAN_SPEED_THRESHOLD = posConfig.scanSpeedThreshold;
  const SCAN_COMPLETE_DELAY = posConfig.scanCompleteDelay;
  const MIN_SCAN_LENGTH = posConfig.minScanLength;

  // Cargar productos al abrir
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      setCartItems(new Map());
      setSearchValue("");
      setSelectedRow(-1);
      setEditingItemId(null);
      // Auto-focus en el input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Mantener focus en el input (excepto cuando se edita cantidad)
  const ensureFocus = useCallback(() => {
    if (!editingItemId && isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editingItemId, isOpen]);

  // Focus en input de edición cuando se abre
  useEffect(() => {
    if (editingItemId) {
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [editingItemId]);

  // Limpiar animación de último agregado
  useEffect(() => {
    if (lastAddedId) {
      const timer = setTimeout(() => setLastAddedId(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [lastAddedId]);

  // Limpiar error de input
  useEffect(() => {
    if (inputError) {
      const timer = setTimeout(() => setInputError(false), 500);
      return () => clearTimeout(timer);
    }
  }, [inputError]);

  // Keyboard shortcuts globales
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // F2 para confirmar
      if (e.key === 'F2') {
        e.preventDefault();
        if (cartItems.size > 0 && !processing) {
          processConsumption();
        }
      }

      // Escape para cerrar
      if (e.key === 'Escape') {
        if (editingItemId) {
          setEditingItemId(null);
          ensureFocus();
        } else {
          onClose();
        }
      }

      // Delete para eliminar item seleccionado
      if (e.key === 'Delete' && selectedRow >= 0 && !editingItemId) {
        const items = Array.from(cartItems.values());
        if (items[selectedRow]) {
          removeFromCart(items[selectedRow].product.id);
        }
      }

      // Flechas para navegar
      if (e.key === 'ArrowDown' && !editingItemId) {
        e.preventDefault();
        setSelectedRow(prev => Math.min(prev + 1, cartItems.size - 1));
      }
      if (e.key === 'ArrowUp' && !editingItemId) {
        e.preventDefault();
        setSelectedRow(prev => Math.max(prev - 1, -1));
      }

      // Enter en fila seleccionada para editar
      if (e.key === 'Enter' && selectedRow >= 0 && !editingItemId && document.activeElement !== inputRef.current) {
        const items = Array.from(cartItems.values());
        if (items[selectedRow]) {
          openEditQty(items[selectedRow]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, cartItems, selectedRow, editingItemId, processing, ensureFocus, onClose]);

  const fetchProducts = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, price, barcode")
        .eq("is_active", true)
        .neq("sku", "SVC-ROOM")
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  // Buscar producto por código de barras, SKU o nombre
  const findProduct = useCallback((code: string): Product | null => {
    const codeLower = code.toLowerCase().trim();

    // 1. Buscar por código de barras exacto
    const byBarcode = products.find(p =>
      p.barcode?.toLowerCase() === codeLower
    );
    if (byBarcode) return byBarcode;

    // 2. Buscar por SKU exacto
    const bySku = products.find(p =>
      p.sku.toLowerCase() === codeLower
    );
    if (bySku) return bySku;

    // 3. Buscar por nombre (parcial)
    const byName = products.find(p =>
      p.name.toLowerCase().includes(codeLower)
    );
    if (byName) return byName;

    return null;
  }, [products]);

  // Procesar el código escaneado/buscado
  const processScannedCode = useCallback((code: string) => {
    const trimmedCode = code.trim();
    if (!trimmedCode || trimmedCode.length < MIN_SCAN_LENGTH) return;

    const product = findProduct(trimmedCode);

    if (product) {
      addToCart(product);
      playSuccess();
      setSearchValue("");
      setLastAddedId(product.id);
      setInputError(false);
    } else {
      playError();
      setInputError(true);
      toast.error(`Producto "${trimmedCode}" no encontrado`, {
        description: "Verifica el código e intenta de nuevo"
      });
    }

    // Reset estado de escaneo rápido
    rapidInputRef.current = false;
  }, [findProduct, playSuccess, playError]);

  // Manejar cambio de input con detección de escaneo automático
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const now = Date.now();
    const timeSinceLastInput = now - lastInputTimeRef.current;

    setSearchValue(newValue);
    lastInputTimeRef.current = now;

    // Solo procesar detección automática si está habilitada en configuración
    if (!posConfig.autoScanDetection) {
      return;
    }

    // Limpiar timeout anterior
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    // Detectar si es entrada rápida (típico de escáner)
    if (timeSinceLastInput < SCAN_SPEED_THRESHOLD && newValue.length > 1) {
      rapidInputRef.current = true;
    }

    // Si estamos en modo de escaneo rápido, esperar un momento y procesar
    if (rapidInputRef.current && newValue.length >= MIN_SCAN_LENGTH) {
      scanTimeoutRef.current = setTimeout(() => {
        if (rapidInputRef.current) {
          processScannedCode(newValue);
        }
      }, SCAN_COMPLETE_DELAY);
    }
  };

  // Manejar Enter manual (para búsqueda con teclado)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      // Limpiar timeout de escaneo automático
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      processScannedCode(searchValue);
    }
  };

  // Limpiar timeouts al desmontar
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  const addToCart = (product: Product) => {
    setCartItems(prev => {
      const newCart = new Map(prev);
      const existing = newCart.get(product.id);
      if (existing) {
        newCart.set(product.id, { ...existing, qty: existing.qty + 1 });
      } else {
        newCart.set(product.id, { product, qty: 1, is_courtesy: false, courtesy_reason: "" });
      }
      return newCart;
    });
  };

  const removeFromCart = (productId: string) => {
    playClick();
    setCartItems(prev => {
      const newCart = new Map(prev);
      newCart.delete(productId);
      return newCart;
    });
    setSelectedRow(-1);
    ensureFocus();
  };

  const updateCartItem = (productId: string, updates: Partial<CartItem>) => {
    setCartItems(prev => {
      const newCart = new Map(prev);
      const existing = newCart.get(productId);
      if (existing) {
        newCart.set(productId, { ...existing, ...updates });
        // Si cantidad es 0, borrar
        if ((updates.qty !== undefined && updates.qty <= 0)) {
          newCart.delete(productId);
        }
      }
      return newCart;
    });
  };

  const openEditQty = (item: CartItem) => {
    setEditingItemId(item.product.id);
    setEditQty(item.qty);
    setEditIsCourtesy(item.is_courtesy || false);
    setEditCourtesyReason(item.courtesy_reason || "");
  };

  const confirmEditQty = () => {
    if (editingItemId) {
      updateCartItem(editingItemId, {
        qty: editQty,
        is_courtesy: editIsCourtesy,
        courtesy_reason: editCourtesyReason
      });
      setEditingItemId(null);
      playClick();
      ensureFocus();
    }
  };

  const incrementQty = (productId: string) => {
    playClick();
    setCartItems(prev => {
      const newCart = new Map(prev);
      const existing = newCart.get(productId);
      if (existing) {
        newCart.set(productId, { ...existing, qty: existing.qty + 1 });
      }
      return newCart;
    });
  };

  const decrementQty = (productId: string) => {
    playClick();
    setCartItems(prev => {
      const newCart = new Map(prev);
      const existing = newCart.get(productId);
      if (existing && existing.qty > 1) {
        newCart.set(productId, { ...existing, qty: existing.qty - 1 });
      } else {
        newCart.delete(productId);
      }
      return newCart;
    });
  };

  // Calcular totales
  const { totalAmount, totalItems } = useMemo(() => {
    let amount = 0;
    let items = 0;
    cartItems.forEach(({ product, qty, is_courtesy }) => {
      const price = is_courtesy ? 0 : product.price;
      amount += price * qty;
      items += qty;
    });
    return { totalAmount: amount, totalItems: items };
  }, [cartItems]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const processConsumption = async () => {
    if (cartItems.size === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }

    setProcessing(true);
    const supabase = createClient();

    try {
      // Obtener warehouse_id de la orden de venta
      const { data: orderInfo } = await supabase
        .from("sales_orders")
        .select("warehouse_id")
        .eq("id", salesOrderId)
        .single();

      if (!orderInfo?.warehouse_id) {
        toast.error("Error de configuración", {
          description: "La orden no tiene almacén asignado"
        });
        return;
      }

      // Validar stock disponible
      const { validateStockAvailability } = await import("@/lib/utils/stock-helpers");

      const itemsToValidate = Array.from(cartItems.values()).map(({ product, qty }) => ({
        product_id: product.id,
        product_name: product.name,
        quantity: qty
      }));

      const stockErrors = await validateStockAvailability(
        itemsToValidate,
        orderInfo.warehouse_id
      );

      if (stockErrors.length > 0) {
        playError();
        toast.error("Stock insuficiente", {
          description: stockErrors.join("\n"),
          duration: 7000
        });
        return;
      }

      // Insertar items en sales_order_items
      const itemsToInsert = Array.from(cartItems.values()).map(({ product, qty, is_courtesy, courtesy_reason }) => ({
        sales_order_id: salesOrderId,
        product_id: product.id,
        qty,
        unit_price: is_courtesy ? 0 : product.price,
        concept_type: "CONSUMPTION",
        is_paid: false,
        is_courtesy: is_courtesy || false,
        courtesy_reason: courtesy_reason || null
      }));

      const { error: itemsError } = await supabase
        .from("sales_order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Crear movimientos de inventario
      const movements = Array.from(cartItems.values()).map(({ product, qty }) => ({
        product_id: product.id,
        warehouse_id: orderInfo.warehouse_id,
        quantity: qty,
        movement_type: 'OUT',
        reason_id: 6,
        reason: 'SALE',
        notes: `Consumo vendido - Habitación ${roomNumber || 'N/A'}`,
        reference_table: 'sales_orders',
        reference_id: salesOrderId
      }));

      const { error: movError } = await supabase
        .from("inventory_movements")
        .insert(movements);

      if (movError) {
        console.error('Error creating inventory movements:', movError);
        toast.error("Advertencia", {
          description: "Consumo agregado pero hubo un error al actualizar el inventario"
        });
      }

      // Actualizar totales de la orden
      const { data: orderData } = await supabase
        .from("sales_orders")
        .select("subtotal, total, paid_amount, remaining_amount")
        .eq("id", salesOrderId)
        .single();

      if (orderData) {
        const newSubtotal = (orderData.subtotal || 0) + totalAmount;
        const newTotal = (orderData.total || 0) + totalAmount;
        const newRemaining = (orderData.remaining_amount || 0) + totalAmount;

        await supabase
          .from("sales_orders")
          .update({
            subtotal: newSubtotal,
            total: newTotal,
            remaining_amount: newRemaining,
            status: "PARTIAL",
          })
          .eq("id", salesOrderId);
      }

      // Imprimir tickets
      try {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const folio = `COM-${year}${month}${day}-${random}`;

        const printData = {
          roomNumber: roomNumber || 'N/A',
          folio: folio,
          date: new Date(),
          items: Array.from(cartItems.values()).map(({ product, qty }) => ({
            name: product.name,
            qty,
            price: product.price,
            total: product.price * qty
          })),
          subtotal: totalAmount,
          total: totalAmount,
          hotelName: undefined
        };

        const printSuccess = await printConsumptionTickets(printData);

        if (!printSuccess) {
          toast.warning("Consumo agregado sin imprimir", {
            description: "El consumo se guardó pero hubo un error al imprimir los tickets.",
            duration: 8000
          });
        }
      } catch (printError) {
        console.error('Print error:', printError);
        toast.warning("Error de impresión", {
          description: "Consumo agregado correctamente, pero no se pudieron imprimir los tickets",
          duration: 5000
        });
      }

      playSuccess();

      const productNames = Array.from(cartItems.values())
        .map(({ product, qty }) => `${qty}x ${product.name}`)
        .join(", ");

      toast.success("✓ Consumo registrado", {
        description: `${productNames} - Total: ${formatCurrency(totalAmount)}`,
      });

      onComplete();
    } catch (error) {
      console.error("Error adding consumption:", error);
      playError();
      toast.error("Error al agregar consumo");
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  const cartItemsArray = Array.from(cartItems.values());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={ensureFocus}
    >
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
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
                      <div>
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">{item.product.sku}</p>
                      </div>
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
                    <td className="px-6 py-4 text-right font-mono font-bold text-green-600">
                      {formatCurrency(item.product.price * item.qty)}
                    </td>
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
