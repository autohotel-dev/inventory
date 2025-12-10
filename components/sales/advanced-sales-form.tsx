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
  ShoppingBag, 
  Building, 
  Users, 
  Save,
  X,
  AlertTriangle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PaymentMethod, PAYMENT_METHODS } from "@/components/sales/room-types";

interface Product {
  id: string;
  name: string;
  sku: string;
  price?: number;
}

interface Customer {
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

interface SalesItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  total: number;
  available_stock: number;
}

interface SalesFormData {
  customer_id: string;
  warehouse_id: string;
  currency: string;
  notes: string;
  items: SalesItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_rate: number;
  discount_amount: number;
  total: number;
  remaining_amount: number;
  paid_amount: number;
  payment_method: PaymentMethod;
}

export function AdvancedSalesForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);
  
  const [formData, setFormData] = useState<SalesFormData>({
    customer_id: "",
    warehouse_id: "",
    currency: "MXN",
    notes: "",
    items: [],
    subtotal: 0,
    tax_rate: 16,
    tax_amount: 0,
    discount_rate: 0,
    discount_amount: 0,
    total: 0,
    remaining_amount: 0,
    paid_amount: 0,
    payment_method: "EFECTIVO"
  });
  const [includeTax, setIncludeTax] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [formData.items, formData.tax_rate, formData.discount_rate, includeTax]);

  const fetchInitialData = async () => {
    const supabase = createClient();
    
    try {
      const [
        { data: customersData },
        { data: warehousesData },
        { data: productsData }
      ] = await Promise.all([
        supabase.from("customers").select("*").eq("is_active", true).order("name"),
        supabase.from("warehouses").select("*").eq("is_active", true).order("name"),
        supabase.from("products").select("id, name, sku, price").eq("is_active", true).order("name")
      ]);

      setCustomers(customersData || []);
      setWarehouses(warehousesData || []);
      setProducts(productsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
    const discount_amount = (subtotal * formData.discount_rate) / 100;
    const discounted_subtotal = subtotal - discount_amount;
    const tax_amount = includeTax ? (discounted_subtotal * formData.tax_rate) / 100 : 0;
    const total = discounted_subtotal + tax_amount;

    setFormData(prev => ({
      ...prev,
      subtotal,
      discount_amount,
      tax_amount,
      total
    }));
  };

  const addProduct = (product: Product) => {
    const existingItemIndex = formData.items.findIndex(item => item.product_id === product.id);
    
    if (existingItemIndex >= 0) {
      // Si ya existe, incrementar cantidad (verificando stock)
      const existingItem = formData.items[existingItemIndex];
      // Simplificado: sin verificación de stock por ahora
      
      const updatedItems = [...formData.items];
      updatedItems[existingItemIndex].quantity += 1;
      updatedItems[existingItemIndex].total = updatedItems[existingItemIndex].quantity * updatedItems[existingItemIndex].unit_price;
      
      setFormData(prev => ({ ...prev, items: updatedItems }));
    } else {
      // Agregar nuevo producto (sin verificación de stock por ahora)
      const newItem: SalesItem = {
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        quantity: 1,
        unit_price: product.price || 0, // Precio desde producto
        total: product.price || 0,
        available_stock: 999 // Valor temporal
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

    const item = formData.items[index];
    if (quantity > item.available_stock) {
      alert(`Cantidad máxima disponible: ${item.available_stock}`);
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
    
    if (!formData.warehouse_id || formData.items.length === 0) {
      alert("Por favor completa todos los campos requeridos y agrega al menos un producto");
      return;
    }

    // Verificar stock antes de crear la venta
    const stockErrors = formData.items.filter(item => item.quantity > item.available_stock);
    if (stockErrors.length > 0) {
      alert("Algunos productos exceden el stock disponible. Por favor revisa las cantidades.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      // Obtener el usuario actual
      const { data: { user } } = await supabase.auth.getUser();

      // Crear la orden de venta
      const { data: salesOrder, error: orderError } = await supabase
        .from("sales_orders")
        .insert({
          customer_id: formData.customer_id || null,
          warehouse_id: formData.warehouse_id,
          currency: formData.currency,
          notes: formData.notes,
          subtotal: formData.subtotal,
          tax: formData.tax_amount,
          total: formData.total,
          status: "OPEN",
          remaining_amount: formData.total,
          paid_amount: 0,
          payment_method: formData.payment_method,
          created_by: user?.id || null
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      // Crear los items de la orden
      const itemsToInsert = formData.items.map(item => ({
        sales_order_id: salesOrder.id,
        product_id: item.product_id,
        qty: item.quantity,
        unit_price: item.unit_price
      }));

      const { error: itemsError } = await supabase
        .from("sales_order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success("¡Orden de venta creada exitosamente!", {
        description: `Orden #${salesOrder.id.slice(0, 8)} creada correctamente`
      });
      router.push(`/sales/${salesOrder.id}`);
    } catch (error) {
      console.error('Error creating sales order:', error);
      toast.error("Error al crear la orden de venta", {
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

  const getStockBadge = () => {
    return <Badge variant="outline">Disponible</Badge>;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nueva Orden de Venta</h1>
          <p className="text-muted-foreground">Crea una nueva orden de venta con control de inventario</p>
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
              <Label htmlFor="customer_id">Cliente</Label>
              <select
                id="customer_id"
                value={formData.customer_id}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_id: e.target.value }))}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Cliente general (sin especificar)</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
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

            <div className="space-y-2">
              <Label htmlFor="discount_rate">Descuento (%)</Label>
              <Input
                id="discount_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.discount_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, discount_rate: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas adicionales sobre la venta..."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Método de Pago</Label>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <Button
                    key={method.value}
                    type="button"
                    variant={formData.payment_method === method.value ? "default" : "outline"}
                    onClick={() => setFormData(prev => ({ ...prev, payment_method: method.value }))}
                    className="flex-1"
                  >
                    <span className="mr-2">{method.icon}</span>
                    {method.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Productos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
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
                      className="flex items-center justify-between p-2 border rounded cursor-pointer transition-colors hover:bg-background"
                      onClick={() => addProduct(product)}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          SKU: {product.sku}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStockBadge()}
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(product.price || 0)}</div>
                        </div>
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
                <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay productos agregados</p>
                <p className="text-sm">Haz clic en "Agregar Producto" para comenzar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-sm text-muted-foreground">
                        SKU: {item.product_sku} | Disponible: {item.available_stock}
                      </div>
                      {item.quantity > item.available_stock && (
                        <div className="flex items-center gap-1 text-red-500 text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          Excede stock disponible
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Cantidad:</Label>
                      <Input
                        type="number"
                        min="1"
                        max={item.available_stock}
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                        className={`w-20 ${item.quantity > item.available_stock ? 'border-red-500' : ''}`}
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
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-medium">{formatCurrency(formData.subtotal)}</span>
                </div>
                {formData.discount_rate > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Descuento ({formData.discount_rate}%):</span>
                    <span className="font-medium">-{formatCurrency(formData.discount_amount)}</span>
                  </div>
                )}
                
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
                <div className="border-t pt-2">
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
            {loading ? "Creando..." : "Crear Orden de Venta"}
          </Button>
        </div>
      </form>
    </div>
  );
}
