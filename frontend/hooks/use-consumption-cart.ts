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
import { getEmployeeByAuthUserId } from "@/lib/services/employee-service";
import { getActiveSession } from "@/lib/services/shift-service";
import { formatCurrency } from "@/lib/utils/formatters";
import { findPromotion, priceLines, linesTotal, describePromotion, type Promotion, type ConsumedItem, type PricedLine } from "@/lib/promotions/engine";
import { logFinancialAction } from "@/lib/audit-logger";
import { findActiveFlow, logFlowEvent } from "@/lib/flow-logger";
import { validateStockAvailability } from "@/lib/utils/stock-helpers";
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
  /** Llave del renglón en el carrito (el producto, o producto+paquete para bebidas incluidas) */
  key: string;
  product: Product;
  qty: number;
  is_courtesy?: boolean;
  courtesy_reason?: string;
  is_package_item?: boolean;
  included_with?: string;
  /** Paquete de botella al que pertenece la bebida incluida */
  package_group?: string;
}

export type ActivePromotion = Promotion;

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

  // Promo context: lo ya consumido en esta estancia (para "solo primera orden")
  const [consumedItems, setConsumedItems] = useState<ConsumedItem[]>([]);
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
  const processingLockRef = useRef<boolean>(false);

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
        .not("sku", "like", "SVC-%") // servicios internos (habitación, daños, hora extra) no se venden aquí
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

  // Todos los consumos de una estancia van en su misma orden: lo consumido = sus renglones vigentes
  const loadConsumedItems = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("sales_order_items")
      .select("product_id, is_cancelled, products:products(category_id, subcategory_id)")
      .eq("sales_order_id", salesOrderId)
      .eq("concept_type", "CONSUMPTION");
    if (error) {
      console.error("Error loading consumed items:", error);
      setConsumedItems([]);
      return;
    }
    setConsumedItems((data || [])
      .filter((item: any) => !item.is_cancelled && item.product_id)
      .map((item: any) => ({
        productId: item.product_id,
        categoryId: item.products?.category_id || null,
        subcategoryId: item.products?.subcategory_id || null,
      })));
  };

  // ─── Init on Open ─────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      fetchActivePromotions();
      loadConsumedItems();
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

  const findPromoForProduct = useCallback((product: Product): ActivePromotion | null =>
    findPromotion(product, activePromotions, consumedItems),
  [activePromotions, consumedItems]);

  const calcItemPromoTotal = useCallback((product: Product, qty: number, isCourtesy: boolean): { total: number; promo: ActivePromotion | null; savedAmount: number; lines: PricedLine[] } => {
    if (isCourtesy) return { total: 0, promo: null, savedAmount: 0, lines: [{ qty, unitPrice: 0, isPromoGift: false, promo: null }] };
    const promo = findPromoForProduct(product);
    const lines = priceLines(product, qty, promo);
    const total = linesTotal(lines);
    return { total, promo: lines.some(l => l.promo) ? promo : null, savedAmount: Math.round((product.price * qty - total) * 100) / 100, lines };
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

  const directAddToCart = (product: Product) => {
    setCartItems(prev => {
      const newCart = new Map(prev);
      const existing = newCart.get(product.id);
      if (existing) {
        newCart.set(product.id, { ...existing, qty: existing.qty + 1 });
      } else {
        newCart.set(product.id, { key: product.id, product, qty: 1, is_courtesy: false, courtesy_reason: "" });
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
    // Cada botella lleva su propio paquete: una segunda botella igual no reemplaza las bebidas de la primera
    const group = `${pendingBottle.id}-${Date.now()}`;
    setCartItems(prev => {
      const newCart = new Map(prev);
      selectedDrinks.forEach(({ product, qty }) => {
        const key = `${product.id}-pkg-${group}`;
        newCart.set(key, {
          key, product, qty,
          is_courtesy: true, courtesy_reason: "Incluido en paquete de botella",
          is_package_item: true, included_with: pendingBottle.id, package_group: group,
        });
      });
      return newCart;
    });
    setPendingBottle(null);
    setActivePackageRule(null);
    setIsPackageModalOpen(false);
    playSuccess();
    setSearchValue("");
    setLastAddedId(pendingBottle.id);
    ensureFocus();
  };

  const packageGroupsOf = (cart: Map<string, CartItem>, bottleId: string) =>
    [...new Set([...cart.values()].filter(i => i.is_package_item && i.included_with === bottleId).map(i => i.package_group!))];

  const removeFromCart = (key: string) => {
    playClick();
    setCartItems(prev => {
      const c = new Map(prev);
      const item = c.get(key);
      c.delete(key);
      // Quitar la botella quita también las bebidas de sus paquetes
      if (item && !item.is_package_item) {
        [...c.values()].filter(i => i.is_package_item && i.included_with === item.product.id).forEach(i => c.delete(i.key));
      }
      return c;
    });
    setSelectedRow(-1);
    ensureFocus();
  };

  const updateCartItem = (key: string, updates: Partial<CartItem>) => {
    setCartItems(prev => {
      const newCart = new Map(prev);
      const existing = newCart.get(key);
      if (existing) {
        newCart.set(key, { ...existing, ...updates });
        if (updates.qty !== undefined && updates.qty <= 0) newCart.delete(key);
      }
      return newCart;
    });
  };

  const incrementQty = (key: string) => {
    const item = cartItems.get(key);
    if (!item) return;
    if (item.is_package_item) {
      toast.info("Las bebidas del paquete no se pueden aumentar", { description: "Si quieren más, agrégalas como consumo normal." });
      return;
    }
    // Una botella más con paquete pasa por su selección de bebidas
    if (packageGroupsOf(cartItems, item.product.id).length > 0) { addToCart(item.product); return; }
    playClick();
    updateCartItem(key, { qty: item.qty + 1 });
  };

  const decrementQty = (key: string) => {
    playClick();
    setCartItems(prev => {
      const c = new Map(prev);
      const e = c.get(key);
      if (!e) return c;
      const groups = e.is_package_item ? [] : packageGroupsOf(c, e.product.id);
      if (groups.length > 0) {
        // Una botella menos se lleva su último paquete
        const last = groups.sort().at(-1);
        [...c.values()].filter(i => i.package_group === last).forEach(i => c.delete(i.key));
      }
      if (e.qty > 1) c.set(key, { ...e, qty: e.qty - 1 });
      else c.delete(key);
      return c;
    });
  };

  // ─── Edit Item ────────────────────────────────────────────────────

  const openEditQty = (item: CartItem) => {
    if (item.is_package_item || packageGroupsOf(cartItems, item.product.id).length > 0) {
      toast.info("Los paquetes de botella no se editan", { description: "Usa + y − o quita la botella y vuélvela a agregar." });
      return;
    }
    setEditingItemId(item.key);
    setEditQty(item.qty);
    setEditIsCourtesy(item.is_courtesy || false);
    setEditCourtesyReason(item.courtesy_reason || "");
  };

  const confirmEditQty = () => {
    if (editingItemId && editIsCourtesy && !editCourtesyReason.trim()) {
      toast.error("Escribe el motivo de la cortesía");
      return;
    }
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



  // ─── Submit ───────────────────────────────────────────────────────

  const processConsumption = async () => {
    if (cartItems.size === 0) { toast.error("Agrega al menos un producto"); return; }
    if (!isReceptionist && !isAdmin && !isManager) {
      toast.error("Acceso denegado", { description: "Solo los recepcionistas pueden realizar ventas directas." });
      return;
    }
    if (processingLockRef.current) return; // Synchronous double-click guard
    processingLockRef.current = true;

    setProcessing(true);
    const supabase = createClient();

    try {
      // Validate warehouse
      const { data: orderInfo } = await supabase
        .from("sales_orders").select("warehouse_id").eq("id", salesOrderId).single();
      if (!orderInfo?.warehouse_id) {
        toast.error("Error de configuración", { description: "La orden no tiene almacén asignado" });
        processingLockRef.current = false;
        setProcessing(false);
        return;
      }

      // Validate stock
      const itemsToValidate = Array.from(cartItems.values()).map(({ product, qty }) => ({
        product_id: product.id, product_name: product.name, quantity: qty
      }));
      const stockErrors = await validateStockAvailability(itemsToValidate, orderInfo.warehouse_id);
      if (stockErrors.length > 0) {
        playError();
        toast.error("Stock insuficiente", { description: stockErrors.join("\n"), duration: 7000 });
        processingLockRef.current = false;
        setProcessing(false);
        return;
      }

      // Get shift session — must always resolve to the ACTIVE shift, never a closed one
      const { data: { user } } = await supabase.auth.getUser();
      let currentSessionId = null;
      if (user) {
        const employeeResult = await getEmployeeByAuthUserId(user.id);
        const employeeData = employeeResult.success ? employeeResult.data : null;
        if (employeeData) {
          const sessionResult = await getActiveSession(employeeData.id);
          const activeSession = sessionResult.success ? sessionResult.data : null;
          currentSessionId = activeSession?.id || null;

          // Fallback: if current user has no active shift, find any active reception shift.
          // This prevents items from being inserted with shift_session_id = null
          // when the user's shift is in 'pending_closing' state.
          if (!currentSessionId) {
            const { data: receptionSession } = await supabase
              .from('shift_sessions')
              .select('id, employees!inner(role)')
              .in('status', ['active', 'open'])
              .or('role.eq.receptionist,role.eq.admin,role.eq.manager', { foreignTable: 'employees' })
              .order('clock_in_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            currentSessionId = receptionSession?.id || null;
          }
        }
      }

      // Insert items
      // Un renglón por precio: la parte con promoción va separada de la de precio normal, así el
      // total de cada renglón (qty × precio) cuadra con lo que se cobra y con el ticket
      const itemsToInsert = Array.from(cartItems.values()).flatMap(({ product, qty, is_courtesy, courtesy_reason }) =>
        calcItemPromoTotal(product, qty, is_courtesy || false).lines.map(line => ({
          sales_order_id: salesOrderId, product_id: product.id, qty: line.qty,
          unit_price: line.unitPrice,
          concept_type: "CONSUMPTION", is_paid: false,
          is_courtesy: (is_courtesy || line.isPromoGift) || false,
          courtesy_reason: line.isPromoGift ? `Promoción ${line.promo?.name}` : (courtesy_reason || null),
          delivery_status: 'PENDING_VALET', shift_session_id: currentSessionId
        })));

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
        // remaining_amount no se toca: el trigger de sales_order_items ya lo recalculó al insertar
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
          items: Array.from(cartItems.values()).flatMap(({ product, qty, is_courtesy }) =>
            calcItemPromoTotal(product, qty, is_courtesy || false).lines.map(line => ({
              name: line.promo ? `${product.name} (${describePromotion(line.promo)})` : product.name,
              qty: line.qty,
              price: line.unitPrice,
              total: Math.round(line.qty * line.unitPrice * 100) / 100,
            }))),
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

      // ─── Audit Log ─────────────────────────────────────────────
      logFinancialAction("CONSUMPTION_ADDED", {
        roomNumber: roomNumber || "N/A",
        amount: totalAmount,
        sessionId: currentSessionId,
        salesOrderId: salesOrderId,
        description: `Consumo en Hab. ${roomNumber || 'N/A'}: ${productNames} - Total: ${formatCurrency(totalAmount)}`,
        extra: {
          item_count: totalItems,
          products: Array.from(cartItems.values()).map(({ product, qty, is_courtesy }) => ({
            name: product.name, qty, price: product.price, is_courtesy: !!is_courtesy,
          })),
        },
      });

      // ─── Flow Event ─────────────────────────────────────────────
      try {
        const { data: stayForFlow } = await supabase
          .from("room_stays")
          .select("id")
          .eq("sales_order_id", salesOrderId)
          .eq("status", "ACTIVA")
          .maybeSingle();
        if (stayForFlow) {
          findActiveFlow(stayForFlow.id).then(flowId => {
            if (flowId) {
              logFlowEvent(flowId, {
                event_type: "CONSUMPTION_ADDED",
                description: `Consumo registrado: ${productNames} - ${formatCurrency(totalAmount)}`,
                metadata: {
                  amount: totalAmount,
                  item_count: totalItems,
                  products: Array.from(cartItems.values()).map(({ product, qty }) => ({ name: product.name, qty, price: product.price })),
                },
              });
            }
          });
        }
      } catch (flowErr) {
        console.error("[flow-logger] consumption:", flowErr);
      }

      onComplete();
    } catch (error) {
      console.error("Error adding consumption:", error);
      playError();
      // La base valida precios y cortesías: su mensaje dice qué renglón y por qué
      toast.error("Error al agregar consumo", { description: (error as { message?: string })?.message, duration: 10000 });
    } finally {
      setProcessing(false);
      processingLockRef.current = false;
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
