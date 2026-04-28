/**
 * Hook for consumption cart state, product search, barcode scanning,
 * promotions, and order submission.
 * Extracted from add-consumption-modal.tsx for testability and separation of concerns.
 */
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useThermalPrinter } from "@/hooks/use-thermal-printer";
import { useUserRole } from "@/hooks/use-user-role";
import { usePOSConfigRead } from "@/hooks/use-pos-config";
import { useSoundFeedback } from "@/hooks/use-sound-feedback";
import { notifyActiveValets } from "@/lib/services/valet-notification-service";
import { validatePromotionConditions } from "@/lib/promo-conditions";
import type { BottlePackageRule } from "@/lib/types/inventory";

// ─── Types ───────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  barcode?: string | null;
  unit?: string;
  category_id?: string;
  subcategory_id?: string;
}

export interface CartItem {
  product: Product;
  qty: number;
  is_courtesy?: boolean;
  courtesy_reason?: string;
  is_package_item?: boolean;
  included_with?: string;
}

export interface ActivePromotion {
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

interface UseConsumptionCartProps {
  isOpen: boolean;
  salesOrderId: string;
  roomNumber?: string;
  onComplete: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useConsumptionCart({
  isOpen, salesOrderId, roomNumber, onComplete,
}: UseConsumptionCartProps) {
  // Core state
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [cartItems, setCartItems] = useState<Map<string, CartItem>>(new Map());
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [inputError, setInputError] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number>(-1);

  // Edit state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(1);
  const [editIsCourtesy, setEditIsCourtesy] = useState<boolean>(false);
  const [editCourtesyReason, setEditCourtesyReason] = useState<string>("");

  // Promo context
  const [previousOrdersCount, setPreviousOrdersCount] = useState<number>(0);
  const [consumedItems, setConsumedItems] = useState<{
    productId: string;
    categoryId: string | null;
    subcategoryId: string | null;
  }[]>([]);
  const [activePromotions, setActivePromotions] = useState<ActivePromotion[]>([]);

  // Package modal state
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [pendingBottle, setPendingBottle] = useState<Product | null>(null);
  const [activePackageRule, setActivePackageRule] = useState<BottlePackageRule | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const lastInputTimeRef = useRef<number>(0);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rapidInputRef = useRef<boolean>(false);

  // External hooks
  const { printConsumptionTickets, isPrinting, printStatus } = useThermalPrinter();
  const { playSuccess, playError, playClick } = useSoundFeedback();
  const posConfig = usePOSConfigRead();
  const { isReceptionist, isAdmin, isManager } = useUserRole();

  const SCAN_SPEED_THRESHOLD = posConfig.scanSpeedThreshold;
  const SCAN_COMPLETE_DELAY = posConfig.scanCompleteDelay;
  const MIN_SCAN_LENGTH = posConfig.minScanLength;

  // ─── Data Fetching ───────────────────────────────────────────────

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
      if (error) console.error("Error fetching promotions:", error);
      else setActivePromotions(data || []);
    } catch (err) {
      console.error("Error fetching promotions:", err);
    }
  };

  const checkPreviousOrders = async () => {
    const supabase = createClient();
    try {
      const { data: currentOrder } = await supabase
        .from("sales_orders")
        .select("booking_id")
        .eq("id", salesOrderId)
        .single();

      if (currentOrder?.booking_id) {
        const { count, error } = await supabase
          .from("sales_orders")
          .select("id", { count: 'exact', head: true })
          .eq("booking_id", currentOrder.booking_id)
          .neq("id", salesOrderId)
          .gt("total", 0);
        if (!error) setPreviousOrdersCount(count || 0);

        const { data: itemsData, error: itemsError } = await supabase
          .from("sales_order_items")
          .select(`product_id, products:products(category_id, subcategory_id), sales_orders!inner(booking_id)`)
          .eq("sales_orders.booking_id", currentOrder.booking_id)
          .neq("sales_order_id", salesOrderId);

        if (!itemsError && itemsData) {
          setConsumedItems(itemsData.map((item: any) => ({
            productId: item.product_id,
            categoryId: item.products?.category_id || null,
            subcategoryId: item.products?.subcategory_id || null
          })));
        }
      }
    } catch (err) {
      console.error("Error checking previous orders:", err);
    }
  };

