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
  AlertCircle,
  Tag
} from "lucide-react";
import { useThermalPrinter } from "@/hooks/use-thermal-printer";
import { useUserRole } from "@/hooks/use-user-role";
import { usePOSConfigRead } from "@/hooks/use-pos-config";
import { useSoundFeedback } from "@/hooks/use-sound-feedback";
import { cn } from "@/lib/utils";
import { notifyActiveValets } from "@/lib/services/valet-notification-service";

import { SelectPackageDrinksModal } from "./select-package-drinks-modal";
import { validatePromotionConditions } from "@/lib/promo-conditions";
import type { BottlePackageRule } from "@/lib/types/inventory";

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  barcode?: string | null;
  unit?: string;
  category_id?: string;
  subcategory_id?: string;
}

interface CartItem {
  product: Product;
  qty: number;
  is_courtesy?: boolean;
  courtesy_reason?: string;
  is_package_item?: boolean;
  included_with?: string; // ID del producto padre (botella)
}

interface ActivePromotion {
  id: string;
  name: string;
  promo_type: 'NxM' | 'PERCENT_DISCOUNT' | 'FIXED_PRICE';
  buy_quantity: number | null;
  pay_quantity: number | null;
  discount_percent: number | null;
  fixed_price: number | null;
  product_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  conditions: {
    first_order_only?: boolean;
  } | null;
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
  const [previousOrdersCount, setPreviousOrdersCount] = useState<number>(0);
  const [consumedItems, setConsumedItems] = useState<{
    productId: string;
    categoryId: string | null;
    subcategoryId: string | null;
  }[]>([]);

  const [editCourtesyReason, setEditCourtesyReason] = useState<string>("");

  // Estados para paquetes de botellas
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [pendingBottle, setPendingBottle] = useState<Product | null>(null);
  const [activePackageRule, setActivePackageRule] = useState<BottlePackageRule | null>(null);

  // Estado para promociones activas
  const [activePromotions, setActivePromotions] = useState<ActivePromotion[]>([]);

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
  const { isReceptionist, isAdmin, isManager } = useUserRole();

  // Usar configuración del sistema (valores dinámicos)
  const SCAN_SPEED_THRESHOLD = posConfig.scanSpeedThreshold;
  const SCAN_COMPLETE_DELAY = posConfig.scanCompleteDelay;
  const MIN_SCAN_LENGTH = posConfig.minScanLength;

