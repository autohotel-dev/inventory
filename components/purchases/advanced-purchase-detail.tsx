"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Package, 
  Truck, 
  Building, 
  Calendar,
  DollarSign,
  Edit,
  Trash2,
  Plus,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  ArrowLeft,
  User,
  X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface PurchaseOrderDetail {
  id: string;
  created_at: string;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
  supplier_id: string;
  warehouse_id: string;
  suppliers: { name: string; email?: string; phone?: string } | null;
  warehouses: { code: string; name: string } | null;
}

interface PurchaseOrderItem {
  id: string;
  product_id: string;
  qty: number;
  unit_cost: number;
  total: number;
  products: { name: string; sku: string } | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  cost?: number;
}

interface AdvancedPurchaseDetailProps {
  orderId: string;
}

export function AdvancedPurchaseDetail({ orderId }: AdvancedPurchaseDetailProps) {
  const router = useRouter();
  const [order, setOrder] = useState<PurchaseOrderDetail | null>(null);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newItemData, setNewItemData] = useState({
    quantity: 1,
    unit_price: 0
  });
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    itemId: '',
    itemName: ''
  });

  useEffect(() => {
    fetchOrderDetail();
  }, [orderId]);

  const fetchOrderDetail = async () => {
    setLoading(true);
    const supabase = createClient();
    
    try {
      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from("purchase_orders")
        .select(`
          id,
          created_at,
          status,
          currency,
          subtotal,
          tax,
          total,
          notes,
          supplier_id,
          warehouse_id,
          suppliers:supplier_id(name, email, phone),
          warehouses:warehouse_id(code, name)
        `)
        .eq("id", orderId)
        .single();

      if (orderError) {
        console.error('Error fetching order:', orderError);
        throw orderError;
      }

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from("purchase_order_items")
        .select(`
          id,
          product_id,
          qty,
          unit_cost,
          total,
          products:product_id(name, sku)
        `)
        .eq("purchase_order_id", orderId);

      if (itemsError) throw itemsError;

      // Fetch available products for adding new items
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, sku, cost")
        .eq("is_active", true)
        .order("name");

      setOrder(orderData as any);
      setItems(itemsData as any || []);
      setProducts(productsData || []);
    } catch (error) {
      console.error('Error fetching order detail:', error);
      // Si hay error, aún así intentamos mostrar algo
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'OPEN': { variant: 'default' as const, icon: Clock, label: 'Abierta' },
      'RECEIVED': { variant: 'secondary' as const, icon: CheckCircle, label: 'Recibida' },
      'CANCELLED': { variant: 'destructive' as const, icon: XCircle, label: 'Cancelada' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.OPEN;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string = 'MXN') => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const addProductToOrder = async () => {
    if (!selectedProduct || !order) return;

    const supabase = createClient();
    
    try {
      const { error } = await supabase
        .from("purchase_order_items")
        .insert({
          purchase_order_id: orderId,
          product_id: selectedProduct.id,
          qty: newItemData.quantity,
          unit_cost: newItemData.unit_price
        });

      if (error) throw error;

      // Recalcular totales de la orden
      await recalculateOrderTotals();
      
      // Refrescar datos
      await fetchOrderDetail();
      
      // Cerrar modal y resetear
      setShowAddProduct(false);
      setSelectedProduct(null);
      setNewItemData({ quantity: 1, unit_price: 0 });
      
      toast.success("Producto agregado exitosamente", {
        description: `${selectedProduct.name} agregado a la orden`
      });
      
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error("Error al agregar el producto", {
        description: "Por favor intenta nuevamente"
      });
    }
  };

  const recalculateOrderTotals = async () => {
    const supabase = createClient();
    
    try {
      const { data: itemsData } = await supabase
        .from("purchase_order_items")
        .select("total")
        .eq("purchase_order_id", orderId);

      const subtotal = itemsData?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
      const tax = 0; // Simplificado por ahora
      const total = subtotal + tax;

      await supabase
        .from("purchase_orders")
        .update({ subtotal, tax, total })
        .eq("id", orderId);
        
    } catch (error) {
      console.error('Error recalculating totals:', error);
    }
  };

  const handleRemoveClick = (itemId: string, itemName: string) => {
    setConfirmDialog({
      isOpen: true,
      itemId,
      itemName
    });
  };

  const removeItemFromOrder = async () => {
    const supabase = createClient();
    
    try {
      const { error } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("id", confirmDialog.itemId);

      if (error) throw error;

      // Recalcular totales
      await recalculateOrderTotals();
      
      // Refrescar datos
      await fetchOrderDetail();
      
      toast.success("Producto eliminado", {
        description: "El producto ha sido removido de la orden"
      });
      
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error("Error al eliminar el producto", {
        description: "Por favor intenta nuevamente"
      });
    }
  };

  const updateOrderStatus = async (newStatus: string) => {
    const supabase = createClient();
    
    try {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;
      // Create inventory movements for received orders
      if (newStatus === 'RECEIVED' && order) {
        const movements = items.map(item => ({
          product_id: item.product_id,
          warehouse_id: order.warehouse_id,
          quantity: item.qty, // Positive quantity, movement_type determines direction
          movement_type: 'IN',
          reason_id: 1, // ID 1 = PURCHASE in movement_reasons table
          reason: 'PURCHASE',
          notes: `Recibido de orden de compra ${orderId}`,
          reference_table: 'purchase_orders',
          reference_id: orderId
        }));

        const { error: movError } = await supabase
          .from("inventory_movements")
          .insert(movements);

        if (movError) {
          console.error('Error creating inventory movements:', movError);
          // No fallar la actualización de estado por error de movimientos
        }
      }

      await fetchOrderDetail();
      
      toast.success("Estado actualizado", {
        description: `La orden ahora está en estado: ${newStatus}`
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error("Error al actualizar el estado", {
        description: "Por favor intenta nuevamente"
      });
    }
  };

  const exportToPDF = () => {
    // Implementar exportación a PDF
    console.log('Exportar a PDF');
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Orden no encontrada</h2>
        <p className="text-muted-foreground">La orden de compra solicitada no existe.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Orden de Compra</h1>
            <p className="text-muted-foreground">#{order.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(order.status)}
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          {order.status === 'OPEN' && (
            <Button onClick={() => updateOrderStatus('RECEIVED')}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar como Recibida
            </Button>
          )}
        </div>
      </div>

      {/* Order Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="h-5 w-5 text-blue-600" />
              Proveedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="font-medium text-lg">{order.suppliers?.name}</div>
              {order.suppliers?.email && (
                <div className="text-sm text-muted-foreground">
                  📧 {order.suppliers.email}
                </div>
              )}
              {order.suppliers?.phone && (
                <div className="text-sm text-muted-foreground">
                  📞 {order.suppliers.phone}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building className="h-5 w-5 text-green-600" />
              Almacén
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="font-medium text-lg">
                {order.warehouses?.code} - {order.warehouses?.name}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-purple-600" />
              Información
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Creada:</span>
                <div className="font-medium">{formatDate(order.created_at)}</div>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Moneda:</span>
                <div className="font-medium">{order.currency}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Resumen Financiero
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(order.subtotal, order.currency)}
              </div>
              <div className="text-sm text-muted-foreground">Subtotal</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(order.tax, order.currency)}
              </div>
              <div className="text-sm text-muted-foreground">Impuestos</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(order.total, order.currency)}
              </div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {items.length}
              </div>
              <div className="text-sm text-muted-foreground">Productos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Productos ({items.length})
            </CardTitle>
            {order.status === 'OPEN' && (
              <Button onClick={() => setShowAddProduct(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Producto
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay productos en esta orden</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="font-medium">{item.products?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      SKU: {item.products?.sku}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="font-medium">{item.qty}</div>
                      <div className="text-xs text-muted-foreground">Cantidad</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">{formatCurrency(item.unit_cost, order.currency)}</div>
                      <div className="text-xs text-muted-foreground">Precio Unit.</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-green-600">{formatCurrency(item.total, order.currency)}</div>
                      <div className="text-xs text-muted-foreground">Total</div>
                    </div>
                    {order.status === 'OPEN' && (
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleRemoveClick(item.id, item.products?.name || 'Producto')}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-600" />
              Notas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Agregar Producto</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setShowAddProduct(false);
                  setSelectedProduct(null);
                  setNewItemData({ quantity: 1, unit_price: 0 });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Product Selection */}
              <div>
                <Label htmlFor="product">Producto</Label>
                <select
                  id="product"
                  className="w-full mt-1 p-2 border rounded-md bg-background text-foreground"
                  value={selectedProduct?.id || ''}
                  onChange={(e) => {
                    const product = products.find(p => p.id === e.target.value);
                    setSelectedProduct(product || null);
                    // Establecer precio automáticamente
                    if (product?.cost) {
                      setNewItemData(prev => ({
                        ...prev,
                        unit_price: product.cost || 0
                      }));
                    }
                  }}
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.sku} - {product.name} - {formatCurrency(product.cost || 0, order?.currency)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <Label htmlFor="quantity">Cantidad</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newItemData.quantity}
                  onChange={(e) => setNewItemData(prev => ({
                    ...prev,
                    quantity: parseInt(e.target.value) || 1
                  }))}
                />
              </div>

              {/* Unit Price - Read Only */}
              <div>
                <Label htmlFor="unit_price">Precio Unitario</Label>
                <Input
                  id="unit_price"
                  type="text"
                  value={formatCurrency(newItemData.unit_price, order?.currency)}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* Total Preview */}
              {selectedProduct && newItemData.quantity > 0 && (
                <div className="p-3 bg-muted rounded-md">
                  <div className="text-sm text-muted-foreground">Total:</div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(newItemData.quantity * newItemData.unit_price, order?.currency)}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowAddProduct(false);
                    setSelectedProduct(null);
                    setNewItemData({ quantity: 1, unit_price: 0 });
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={addProductToOrder}
                  disabled={!selectedProduct || newItemData.quantity <= 0}
                >
                  Agregar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, itemId: '', itemName: '' })}
        onConfirm={removeItemFromOrder}
        title="Eliminar producto"
        description={`¿Estás seguro de que quieres eliminar "${confirmDialog.itemName}" de esta orden?`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
}
