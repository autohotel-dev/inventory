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
  Wallet,
  ChevronDown,
  ChevronUp,
  Bed,
  Banknote,
  Building2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Generar referencia única para pagos
function generatePaymentReference(prefix: string = "PAY"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Customer } from "@/lib/types/inventory";
import { AddProductModal } from "@/components/sales/add-product-modal";
import { PaymentMethod, PAYMENT_METHODS } from "@/components/sales/room-types";
import { MultiPaymentInput, PaymentEntry, createInitialPayment } from "@/components/sales/multi-payment-input";
import { GranularPaymentModal } from "@/components/sales/granular-payment-modal";
import { ReceiptGenerator } from "@/components/sales/receipt-generator";
import { ListChecks } from "lucide-react";

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
  payment_method?: string | null;
  is_paid?: boolean;
  paid_at?: string | null;
  concept_type?: string | null;
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
  const [showGranularPaymentModal, setShowGranularPaymentModal] = useState(false);
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

  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [paymentHistory, setPaymentHistory] = useState<{
    id: string;
    amount: number;
    payment_method: string;
    reference: string;
    concept: string;
    status: string;
    created_at: string;
  }[]>([]);

  const toggleItemExpand = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

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

    // Pre-cargar con el saldo pendiente
    setPayments(createInitialPayment(order.remaining_amount));
    setShowPaymentModal(true);
  };

  const resetPaymentForm = () => {
    setShowPaymentModal(false);
    setPayments([]);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    if (totalAmount <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    try {
      const supabase = createClient();

      // Insertar pagos de abono
      const validPayments = payments.filter(p => p.amount > 0);
      const isMultipago = validPayments.length > 1;

      if (isMultipago) {
        // MULTIPAGO: Crear cargo principal + subpagos
        const { data: mainPayment, error: mainError } = await supabase
          .from("payments")
          .insert({
            sales_order_id: orderId,
            amount: totalAmount,
            payment_method: "PENDIENTE",
            reference: generatePaymentReference("ABN"),
            concept: "ABONO",
            status: "PAGADO",
            payment_type: "COMPLETO",
          })
          .select("id")
          .single();

        if (mainError) {
          console.error("Error inserting main payment:", mainError);
        } else if (mainPayment) {
          const subpayments = validPayments.map(p => ({
            sales_order_id: orderId,
            amount: p.amount,
            payment_method: p.method,
            reference: p.reference || generatePaymentReference("SUB"),
            concept: "ABONO",
            status: "PAGADO",
            payment_type: "PARCIAL",
            parent_payment_id: mainPayment.id,
          }));

          const { error: subError } = await supabase
            .from("payments")
            .insert(subpayments);

          if (subError) {
            console.error("Error inserting subpayments:", subError);
          }
        }
      } else if (validPayments.length === 1) {
        // PAGO ÚNICO
        const p = validPayments[0];
        const { error: paymentsError } = await supabase
          .from("payments")
          .insert({
            sales_order_id: orderId,
            amount: p.amount,
            payment_method: p.method,
            reference: p.reference || generatePaymentReference("ABN"),
            concept: "ABONO",
            status: "PAGADO",
            payment_type: "COMPLETO",
          });

        if (paymentsError) {
          console.error("Error inserting payment:", paymentsError);
        }
      }

      const { data, error } = await supabase
        .rpc("process_payment", {
          order_id: orderId,
          payment_amount: totalAmount
        });

      if (error) {
        console.error('Error creating payment:', error);
        toast.error('Error al crear el pago');
        return;
      }

      const result = data[0] as any;

      if (result.success === true) {
        const methodsSummary = payments.map(p => `${p.method}: $${p.amount.toFixed(2)}`).join(', ');
        toast.success('Pago creado exitosamente', {
          description: `Total: $${totalAmount.toFixed(2)} MXN (${methodsSummary})`
        });
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
          payment_method,
          is_paid,
          paid_at,
          concept_type,
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

      // Fetch payment history
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("id, amount, payment_method, reference, concept, status, created_at")
        .eq("sales_order_id", orderId)
        .order("created_at", { ascending: false });

      // Simplified: no stock warnings for now
      const warnings: string[] = [];

      setOrder(enrichedOrderData as any);
      setItems(itemsData as any || []);
      setProducts(productsData || []);
      setPaymentHistory(paymentsData || []);
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
      // IMPORTANTE: Solo crear movimientos si no existen previamente
      if ((newStatus === 'COMPLETED' || newStatus === 'PARTIAL') && order) {
        // Verificar si ya existen movimientos para esta orden
        const { data: existingMovements, error: checkError } = await supabase
          .from("inventory_movements")
          .select("id")
          .eq("reference_id", orderId)
          .eq("reference_table", "sales_orders")
          .limit(1);

        if (checkError) {
          console.error('Error checking existing movements:', checkError);
        }

        // Solo crear movimientos si NO existen aún
        if (!existingMovements || existingMovements.length === 0) {
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
        } else {
          console.log('Movimientos de inventario ya existen para esta orden, omitiendo duplicados');
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
    if (!order) return;

    // Crear contenido para imprimir
    const printContent = `
      <html>
        <head>
          <title>Orden de Venta #${order.id.slice(0, 8)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            .info { margin-bottom: 20px; }
            .info p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .total { font-weight: bold; font-size: 18px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Orden de Venta #${order.id.slice(0, 8)}</h1>
          <div class="info">
            <p><strong>Fecha:</strong> ${formatDate(order.created_at)}</p>
            <p><strong>Cliente:</strong> ${order.customers?.name || 'Cliente general'}</p>
            <p><strong>Almacén:</strong> ${order.warehouses?.code} - ${order.warehouses?.name}</p>
            <p><strong>Estado:</strong> ${order.status}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Cantidad</th>
                <th>Precio Unit.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${item.products?.name || '-'}</td>
                  <td>${item.products?.sku || '-'}</td>
                  <td>${item.qty}</td>
                  <td>${formatCurrency(item.unit_price, order.currency)}</td>
                  <td>${formatCurrency(item.total, order.currency)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p class="total">Total: ${formatCurrency(order.total, order.currency)}</p>
          ${order.notes ? `<p><strong>Notas:</strong> ${order.notes}</p>` : ''}
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const addProductToOrder = async (items: { product: Product; quantity: number; unit_price: number; payments: PaymentEntry[] }[]) => {
    if (!order || items.length === 0) return;

    const supabase = createClient();

    try {
      // Validar que exista warehouse_id
      if (!order.warehouse_id) {
        toast.error("Error de configuración", {
          description: "La orden no tiene almacén asignado"
        });
        return;
      }

      // NUEVO: Validar stock disponible
      const { validateStockAvailability } = await import("@/lib/utils/stock-helpers");

      const itemsToValidate = items.map(item => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity
      }));

      const stockErrors = await validateStockAvailability(
        itemsToValidate,
        order.warehouse_id
      );

      if (stockErrors.length > 0) {
        toast.error("Stock insuficiente", {
          description: stockErrors.join(" | "),
          duration: 5000
        });
        return; // Abortar la operación
      }

      // Calcular el total de los nuevos items
      const newItemsTotal = items.reduce(
        (sum, item) => sum + (item.quantity * item.unit_price),
        0
      );

      // Crear descripción de los productos para las notas del pago
      const productosNota = items
        .map(item => `${item.quantity}x ${item.product.name}`)
        .join(", ");

      // Insertar todos los productos
      const insertData = items.map(item => ({
        sales_order_id: orderId,
        product_id: item.product.id,
        qty: item.quantity,
        unit_price: item.unit_price,
      }));

      const { error } = await supabase
        .from("sales_order_items")
        .insert(insertData);

      if (error) throw error;

      // Crear movimientos de inventario para descontar el stock
      if (order.warehouse_id) {
        const movements = items.map(item => ({
          product_id: item.product.id,
          warehouse_id: order.warehouse_id,
          quantity: item.quantity,
          movement_type: 'OUT',
          reason_id: 6, // ID 6 = SALE in movement_reasons table
          reason: 'SALE',
          notes: `Consumo vendido en orden ${orderId}`,
          reference_table: 'sales_orders',
          reference_id: orderId
        }));

        const { error: movError } = await supabase
          .from("inventory_movements")
          .insert(movements);

        if (movError) {
          console.error('Error creating inventory movements:', movError);
          toast.error("Advertencia", {
            description: "Productos agregados pero hubo un error al actualizar el inventario"
          });
        }
      }

      // Crear pago PENDIENTE para estos consumos específicos
      await supabase.from("payments").insert({
        sales_order_id: orderId,
        amount: newItemsTotal,
        payment_method: "PENDIENTE",
        reference: generatePaymentReference("CON"),
        concept: "CONSUMO",
        status: "PENDIENTE",
        payment_type: "COMPLETO",
        notes: productosNota,
      });

      // Actualizar totales de la orden sumando el nuevo monto (no recalcular todo)
      const currentSubtotal = Number(order.subtotal) || 0;
      const currentTotal = Number(order.total) || 0;
      const currentRemaining = Number(order.remaining_amount) || 0;

      const newSubtotal = currentSubtotal + newItemsTotal;
      const newTotal = currentTotal + newItemsTotal;
      const newRemaining = currentRemaining + newItemsTotal;

      await supabase
        .from("sales_orders")
        .update({
          subtotal: newSubtotal,
          total: newTotal,
          remaining_amount: newRemaining,
        })
        .eq("id", orderId);

      // Refrescar datos
      await fetchOrderDetail();

      // Cerrar modal
      setShowAddProduct(false);

      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
      toast.success(`${totalItems} producto(s) agregado(s)`, {
        description: `${productosNota} - Total: $${newItemsTotal.toFixed(2)} (pendiente de pago)`
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
      // Obtener datos actuales de la orden (incluye estancia, horas extra, personas extra)
      const { data: orderData } = await supabase
        .from("sales_orders")
        .select("subtotal, tax, total, paid_amount, remaining_amount")
        .eq("id", orderId)
        .single();

      if (!orderData) return;

      // Obtener suma de items (consumos)
      const { data: itemsData } = await supabase
        .from("sales_order_items")
        .select("qty, unit_price")
        .eq("sales_order_id", orderId);

      const itemsSubtotal =
        itemsData?.reduce(
          (sum, item: any) => sum + (Number(item.qty) || 0) * (Number(item.unit_price) || 0),
          0
        ) || 0;

      // Obtener suma de pagos principales (para saber el total real de cargos)
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("amount, concept")
        .eq("sales_order_id", orderId)
        .is("parent_payment_id", null);

      // Sumar cargos que NO son consumos (estancia, hora extra, persona extra)
      const nonItemCharges = paymentsData?.reduce((sum, p: any) => {
        if (p.concept !== "CONSUMO") {
          return sum + (Number(p.amount) || 0);
        }
        return sum;
      }, 0) || 0;

      // El subtotal real es: cargos no-items + items
      const subtotal = nonItemCharges + itemsSubtotal;
      const tax = Number(orderData.tax) || 0;
      const total = subtotal + tax;
      const paid_amount = Number(orderData.paid_amount) || 0;
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
          <ReceiptGenerator orderId={order.id} />
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
            <>
              <Button size="sm" variant="outline" onClick={() => setShowGranularPaymentModal(true)}>
                <ListChecks className="h-4 w-4 mr-2" />
                Por Concepto
              </Button>
              <Button size="sm" onClick={handlePaymentModalOpen}>
                <Wallet className="h-4 w-4 mr-2" />
                Abonar Todo
              </Button>
            </>
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
            <div className="text-center p-3 rounded-lg bg-emerald-500/10">
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(order.total, order.currency)}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-500/10">
              <p className="text-2xl font-bold text-green-600">{formatCurrency(paidAmount, order.currency)}</p>
              <p className="text-xs text-muted-foreground">Pagado</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-amber-500/10">
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(order.remaining_amount, order.currency)}</p>
              <p className="text-xs text-muted-foreground">Pendiente</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-500/10">
              <p className="text-2xl font-bold text-blue-600">{paymentProgress.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Progreso</p>
            </div>
          </div>

          {/* Barra de progreso de pago */}
          {order.remaining_amount > 0 && (
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Desglose por Concepto */}
      {items.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Desglose por Concepto</span>
            </div>

            {(() => {
              // Calcular totales por tipo de concepto
              const conceptTotals = items.reduce((acc, item) => {
                const type = item.concept_type || 'PRODUCT';
                if (!acc[type]) {
                  acc[type] = { total: 0, paid: 0, count: 0 };
                }
                acc[type].total += item.total;
                acc[type].count += 1;
                if (item.is_paid) {
                  acc[type].paid += item.total;
                }
                return acc;
              }, {} as Record<string, { total: number; paid: number; count: number }>);

              const conceptConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
                ROOM_BASE: {
                  label: "Habitación Base",
                  icon: <Bed className="h-4 w-4" />,
                  color: "text-blue-600",
                  bgColor: "bg-blue-500/10"
                },
                EXTRA_HOUR: {
                  label: "Horas Extra",
                  icon: <Clock className="h-4 w-4" />,
                  color: "text-amber-600",
                  bgColor: "bg-amber-500/10"
                },
                EXTRA_PERSON: {
                  label: "Personas Extra",
                  icon: <Users className="h-4 w-4" />,
                  color: "text-purple-600",
                  bgColor: "bg-purple-500/10"
                },
                CONSUMPTION: {
                  label: "Consumos",
                  icon: <ShoppingBag className="h-4 w-4" />,
                  color: "text-green-600",
                  bgColor: "bg-green-500/10"
                },
                PRODUCT: {
                  label: "Productos",
                  icon: <ShoppingBag className="h-4 w-4" />,
                  color: "text-slate-600",
                  bgColor: "bg-slate-500/10"
                },
                OTHER: {
                  label: "Otros",
                  icon: <Receipt className="h-4 w-4" />,
                  color: "text-slate-600",
                  bgColor: "bg-slate-500/10"
                },
              };

              const orderedTypes = ['ROOM_BASE', 'EXTRA_HOUR', 'EXTRA_PERSON', 'CONSUMPTION', 'PRODUCT', 'OTHER'];
              const existingTypes = orderedTypes.filter(type => conceptTotals[type]);

              return (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {existingTypes.map(type => {
                    const config = conceptConfig[type];
                    const data = conceptTotals[type];
                    const paidPercentage = data.total > 0 ? (data.paid / data.total) * 100 : 0;

                    return (
                      <div key={type} className={`p-3 rounded-lg ${config.bgColor} space-y-2`}>
                        <div className="flex items-center gap-2">
                          <span className={config.color}>{config.icon}</span>
                          <span className="text-xs font-medium truncate">{config.label}</span>
                          <Badge variant="outline" className="text-[10px] ml-auto">
                            {data.count}
                          </Badge>
                        </div>
                        <div>
                          <p className={`text-lg font-bold ${config.color}`}>
                            {formatCurrency(data.total, order.currency)}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="text-green-600">{formatCurrency(data.paid, order.currency)} pagado</span>
                            <span>•</span>
                            <span className="text-amber-600">{formatCurrency(data.total - data.paid, order.currency)} pend.</span>
                          </div>
                        </div>
                        {/* Mini barra de progreso */}
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all duration-300"
                            style={{ width: `${paidPercentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

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
              {items.map((item) => {
                const isExpanded = expandedItems.has(item.id);
                const conceptLabels: Record<string, string> = {
                  ROOM_BASE: "Habitación Base",
                  EXTRA_HOUR: "Hora Extra",
                  EXTRA_PERSON: "Persona Extra",
                  CONSUMPTION: "Consumo",
                  PRODUCT: "Producto",
                  OTHER: "Otro",
                };
                const conceptIcons: Record<string, React.ReactNode> = {
                  ROOM_BASE: <Bed className="h-3 w-3" />,
                  EXTRA_HOUR: <Clock className="h-3 w-3" />,
                  EXTRA_PERSON: <Users className="h-3 w-3" />,
                  CONSUMPTION: <ShoppingBag className="h-3 w-3" />,
                  PRODUCT: <ShoppingBag className="h-3 w-3" />,
                  OTHER: <Receipt className="h-3 w-3" />,
                };
                const paymentIcons: Record<string, React.ReactNode> = {
                  EFECTIVO: <Banknote className="h-3 w-3 text-green-500" />,
                  TARJETA: <CreditCard className="h-3 w-3 text-blue-500" />,
                  TRANSFERENCIA: <Building2 className="h-3 w-3 text-purple-500" />,
                  MIXTO: <Wallet className="h-3 w-3 text-amber-500" />,
                };

                return (
                  <div key={item.id} className="rounded-lg border overflow-hidden">
                    {/* Item principal */}
                    <div
                      className={`flex items-center justify-between p-3 hover:bg-muted/30 transition-colors group cursor-pointer ${item.is_paid ? 'bg-green-500/5' : ''
                        }`}
                      onClick={() => toggleItemExpand(item.id)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Indicador de estado de pago */}
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.is_paid ? 'bg-green-500' : 'bg-amber-500'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">
                              {item.concept_type && item.concept_type !== 'PRODUCT'
                                ? conceptLabels[item.concept_type]
                                : item.products?.name || 'Producto'}
                            </p>
                            {item.concept_type && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {conceptIcons[item.concept_type]}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.products?.sku !== 'SVC-ROOM' ? `SKU: ${item.products?.sku}` : 'Servicio de habitación'}
                          </p>
                        </div>
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
                          <p className={`font-semibold ${item.is_paid ? 'text-green-600' : 'text-amber-600'}`}>
                            {formatCurrency(item.total, order.currency)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Total</p>
                        </div>
                        <div className="text-center min-w-[60px]">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${item.is_paid ? 'bg-green-500/10 text-green-600 border-green-500/30' : 'bg-amber-500/10 text-amber-600 border-amber-500/30'}`}
                          >
                            {item.is_paid ? 'Pagado' : 'Pendiente'}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleItemExpand(item.id);
                          }}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        {order.status === 'OPEN' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveClick(item.id, item.products?.name || 'Producto');
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Dropdown expandible con detalles de pago */}
                    {isExpanded && (
                      <div className="px-4 py-3 bg-muted/30 border-t space-y-3 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          {/* Tipo de concepto */}
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Concepto</p>
                            <div className="flex items-center gap-1.5">
                              {item.concept_type && conceptIcons[item.concept_type]}
                              <span className="font-medium">
                                {item.concept_type && item.concept_type !== 'PRODUCT'
                                  ? conceptLabels[item.concept_type]
                                  : item.products?.name || 'Producto'}
                              </span>
                            </div>
                          </div>

                          {/* Estado de pago */}
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Estado</p>
                            <div className="flex items-center gap-1.5">
                              {item.is_paid ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <Clock className="h-4 w-4 text-amber-500" />
                              )}
                              <span className={`font-medium ${item.is_paid ? 'text-green-600' : 'text-amber-600'}`}>
                                {item.is_paid ? 'Pagado' : 'Pendiente'}
                              </span>
                            </div>
                          </div>

                          {/* Método de pago */}
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Método</p>
                            <div className="flex items-center gap-1.5">
                              {item.payment_method && paymentIcons[item.payment_method]}
                              <span className="font-medium">
                                {item.payment_method || '—'}
                              </span>
                            </div>
                          </div>

                          {/* Fecha de pago */}
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fecha de pago</p>
                            <span className="font-medium">
                              {item.paid_at
                                ? new Date(item.paid_at).toLocaleString('es-MX', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                                : '—'
                              }
                            </span>
                          </div>
                        </div>

                        {/* Resumen de pago */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <span className="text-sm text-muted-foreground">
                            {item.is_paid
                              ? `Cobrado: ${formatCurrency(item.total, order.currency)} con ${item.payment_method || 'método no especificado'}`
                              : `Pendiente de cobro: ${formatCurrency(item.total, order.currency)}`
                            }
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de Pagos */}
      {paymentHistory.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-4 w-4 text-green-500" />
              <span className="font-medium">Historial de Pagos ({paymentHistory.length})</span>
            </div>
            <div className="space-y-2">
              {paymentHistory.map((payment) => {
                const paymentIcons: Record<string, React.ReactNode> = {
                  EFECTIVO: <Banknote className="h-4 w-4 text-green-500" />,
                  TARJETA: <CreditCard className="h-4 w-4 text-blue-500" />,
                  TRANSFERENCIA: <Building2 className="h-4 w-4 text-purple-500" />,
                  MIXTO: <Wallet className="h-4 w-4 text-amber-500" />,
                  PENDIENTE: <Clock className="h-4 w-4 text-gray-500" />,
                };
                const conceptLabels: Record<string, string> = {
                  CHECKOUT: "Checkout",
                  EXTRA_HOUR: "Hora Extra",
                  EXTRA_PERSON: "Persona Extra",
                  CONSUMPTION: "Consumo",
                  PARTIAL: "Pago Parcial",
                  GRANULAR: "Cobro Granular",
                };

                return (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/10">
                        {paymentIcons[payment.payment_method] || <Wallet className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{payment.payment_method}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {conceptLabels[payment.concept] || payment.concept}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payment.created_at).toLocaleString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                          {payment.reference && ` • Ref: ${payment.reference}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        +{formatCurrency(payment.amount, order.currency)}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${payment.status === 'PAGADO'
                          ? 'bg-green-500/10 text-green-600 border-green-500/30'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                          }`}
                      >
                        {payment.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <MultiPaymentInput
                    totalAmount={order.remaining_amount}
                    payments={payments}
                    onPaymentsChange={setPayments}
                    showReference={true}
                  />
                </div>

                <div className="flex gap-2 p-4 border-t">
                  <Button type="button" variant="outline" className="flex-1" onClick={resetPaymentForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={payments.reduce((s, p) => s + p.amount, 0) <= 0}>
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

      {/* Modal de Cobro Granular */}
      <GranularPaymentModal
        isOpen={showGranularPaymentModal}
        salesOrderId={orderId}
        onClose={() => setShowGranularPaymentModal(false)}
        onComplete={() => {
          setShowGranularPaymentModal(false);
          fetchOrderDetail();
        }}
      />
    </div>
  );
}
