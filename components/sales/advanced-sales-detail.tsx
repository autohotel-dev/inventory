"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShoppingBag,
  Users,
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
  Truck,
  AlertTriangle,
  Package,
  X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Customer } from "@/lib/types/inventory";
import { Modal } from "@/components/sales/make_payment_modal";

interface SalesOrderDetail {
  id: string;
  created_at: string;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
  customer_id: string | null;
  warehouse_id: string;
  customers: { name: string; email: string; phone: string } | null;
  warehouses: { code: string; name: string } | null;
  remaining_amount: number;
}

interface SalesOrderItem {
  id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  total: number;
  products: { name: string; sku: string } | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price?: number;
}

interface AdvancedSalesDetailProps {
  orderId: string;
}

export function AdvancedSalesDetail({ orderId }: AdvancedSalesDetailProps) {
  const router = useRouter();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [order, setOrder] = useState<SalesOrderDetail | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockWarnings, setStockWarnings] = useState<string[]>([]);
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

  const [paymentAmount, setPaymentAmount] = useState<string>("");

  useEffect(() => {
    fetchOrderDetail();
  }, [orderId]);

  const handlePaymentModalClose = () => {
    setShowPaymentModal(false);
  };

  const handlePaymentModalOpen = () => {
    if (!order || typeof order.remaining_amount !== "number") {
      toast.error("No se pudo obtener el saldo pendiente");
      return;
    }

    if (order.remaining_amount <= 0) {
      toast.error("No hay saldo pendiente", {
        description: "Esta orden ya está pagada al 100%."
      });
      return;
    }

    // Pre-cargar el monto con el saldo pendiente para facilitar el flujo
    setPaymentAmount(String(order.remaining_amount));
    setShowPaymentModal(true);
  };

  const resetPaymentForm = () => {
    setShowPaymentModal(false);
    setPaymentAmount("");
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(paymentAmount || "0");

    if (!amount || amount <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .rpc("process_payment", {
          order_id: orderId,
          payment_amount: amount
        });

      if (error) {
        console.error('Error creating payment:', error);
        toast.error('Error al crear el pago');
        return;
      }

      const result = data[0] as any;

      if (result.success === true) {
        toast.success('Pago creado exitosamente');
        fetchOrderDetail();
        resetPaymentForm();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Error al crear el pago');
    }
  };

  const fetchOrderDetail = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // Fetch order details (simplified query first)
      const { data: orderData, error: orderError } = await supabase
        .from("sales_orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (orderError) {
        console.error('Error fetching sales order:', orderError);
        throw orderError;
      }

      if (!orderData) {
        console.log('No se encontró la orden con ID:', orderId);
        return;
      }

      // Fetch customer and warehouse separately if they exist
      let customerData = null;
      let warehouseData = null;

      if (orderData.customer_id) {
        const { data: customer } = await supabase
          .from("customers")
          .select("name, email, phone")
          .eq("id", orderData.customer_id)
          .single();
        customerData = customer as Customer;
      }

      if (orderData.warehouse_id) {
        const { data: warehouse } = await supabase
          .from("warehouses")
          .select("code, name")
          .eq("id", orderData.warehouse_id)
          .single();
        warehouseData = warehouse;
      }

      // Add relations to order data
      const enrichedOrderData = {
        ...orderData,
        customers: customerData,
        warehouses: warehouseData
      };

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from("sales_order_items")
        .select(`
          id,
          product_id,
          qty,
          unit_price,
          total,
          products:product_id(name, sku)
        `)
        .eq("sales_order_id", orderId);

      if (itemsError) {
        console.error('Error fetching items:', itemsError);
        throw itemsError;
      }

      // Fetch available products for adding new items
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, sku, price")
        .eq("is_active", true)
        .order("name");

      // Simplified: no stock warnings for now
      const warnings: string[] = [];

      setOrder(enrichedOrderData as any);
      setItems(itemsData as any || []);
      setProducts(productsData || []);
      setStockWarnings(warnings);
    } catch (error) {
      console.error('Error fetching order detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'OPEN': { variant: 'default' as const, icon: Clock, label: 'Abierta', color: 'bg-gray-700' },
      'COMPLETED': { variant: 'secondary' as const, icon: CheckCircle, label: 'Completada', color: 'bg-green-700' },
      'PARTIAL': { variant: 'outline' as const, icon: Truck, label: 'En Pagos', color: 'bg-yellow-700' },
      'CANCELLED': { variant: 'destructive' as const, icon: XCircle, label: 'Cancelada', color: 'bg-red-700' },
      'ENDED': { variant: 'secondary' as const, icon: FileText, label: 'Finalizada', color: 'bg-blue-700' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.OPEN;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={`flex items-center gap-2 p-2 ${config.color}`}>
        <Icon className="h-4 w-4" />
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

  const updateOrderStatus = async (newStatus: string) => {
    const supabase = createClient();

    try {
      // Create inventory movements for completed/shipped orders
      if ((newStatus === 'COMPLETED' || newStatus === 'PARTIAL') && order) {
        const movements = items.map(item => ({
          product_id: item.product_id,
          warehouse_id: order.warehouse_id,
          quantity: item.qty, // Positive quantity, movement_type determines direction
          movement_type: 'OUT',
          reason_id: 6, // ID 6 = SALE in movement_reasons table
          reason: 'SALE',
          notes: `Vendido en orden ${orderId}`,
          reference_table: 'sales_orders',
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

      const { error } = await supabase
        .from("sales_orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

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

  const calculateProfitMargin = () => {
    if (!order || !items.length) return 0;

    const totalCost = items.reduce((sum, item) => {
      // Assuming we have purchase_price in products, otherwise use a default margin
      const estimatedCost = item.unit_price * 0.7; // 70% of sale price as estimated cost
      return sum + (estimatedCost * item.qty);
    }, 0);

    const revenue = order.total;
    const profit = revenue - totalCost;
    return totalCost > 0 ? (profit / revenue) * 100 : 0;
  };

  const exportToPDF = () => {
    // Implementar exportación a PDF
    console.log('Exportar a PDF');
  };

  const addProductToOrder = async () => {
    if (!selectedProduct || !order) return;

    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("sales_order_items")
        .insert({
          sales_order_id: orderId,
          product_id: selectedProduct.id,
          qty: newItemData.quantity,
          unit_price: newItemData.unit_price
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
        .from("sales_order_items")
        .select("qty, unit_price")
        .eq("sales_order_id", orderId);

      const subtotal =
        itemsData?.reduce(
          (sum, item: any) => sum + (Number(item.qty) || 0) * (Number(item.unit_price) || 0),
          0
        ) || 0;
      const tax = 0; // Simplificado por ahora
      const total = subtotal + tax;
      // Obtener monto ya pagado para recalcular saldo pendiente
      const { data: orderData } = await supabase
        .from("sales_orders")
        .select("paid_amount")
        .eq("id", orderId)
        .single();

      const paid_amount = Number(orderData?.paid_amount) || 0;
      const remaining_amount = Math.max(total - paid_amount, 0);

      await supabase
        .from("sales_orders")
        .update({ subtotal, tax, total, remaining_amount })
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
        .from("sales_order_items")
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
        <p className="text-muted-foreground">La orden de venta solicitada no existe.</p>
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
            <h1 className="text-2xl font-bold">Orden de Venta</h1>
            <p className="text-muted-foreground">#{order.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {getStatusBadge(order.status)}
          <Button variant="outline" onClick={exportToPDF}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          {order.status === 'OPEN' && (
            <div className="flex items-center gap-2">
              <Button onClick={() => updateOrderStatus('COMPLETED')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Completar Venta
              </Button>
              <Button onClick={() => updateOrderStatus('PARTIAL')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mandar a Pagos
              </Button>
            </div>
          )}
          {order.status === 'PARTIAL' && (
            <Button onClick={handlePaymentModalOpen}>
              <Truck className="h-4 w-4 mr-2" />
              Abonar
            </Button>
          )}
          {order.status === 'COMPLETED' && (
            <Button onClick={() => updateOrderStatus('ENDED')}>
              <Truck className="h-4 w-4 mr-2" />
              Finalizar Venta
            </Button>
          )}
        </div>
      </div>

      {/* Stock Warnings */}
      {stockWarnings.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              Advertencias de Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {stockWarnings.map((warning, index) => (
                <li key={index} className="text-sm text-orange-700">• {warning}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Order Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-blue-600" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="font-medium text-lg">
                {order.customers?.name}
              </div>
              {order.customers?.email && (
                <div className="text-sm text-muted-foreground">
                  📧 {order.customers.email}
                </div>
              )}
              {order.customers?.phone && (
                <div className="text-sm text-muted-foreground">
                  📞 {order.customers.phone}
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
                {calculateProfitMargin().toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Margen Est.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-blue-600" />
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
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
                      <div className="font-medium">{formatCurrency(item.unit_price, order.currency)}</div>
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
                    if (product?.price) {
                      setNewItemData(prev => ({
                        ...prev,
                        unit_price: product.price || 0
                      }));
                    }
                  }}
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.sku} - {product.name} - {formatCurrency(product.price || 0, order?.currency)}
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

      <Modal
        isOpen={showPaymentModal}
        onClose={handlePaymentModalClose}
        title="Abonar"
      >
        <div>
          <form onSubmit={handlePaymentSubmit}>
            <div>
              <Label htmlFor="amount">Monto</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={`Máximo: $${order?.remaining_amount || 0}`}
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={resetPaymentForm}>
                Cancelar
              </Button>
              <Button type="submit">Abonar</Button>
            </div>
          </form>
        </div>
      </Modal>

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
