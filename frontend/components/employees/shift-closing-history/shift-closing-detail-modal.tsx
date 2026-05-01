import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Receipt, Loader2, CheckCircle, Clock, History, AlertTriangle, XCircle
} from "lucide-react";
import { ShiftClosing } from "../types";
import { formatCurrency } from "@/hooks/use-shift-closing-history";

interface ShiftClosingDetailModalProps {
  selectedClosing: ShiftClosing | null;
  setSelectedClosing: (closing: ShiftClosing | null) => void;
  closingDetails: any[];
  closingSalesOrders: any[];
  closingReviews: any[];
  loadingDetails: boolean;
  isAdmin: boolean;
  processingAction: boolean;
  currentEmployeeId: string | null;
  openRejectModal: () => void;
  approveClosing: (id: string) => void;
  exportClosing: (closing: ShiftClosing) => void;
  openCorrectionModal: (closing: ShiftClosing) => void;
}

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

export function ShiftClosingDetailModal({
  selectedClosing,
  setSelectedClosing,
  closingDetails,
  closingSalesOrders,
  closingReviews,
  loadingDetails,
  isAdmin,
  processingAction,
  currentEmployeeId,
  openRejectModal,
  approveClosing,
  exportClosing,
  openCorrectionModal
}: ShiftClosingDetailModalProps) {
  if (!selectedClosing) return null;

  return (
    <Dialog open={!!selectedClosing} onOpenChange={() => setSelectedClosing(null)}>
      <DialogContent className="max-w-[90%] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalle del Corte
          </DialogTitle>
          <DialogDescription>
            {new Date(selectedClosing.period_start).toLocaleDateString("es-MX", {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
            {" • "}
            {selectedClosing.employees?.first_name} {selectedClosing.employees?.last_name}
          </DialogDescription>
        </DialogHeader>

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
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-muted-foreground font-mono">
                                #{(index + 1).toString().padStart(2, '0')}
                              </span>
                              <span className="text-sm font-medium">
                                {payment?.created_at
                                  ? new Date(payment.created_at).toLocaleTimeString("es-MX", {
                                    hour: '2-digit', minute: '2-digit', second: '2-digit'
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

                            <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                              {payment?.reference && (
                                <p><span className="font-medium">Ref:</span> {payment.reference}</p>
                              )}
                              {roomType && (
                                <p><span className="font-medium">Tipo:</span> {roomType.name}</p>
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
                                <p><span className="font-medium">Tipo pago:</span> {payment.payment_type}</p>
                              )}
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-bold text-primary">
                              {formatCurrency(detail.amount)}
                            </p>
                            <p className={`text-xs ${payment?.status === "PAGADO" ? "text-green-500" : "text-amber-500"}`}>
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
                                hour: "2-digit", minute: "2-digit",
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
                                    <span className="text-xs text-muted-foreground w-5">{itemIndex + 1}.</span>
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

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setSelectedClosing(null)}>
            Cerrar
          </Button>
          <Button variant="outline" onClick={() => exportClosing(selectedClosing)}>
            <Receipt className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
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
  );
}
