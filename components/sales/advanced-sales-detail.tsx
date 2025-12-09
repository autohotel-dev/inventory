"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  X,
  CreditCard,
  Receipt,
  Wallet
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Customer } from "@/lib/types/inventory";
import { AddProductModal } from "@/components/sales/add-product-modal";

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

  const addProductToOrder = async (items: { product: Product; quantity: number; unit_price: number }[]) => {
    if (!order || items.length === 0) return;

    const supabase = createClient();

    try {
      // Insertar todos los productos
      const insertData = items.map(item => ({
        sales_order_id: orderId,
        product_id: item.product.id,
        qty: item.quantity,
        unit_price: item.unit_price
      }));

      const { error } = await supabase
        .from("sales_order_items")
        .insert(insertData);

      if (error) throw error;

      // Recalcular totales de la orden
      await recalculateOrderTotals();

      // Refrescar datos
      await fetchOrderDetail();

      // Cerrar modal
      setShowAddProduct(false);

      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
      toast.success(`${totalItems} producto(s) agregado(s)`, {
        description: `Se agregaron ${items.length} línea(s) a la orden`
      });

    } catch (error) {
      console.error('Error adding products:', error);
      toast.error("Error al agregar productos", {
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

  const paidAmount = order.total - order.remaining_amount;
  const paymentProgress = order.total > 0 ? (paidAmount / order.total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header compacto */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Orden de Venta</h1>
              {getStatusBadge(order.status)}
            </div>
            <p className="text-xs text-muted-foreground font-mono">#{order.id.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          {order.status === 'OPEN' && (
            <>
              <Button size="sm" variant="outline" onClick={() => updateOrderStatus('PARTIAL')}>
                <CreditCard className="h-4 w-4 mr-2" />
                Enviar a Pagos
              </Button>
              <Button size="sm" onClick={() => updateOrderStatus('COMPLETED')}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Completar
              </Button>
            </>
          )}
          {order.status === 'PARTIAL' && (
            <Button size="sm" onClick={handlePaymentModalOpen}>
              <Wallet className="h-4 w-4 mr-2" />
              Abonar
            </Button>
          )}
          {order.status === 'COMPLETED' && (
            <Button size="sm" onClick={() => updateOrderStatus('ENDED')}>
              <Truck className="h-4 w-4 mr-2" />
              Finalizar
            </Button>
          )}
        </div>
      </div>

      {/* Stock Warnings */}
      {stockWarnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-600 font-medium mb-2">
            <AlertTriangle className="h-4 w-4" />
            Advertencias de Stock
          </div>
          <ul className="space-y-1 text-sm text-amber-700">
            {stockWarnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Info Cards - Grid compacto */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cliente */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Cliente</p>
                <p className="font-medium truncate">{order.customers?.name || 'Cliente general'}</p>
                {order.customers?.email && (
                  <p className="text-xs text-muted-foreground truncate">{order.customers.email}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Almacén */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Building className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Almacén</p>
                <p className="font-medium">{order.warehouses?.code || '-'}</p>
                <p className="text-xs text-muted-foreground truncate">{order.warehouses?.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fecha */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Calendar className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Fecha</p>
                <p className="font-medium">{formatDate(order.created_at)}</p>
                <p className="text-xs text-muted-foreground">{order.currency}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen Financiero - Diseño moderno */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <span className="font-medium">Resumen Financiero</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{formatCurrency(order.subtotal, order.currency)}</p>
              <p className="text-xs text-muted-foreground">Subtotal</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold">{formatCurrency(order.tax, order.currency)}</p>
              <p className="text-xs text-muted-foreground">Impuestos</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-500/10">
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(order.total, order.currency)}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-purple-500/10">
              <p className="text-2xl font-bold text-purple-600">{calculateProfitMargin().toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Margen Est.</p>
            </div>
          </div>

          {/* Barra de progreso de pago */}
          {order.status === 'PARTIAL' && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progreso de pago</span>
                <span className="font-medium">{paymentProgress.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${paymentProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Pagado: {formatCurrency(paidAmount, order.currency)}</span>
                <span>Pendiente: {formatCurrency(order.remaining_amount, order.currency)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Productos */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Productos ({items.length})</span>
            </div>
            {order.status === 'OPEN' && (
              <Button size="sm" onClick={() => setShowAddProduct(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">No hay productos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.products?.name}</p>
                    <p className="text-xs text-muted-foreground">SKU: {item.products?.sku}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-medium">{item.qty}</p>
                      <p className="text-[10px] text-muted-foreground">Cant.</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="font-medium">{formatCurrency(item.unit_price, order.currency)}</p>
                      <p className="text-[10px] text-muted-foreground">P. Unit.</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-emerald-600">{formatCurrency(item.total, order.currency)}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                    {order.status === 'OPEN' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        onClick={() => handleRemoveClick(item.id, item.products?.name || 'Producto')}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notas */}
      {order.notes && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Notas</span>
            </div>
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Modal Agregar Producto con Escáner */}
      <AddProductModal
        isOpen={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        products={products}
        currency={order.currency}
        onAddProducts={addProductToOrder}
        formatCurrency={formatCurrency}
      />

      {/* Modal de Pago */}
      {showPaymentModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={handlePaymentModalClose} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto bg-background border rounded-xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 fade-in duration-200">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-emerald-500" />
                  <h3 className="font-semibold">Registrar Abono</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePaymentModalClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handlePaymentSubmit}>
                <div className="p-4 space-y-4">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">Saldo Pendiente</p>
                    <p className="text-2xl font-bold text-amber-600">{formatCurrency(order.remaining_amount, order.currency)}</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Monto a Abonar</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      max={order.remaining_amount}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="h-10 text-lg font-medium"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex gap-2 p-4 border-t">
                  <Button type="button" variant="outline" className="flex-1" onClick={resetPaymentForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Abonar
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
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
