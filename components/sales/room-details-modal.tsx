"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Receipt, Banknote, CreditCard, Building2, Package, Clock, Users, DollarSign } from "lucide-react";
import { Room, RoomStay } from "@/components/sales/room-types";
import { createClient } from "@/lib/supabase/client";

interface Payment {
  id: string;
  payment_number: string | null;
  amount: number;
  payment_method: string;
  reference: string | null;
  concept: string | null;
  status: string;
  payment_type: string;
  parent_payment_id: string | null;
  notes: string | null;
  created_at: string;
}

interface SalesOrderItem {
  id: string;
  qty: number;
  unit_price: number;
  products: {
    name: string;
    sku: string;
  } | null;
}

interface SalesOrder {
  id: string;
  notes: string | null;
  subtotal: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  created_at: string;
}

export interface RoomDetailsModalProps {
  isOpen: boolean;
  room: Room | null;
  activeStay: RoomStay | null;
  onClose: () => void;
}

export function RoomDetailsModal({
  isOpen,
  room,
  activeStay,
  onClose,
}: RoomDetailsModalProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [salesOrder, setSalesOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"payments" | "items">("payments");

  useEffect(() => {
    if (isOpen && activeStay?.sales_order_id) {
      fetchDetails(activeStay.sales_order_id);
    }
  }, [isOpen, activeStay]);

  const fetchDetails = async (salesOrderId: string) => {
    setLoading(true);
    const supabase = createClient();

    // Fetch payments
    const { data: paymentsData } = await supabase
      .from("payments")
      .select("*")
      .eq("sales_order_id", salesOrderId)
      .order("created_at", { ascending: false });

    // Fetch items
    const { data: itemsData, error: itemsError } = await supabase
      .from("sales_order_items")
      .select(`
        id,
        qty,
        unit_price,
        products (name, sku)
      `)
      .eq("sales_order_id", salesOrderId);

    // Fetch sales order
    const { data: orderData } = await supabase
      .from("sales_orders")
      .select("id, notes, subtotal, total, paid_amount, remaining_amount, status, created_at")
      .eq("id", salesOrderId)
      .single();

    if (paymentsData) setPayments(paymentsData);
    if (itemsData) setItems(itemsData as unknown as SalesOrderItem[]);
    if (orderData) setSalesOrder(orderData);
    
    setLoading(false);
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "EFECTIVO": return <Banknote className="h-4 w-4 text-green-400" />;
      case "TARJETA": return <CreditCard className="h-4 w-4 text-blue-400" />;
      case "TRANSFERENCIA": return <Building2 className="h-4 w-4 text-purple-400" />;
      default: return <Receipt className="h-4 w-4 text-gray-400" />;
    }
  };

  const getConceptLabel = (concept: string | null) => {
    switch (concept) {
      case "ESTANCIA": return "Estancia";
      case "HORA_EXTRA": return "Hora extra";
      case "PERSONA_EXTRA": return "Persona extra";
      case "CONSUMO": return "Consumo";
      case "CHECKOUT": return "Checkout";
      case "PAGO_EXTRA": return "Pago extra";
      case "ABONO": return "Abono";
      case "VENTA": return "Venta";
      case "ABONO_CLIENTE": return "Abono cliente";
      case "TOLERANCIA_EXPIRADA": return "Tolerancia expirada";
      default: return concept || "—";
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("es-MX", { 
      day: "2-digit",
      month: "short",
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const totalPayments = payments
    .filter(p => !p.parent_payment_id)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalItems = items.reduce((sum, i) => sum + (i.qty * Number(i.unit_price)), 0);

  if (!isOpen || !room) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
              <Receipt className="h-6 w-6 text-sky-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Detalles de Venta</h2>
              <p className="text-sm text-slate-400">
                Hab. {room.number} – {room.room_types?.name || "Sin tipo"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Resumen */}
        {salesOrder && (
          <div className="px-6 py-3 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-lg font-bold text-white">${Number(salesOrder.total).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Pagado</p>
                <p className="text-lg font-bold text-emerald-400">${Number(salesOrder.paid_amount).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Pendiente</p>
                <p className={`text-lg font-bold ${Number(salesOrder.remaining_amount) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  ${Number(salesOrder.remaining_amount).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Estado</p>
                <Badge variant="outline" className={`mt-1 ${
                  salesOrder.status === 'COMPLETED' ? 'border-emerald-500 text-emerald-400' :
                  salesOrder.status === 'OPEN' ? 'border-blue-500 text-blue-400' :
                  'border-amber-500 text-amber-400'
                }`}>
                  {salesOrder.status}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 py-2 border-b border-slate-700 flex gap-2 flex-shrink-0">
          <Button
            variant={activeTab === "payments" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("payments")}
            className={activeTab === "payments" ? "bg-sky-600" : "text-slate-400"}
          >
            <DollarSign className="h-4 w-4 mr-1" />
            Pagos ({payments.filter(p => !p.parent_payment_id).length})
          </Button>
          <Button
            variant={activeTab === "items" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("items")}
            className={activeTab === "items" ? "bg-sky-600" : "text-slate-400"}
          >
            <Package className="h-4 w-4 mr-1" />
            Consumos ({items.length})
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
            </div>
          ) : activeTab === "payments" ? (
            /* Tabla de Pagos */
            <div className="space-y-2">
              {payments.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 mx-auto text-slate-600 mb-2" />
                  <p className="text-slate-500">Sin pagos registrados</p>
                </div>
              ) : (
                <>
                  {(() => {
                    // Agrupar pagos: principales (sin parent) y subpagos
                    const mainPayments = payments.filter(p => !p.parent_payment_id);
                    const getSubpayments = (parentId: string) => 
                      payments.filter(p => p.parent_payment_id === parentId);

                    return (
                      <div className="space-y-3">
                        {mainPayments.map((payment) => {
                          const subpayments = getSubpayments(payment.id);
                          const hasSubpayments = subpayments.length > 0;

                          return (
                            <div key={payment.id} className="border border-slate-700 rounded-lg overflow-hidden">
                              {/* Pago principal */}
                              <div className={`p-3 ${hasSubpayments ? 'bg-slate-800/50' : 'bg-slate-800/30'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span className="text-sky-400 font-mono text-xs font-bold">
                                      {payment.payment_number || "—"}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-300">
                                      {getConceptLabel(payment.concept)}
                                    </Badge>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-[10px] ${
                                        payment.status === "PAGADO" 
                                          ? "border-emerald-500/50 text-emerald-400" 
                                          : "border-amber-500/50 text-amber-400"
                                      }`}
                                    >
                                      {payment.status}
                                    </Badge>
                                  </div>
                                  <span className="text-lg font-bold text-emerald-400">
                                    ${Number(payment.amount).toFixed(2)}
                                  </span>
                                </div>
                                {!hasSubpayments && (
                                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                                    {getPaymentIcon(payment.payment_method)}
                                    <span>{payment.payment_method}</span>
                                    {payment.reference && (
                                      <span className="font-mono">• {payment.reference}</span>
                                    )}
                                  </div>
                                )}
                                {/* Mostrar productos si es un pago de consumo */}
                                {payment.concept === "CONSUMO" && payment.notes && (
                                  <div className="mt-2 text-xs text-slate-400 bg-slate-800/50 rounded px-2 py-1">
                                    <span className="text-slate-500">Productos: </span>
                                    {payment.notes}
                                  </div>
                                )}
                              </div>

                              {/* Subpagos */}
                              {hasSubpayments && (
                                <div className="border-t border-slate-700">
                                  {subpayments.map((sub, idx) => (
                                    <div 
                                      key={sub.id} 
                                      className={`px-3 py-2 flex items-center justify-between text-sm ${
                                        idx !== subpayments.length - 1 ? 'border-b border-slate-800' : ''
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 pl-4">
                                        <span className="text-slate-500">└</span>
                                        {getPaymentIcon(sub.payment_method)}
                                        <span className="text-white text-xs">{sub.payment_method}</span>
                                        {sub.reference && (
                                          <span className="text-slate-500 text-[10px] font-mono">
                                            {sub.reference}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-emerald-400 font-medium">
                                        ${Number(sub.amount).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Total */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-600">
                          <span className="text-sm font-medium text-slate-300">Total Pagado</span>
                          <span className="text-lg font-bold text-emerald-400">
                            ${totalPayments.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          ) : (
            /* Tabla de Consumos */
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-slate-600 mb-2" />
                  <p className="text-slate-500">Sin consumos registrados</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                      <th className="pb-2 font-medium">Producto</th>
                      <th className="pb-2 font-medium text-center">Cant.</th>
                      <th className="pb-2 font-medium text-right">P. Unit.</th>
                      <th className="pb-2 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {items.map((item) => (
                      <tr key={item.id} className="text-sm">
                        <td className="py-3">
                          <div>
                            <p className="text-white">{item.products?.name || "Producto"}</p>
                            <p className="text-xs text-slate-500">{item.products?.sku || ""}</p>
                          </div>
                        </td>
                        <td className="py-3 text-center text-slate-300">
                          {item.qty}
                        </td>
                        <td className="py-3 text-right text-slate-400">
                          ${Number(item.unit_price).toFixed(2)}
                        </td>
                        <td className="py-3 text-right font-medium text-white">
                          ${(item.qty * Number(item.unit_price)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-600">
                      <td colSpan={3} className="py-3 text-sm font-medium text-slate-300">
                        Total Consumos
                      </td>
                      <td className="py-3 text-right text-lg font-bold text-white">
                        ${totalItems.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-end flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
