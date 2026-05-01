"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag, Users, Building, Calendar, DollarSign, Trash2, Plus,
  FileText, CheckCircle, Clock, XCircle, Download, ArrowLeft, Truck,
  AlertTriangle, X, CreditCard, Receipt, Wallet, ChevronDown, ChevronUp,
  Bed, Banknote, Building2, ListChecks
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AddProductModal } from "@/components/sales/add-product-modal";
import { MultiPaymentInput } from "@/components/sales/multi-payment-input";
import { GranularPaymentModal } from "@/components/sales/granular-payment-modal";
import { ReceiptGenerator } from "@/components/sales/receipt-generator";
import { useSalesDetail, formatCurrency, formatDate } from "@/hooks/use-sales-detail";

interface AdvancedSalesDetailProps {
  orderId: string;
}

export function AdvancedSalesDetail({ orderId }: AdvancedSalesDetailProps) {
  const router = useRouter();

  const {
    order, items, products, loading, stockWarnings, paymentHistory,
    showPaymentModal, showGranularPaymentModal, showAddProduct, confirmDialog,
    payments, expandedItems,
    setShowPaymentModal, setShowGranularPaymentModal, setShowAddProduct, setConfirmDialog,
    setPayments,
    fetchOrderDetail, handlePaymentModalOpen, handlePaymentModalClose, handlePaymentSubmit, resetPaymentForm,
    updateOrderStatus, addProductToOrder, handleRemoveClick, removeItemFromOrder,
    toggleItemExpand, exportToPDF,
    calculateProfitMargin,
  } = useSalesDetail({ orderId });

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
            <div className="pointer-events-auto bg-background border rounded-xl shadow-2xl w-[95vw] sm:w-full sm:max-w-sm animate-in zoom-in-95 fade-in duration-200">
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
