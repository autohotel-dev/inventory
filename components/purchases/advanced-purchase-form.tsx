"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  Trash2, 
  Search, 
  Calculator, 
  Package, 
  Building, 
  Truck, 
  Save,
  X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  sku: string;
  cost?: number;
}

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface PurchaseItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface PurchaseFormData {
  supplier_id: string;
  warehouse_id: string;
  currency: string;
  notes: string;
  items: PurchaseItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
}

export function AdvancedPurchaseForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);
  
  const [formData, setFormData] = useState<PurchaseFormData>({
    supplier_id: "",
    warehouse_id: "",
    currency: "MXN",
    notes: "",
    items: [],
    subtotal: 0,
    tax_rate: 16,
    tax_amount: 0,
    total: 0
  });
  const [includeTax, setIncludeTax] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [formData.items, formData.tax_rate, includeTax]);

  const fetchInitialData = async () => {
    const supabase = createClient();
    
    try {
      const [
        { data: suppliersData },
        { data: warehousesData },
        { data: productsData }
      ] = await Promise.all([
        supabase.from("suppliers").select("*").eq("is_active", true).order("name"),
        supabase.from("warehouses").select("*").eq("is_active", true).order("name"),
        supabase.from("products").select("id, name, sku, cost").eq("is_active", true).order("name")
      ]);

      setSuppliers(suppliersData || []);
      setWarehouses(warehousesData || []);
      setProducts(productsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
    const tax_amount = includeTax ? (subtotal * formData.tax_rate) / 100 : 0;
    const total = subtotal + tax_amount;

    setFormData(prev => ({
      ...prev,
      subtotal,
      tax_amount,
      total
    }));
  };

  const addProduct = (product: Product) => {
    const existingItemIndex = formData.items.findIndex(item => item.product_id === product.id);
    
    if (existingItemIndex >= 0) {
      // Si ya existe, incrementar cantidad
      const updatedItems = [...formData.items];
      updatedItems[existingItemIndex].quantity += 1;
      updatedItems[existingItemIndex].total = updatedItems[existingItemIndex].quantity * updatedItems[existingItemIndex].unit_price;
      
      setFormData(prev => ({ ...prev, items: updatedItems }));
    } else {
      // Agregar nuevo producto
      const newItem: PurchaseItem = {
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        quantity: 1,
        unit_price: product.cost || 0, // Precio de costo desde producto
        total: product.cost || 0
      };
      
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, newItem]
      }));
    }
    
    setShowProductSearch(false);
    setSearchTerm("");
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }

    const updatedItems = [...formData.items];
    updatedItems[index].quantity = quantity;
    updatedItems[index].total = quantity * updatedItems[index].unit_price;
    
    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const updateItemPrice = (index: number, price: number) => {
    const updatedItems = [...formData.items];
    updatedItems[index].unit_price = price;
    updatedItems[index].total = updatedItems[index].quantity * price;
    
    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const removeItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, items: updatedItems }));
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplier_id || !formData.warehouse_id || formData.items.length === 0) {
      alert("Por favor completa todos los campos requeridos y agrega al menos un producto");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      // Crear la orden de compra
      const { data: purchaseOrder, error: orderError } = await supabase
        .from("purchase_orders")
        .insert({
          supplier_id: formData.supplier_id,
          warehouse_id: formData.warehouse_id,
          currency: formData.currency,
          notes: formData.notes,
          subtotal: formData.subtotal,
          tax: formData.tax_amount,
          total: formData.total,
          status: "OPEN"
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      // Crear los items de la orden
      const itemsToInsert = formData.items.map(item => ({
        purchase_order_id: purchaseOrder.id,
        product_id: item.product_id,
        qty: item.quantity,
        unit_cost: item.unit_price
      }));

      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success("¡Orden de compra creada exitosamente!", {
        description: `Orden #${purchaseOrder.id.slice(0, 8)} creada correctamente`
      });
      router.push(`/purchases/${purchaseOrder.id}`);
    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast.error("Error al crear la orden de compra", {
        description: "Por favor verifica los datos e intenta nuevamente"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: formData.currency
    }).format(amount);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nueva Orden de Compra</h1>
          <p className="text-muted-foreground">Crea una nueva orden de compra con productos específicos</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Información General
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Proveedor *</Label>
              <select
                id="supplier_id"
                required
                value={formData.supplier_id}
                onChange={(e) => setFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Seleccionar proveedor</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="warehouse_id">Almacén *</Label>
              <select
                id="warehouse_id"
                required
                value={formData.warehouse_id}
                onChange={(e) => setFormData(prev => ({ ...prev, warehouse_id: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Seleccionar almacén</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <select
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              >
                <option value="MXN">MXN - Peso Mexicano</option>
                <option value="USD">USD - Dólar Americano</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_rate">Tasa de Impuesto (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                step="0.01"
                value={formData.tax_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas adicionales sobre la orden..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Productos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Productos ({formData.items.length})
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowProductSearch(!showProductSearch)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Producto
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Búsqueda de productos */}
            {showProductSearch && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar productos por nombre o SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-2 border rounded hover:bg-background cursor-pointer"
                      onClick={() => addProduct(product)}
                    >
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          SKU: {product.sku}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(product.cost || 0)}</div>
                      </div>
                    </div>
                  ))}
                  {filteredProducts.length === 0 && searchTerm && (
                    <div className="text-center text-muted-foreground py-4">
                      No se encontraron productos
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lista de productos seleccionados */}
            {formData.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay productos agregados</p>
                <p className="text-sm">Haz clic en "Agregar Producto" para comenzar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-sm text-muted-foreground">SKU: {item.product_sku}</div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Cantidad:</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Precio:</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                    </div>
                    
                    <div className="text-right min-w-[80px]">
                      <div className="font-medium">{formatCurrency(item.total)}</div>
                    </div>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totales */}
        {formData.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Resumen de Totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(formData.subtotal)}</span>
                </div>
                
                {/* Tax Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="includeTax" 
                      checked={includeTax}
                      onCheckedChange={(checked) => setIncludeTax(checked === true)}
                    />
                    <Label htmlFor="includeTax">Incluir impuesto ({formData.tax_rate}%)</Label>
                  </div>
                  {includeTax && (
                    <span className="font-medium">{formatCurrency(formData.tax_amount)}</span>
                  )}
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(formData.total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botones de acción */}
        <div className="flex gap-4 justify-end">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || formData.items.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Creando..." : "Crear Orden de Compra"}
          </Button>
        </div>
      </form>
    </div>
  );
}