  // ─── Init on Open ─────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      fetchActivePromotions();
      checkPreviousOrders();
      setCartItems(new Map());
      setSearchValue("");
      setSelectedRow(-1);
      setEditingItemId(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ─── Focus Management ─────────────────────────────────────────────

  const ensureFocus = useCallback(() => {
    if (!editingItemId && isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editingItemId, isOpen]);

  useEffect(() => {
    if (editingItemId) setTimeout(() => editInputRef.current?.focus(), 50);
  }, [editingItemId]);

  useEffect(() => {
    if (lastAddedId) {
      const timer = setTimeout(() => setLastAddedId(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [lastAddedId]);

  useEffect(() => {
    if (inputError) {
      const timer = setTimeout(() => setInputError(false), 500);
      return () => clearTimeout(timer);
    }
  }, [inputError]);

  // Cleanup scan timeout
  useEffect(() => {
    return () => { if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current); };
  }, []);

  // ─── Promotion Engine ─────────────────────────────────────────────

  const findPromoForProduct = useCallback((product: Product & { category_id?: string; subcategory_id?: string }): ActivePromotion | null => {
    if (activePromotions.length === 0) return null;

    const eligiblePromos = activePromotions.filter(p =>
      validatePromotionConditions(p.conditions, {
        previousOrdersCount, consumedItems,
        scope: { productId: p.product_id, categoryId: p.category_id, subcategoryId: p.subcategory_id }
      })
    );
    if (eligiblePromos.length === 0) return null;

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

  const calcItemPromoTotal = useCallback((product: Product, qty: number, isCourtesy: boolean): { total: number; promo: ActivePromotion | null; savedAmount: number } => {
    if (isCourtesy) return { total: 0, promo: null, savedAmount: 0 };
    const promo = findPromoForProduct(product);
    if (!promo) return { total: product.price * qty, promo: null, savedAmount: 0 };

    let total = product.price * qty;
    switch (promo.promo_type) {
      case 'NxM': {
        const buyN = promo.buy_quantity || 2;
        const payM = promo.pay_quantity || 1;
        total = (Math.floor(qty / buyN) * payM + qty % buyN) * product.price;
        break;
      }
      case 'PERCENT_DISCOUNT':
        total = product.price * qty * (1 - (promo.discount_percent || 0) / 100);
        break;
      case 'FIXED_PRICE':
        total = (promo.fixed_price || product.price) * qty;
        break;
    }
    return { total, promo, savedAmount: (product.price * qty) - total };
  }, [findPromoForProduct]);

  // ─── Product Search ───────────────────────────────────────────────

  const findProduct = useCallback((code: string): Product | null => {
    const codeLower = code.toLowerCase().trim();
    return (
      products.find(p => p.barcode?.toLowerCase() === codeLower) ||
      products.find(p => p.sku.toLowerCase() === codeLower) ||
      products.find(p => p.name.toLowerCase().includes(codeLower)) ||
      null
    );
  }, [products]);

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
      toast.error(`Producto "${trimmedCode}" no encontrado`, { description: "Verifica el código e intenta de nuevo" });
    }
    rapidInputRef.current = false;
  }, [findProduct, playSuccess, playError]);

  // ─── Input Handling ───────────────────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const now = Date.now();
    const timeSinceLastInput = now - lastInputTimeRef.current;
    setSearchValue(newValue);
    lastInputTimeRef.current = now;

    if (!posConfig.autoScanDetection) return;
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    if (timeSinceLastInput < SCAN_SPEED_THRESHOLD && newValue.length > 1) rapidInputRef.current = true;
    if (rapidInputRef.current && newValue.length >= MIN_SCAN_LENGTH) {
      scanTimeoutRef.current = setTimeout(() => {
        if (rapidInputRef.current) processScannedCode(newValue);
      }, SCAN_COMPLETE_DELAY);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      processScannedCode(searchValue);
    }
  };

  // ─── Cart Operations ──────────────────────────────────────────────

  const directAddToCart = (product: Product, isPackageItem = false, parentId?: string) => {
    setCartItems(prev => {
      const newCart = new Map(prev);
      const key = isPackageItem ? `${product.id}-pkg-${parentId}-${Date.now()}` : product.id;
      const existing = newCart.get(key);
      if (existing && !isPackageItem) {
        newCart.set(key, { ...existing, qty: existing.qty + 1 });
      } else {
        newCart.set(key, {
          product, qty: 1,
          is_courtesy: isPackageItem,
          courtesy_reason: isPackageItem ? "Incluido en paquete de botella" : "",
          is_package_item: isPackageItem,
          included_with: parentId
        });
      }
      return newCart;
    });
  };

  const addToCart = async (product: Product) => {
    // Check for bottle package rules
    if (product.unit === 'PZBOT' || product.unit === 'PZBOTAN') {
      try {
        const supabase = createClient();
        const { data: prodData } = await supabase
          .from("products")
          .select("category_id, subcategory_id")
          .eq("id", product.id)
          .single();

        if (prodData?.subcategory_id) {
          const { data: ruleData } = await supabase
            .from("bottle_package_rules")
            .select("*, included_category:categories!included_category_id(name)")
            .eq("unit_type", product.unit)
            .eq("subcategory_id", prodData.subcategory_id)
            .eq("is_active", true)
            .single();

          if (ruleData) {
            setPendingBottle(product);
            setActivePackageRule(ruleData as any);
            setIsPackageModalOpen(true);
            return;
          }
        }
      } catch (err) {
        console.error("Error checking package rules:", err);
      }
    }
    directAddToCart(product);
  };

  const handlePackageConfirm = (selectedDrinks: { product: Product; qty: number }[]) => {
    if (!pendingBottle) return;
    directAddToCart(pendingBottle);
    selectedDrinks.forEach(({ product, qty }) => {
      setCartItems(prev => {
        const newCart = new Map(prev);
        const key = `${product.id}-pkg-${pendingBottle.id}`;
        newCart.set(key, {
          product, qty,
          is_courtesy: true, courtesy_reason: "Incluido en paquete",
          is_package_item: true, included_with: pendingBottle.id
        });
        return newCart;
      });
    });
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
    setCartItems(prev => { const c = new Map(prev); c.delete(productId); return c; });
    setSelectedRow(-1);
    ensureFocus();
  };

  const updateCartItem = (productId: string, updates: Partial<CartItem>) => {
    setCartItems(prev => {
      const newCart = new Map(prev);
      const existing = newCart.get(productId);
      if (existing) {
        newCart.set(productId, { ...existing, ...updates });
        if (updates.qty !== undefined && updates.qty <= 0) newCart.delete(productId);
      }
      return newCart;
    });
  };

  const incrementQty = (productId: string) => {
    playClick();
    setCartItems(prev => {
      const c = new Map(prev);
      const e = c.get(productId);
      if (e) c.set(productId, { ...e, qty: e.qty + 1 });
      return c;
    });
  };

  const decrementQty = (productId: string) => {
    playClick();
    setCartItems(prev => {
      const c = new Map(prev);
      const e = c.get(productId);
      if (e && e.qty > 1) c.set(productId, { ...e, qty: e.qty - 1 });
      else c.delete(productId);
      return c;
    });
  };

  // ─── Edit Item ────────────────────────────────────────────────────

  const openEditQty = (item: CartItem) => {
    setEditingItemId(item.product.id);
    setEditQty(item.qty);
    setEditIsCourtesy(item.is_courtesy || false);
    setEditCourtesyReason(item.courtesy_reason || "");
  };

  const confirmEditQty = () => {
    if (editingItemId) {
      updateCartItem(editingItemId, { qty: editQty, is_courtesy: editIsCourtesy, courtesy_reason: editCourtesyReason });
      setEditingItemId(null);
      playClick();
      ensureFocus();
    }
  };

  // ─── Computed Values ──────────────────────────────────────────────

  const { totalAmount, totalItems, totalSaved } = useMemo(() => {
    let amount = 0, items = 0, saved = 0;
    cartItems.forEach(({ product, qty, is_courtesy }) => {
      const { total, savedAmount } = calcItemPromoTotal(product, qty, is_courtesy || false);
      amount += total;
      saved += savedAmount;
      items += qty;
    });
    return { totalAmount: amount, totalItems: items, totalSaved: saved };
  }, [cartItems, calcItemPromoTotal]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

  // ─── Submit ───────────────────────────────────────────────────────

  const processConsumption = async () => {
    if (cartItems.size === 0) { toast.error("Agrega al menos un producto"); return; }
    if (!isReceptionist && !isAdmin && !isManager) {
      toast.error("Acceso denegado", { description: "Solo los recepcionistas pueden realizar ventas directas." });
      return;
    }

    setProcessing(true);
    const supabase = createClient();

    try {
      // Validate warehouse
      const { data: orderInfo } = await supabase
        .from("sales_orders").select("warehouse_id").eq("id", salesOrderId).single();
      if (!orderInfo?.warehouse_id) {
        toast.error("Error de configuración", { description: "La orden no tiene almacén asignado" });
        return;
      }

      // Validate stock
      const { validateStockAvailability } = await import("@/lib/utils/stock-helpers");
      const itemsToValidate = Array.from(cartItems.values()).map(({ product, qty }) => ({
        product_id: product.id, product_name: product.name, quantity: qty
      }));
      const stockErrors = await validateStockAvailability(itemsToValidate, orderInfo.warehouse_id);
      if (stockErrors.length > 0) {
        playError();
        toast.error("Stock insuficiente", { description: stockErrors.join("\n"), duration: 7000 });
        return;
      }

      // Get shift session
      const { data: { user } } = await supabase.auth.getUser();
      let currentSessionId = null;
      if (user) {
        const { data: employee } = await supabase
          .from('employees').select('id').eq('auth_user_id', user.id).single();
        if (employee) {
          const { data: activeSession } = await supabase
            .from('shift_sessions').select('id').eq('employee_id', employee.id).eq('status', 'active').maybeSingle();
          currentSessionId = activeSession?.id || null;
        }
      }

      // Insert items
      const itemsToInsert = Array.from(cartItems.values()).map(({ product, qty, is_courtesy, courtesy_reason }) => {
        const { total } = calcItemPromoTotal(product, qty, is_courtesy || false);
        const effectiveUnitPrice = is_courtesy ? 0 : (qty > 0 ? total / qty : product.price);
        return {
          sales_order_id: salesOrderId, product_id: product.id, qty,
          unit_price: Math.round(effectiveUnitPrice * 100) / 100,
          concept_type: "CONSUMPTION", is_paid: false,
          is_courtesy: is_courtesy || false, courtesy_reason: courtesy_reason || null,
          delivery_status: 'PENDING_VALET', shift_session_id: currentSessionId
        };
      });

      const { error: itemsError } = await supabase.from("sales_order_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // Inventory movements
      const movements = Array.from(cartItems.values()).map(({ product, qty }) => ({
        product_id: product.id, warehouse_id: orderInfo.warehouse_id,
        quantity: qty, movement_type: 'OUT', reason_id: 6, reason: 'SALE',
        notes: `Consumo vendido - Habitación ${roomNumber || 'N/A'}`,
        reference_table: 'sales_orders', reference_id: salesOrderId,
        created_by: user?.id || null
      }));
      const { error: movError } = await supabase.from("inventory_movements").insert(movements);
      if (movError) {
        console.error('Error creating inventory movements:', movError);
        toast.error("Advertencia", { description: "Consumo agregado pero hubo un error al actualizar el inventario" });
      }

      // Update order totals
      const { data: orderData } = await supabase
        .from("sales_orders").select("subtotal, total, paid_amount, remaining_amount").eq("id", salesOrderId).single();
      if (orderData) {
        await supabase.from("sales_orders").update({
          subtotal: (orderData.subtotal || 0) + totalAmount,
          total: (orderData.total || 0) + totalAmount,
          status: "PARTIAL",
        }).eq("id", salesOrderId);

        // Notify valets
        try {
          const productNames = Array.from(cartItems.values())
            .map(({ product, qty }) => `${qty}x ${product.name}`).join(", ");
          await notifyActiveValets(supabase, '🛒 Nuevo Consumo Registrado',
            `Habitación ${roomNumber || 'N/A'}: Se agregaron ${productNames}. Nuevo cargo: $${totalAmount.toFixed(2)} MXN.`,
            { type: 'REGULAR_CONSUMPTION', salesOrderId, roomNumber: roomNumber || 'N/A' }
          );
        } catch (pushErr) {
          console.error("Error sending consumption push notification:", pushErr);
        }
      }

      // Print tickets
      try {
        const date = new Date();
        const folio = `COM-${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        const printData = {
          roomNumber: roomNumber || 'N/A', folio, date: new Date(),
          items: Array.from(cartItems.values()).map(({ product, qty }) => ({
            name: product.name, qty, price: product.price, total: product.price * qty
          })),
          subtotal: totalAmount, total: totalAmount, hotelName: undefined
        };
        const printSuccess = await printConsumptionTickets(printData);
        if (!printSuccess) {
          toast.warning("Consumo agregado sin imprimir", {
            description: "El consumo se guardó pero hubo un error al imprimir los tickets.", duration: 8000
          });
        }
      } catch (printError) {
        console.error('Print error:', printError);
        toast.warning("Error de impresión", {
          description: "Consumo agregado correctamente, pero no se pudieron imprimir los tickets", duration: 5000
        });
      }

      playSuccess();
      const productNames = Array.from(cartItems.values())
        .map(({ product, qty }) => `${qty}x ${product.name}`).join(", ");
      toast.success("✓ Consumo registrado", { description: `${productNames} - Total: ${formatCurrency(totalAmount)}` });
      onComplete();
    } catch (error) {
      console.error("Error adding consumption:", error);
      playError();
      toast.error("Error al agregar consumo");
    } finally {
      setProcessing(false);
    }
  };

  return {
    // State
    products, loading, processing, searchValue, cartItems, lastAddedId, inputError, selectedRow,
    editingItemId, editQty, editIsCourtesy, editCourtesyReason,
    isPackageModalOpen, pendingBottle, activePackageRule,
    isPrinting, printStatus,
    // Computed
    totalAmount, totalItems, totalSaved,
    cartItemsArray: Array.from(cartItems.values()),
    // Setters
    setSearchValue, setSelectedRow, setEditingItemId, setEditQty, setEditIsCourtesy, setEditCourtesyReason,
    setIsPackageModalOpen, setPendingBottle, setActivePackageRule,
    // Actions
    handleInputChange, handleSearchKeyDown,
    addToCart, directAddToCart, removeFromCart, updateCartItem,
    incrementQty, decrementQty,
    openEditQty, confirmEditQty,
    handlePackageConfirm,
    processConsumption,
    ensureFocus,
    // Formatters
    formatCurrency, calcItemPromoTotal, findPromoForProduct,
    // Refs
    inputRef, editInputRef,
  };
}