  // Cargar productos y promociones al abrir
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      fetchActivePromotions();
      checkPreviousOrders();
      setCartItems(new Map());
      setSearchValue("");
      setSelectedRow(-1);
      setEditingItemId(null);
      // Auto-focus en el input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const checkPreviousOrders = async () => {
    const supabase = createClient();
    try {
      // Primero obtenemos el booking_id de la orden actual para saber a qué estadía pertenece
      const { data: currentOrder } = await supabase
        .from("sales_orders")
        .select("booking_id")
        .eq("id", salesOrderId)
        .single();

      if (currentOrder && currentOrder.booking_id) {
        // Contamos cuantas ordenes TIENEN items (consumos) para esta estadía, excluyendo la actual si estuviera vacía (aunque aqui apenas agregaremos)
        // Realmente queremos saber si YA HUBO consumos previos.
        // Buscamos ordenes de esta booking que NO sean la actual y que tengan status pagado o parcial, o simplemente que existan.
        // Una forma segura es ver si hay sales_order_items asociados a ordenes de este booking (excluyendo la actual si quisieramos ser muy estrictos, pero "primera orden" suele referirse al primer momento de consumo).
        // Simplificación: Contamos sales_orders previas o items previos.
        // Vamos a contar sales_orders de esta booking que tengan items.

        const { count, error } = await supabase
          .from("sales_orders")
          .select("id", { count: 'exact', head: true })
          .eq("booking_id", currentOrder.booking_id)
          .neq("id", salesOrderId) // Excluir la orden actual
          .gt("total", 0); // Que hayan tenido monto (consumos)

        if (!error) {
          setPreviousOrdersCount(count || 0);
        }

        // Fetch detailed consumed items for scoped conditions
        const { data: itemsData, error: itemsError } = await supabase
          .from("sales_order_items")
          .select(`
                  product_id,
                  products:products (
                    category_id,
                    subcategory_id
                  ),
                  sales_orders!inner (
                    booking_id
                  )
                `)
          .eq("sales_orders.booking_id", currentOrder.booking_id)
          .neq("sales_order_id", salesOrderId);

        if (!itemsError && itemsData) {
          const mappedItems = itemsData.map((item: any) => ({
            productId: item.product_id,
            categoryId: item.products?.category_id || null,
            subcategoryId: item.products?.subcategory_id || null
          }));
          setConsumedItems(mappedItems);
        } else if (itemsError) {
          console.error("Error fetching previous items:", itemsError);
        }
      }
    } catch (err) {
      console.error("Error checking previous orders:", err);
    }
  };

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
        .select("id, name, sku, price, barcode, unit, category_id, subcategory_id")
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

  const fetchActivePromotions = async () => {
    const supabase = createClient();
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("product_promotions")
        .select("id, name, promo_type, buy_quantity, pay_quantity, discount_percent, fixed_price, product_id, category_id, subcategory_id, conditions")
        .eq("is_active", true)
        .or(`start_date.is.null,start_date.lte.${now}`)
        .or(`end_date.is.null,end_date.gte.${now}`);

      if (error) {
        console.error("Error fetching promotions:", error);
      } else {
        setActivePromotions(data || []);
      }
    } catch (err) {
      console.error("Error fetching promotions:", err);
    }
  };

  // ... inside AddConsumptionModal ...

  // Buscar la promoción aplicable para un producto
  const findPromoForProduct = useCallback((product: Product & { category_id?: string; subcategory_id?: string }): ActivePromotion | null => {
    if (activePromotions.length === 0) return null;

    // Filtrar promociones que cumplan con las condiciones
    const eligiblePromos = activePromotions.filter(p => {
      return validatePromotionConditions(p.conditions, {
        previousOrdersCount,
        consumedItems,
        scope: {
          productId: p.product_id,
          categoryId: p.category_id,
          subcategoryId: p.subcategory_id
        }
      });
    });

    if (eligiblePromos.length === 0) return null;

    // Prioridad: producto específico > subcategoría > categoría
    const byProduct = eligiblePromos.find(p => p.product_id === product.id);
    if (byProduct) return byProduct;

    if ((product as any).subcategory_id) {
      const bySub = eligiblePromos.find(p => p.subcategory_id === (product as any).subcategory_id && !p.product_id);
      if (bySub) return bySub;
    }

    if ((product as any).category_id) {
      const byCat = eligiblePromos.find(p => p.category_id === (product as any).category_id && !p.product_id && !p.subcategory_id);
      if (byCat) return byCat;
    }

    return null;
  }, [activePromotions, previousOrdersCount]);

  // Calcular precio efectivo de un item considerando promociones
  const calcItemPromoTotal = useCallback((product: Product, qty: number, isCourtesy: boolean): { total: number; promo: ActivePromotion | null; savedAmount: number } => {
    if (isCourtesy) return { total: 0, promo: null, savedAmount: 0 };

    const promo = findPromoForProduct(product);
    if (!promo) return { total: product.price * qty, promo: null, savedAmount: 0 };

    let total = product.price * qty;
    switch (promo.promo_type) {
      case 'NxM': {
        const buyN = promo.buy_quantity || 2;
        const payM = promo.pay_quantity || 1;
        const fullSets = Math.floor(qty / buyN);
        const remainder = qty % buyN;
        total = (fullSets * payM + remainder) * product.price;
        break;
      }
      case 'PERCENT_DISCOUNT': {
        const disc = promo.discount_percent || 0;
        total = product.price * qty * (1 - disc / 100);
        break;
      }
      case 'FIXED_PRICE': {
        total = (promo.fixed_price || product.price) * qty;
        break;
      }
    }
    const savedAmount = (product.price * qty) - total;
    return { total, promo, savedAmount };
  }, [findPromoForProduct]);

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

  const addToCart = async (product: Product) => {
    // 1. Verificar si es una botella con paquete configurado
    if (product.unit === 'PZBOT' || product.unit === 'PZBOTAN') {
      try {
        const supabase = createClient();
        // Buscar regla activa para esta unidad y subcategoría
        // Primero necesitamos saber la subcategoría del producto
        const { data: prodData, error: prodError } = await supabase
          .from("products")
          .select("category_id, subcategory_id")
          .eq("id", product.id)
          .single();

        if (prodData && prodData.subcategory_id) {
          const { data: ruleData } = await supabase
            .from("bottle_package_rules")
            .select("*, included_category:categories!included_category_id(name)")
            .eq("unit_type", product.unit)
            .eq("subcategory_id", prodData.subcategory_id)
            .eq("is_active", true)
            .single();

          if (ruleData) {
            // Encontramos una regla, abrir modal de selección
            setPendingBottle(product);
            setActivePackageRule(ruleData as any);
            setIsPackageModalOpen(true);
            return; // Detener flujo normal
          }
        }
      } catch (err) {
        console.error("Error checking package rules:", err);
      }
    }

    // Flujo normal
    directAddToCart(product);
  };

  const directAddToCart = (product: Product, isPackageItem = false, parentId?: string) => {
    setCartItems(prev => {
      const newCart = new Map(prev);

      // Si es parte de un paquete, generamos un ID único compuesto para permitir múltiples instancias
      // O simplemente lo agregamos como item separado si ya existe
      const key = isPackageItem ? `${product.id}-pkg-${parentId}-${Date.now()}` : product.id;

      const existing = newCart.get(key);
      if (existing && !isPackageItem) {
        newCart.set(key, { ...existing, qty: existing.qty + 1 });
      } else {
        newCart.set(key, {
          product,
          qty: 1,
          is_courtesy: isPackageItem, // Los items de paquete son cortesía automáticamente
          courtesy_reason: isPackageItem ? "Incluido en paquete de botella" : "",
          is_package_item: isPackageItem,
          included_with: parentId
        });
      }
      return newCart;
    });
  };

  const handlePackageConfirm = (selectedDrinks: { product: Product, qty: number }[]) => {
    if (!pendingBottle) return;

    // 1. Agregar la botella
    directAddToCart(pendingBottle);

    // 2. Agregar las bebidas seleccionadas
    selectedDrinks.forEach(({ product, qty }) => {
      // Agregar N veces según la cantidad seleccionada
      // Nota: Para simplificar, agregamos un item con la cantidad total
      setCartItems(prev => {
        const newCart = new Map(prev);
        // Usamos un ID único para asegurar que se agrupen con ESTA botella específica si hubiera múltiples
        // Pero por simplicidad en la UI, usaremos un ID compuesto
        const key = `${product.id}-pkg-${pendingBottle.id}`;

        // Si ya existe este producto vinculado a esta botella (mismo tipo), sumamos
        // Nota: Esto asume que solo hay una botella de este tipo en el proceso actual.
        // Si el usuario agrega otra botella igual, se separará porque pendingBottle es el mismo pero
        // la lógica de directAddToCart maneja IDs base.
        // Para hacerlo robusto:

        newCart.set(key, {
          product,
          qty: qty,
          is_courtesy: true,
          courtesy_reason: "Incluido en paquete",
          is_package_item: true,
          included_with: pendingBottle.id
        });

        return newCart;
      });
    });

    // Resetear estados
    setPendingBottle(null);
    setActivePackageRule(null);
    setIsPackageModalOpen(false);
    playSuccess();
    setSearchValue("");
    setLastAddedId(pendingBottle.id);
    ensureFocus();
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

  // Calcular totales con promociones
  const { totalAmount, totalItems, totalSaved } = useMemo(() => {
    let amount = 0;
    let items = 0;
    let saved = 0;
    cartItems.forEach(({ product, qty, is_courtesy }) => {
      const { total, savedAmount } = calcItemPromoTotal(product, qty, is_courtesy || false);
      amount += total;
      saved += savedAmount;
      items += qty;
    });
    return { totalAmount: amount, totalItems: items, totalSaved: saved };
  }, [cartItems, calcItemPromoTotal]);

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

    if (!isReceptionist && !isAdmin && !isManager) {
      toast.error("Acceso denegado", {
        description: "Solo los recepcionistas pueden realizar ventas directas."
      });
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

      // Get the active shift session ID
      const { data: { user } } = await supabase.auth.getUser();
      
      let currentSessionId = null;
      if (user) {
        const { data: employee } = await supabase
          .from('employees')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();
          
        if (employee) {
          const { data: activeSession } = await supabase
            .from('shift_sessions')
            .select('id')
            .eq('employee_id', employee.id)
            .eq('status', 'active')
            .maybeSingle();
          currentSessionId = activeSession?.id || null;
        }
      }

      const itemsToInsert = Array.from(cartItems.values()).map(({ product, qty, is_courtesy, courtesy_reason }) => {
        const { total } = calcItemPromoTotal(product, qty, is_courtesy || false);
        const effectiveUnitPrice = is_courtesy ? 0 : (qty > 0 ? total / qty : product.price);
        return {
          sales_order_id: salesOrderId,
          product_id: product.id,
          qty,
          unit_price: Math.round(effectiveUnitPrice * 100) / 100,
          concept_type: "CONSUMPTION",
          is_paid: false,
          is_courtesy: is_courtesy || false,
          courtesy_reason: courtesy_reason || null,
          delivery_status: 'PENDING_VALET',
          shift_session_id: currentSessionId
        };
      });

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
        reference_id: salesOrderId,
        created_by: user?.id || null
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
        // remaining_amount is auto-calculated by the DB trigger (trg_sync_sales_order_totals)

        await supabase
          .from("sales_orders")
          .update({
            subtotal: newSubtotal,
            total: newTotal,
            status: "PARTIAL",
          })
          .eq("id", salesOrderId);

        // Notificación manual activada

        try {
          const productNames = Array.from(cartItems.values())
            .map(({ product, qty }) => `${qty}x ${product.name}`)
            .join(", ");

          await notifyActiveValets(
            supabase,
            '🛒 Nuevo Consumo Registrado',
            `Habitación ${roomNumber || 'N/A'}: Se agregaron ${productNames}. Nuevo cargo: $${totalAmount.toFixed(2)} MXN.`,
            {
              type: 'REGULAR_CONSUMPTION',
              salesOrderId: salesOrderId,
              roomNumber: roomNumber || 'N/A'
            }
          );
        } catch (pushErr) {
          console.error("Error sending consumption push notification:", pushErr);
        }
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
