"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Printer, Download, Loader2, X } from "lucide-react";

interface ReceiptItem {
  id: string;
  qty: number;
  unit_price: number;
  total: number;
  concept_type: string | null;
  is_paid: boolean;
  payment_method: string | null;
  products: { name: string; sku: string } | null;
}

interface ReceiptPayment {
  id: string;
  amount: number;
  payment_method: string;
  reference: string;
  created_at: string;
}

interface ReceiptData {
  order: {
    id: string;
    created_at: string;
    total: number;
    paid_amount: number;
    remaining_amount: number;
    currency: string;
    status: string;
  };
  items: ReceiptItem[];
  payments: ReceiptPayment[];
  roomNumber?: string;
}

interface ReceiptGeneratorProps {
  orderId: string;
  roomNumber?: string;
  onClose?: () => void;
}

export function ReceiptGenerator({ orderId, roomNumber, onClose }: ReceiptGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const fetchReceiptData = async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // Obtener orden
      const { data: order, error: orderError } = await supabase
        .from("sales_orders")
        .select("id, created_at, total, paid_amount, remaining_amount, currency, status")
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;

      // Obtener items
      const { data: items } = await supabase
        .from("sales_order_items")
        .select(`
          id, qty, unit_price, total, concept_type, is_paid, payment_method,
          products:product_id(name, sku)
        `)
        .eq("sales_order_id", orderId);

      // Obtener pagos
      const { data: payments } = await supabase
        .from("payments")
        .select("id, amount, payment_method, reference, created_at")
        .eq("sales_order_id", orderId)
        .order("created_at", { ascending: true });

      setReceiptData({
        order: order as any,
        items: (items || []).map((item: any) => ({
          ...item,
          products: Array.isArray(item.products) ? item.products[0] : item.products
        })),
        payments: payments || [],
        roomNumber,
      });
      setShowPreview(true);
    } catch (error) {
      console.error("Error fetching receipt data:", error);
      toast.error("Error al generar recibo");
    } finally {
      setLoading(false);
    }
  };

  const printReceipt = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow || !receiptData) return;

    const conceptLabels: Record<string, string> = {
      ROOM_BASE: "Habitación",
      EXTRA_HOUR: "Hora Extra",
      EXTRA_PERSON: "Persona Extra",
      CONSUMPTION: "Consumo",
      PRODUCT: "Producto",
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: receiptData.order.currency || "MXN",
      }).format(amount);
    };

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recibo - ${receiptData.roomNumber ? `Hab. ${receiptData.roomNumber}` : orderId.slice(0, 8)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 12px; 
            padding: 10px;
            max-width: 300px;
            margin: 0 auto;
          }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
          .header h1 { font-size: 16px; margin-bottom: 5px; }
          .header p { font-size: 10px; color: #666; }
          .info { margin-bottom: 10px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin: 10px 0; }
          .item { margin-bottom: 8px; }
          .item-name { font-weight: bold; }
          .item-details { display: flex; justify-content: space-between; font-size: 11px; color: #666; }
          .item-total { text-align: right; font-weight: bold; }
          .totals { margin: 10px 0; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .total-row.grand { font-size: 14px; font-weight: bold; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
          .payments { margin: 10px 0; padding: 10px 0; border-top: 1px dashed #000; }
          .payments h3 { font-size: 11px; margin-bottom: 5px; }
          .payment { font-size: 10px; margin-bottom: 3px; }
          .footer { text-align: center; margin-top: 15px; font-size: 10px; color: #666; }
          .status { text-align: center; padding: 5px; margin: 10px 0; font-weight: bold; }
          .status.paid { background: #d4edda; color: #155724; }
          .status.pending { background: #fff3cd; color: #856404; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏨 RECIBO</h1>
          ${receiptData.roomNumber ? `<p>Habitación ${receiptData.roomNumber}</p>` : ""}
          <p>${formatDate(receiptData.order.created_at)}</p>
          <p style="font-size: 9px; color: #999;">Ref: ${receiptData.order.id.slice(0, 8).toUpperCase()}</p>
        </div>

        <div class="items">
          ${receiptData.items.map(item => `
            <div class="item">
              <div class="item-name">
                ${item.concept_type && item.concept_type !== 'PRODUCT' 
                  ? conceptLabels[item.concept_type] 
                  : item.products?.name || 'Producto'}
              </div>
              <div class="item-details">
                <span>${item.qty} x ${formatCurrency(item.unit_price)}</span>
                <span>${item.is_paid ? '✓ Pagado' : '○ Pend.'}</span>
              </div>
              <div class="item-total">${formatCurrency(item.total)}</div>
            </div>
          `).join("")}
        </div>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>${formatCurrency(receiptData.order.total)}</span>
          </div>
          <div class="total-row">
            <span>Pagado:</span>
            <span>${formatCurrency(receiptData.order.paid_amount || 0)}</span>
          </div>
          <div class="total-row grand">
            <span>Saldo:</span>
            <span>${formatCurrency(receiptData.order.remaining_amount || 0)}</span>
          </div>
        </div>

        <div class="status ${receiptData.order.remaining_amount <= 0 ? 'paid' : 'pending'}">
          ${receiptData.order.remaining_amount <= 0 ? '✓ PAGADO COMPLETO' : '⏳ SALDO PENDIENTE'}
        </div>

        ${receiptData.payments.length > 0 ? `
          <div class="payments">
            <h3>Historial de Pagos:</h3>
            ${receiptData.payments.map(p => `
              <div class="payment">
                ${formatDate(p.created_at)} - ${p.payment_method}: ${formatCurrency(p.amount)}
              </div>
            `).join("")}
          </div>
        ` : ""}

        <div class="footer">
          <p>¡Gracias por su preferencia!</p>
          <p style="margin-top: 5px;">Este documento es un comprobante de pago</p>
        </div>

        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px; cursor: pointer;">
            🖨️ Imprimir
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={fetchReceiptData}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Printer className="h-4 w-4 mr-2" />
        )}
        Recibo
      </Button>

      {showPreview && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[90vh] flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Vista previa del recibo</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowPreview(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="bg-white text-black rounded-lg p-4 text-xs font-mono">
                <div className="text-center mb-3 pb-2 border-b border-dashed border-gray-400">
                  <p className="text-lg font-bold">🏨 RECIBO</p>
                  {receiptData.roomNumber && <p>Habitación {receiptData.roomNumber}</p>}
                  <p className="text-[10px] text-gray-500">
                    {new Date(receiptData.order.created_at).toLocaleString("es-MX")}
                  </p>
                </div>

                <div className="space-y-2 mb-3 pb-2 border-b border-dashed border-gray-400">
                  {receiptData.items.map((item) => (
                    <div key={item.id}>
                      <p className="font-bold">
                        {item.concept_type && item.concept_type !== 'PRODUCT'
                          ? { ROOM_BASE: "Habitación", EXTRA_HOUR: "Hora Extra", EXTRA_PERSON: "Persona Extra", CONSUMPTION: "Consumo" }[item.concept_type]
                          : item.products?.name}
                      </p>
                      <div className="flex justify-between text-[10px] text-gray-600">
                        <span>{item.qty} x ${item.unit_price.toFixed(2)}</span>
                        <span>{item.is_paid ? "✓" : "○"}</span>
                      </div>
                      <p className="text-right font-bold">${item.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-bold">${receiptData.order.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pagado:</span>
                    <span>${(receiptData.order.paid_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-gray-400 pt-1">
                    <span>Saldo:</span>
                    <span>${(receiptData.order.remaining_amount || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className={`text-center mt-3 py-1 rounded ${
                  receiptData.order.remaining_amount <= 0 
                    ? "bg-green-100 text-green-800" 
                    : "bg-amber-100 text-amber-800"
                }`}>
                  {receiptData.order.remaining_amount <= 0 ? "✓ PAGADO" : "⏳ PENDIENTE"}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Cerrar
              </Button>
              <Button onClick={printReceipt}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
