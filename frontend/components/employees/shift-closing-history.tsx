"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, CreditCard, Receipt, Calculator, CheckCircle, XCircle,
  AlertTriangle, Loader2, FileText, Clock, TrendingUp, TrendingDown,
  Minus, History, Printer, ArrowDownCircle, Filter, ShoppingBag,
} from "lucide-react";
import { ShiftClosing, SHIFT_COLORS } from "./types";
import { EXPENSE_TYPE_LABELS, EXPENSE_TYPE_ICONS } from "@/types/expenses";
import { useShiftClosingHistory, formatCurrency } from "@/hooks/use-shift-closing-history";

export function ShiftClosingHistory() {
  const {
    closings, loading, isAdmin, selectedClosing,
    closingDetails, closingSalesOrders, closingReviews, loadingDetails,
    statusFilter, processingAction, currentPage, pageSize, totalCount,
    showRejectModal, rejectionReason, showCorrectionModal, correctionClosing,
    correctionCountedCash, correctionDeclaredBBVA, correctionDeclaredGetnet,
    correctionNotes, savingCorrection, currentEmployeeId,
    setSelectedClosing, setStatusFilter, setCurrentPage, setPageSize,
    setShowRejectModal, setRejectionReason, setShowCorrectionModal,
    setCorrectionClosing, setCorrectionCountedCash, setCorrectionDeclaredBBVA,
    setCorrectionDeclaredGetnet, setCorrectionNotes,
    loadClosings, openDetail, approveClosing, openRejectModal, confirmRejectClosing,
    openCorrectionModal, saveCorrectionClosing, exportClosing, calculateCorrectionCashTotal,
    rejectedClosings, totalPages,
  } = useShiftClosingHistory();

  const getStatusBadge = (status: ShiftClosing["status"]) => {
    const config = {
      pending: { label: "Pendiente", variant: "secondary" as const, icon: "⏳" },
      approved: { label: "Aprobado", variant: "default" as const, icon: "✓" },
      rejected: { label: "Rechazado", variant: "destructive" as const, icon: "✕" },
      reviewed: { label: "Revisado", variant: "outline" as const, icon: "👁" },
    };
    const { label, variant, icon } = config[status] || config.pending;
    return <Badge variant={variant}>{icon} {label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alerta de cortes rechazados */}
      {rejectedClosings.length > 0 && !isAdmin && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-500 mb-1">
                Tienes {rejectedClosings.length} corte(s) rechazado(s)
              </h4>
              <p className="text-sm text-muted-foreground">
                Por favor revisa los motivos de rechazo y realiza las correcciones necesarias.
                Haz clic en &quot;Ver&quot; para ver los detalles de cada corte rechazado.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rejectedClosings.slice(0, 3).map((closing) => (
                  <Button
                    key={closing.id}
                    variant="outline"
                    size="sm"
                    className="text-xs border-red-500/30 hover:bg-red-500/10"
                    onClick={() => openDetail(closing)}
                  >
                    {new Date(closing.created_at).toLocaleDateString("es-MX")} - Ver detalles
                  </Button>
                ))}
                {rejectedClosings.length > 3 && (
                  <span className="text-xs text-muted-foreground self-center">
                    y {rejectedClosings.length - 3} más...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros con diseño premium */}
      <div className="flex items-center gap-4 flex-wrap justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Estado */}
          <div className={`relative p-3 rounded-xl border transition-all duration-300 ${statusFilter !== 'all' ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-muted/30 border-border/50 hover:border-blue-500/30 hover:bg-blue-500/5'}`}>
            <label className="flex items-center gap-2 text-xs font-medium mb-2">
              <div className={`p-1 rounded-md ${statusFilter !== 'all' ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-500'}`}>
                <Filter className="h-3 w-3" />
              </div>
              <span className={statusFilter !== 'all' ? 'text-blue-400' : 'text-muted-foreground'}>Estado</span>
            </label>
            <div className="relative group">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-3 pr-8 py-2 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-blue-500/30 focus:outline-none hover:bg-background shadow-sm min-w-[130px]"
              >
                <option value="all">✨ Todos</option>
                <option value="pending">⏳ Pendientes</option>
                <option value="approved">✅ Aprobados</option>
                <option value="rejected">❌ Rechazados</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <ArrowDownCircle className={`h-3.5 w-3.5 ${statusFilter !== 'all' ? 'text-blue-500' : 'text-muted-foreground'}`} />
              </div>
            </div>
          </div>

          {/* Mostrar */}
          <div className={`relative p-3 rounded-xl border transition-all duration-300 bg-muted/30 border-border/50 hover:border-purple-500/30 hover:bg-purple-500/5`}>
            <label className="flex items-center gap-2 text-xs font-medium mb-2">
              <div className={`p-1 rounded-md bg-purple-500/10 text-purple-500`}>
                <Receipt className="h-3 w-3" />
              </div>
              <span className="text-muted-foreground">Mostrar</span>
            </label>
            <div className="relative group">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="pl-3 pr-8 py-2 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-purple-500/30 focus:outline-none hover:bg-background shadow-sm min-w-[80px]"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <ArrowDownCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            {totalCount} corte(s) total
          </Badge>
          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground">
              Página {currentPage} de {Math.ceil(totalCount / pageSize)}
            </span>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Empleado</TableHead>
              <TableHead>Turno</TableHead>
              <TableHead className="text-right">Efectivo</TableHead>
              <TableHead className="text-right">Tarjetas</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {closings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No hay cortes registrados
                </TableCell>
              </TableRow>
            ) : (
              closings.map((closing) => (
                <TableRow key={closing.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <p className="font-medium">{new Date(closing.period_start).toLocaleDateString("es-MX")}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(closing.period_start).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                        {" - "}
                        {new Date(closing.period_end).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {closing.employees?.first_name} {closing.employees?.last_name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${SHIFT_COLORS[closing.shift_definitions?.code || ""] || "bg-gray-500"
                        } text-white`}
                    >
                      {closing.shift_definitions?.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(closing.total_cash || 0)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency((closing.total_card_bbva || 0) + (closing.total_card_getnet || 0))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(closing.total_sales)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-medium ${closing.cash_difference === 0
                        ? "text-green-600"
                        : (closing.cash_difference || 0) > 0
                          ? "text-blue-600"
                          : "text-red-600"
                        }`}
                    >
                      {closing.cash_difference === 0 ? "✓" : (closing.cash_difference || 0) > 0 ? "+" : ""}
                      {formatCurrency(closing.cash_difference || 0)}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(closing.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetail(closing)}
                        title="Ver detalle"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => exportClosing(closing)}
                        title="Imprimir"
                      >
                        <Receipt className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Controles de paginación */}
      {totalCount > pageSize && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {Math.min((currentPage - 1) * pageSize + 1, totalCount)} - {Math.min(currentPage * pageSize, totalCount)} de {totalCount}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              Primera
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <span className="text-sm px-3">
              Página {currentPage} de {Math.ceil(totalCount / pageSize)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / pageSize), prev + 1))}
              disabled={currentPage >= Math.ceil(totalCount / pageSize)}
            >
              Siguiente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.ceil(totalCount / pageSize))}
              disabled={currentPage >= Math.ceil(totalCount / pageSize)}
            >
              Última
            </Button>
          </div>
        </div>
      )}

      {/* Modal de detalle */}
      <Dialog open={!!selectedClosing} onOpenChange={() => setSelectedClosing(null)}>
        <DialogContent className="max-w-[90%] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalle del Corte
            </DialogTitle>
            <DialogDescription>
              {selectedClosing && (
                <>
                  {new Date(selectedClosing.period_start).toLocaleDateString("es-MX", {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                  })}
                  {" • "}
                  {selectedClosing.employees?.first_name} {selectedClosing.employees?.last_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedClosing && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-xs text-green-600">Efectivo</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(selectedClosing.total_cash || 0)}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-600">BBVA</p>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(selectedClosing.total_card_bbva || 0)}</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <p className="text-xs text-orange-600">Getnet</p>
                  <p className="text-lg font-bold text-orange-600">{formatCurrency(selectedClosing.total_card_getnet || 0)}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-primary">Total</p>
                  <p className="text-lg font-bold text-primary">{formatCurrency(selectedClosing.total_sales || 0)}</p>
                </div>
              </div>

              {/* Arqueo */}
              <div className={`p-4 rounded-lg border ${selectedClosing.cash_difference === 0
                ? "bg-green-500/10 border-green-500/30"
                : (selectedClosing.cash_difference || 0) > 0
                  ? "bg-blue-500/10 border-blue-500/30"
                  : "bg-red-500/10 border-red-500/30"
                }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Arqueo de Caja</p>
                    <p className="text-xs text-muted-foreground">
                      Esperado: {formatCurrency(selectedClosing.total_cash || 0)} •
                      Contado: {formatCurrency(selectedClosing.counted_cash || 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${selectedClosing.cash_difference === 0
                      ? "text-green-600"
                      : (selectedClosing.cash_difference || 0) > 0
                        ? "text-blue-600"
                        : "text-red-600"
                      }`}>
                      {selectedClosing.cash_difference === 0
                        ? "✓ Cuadra"
                        : (selectedClosing.cash_difference || 0) > 0
                          ? `+${formatCurrency(selectedClosing.cash_difference || 0)}`
                          : formatCurrency(selectedClosing.cash_difference || 0)
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedClosing.cash_difference === 0
                        ? "Sin diferencia"
                        : (selectedClosing.cash_difference || 0) > 0
                          ? "Sobrante"
                          : "Faltante"
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Notas */}
              {selectedClosing.notes && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs text-muted-foreground mb-1">Notas:</p>
                  <p className="text-sm">{selectedClosing.notes}</p>
                </div>
              )}

              {/* Transacciones Detalladas */}
              {loadingDetails ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : closingDetails.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
                    <h4 className="font-medium text-sm">Transacciones Detalladas ({closingDetails.length})</h4>
                    <Badge variant="outline" className="text-xs">
                      Total: {formatCurrency(closingDetails.reduce((sum, d) => sum + (d.amount || 0), 0))}
                    </Badge>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                    <div className="divide-y">
                      {closingDetails.map((detail, index) => {
                        const payment = detail.payments;
                        const salesOrder = payment?.sales_orders;
                        const roomStay = salesOrder?.room_stays?.[0];
                        const room = roomStay?.rooms;
                        const roomType = room?.room_types;

                        // Determinar el método de pago para mostrar
                        const paymentMethod = detail.payment_method === "TARJETA_BBVA"
                          ? "TARJETA"
                          : detail.payment_method === "TARJETA_GETNET"
                            ? "TARJETA"
                            : detail.payment_method;

                        const terminalCode = detail.payment_method === "TARJETA_BBVA"
                          ? "BBVA"
                          : detail.payment_method === "TARJETA_GETNET"
                            ? "GETNET"
                            : detail.terminal_code || payment?.terminal_code;

                        // Concepto legible
                        const conceptLabels: Record<string, string> = {
                          CHECKOUT: "Checkout",
                          PAGO_GRANULAR: "Pago por Concepto",
                          ABONO: "Abono",
                          ANTICIPO: "Anticipo",
                        };
                        const conceptLabel = payment?.concept
                          ? (conceptLabels[payment.concept] || payment.concept.replace(/_/g, " "))
                          : "Pago";

                        return (
                          <div key={detail.id} className="p-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              {/* Columna izquierda: Info principal */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs text-muted-foreground font-mono">
                                    #{(index + 1).toString().padStart(2, '0')}
                                  </span>
                                  <span className="text-sm font-medium">
                                    {payment?.created_at
                                      ? new Date(payment.created_at).toLocaleTimeString("es-MX", {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                      })
                                      : "-"
                                    }
                                  </span>
                                  {room && (
                                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                                      🏨 Hab. {room.number}
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <Badge variant={paymentMethod === "EFECTIVO" ? "default" : "secondary"}>
                                    {paymentMethod === "EFECTIVO" ? "💵" : "💳"} {paymentMethod}
                                  </Badge>
                                  {terminalCode && (
                                    <Badge variant="outline" className="text-xs">
                                      Terminal: {terminalCode}
                                    </Badge>
                                  )}
                                  <span className="text-muted-foreground">
                                    {conceptLabel}
                                  </span>
                                </div>

                                {/* Detalles adicionales */}
                                <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                                  {payment?.reference && (
                                    <p>
                                      <span className="font-medium">Ref:</span> {payment.reference}
                                    </p>
                                  )}
                                  {roomType && (
                                    <p>
                                      <span className="font-medium">Tipo:</span> {roomType.name}
                                    </p>
                                  )}
                                  {salesOrder && (
                                    <p>
                                      <span className="font-medium">Orden:</span> #{salesOrder.id.slice(0, 8).toUpperCase()}
                                      {salesOrder.status && (
                                        <span className={`ml-2 ${salesOrder.status === "COMPLETED" || salesOrder.status === "ENDED"
                                          ? "text-green-500"
                                          : "text-amber-500"
                                          }`}>
                                          ({salesOrder.status})
                                        </span>
                                      )}
                                    </p>
                                  )}
                                  {payment?.payment_type && payment.payment_type !== "COMPLETO" && (
                                    <p>
                                      <span className="font-medium">Tipo pago:</span> {payment.payment_type}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Columna derecha: Monto */}
                              <div className="text-right flex-shrink-0">
                                <p className="text-lg font-bold text-primary">
                                  {formatCurrency(detail.amount)}
                                </p>
                                <p className={`text-xs ${payment?.status === "PAGADO" ? "text-green-500" : "text-amber-500"
                                  }`}>
                                  {payment?.status || "PAGADO"}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Desglose de Ventas por Orden */}
              {closingSalesOrders.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="p-3 bg-muted/50 border-b flex items-center justify-between">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Desglose de Ventas ({closingSalesOrders.length} órdenes)
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      Total: {formatCurrency(closingSalesOrders.reduce((sum, o) => sum + (o.total || 0), 0))}
                    </Badge>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                    <div className="divide-y">
                      {closingSalesOrders.map((order, orderIndex) => {
                        const roomStay = order.room_stays?.[0];
                        const room = roomStay?.rooms;
                        const roomType = room?.room_types;
                        const items = order.sales_order_items || [];

                        const conceptLabels: Record<string, string> = {
                          ROOM_BASE: "Habitación",
                          EXTRA_HOUR: "Hora Extra",
                          EXTRA_PERSON: "Persona Extra",
                          CONSUMPTION: "Consumo",
                          PRODUCT: "Producto",
                        };

                        return (
                          <div key={order.id} className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-mono">
                                  #{(orderIndex + 1).toString().padStart(2, '0')}
                                </span>
                                <span className="text-sm font-medium">
                                  {new Date(order.created_at).toLocaleTimeString("es-MX", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {room && (
                                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                                    🏨 Hab. {room.number}
                                  </Badge>
                                )}
                                {roomType && (
                                  <span className="text-xs text-muted-foreground">({roomType.name})</span>
                                )}
                                <Badge
                                  variant={order.status === "COMPLETED" || order.status === "ENDED" ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {order.status}
                                </Badge>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-primary">{formatCurrency(order.total)}</p>
                                {order.remaining_amount > 0 && (
                                  <p className="text-xs text-amber-500">Pend: {formatCurrency(order.remaining_amount)}</p>
                                )}
                              </div>
                            </div>

                            {items.length > 0 && (
                              <div className="ml-4 pl-3 border-l-2 border-muted space-y-1">
                                {items.map((item: any, itemIndex: number) => {
                                  const product = Array.isArray(item.products) ? item.products[0] : item.products;
                                  const conceptType = item.concept_type || "PRODUCT";
                                  const itemName = conceptType !== "PRODUCT" && conceptLabels[conceptType]
                                    ? conceptLabels[conceptType]
                                    : product?.name || "Producto";

                                  return (
                                    <div key={item.id} className="flex items-center justify-between text-sm py-1">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="text-xs text-muted-foreground w-5">
                                          {itemIndex + 1}.
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className={`text-[10px] px-1.5 ${conceptType === "ROOM_BASE" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
                                            conceptType === "EXTRA_HOUR" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                                              conceptType === "EXTRA_PERSON" ? "bg-purple-500/10 text-purple-400 border-purple-500/30" :
                                                conceptType === "CONSUMPTION" ? "bg-green-500/10 text-green-400 border-green-500/30" :
                                                  "bg-slate-500/10 text-slate-400 border-slate-500/30"
                                            }`}
                                        >
                                          {conceptLabels[conceptType] || "Prod"}
                                        </Badge>
                                        <span className="truncate">{itemName}</span>
                                        <span className="text-muted-foreground text-xs">
                                          ×{item.qty} @ {formatCurrency(item.unit_price)}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="font-medium">{formatCurrency(item.total)}</span>
                                        {item.is_paid ? (
                                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                        ) : (
                                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="mt-2 pt-2 border-t border-dashed flex items-center justify-between text-xs text-muted-foreground">
                              <span>Orden: #{order.id.slice(0, 8).toUpperCase()}</span>
                              <span>
                                {items.filter((i: any) => i.is_paid).length}/{items.length} items pagados
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Estado actual */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Estado actual:</span>
                  {getStatusBadge(selectedClosing.status)}
                </div>
                {selectedClosing.reviewed_at && (
                  <span className="text-xs text-muted-foreground">
                    Revisado: {new Date(selectedClosing.reviewed_at).toLocaleString("es-MX")}
                  </span>
                )}
              </div>

              {/* Motivo de rechazo (si fue rechazado) */}
              {selectedClosing.status?.toLowerCase() === "rejected" && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-red-500 mb-1">Motivo del Rechazo</h4>
                      <p className="text-sm">{selectedClosing.rejection_reason || "No se especificó motivo"}</p>

                      {/* Verificar si ya existe una corrección */}
                      {!selectedClosing.is_correction && selectedClosing.employee_id === currentEmployeeId && (
                        <div className="mt-3 pt-3 border-t border-red-500/20">
                          <p className="text-xs text-muted-foreground mb-2">
                            Puedes crear un nuevo corte corregido con el arqueo de caja correcto.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500/30 hover:bg-red-500/10 text-red-500"
                            onClick={() => openCorrectionModal(selectedClosing)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Crear Corte Corregido
                          </Button>
                        </div>
                      )}

                      {selectedClosing.has_correction && (
                        <p className="text-xs text-green-500 mt-2">
                          ✓ Ya existe un corte corregido para este período.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Historial de revisiones */}
              {closingReviews.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="p-3 bg-muted/50 border-b">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Historial de Revisiones ({closingReviews.length})
                    </h4>
                  </div>
                  <div className="max-h-[150px] overflow-y-auto">
                    <div className="divide-y">
                      {closingReviews.map((review) => (
                        <div key={review.id} className="p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={review.action === "approved" ? "default" : review.action === "rejected" ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {review.action === "approved" ? "✓ Aprobado" : review.action === "rejected" ? "✗ Rechazado" : "⏳ Pendiente"}
                              </Badge>
                              <span className="text-muted-foreground">
                                por {review.employees?.first_name} {review.employees?.last_name}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(review.created_at).toLocaleString("es-MX")}
                            </span>
                          </div>
                          {review.reason && (
                            <p className="text-xs text-muted-foreground mt-1 pl-2 border-l-2 border-muted">
                              {review.reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setSelectedClosing(null)}>
              Cerrar
            </Button>
            {selectedClosing && (
              <Button variant="outline" onClick={() => exportClosing(selectedClosing)}>
                <Receipt className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            )}
            {/* Botones de aprobar/rechazar solo para admin y si está pendiente */}
            {isAdmin && selectedClosing?.status?.toLowerCase() === "pending" && (
              <>
                <Button
                  variant="destructive"
                  onClick={openRejectModal}
                  disabled={processingAction}
                >
                  {processingAction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Rechazar
                </Button>
                <Button
                  onClick={() => approveClosing(selectedClosing.id)}
                  disabled={processingAction}
                >
                  {processingAction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Aprobar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de rechazo con motivo */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Rechazar Corte de Caja
            </DialogTitle>
            <DialogDescription>
              Por favor, proporcione el motivo del rechazo. Esta información será visible para el empleado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motivo del rechazo *</Label>
              <textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ej: Diferencia de $50 en efectivo no justificada, falta comprobante de pago con tarjeta..."
                className="w-full h-32 px-3 py-2 border rounded-md bg-background resize-none text-sm"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Sea específico para que el empleado pueda corregir el problema.
              </p>
            </div>

            {selectedClosing && (
              <div className="p-3 rounded-lg bg-muted/50 border text-sm">
                <p className="font-medium mb-1">Resumen del corte:</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>Empleado:</span>
                  <span>{selectedClosing.employees?.first_name} {selectedClosing.employees?.last_name}</span>
                  <span>Fecha:</span>
                  <span>{new Date(selectedClosing.created_at).toLocaleDateString("es-MX")}</span>
                  <span>Diferencia:</span>
                  <span className={(selectedClosing.cash_difference || 0) !== 0 ? "text-red-500 font-medium" : "text-green-500"}>
                    {formatCurrency(selectedClosing.cash_difference || 0)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectModal(false)}
              disabled={processingAction}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRejectClosing}
              disabled={processingAction || !rejectionReason.trim()}
            >
              {processingAction ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de corrección de corte */}
      <Dialog open={showCorrectionModal} onOpenChange={setShowCorrectionModal}>
        <DialogContent className="max-w-[90%] w-full h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
          <DialogHeader className="px-6 py-4 border-b bg-background z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Corregir Corte de Caja</DialogTitle>
                  <DialogDescription className="text-sm mt-0.5">
                    Realiza un nuevo arqueo para el corte RECHAZADO del {correctionClosing && new Date(correctionClosing.period_start).toLocaleDateString("es-MX")}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {correctionClosing && (
            <div className="flex-1 overflow-hidden">
              <div className="h-full grid grid-cols-1 md:grid-cols-12">

                {/* LEFT PANEL: CONTEXT (35%) - Same as ShiftClosingModal */}
                <div className="hidden md:flex md:col-span-4 lg:col-span-3 flex-col border-r bg-muted/30 overflow-y-auto">
                  <div className="p-6 space-y-6">

                    {/* Info Original (Rejection Reason) */}
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2">
                      <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Corte Rechazado
                      </h4>
                      {correctionClosing.rejection_reason && (
                        <p className="text-xs text-amber-800 italic">
                          &quot; {correctionClosing.rejection_reason} &quot;
                        </p>
                      )}
                    </div>

                    {/* Sales Summary (Equivalent to Total Sales) */}
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Ventas Registradas</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold tracking-tight">{formatCurrency(correctionClosing.total_sales || 0)}</span>
                        <span className="text-sm text-muted-foreground">({correctionClosing.total_transactions || 0} ops)</span>
                      </div>
                    </div>

                    {/* Payment Breakdown (Read Only) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-green-600" />
                          </div>
                          <span className="font-medium text-sm">Efectivo</span>
                        </div>
                        <span className="font-bold text-green-700">{formatCurrency(correctionClosing.total_cash || 0)}</span>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="font-medium text-sm">BBVA</span>
                        </div>
                        <span className="font-bold text-blue-700">{formatCurrency(correctionClosing.total_card_bbva || 0)}</span>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                            <CreditCard className="h-4 w-4 text-red-600" />
                          </div>
                          <span className="font-medium text-sm">GETNET</span>
                        </div>
                        <span className="font-bold text-red-700">{formatCurrency(correctionClosing.total_card_getnet || 0)}</span>
                      </div>
                    </div>

                    {/* Expenses (Read Only Context) */}
                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Gastos</h3>
                        <span className="text-sm font-bold text-red-600">-{formatCurrency(correctionClosing.total_expenses || 0)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground italic">Gastos registrados en el turno original</p>
                    </div>

                    {/* EXPECTED CASH HIGHLIGHT */}
                    <div className="mt-auto pt-6 border-t">
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-1">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider">Efectivo Esperado en Caja</p>
                        <p className="text-2xl font-black text-foreground">{formatCurrency(correctionClosing.total_cash || 0)}</p>
                        <p className="text-[10px] text-muted-foreground">Ventas Efectivo - Gastos</p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* RIGHT PANEL: COUNTING (65%) - Same as ShiftClosingModal */}
                <div className="col-span-1 md:col-span-8 lg:col-span-9 overflow-y-auto bg-background p-6">
                  <div className="max-w-4xl mx-auto space-y-8">

                    {/* CASH COUNTING - Simplified for Correction */}
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-lg font-semibold">
                          <Calculator className="h-5 w-5 text-primary" />
                          Nuevo Conteo de Efectivo
                        </h3>
                      </div>

                      <div className="border rounded-xl p-6 bg-muted/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Efectivo esperado</p>
                          </div>
                          <span className="text-xl font-bold">{formatCurrency(correctionClosing.total_cash || 0)}</span>
                        </div>

                        <div className="border-t pt-4">
                          <Label className="text-base font-semibold">Nuevo total en efectivo</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={correctionCountedCash || ""}
                            onChange={(e) => setCorrectionCountedCash(parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="text-right text-2xl font-mono h-14"
                          />
                        </div>
                      </div>
                    </section>

                    {/* VOUCHER COUNTING */}
                    <section className="space-y-4 pt-6 border-t">
                      <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground/80">
                        <Receipt className="h-5 w-5 text-primary" />
                        Declaración de Vouchers
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* BBVA Card */}
                        <div className="group bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/10 border rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                          <div className="p-5 space-y-5">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20 flex items-center justify-center text-white">
                                  <CreditCard className="h-5 w-5" />
                                </div>
                                <div>
                                  <span className="block font-bold text-base text-foreground">BBVA</span>
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Terminal</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Sistema</span>
                                <Badge variant="outline" className="font-mono text-sm bg-background/50 backdrop-blur-sm border-blue-200 dark:border-blue-900">
                                  {formatCurrency(correctionClosing.total_card_bbva || 0)}
                                </Badge>
                              </div>
                            </div>

                            <div className="bg-background/60 dark:bg-black/20 rounded-xl p-1.5 border border-border/50">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">Físico:</span>
                                <Input
                                  type="number"
                                  value={correctionDeclaredBBVA}
                                  onChange={(e) => setCorrectionDeclaredBBVA(e.target.value)}
                                  placeholder="0.00"
                                  className="border-0 bg-transparent text-right text-lg font-mono font-bold h-10 focus-visible:ring-0 px-3 pl-16 shadow-none"
                                />
                              </div>
                            </div>
                          </div>
                          <div className={`px-5 py-3 flex justify-between items-center text-sm font-medium border-t border-border/50 ${(parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0) === 0 ? 'bg-green-100/30 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100/30 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                            <span className="flex items-center gap-2">
                              {(parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0) === 0 ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                              Diferencia
                            </span>
                            <span className="font-mono font-bold tracking-tight text-base">
                              {(parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0) > 0 ? '+' : ''}
                              {formatCurrency((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0))}
                            </span>
                          </div>
                        </div>

                        {/* GETNET Card */}
                        <div className="group bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-950/10 border rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
                          <div className="p-5 space-y-5">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-red-600 shadow-lg shadow-red-600/20 flex items-center justify-center text-white">
                                  <CreditCard className="h-5 w-5" />
                                </div>
                                <div>
                                  <span className="block font-bold text-base text-foreground">GETNET</span>
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Terminal</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-muted-foreground uppercase block mb-0.5">Sistema</span>
                                <Badge variant="outline" className="font-mono text-sm bg-background/50 backdrop-blur-sm border-red-200 dark:border-red-900">
                                  {formatCurrency(correctionClosing.total_card_getnet || 0)}
                                </Badge>
                              </div>
                            </div>

                            <div className="bg-background/60 dark:bg-black/20 rounded-xl p-1.5 border border-border/50">
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">Físico:</span>
                                <Input
                                  type="number"
                                  value={correctionDeclaredGetnet}
                                  onChange={(e) => setCorrectionDeclaredGetnet(e.target.value)}
                                  placeholder="0.00"
                                  className="border-0 bg-transparent text-right text-lg font-mono font-bold h-10 focus-visible:ring-0 px-3 pl-16 shadow-none"
                                />
                              </div>
                            </div>
                          </div>
                          <div className={`px-5 py-3 flex justify-between items-center text-sm font-medium border-t border-border/50 ${(parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0) === 0 ? 'bg-green-100/30 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100/30 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                            <span className="flex items-center gap-2">
                              {(parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0) === 0 ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                              Diferencia
                            </span>
                            <span className="font-mono font-bold tracking-tight text-base">
                              {(parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0) > 0 ? '+' : ''}
                              {formatCurrency((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* NOTES & FINAL RESULT highlight */}
                    <section className="bg-muted/30 rounded-2xl p-6 border flex flex-col lg:flex-row gap-8 items-stretch pt-8 mt-6">
                      <div className="flex-1 space-y-3">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          Observaciones
                        </Label>
                        <textarea
                          value={correctionNotes}
                          onChange={(e) => setCorrectionNotes(e.target.value)}
                          placeholder="Describe brevemente la causa de la corrección..."
                          className="w-full bg-background border rounded-xl p-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none h-[120px]"
                        />
                        <p className="text-xs text-muted-foreground ml-1">
                          * Esta nota quedará registrada permanentemente en el historial.
                        </p>
                      </div>

                      <div className="flex flex-col gap-4">
                        {/* Global Difference Card (Reference) */}
                        <div className="min-w-[320px] rounded-xl border bg-muted/20 p-4 flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Diferencia Global</Label>
                            <p className="text-[10px] text-muted-foreground">(Efectivo + Tarjetas)</p>
                          </div>
                          <div className={`text-xl font-bold font-mono tracking-tight ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) + ((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0)) + ((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0))) === 0 ? 'text-green-600' : (calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) + ((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0)) + ((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0))) > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                            {(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) + ((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0)) + ((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0))) > 0 ? '+' : ''}
                            {formatCurrency(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0) + ((parseFloat(correctionDeclaredBBVA) || 0) - (correctionClosing.total_card_bbva || 0)) + ((parseFloat(correctionDeclaredGetnet) || 0) - (correctionClosing.total_card_getnet || 0)))}
                          </div>
                        </div>

                        {/* Cash Result Card (Main) */}
                        <div className={`min-w-[320px] rounded-2xl p-1 shadow-lg bg-gradient-to-br ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? 'from-green-500 to-emerald-700' : 'from-red-500 to-rose-700'}`}>
                          <div className="h-full bg-white dark:bg-slate-950 rounded-xl p-6 flex flex-col justify-center items-center relative overflow-hidden">
                            {/* Background Glow */}
                            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? 'from-green-400 to-emerald-500' : 'from-red-400 to-rose-500'}`}></div>

                            <Label className="text-xs text-muted-foreground uppercase tracking-widest text-center mb-4 font-bold">Resultado Final (Efectivo)</Label>

                            <div className={`text-5xl font-black text-center mb-2 tracking-tighter ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? 'text-green-600 dark:text-green-400' : (calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) > 0 ? 'text-blue-600' : 'text-red-600 dark:text-red-500'}`}>
                              {formatCurrency(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0))}
                            </div>

                            <div className={`mt-2 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 ${(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) === 0 ? (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  <span>CORTE PERFECTO</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-4 w-4" />
                                  <span>{(calculateCorrectionCashTotal() - (correctionClosing.total_cash || 0)) > 0 ? 'SOBRANTE' : 'FALTANTE'}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-4 border-t bg-background z-10 flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowCorrectionModal(false);
                setCorrectionClosing(null);
              }}
              disabled={savingCorrection}
            >
              Cancelar
            </Button>
            <Button
              onClick={saveCorrectionClosing}
              disabled={savingCorrection || calculateCorrectionCashTotal() === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {savingCorrection ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirmar Corrección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
