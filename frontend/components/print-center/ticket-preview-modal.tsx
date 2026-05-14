"use client";

import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ReprintableTicket, TicketType } from "@/hooks/use-reprint-center";

// ─── Helpers ──────────────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

const fmtDate = (d: Date | string) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const fmtTime = (d: Date | string) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const typeLabels: Record<TicketType, { label: string; emoji: string }> = {
  entry: { label: "Ticket de Entrada", emoji: "🚪" },
  checkout: { label: "Ticket de Salida", emoji: "🚶" },
  consumption: { label: "Ticket de Consumo", emoji: "🛒" },
  payment: { label: "Comprobante de Pago", emoji: "💰" },
  closing: { label: "Corte de Caja", emoji: "📋" },
  tolerance: { label: "Ticket de Tolerancia", emoji: "⏳" },
};

// ─── Receipt Section Renderers ────────────────────────────────────────

function ReceiptDivider() {
  return <div className="border-t border-dashed border-zinc-600 my-2" />;
}

function ReceiptLine({
  left,
  right,
  bold,
}: {
  left: string;
  right?: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between text-xs ${bold ? "font-bold" : ""}`}>
      <span>{left}</span>
      {right && <span className="tabular-nums">{right}</span>}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-1 mt-1">
      {children}
    </div>
  );
}

// ─── Entry Preview ───────────────────────────────────────────────────

function EntryPreview({ data }: { data: any }) {
  return (
    <>
      <ReceiptLine left="Habitación:" right={data.roomNumber} bold />
      <ReceiptLine left="Tipo:" right={data.roomTypeName} />
      <ReceiptLine left="Personas:" right={String(data.people || 1)} />
      {data.vehiclePlate && (
        <ReceiptLine left="Placas:" right={data.vehiclePlate} />
      )}
      {data.vehicleBrand && (
        <ReceiptLine
          left="Vehículo:"
          right={`${data.vehicleBrand} ${data.vehicleModel || ""}`.trim()}
        />
      )}
      <ReceiptDivider />
      <ReceiptLine left="Precio base:" right={fmtCurrency(data.basePrice)} />
      {data.extraPeopleCount > 0 && (
        <ReceiptLine
          left={`Extra (${data.extraPeopleCount} pers.):`}
          right={fmtCurrency(data.extraPeopleCost)}
        />
      )}
      <ReceiptDivider />
      <ReceiptLine left="TOTAL:" right={fmtCurrency(data.totalPrice)} bold />
      <ReceiptLine left="Forma de pago:" right={data.paymentMethod} />
      {data.expectedCheckout && (
        <ReceiptLine
          left="Salida esperada:"
          right={`${fmtDate(data.expectedCheckout)} ${fmtTime(data.expectedCheckout)}`}
        />
      )}
    </>
  );
}

// ─── Checkout Preview ────────────────────────────────────────────────

function CheckoutPreview({ data }: { data: any }) {
  return (
    <>
      <ReceiptLine left="Habitación:" right={data.roomNumber} bold />
      {data.folio && <ReceiptLine left="Folio:" right={data.folio} />}
      <ReceiptDivider />
      {data.items && data.items.length > 0 ? (
        <>
          {data.items.map((item: any, i: number) => (
            <ReceiptLine
              key={i}
              left={`${item.qty || 1}x ${item.name}`}
              right={fmtCurrency(item.total || 0)}
            />
          ))}
          <ReceiptDivider />
        </>
      ) : null}
      <ReceiptLine
        left="TOTAL:"
        right={fmtCurrency(data.total || data.subtotal || 0)}
        bold
      />
    </>
  );
}

// ─── Consumption Preview ─────────────────────────────────────────────

function ConsumptionPreview({ data }: { data: any }) {
  return (
    <>
      <ReceiptLine left="Habitación:" right={data.roomNumber} bold />
      {data.folio && <ReceiptLine left="Folio:" right={data.folio} />}
      <ReceiptDivider />
      <SectionHeader>Productos</SectionHeader>
      {(data.items || []).map((item: any, i: number) => (
        <div key={i} className="flex justify-between text-xs">
          <span className="max-w-[65%] truncate">
            {item.qty}x {item.name}
          </span>
          <span className="tabular-nums">
            {fmtCurrency(item.total || item.price * item.qty)}
          </span>
        </div>
      ))}
      <ReceiptDivider />
      <ReceiptLine left="Subtotal:" right={fmtCurrency(data.subtotal)} />
      <ReceiptLine left="TOTAL:" right={fmtCurrency(data.total)} bold />
    </>
  );
}

// ─── Payment Preview ─────────────────────────────────────────────────

function PaymentPreview({ data }: { data: any }) {
  return (
    <>
      {data.roomNumber && (
        <ReceiptLine left="Habitación:" right={data.roomNumber} bold />
      )}
      <ReceiptLine left="Método de pago:" right={data.paymentMethod} />
      <ReceiptDivider />
      {data.items && data.items.length > 0 && (
        <>
          <SectionHeader>Conceptos</SectionHeader>
          {data.items.map((item: any, i: number) => (
            <ReceiptLine
              key={i}
              left={`${item.qty || 1}x ${item.name}`}
              right={fmtCurrency(item.total || 0)}
            />
          ))}
          <ReceiptDivider />
        </>
      )}
      <ReceiptLine left="TOTAL PAGADO:" right={fmtCurrency(data.total)} bold />
      {data.remainingAmount !== undefined && data.remainingAmount > 0 && (
        <ReceiptLine
          left="Saldo pendiente:"
          right={fmtCurrency(data.remainingAmount)}
        />
      )}
    </>
  );
}

// ─── Closing Preview (matches buildClosingTicket from print-server) ──

function BreakdownSection({
  title,
  items,
  totalLabel,
}: {
  title: string;
  items: Record<string, { count: number; total: number }>;
  totalLabel: string;
}) {
  if (!items || Object.keys(items).length === 0) return null;

  let totalCount = 0;
  let totalAmount = 0;
  Object.values(items).forEach((v) => {
    totalCount += v.count;
    totalAmount += v.total;
  });

  return (
    <>
      <div className="text-center text-xs font-bold mt-1 mb-0.5">{title}</div>
      <ReceiptDivider />
      {Object.entries(items).map(([name, info]) => (
        <ReceiptLine
          key={name}
          left={`  ${String(info.count).padStart(2, " ")}  ${name}`}
          right={fmtCurrency(info.total)}
        />
      ))}
      <ReceiptDivider />
      <ReceiptLine
        left={`  ${String(totalCount).padStart(2, " ")}  ${totalLabel}`}
        right={fmtCurrency(totalAmount)}
        bold
      />
      <div className="border-t border-double border-zinc-600 my-2" />
    </>
  );
}

function ClosingPreview({
  data,
  loadingDetails,
}: {
  data: any;
  loadingDetails?: boolean;
}) {
  const transactions: any[] = data.transactions || [];

  // Group transactions by payment type (same as print-server)
  const cashTx = transactions.filter(
    (tx: any) => tx.paymentMethod === "EFECTIVO"
  );
  const bbvaTx = transactions.filter(
    (tx: any) =>
      tx.paymentMethod === "TARJETA_BBVA" ||
      (tx.paymentMethod === "TARJETA" && tx.terminalCode === "BBVA")
  );
  const getnetTx = transactions.filter(
    (tx: any) =>
      tx.paymentMethod === "TARJETA_GETNET" ||
      (tx.paymentMethod === "TARJETA" && tx.terminalCode === "GETNET")
  );

  return (
    <>
      {/* ═══ Header: Employee & Shift ═══ */}
      <ReceiptLine left={data.shiftName || "Turno"} bold />
      <ReceiptLine left={data.employeeName || "—"} />
      <div className="border-t border-double border-zinc-600 my-2" />

      {/* ═══ Period ═══ */}
      <ReceiptLine
        left="Inicio:"
        right={
          data.periodStart
            ? `${fmtDate(data.periodStart)} ${fmtTime(data.periodStart)}`
            : "—"
        }
      />
      <ReceiptLine
        left="Fin:"
        right={
          data.periodEnd
            ? `${fmtDate(data.periodEnd)} ${fmtTime(data.periodEnd)}`
            : "—"
        }
      />
      <ReceiptDivider />

      {/* ═══ RESUMEN ═══ */}
      <div className="text-center text-xs font-bold mb-1">RESUMEN</div>

      <div className="text-xs font-bold mt-1">EFECTIVO</div>
      <ReceiptLine
        left="  Esperado:"
        right={fmtCurrency(data.totalCash || 0)}
      />
      <ReceiptLine
        left="  Contado:"
        right={fmtCurrency(data.countedCash || 0)}
      />
      <div
        className={`flex justify-between text-xs ${
          (data.cashDifference || 0) < 0
            ? "text-red-400"
            : (data.cashDifference || 0) > 0
            ? "text-emerald-400"
            : ""
        }`}
      >
        <span>
          {"  "}Diferencia:
        </span>
        <span className="tabular-nums">
          {(data.cashDifference || 0) >= 0 ? "+" : ""}
          {fmtCurrency(data.cashDifference || 0)}
        </span>
      </div>

      {(data.totalCardBBVA || 0) > 0 && (
        <>
          <div className="text-xs font-bold mt-2">TARJETA BBVA</div>
          <ReceiptLine
            left="  Total:"
            right={fmtCurrency(data.totalCardBBVA)}
          />
        </>
      )}

      {(data.totalCardGetnet || 0) > 0 && (
        <>
          <div className="text-xs font-bold mt-2">TARJETA GETNET</div>
          <ReceiptLine
            left="  Total:"
            right={fmtCurrency(data.totalCardGetnet)}
          />
        </>
      )}

      <ReceiptDivider />
      <ReceiptLine
        left="TOTAL VENTAS:"
        right={fmtCurrency(data.totalSales || 0)}
        bold
      />
      <ReceiptLine
        left={`Transacciones: ${data.totalTransactions || 0}`}
      />
      <div className="border-t border-double border-zinc-600 my-2" />

      {/* Loading indicator for dynamic data */}
      {loadingDetails ? (
        <div className="flex items-center justify-center py-6 gap-2">
          <svg
            className="animate-spin h-4 w-4 text-amber-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-[11px] text-zinc-500">
            Cargando detalles del corte...
          </span>
        </div>
      ) : (
        <>
          {/* ═══ HABITACIONES POR TIPO ═══ */}
          <BreakdownSection
            title="HABITACIONES POR TIPO"
            items={data.roomBreakdown}
            totalLabel="TOTAL HAB."
          />

          {/* ═══ EXTRAS ═══ */}
          <BreakdownSection
            title="EXTRAS"
            items={data.extraBreakdown}
            totalLabel="TOTAL EXTRAS"
          />

          {/* ═══ CONSUMOS ═══ */}
          <BreakdownSection
            title="CONSUMOS"
            items={data.consumptionBreakdown}
            totalLabel="TOTAL CONSUMOS"
          />

          {/* ═══ DETALLE (transactions grouped by type) ═══ */}
          {transactions.length > 0 && (
            <>
              <div className="text-center text-xs font-bold mt-1 mb-0.5">
                DETALLE
              </div>

              {cashTx.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs font-bold">
                    EFECTIVO ({cashTx.length})
                  </div>
                  {cashTx.map((tx: any, i: number) => (
                    <div key={i} className="text-[11px] text-zinc-300">
                      <span>
                        {i + 1}. {tx.time}{"  "}
                        <span className="tabular-nums font-medium">
                          {fmtCurrency(tx.amount)}
                        </span>
                      </span>
                      {(tx.concept || tx.roomNumber) && (
                        <span className="text-zinc-500 text-[10px] ml-1">
                          {tx.concept && tx.roomNumber
                            ? `(${tx.concept} · Hab ${tx.roomNumber})`
                            : tx.concept
                            ? `(${tx.concept})`
                            : `(Hab ${tx.roomNumber})`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {bbvaTx.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs font-bold">
                    BBVA ({bbvaTx.length})
                  </div>
                  {bbvaTx.map((tx: any, i: number) => (
                    <div key={i} className="text-[11px] text-zinc-300">
                      <span>
                        {i + 1}. {tx.time}{"  "}
                        <span className="tabular-nums font-medium">
                          {fmtCurrency(tx.amount)}
                        </span>
                      </span>
                      {(tx.concept || tx.roomNumber) && (
                        <span className="text-zinc-500 text-[10px] ml-1">
                          {tx.concept && tx.roomNumber
                            ? `(${tx.concept} · Hab ${tx.roomNumber})`
                            : tx.concept
                            ? `(${tx.concept})`
                            : `(Hab ${tx.roomNumber})`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {getnetTx.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs font-bold">
                    GETNET ({getnetTx.length})
                  </div>
                  {getnetTx.map((tx: any, i: number) => (
                    <div key={i} className="text-[11px] text-zinc-300">
                      <span>
                        {i + 1}. {tx.time}{"  "}
                        <span className="tabular-nums font-medium">
                          {fmtCurrency(tx.amount)}
                        </span>
                      </span>
                      {(tx.concept || tx.roomNumber) && (
                        <span className="text-zinc-500 text-[10px] ml-1">
                          {tx.concept && tx.roomNumber
                            ? `(${tx.concept} · Hab ${tx.roomNumber})`
                            : tx.concept
                            ? `(${tx.concept})`
                            : `(Hab ${tx.roomNumber})`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <ReceiptDivider />
            </>
          )}

          {/* ═══ GASTOS DEL TURNO ═══ */}
          {(data.expenses?.length > 0 || (data.totalExpenses || 0) > 0) && (
            <>
              <div className="text-center text-xs font-bold mt-1 mb-0.5">
                GASTOS DEL TURNO
              </div>
              <ReceiptDivider />
              {(data.expenses || []).map((exp: any, i: number) => {
                const EXPENSE_ICONS: Record<string, string> = {
                  UBER: "🚗", MAINTENANCE: "🔧", REPAIR: "🛠️",
                  SUPPLIES: "📦", PETTY_CASH: "💵", OTHER: "📝",
                };
                const icon = EXPENSE_ICONS[exp.type] || "📝";
                return (
                  <div key={i} className="text-[11px] mb-0.5">
                    <div className="flex justify-between">
                      <span className="max-w-[70%] truncate">
                        {icon} {exp.description}
                      </span>
                      <span className="tabular-nums font-medium text-red-400">
                        -{fmtCurrency(exp.amount)}
                      </span>
                    </div>
                    <div className="text-[9px] text-zinc-500 ml-4">
                      {exp.time}
                      {exp.recipient && ` · ${exp.recipient}`}
                    </div>
                  </div>
                );
              })}
              <ReceiptDivider />
              <ReceiptLine
                left="TOTAL GASTOS:"
                right={`-${fmtCurrency(data.totalExpenses || 0)}`}
                bold
              />
              <ReceiptLine
                left="EFECTIVO NETO:"
                right={fmtCurrency((data.totalCash || 0) - (data.totalExpenses || 0))}
                bold
              />
              <div className="border-t border-double border-zinc-600 my-2" />
            </>
          )}
        </>
      )}

      {/* ═══ NOTAS ═══ */}
      {data.notes && (
        <>
          <div className="text-xs font-bold">NOTAS:</div>
          <p className="text-xs text-zinc-300 whitespace-pre-wrap">
            {data.notes}
          </p>
          <ReceiptDivider />
        </>
      )}
    </>
  );
}

// ─── Tolerance Preview ───────────────────────────────────────────────

function TolerancePreview({ data }: { data: any }) {
  return (
    <>
      <ReceiptLine left="Habitación:" right={data.roomNumber} bold />
      <ReceiptLine left="Personas:" right={String(data.people || 1)} />
      <ReceiptLine
        left="Tipo:"
        right={
          data.toleranceType === "ROOM_EMPTY"
            ? "Habitación vacía"
            : "Persona salió"
        }
      />
      <ReceiptDivider />
      {data.exitTime && (
        <ReceiptLine left="Hora de salida:" right={fmtTime(data.exitTime)} />
      )}
      {data.returnDeadline && (
        <ReceiptLine
          left="Hora límite regreso:"
          right={fmtTime(data.returnDeadline)}
          bold
        />
      )}
    </>
  );
}

// ─── Preview Content Switch ──────────────────────────────────────────

function TicketPreviewContent({
  ticket,
  loadingDetails,
}: {
  ticket: ReprintableTicket;
  loadingDetails?: boolean;
}) {
  switch (ticket.type) {
    case "entry":
      return <EntryPreview data={ticket.rawData} />;
    case "checkout":
      return <CheckoutPreview data={ticket.rawData} />;
    case "consumption":
      return <ConsumptionPreview data={ticket.rawData} />;
    case "payment":
      return <PaymentPreview data={ticket.rawData} />;
    case "closing":
      return (
        <ClosingPreview
          data={ticket.rawData}
          loadingDetails={loadingDetails}
        />
      );
    case "tolerance":
      return <TolerancePreview data={ticket.rawData} />;
    default:
      return (
        <p className="text-xs text-zinc-500">
          Vista previa no disponible para este tipo de ticket.
        </p>
      );
  }
}

// ─── Modal Component ─────────────────────────────────────────────────

interface TicketPreviewModalProps {
  ticket: ReprintableTicket | null;
  open: boolean;
  onClose: () => void;
  onReprint: (ticket: ReprintableTicket) => void;
  onReprintHP?: (ticket: ReprintableTicket) => void;
  isPrinting: boolean;
  loadingDetails?: boolean;
}

export function TicketPreviewModal({
  ticket,
  open,
  onClose,
  onReprint,
  onReprintHP,
  isPrinting,
  loadingDetails,
}: TicketPreviewModalProps) {
  const handleReprint = useCallback(() => {
    if (ticket) onReprint(ticket);
  }, [ticket, onReprint]);

  const handleReprintHP = useCallback(() => {
    if (ticket && onReprintHP) onReprintHP(ticket);
  }, [ticket, onReprintHP]);

  if (!ticket) return null;

  const info = typeLabels[ticket.type];
  const ticketDate = new Date(ticket.date);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-zinc-900 border-zinc-700/50 max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span>{info.emoji}</span>
            <span>{info.label}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            {fmtDate(ticketDate)} a las {fmtTime(ticketDate)}
            {ticket.roomNumber && ` · Hab. ${ticket.roomNumber}`}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable receipt paper simulation */}
        <div className="mx-6 mb-4 overflow-y-auto flex-1 min-h-0">
          <div
            className="relative rounded-lg border border-zinc-700/40 bg-zinc-950 px-5 py-4 shadow-inner"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(255,255,255,0.02) 23px, rgba(255,255,255,0.02) 24px)",
            }}
          >
            {/* Hotel Header */}
            <div className="text-center mb-3">
              <h3 className="text-sm font-bold tracking-widest uppercase text-zinc-200">
                Luxor Auto Hotel
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {info.label} — {fmtDate(ticketDate)} {fmtTime(ticketDate)}
              </p>
            </div>

            <ReceiptDivider />

            {/* Dynamic Content */}
            <TicketPreviewContent
              ticket={ticket}
              loadingDetails={loadingDetails}
            />

            {/* Footer */}
            <ReceiptDivider />
            <p className="text-center text-[10px] text-zinc-500 mt-1">
              *** VISTA PREVIA ***
            </p>
          </div>
        </div>

        {/* Actions */}
        <DialogFooter className="px-6 pb-5 gap-2 sm:gap-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors border border-zinc-700/50"
          >
            Cerrar
          </button>
          {ticket.type === "closing" && onReprintHP && (
            <button
              onClick={handleReprintHP}
              disabled={isPrinting}
              className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPrinting ? (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="8" y1="13" x2="16" y2="13" />
                  <line x1="8" y1="17" x2="16" y2="17" />
                </svg>
              )}
              Hoja HP
            </button>
          )}
          <button
            onClick={handleReprint}
            disabled={isPrinting}
            className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPrinting ? (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect width="12" height="8" x="6" y="14" />
              </svg>
            )}
            {isPrinting ? "Imprimiendo..." : "Reimprimir"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
