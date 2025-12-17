"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  X,
  Loader2,
  Package
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
}

interface AddConsumptionModalProps {
  isOpen: boolean;
  salesOrderId: string;
  roomNumber?: string;
  onClose: () => void;
  onComplete: () => void;
}

export function AddConsumptionModal({
  isOpen,
  salesOrderId,
  roomNumber,
  onClose,
  onComplete,
}: AddConsumptionModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Map<string, { product: Product; qty: number }>>(new Map());

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
      setSelectedProducts(new Map());
      setSearchTerm("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredProducts(products);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredProducts(
        products.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.sku.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, products]);

  const fetchProducts = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, price")
        .eq("is_active", true)
        .neq("sku", "SVC-ROOM") // Excluir producto de servicio
        .order("name");

      if (error) throw error;
      setProducts(data || []);
      setFilteredProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  const addProduct = (product: Product) => {
    const newSelected = new Map(selectedProducts);
    const existing = newSelected.get(product.id);
    if (existing) {
      newSelected.set(product.id, { ...existing, qty: existing.qty + 1 });
    } else {
      newSelected.set(product.id, { product, qty: 1 });
    }
    setSelectedProducts(newSelected);
  };

  const removeProduct = (productId: string) => {
    const newSelected = new Map(selectedProducts);
    const existing = newSelected.get(productId);
    if (existing && existing.qty > 1) {
      newSelected.set(productId, { ...existing, qty: existing.qty - 1 });
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      const newSelected = new Map(selectedProducts);
      newSelected.delete(productId);
      setSelectedProducts(newSelected);
    } else {
      const newSelected = new Map(selectedProducts);
      const existing = newSelected.get(productId);
      if (existing) {
        newSelected.set(productId, { ...existing, qty });
        setSelectedProducts(newSelected);
      }
    }
  };

  const getTotalAmount = () => {
    let total = 0;
    selectedProducts.forEach(({ product, qty }) => {
      total += product.price * qty;
    });
    return total;
  };

  const getTotalItems = () => {
    let count = 0;
    selectedProducts.forEach(({ qty }) => {
      count += qty;
    });
    return count;
  };

  const processConsumption = async () => {
    if (selectedProducts.size === 0) {
      toast.error("Selecciona al menos un producto");
      return;
    }

    setProcessing(true);
    const supabase = createClient();

    try {
      const totalAmount = getTotalAmount();

      // Insertar items en sales_order_items
      const itemsToInsert = Array.from(selectedProducts.values()).map(({ product, qty }) => ({
        sales_order_id: salesOrderId,
        product_id: product.id,
        qty,
        unit_price: product.price,
        concept_type: "CONSUMPTION",
        is_paid: false,
      }));

      const { error: itemsError } = await supabase
        .from("sales_order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

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

      const productNames = Array.from(selectedProducts.values())
        .map(({ product, qty }) => `${qty}x ${product.name}`)
        .join(", ");

      toast.success("Consumo agregado", {
        description: `${productNames} - Total: $${totalAmount.toFixed(2)}`,
      });

      onComplete();
    } catch (error) {
      console.error("Error adding consumption:", error);
      toast.error("Error al agregar consumo");
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-green-500" />
              Agregar Consumo
            </h2>
            {roomNumber && (
              <p className="text-sm text-muted-foreground">Habitación {roomNumber}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={processing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredProducts.map((product) => {
                const selected = selectedProducts.get(product.id);
                const qty = selected?.qty || 0;

                return (
                  <div
                    key={product.id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      qty > 0
                        ? "border-green-500 bg-green-500/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => addProduct(product)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                        <p className="text-sm font-bold text-green-600 mt-1">
                          {formatCurrency(product.price)}
                        </p>
                      </div>
                      {qty > 0 && (
                        <Badge className="bg-green-500 text-white">
                          {qty}
                        </Badge>
                      )}
                    </div>
                    {qty > 0 && (
                      <div className="flex items-center justify-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeProduct(product.id)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          value={qty}
                          onChange={(e) => updateQty(product.id, parseInt(e.target.value) || 0)}
                          className="w-14 h-7 text-center text-sm"
                          min={0}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => addProduct(product)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-8">
                  <Package className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No se encontraron productos</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-4 flex-shrink-0">
          <div>
            {selectedProducts.size > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">{getTotalItems()} productos</span>
                <span className="mx-2">•</span>
                <span className="font-bold text-green-600">{formatCurrency(getTotalAmount())}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={processing}>
              Cancelar
            </Button>
            <Button
              onClick={processConsumption}
              disabled={selectedProducts.size === 0 || processing}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Agregando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Consumo
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
