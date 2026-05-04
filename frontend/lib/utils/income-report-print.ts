/**
 * Generates a beautifully formatted HTML income report and opens it in a print window.
 * Designed to be printed on an HP LaserJet (letter size) with proper borders and layout.
 */

export interface IncomeReportEntry {
  time: string;
  vehicle_plate: string;
  room_number: string;
  checkout_valet_name?: string;
  room_price: number;
  extra: number;
  consumption: number;
  total: number;
  payment_method: string;
}

export interface IncomeReportPrintParams {
  entries: IncomeReportEntry[];
  receptionistName: string;
  periodStart: string;
  periodEnd: string;
  paymentBreakdown: Record<string, number>;
}

function fmtCurrency(val: number): string {
  return '$' + Number(val).toFixed(2);
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch { return iso; }
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return iso; }
}

export function openIncomeReportPrintWindow(params: IncomeReportPrintParams) {
  const { entries, receptionistName, periodStart, periodEnd, paymentBreakdown } = params;

  const totals = entries.reduce(
    (acc, e) => ({
      roomPrice: acc.roomPrice + (e.room_price || 0),
      extra: acc.extra + (e.extra || 0),
      consumption: acc.consumption + (e.consumption || 0),
      total: acc.total + (e.total || 0),
    }),
    { roomPrice: 0, extra: 0, consumption: 0, total: 0 }
  );

  const tableRows = entries.map((e, idx) => {
    const rowBg = idx % 2 === 0 ? '' : 'background:#f9fafb;';
    return `<tr style="${rowBg}">
      <td style="text-align:center;font-weight:600;border:1px solid #d1d5db;padding:6px 8px;">${idx + 1}</td>
      <td style="text-align:center;border:1px solid #d1d5db;padding:6px 8px;">${e.time}</td>
      <td style="text-align:center;text-transform:uppercase;font-size:10px;border:1px solid #d1d5db;padding:6px 8px;">${e.vehicle_plate || '—'}</td>
      <td style="text-align:center;font-weight:600;border:1px solid #d1d5db;padding:6px 8px;">${e.room_number}</td>
      <td style="text-align:center;font-size:10px;color:#4b5563;border:1px solid #d1d5db;padding:6px 8px;">${e.checkout_valet_name || '—'}</td>
      <td style="text-align:right;font-family:monospace;border:1px solid #d1d5db;padding:6px 8px;">${e.room_price > 0 ? fmtCurrency(e.room_price) : '—'}</td>
      <td style="text-align:right;font-family:monospace;border:1px solid #d1d5db;padding:6px 8px;">${e.extra > 0 ? fmtCurrency(e.extra) : '—'}</td>
      <td style="text-align:right;font-family:monospace;border:1px solid #d1d5db;padding:6px 8px;">${e.consumption > 0 ? fmtCurrency(e.consumption) : '—'}</td>
      <td style="text-align:right;font-weight:700;font-family:monospace;border:1px solid #d1d5db;padding:6px 8px;">${fmtCurrency(e.total)}</td>
      <td style="text-align:center;font-size:10px;font-weight:600;border:1px solid #d1d5db;padding:6px 8px;">${e.payment_method || '—'}</td>
    </tr>`;
  }).join('');

  const breakdownRows = Object.entries(paymentBreakdown).map(([method, amount]) =>
    `<tr>
      <td style="padding:5px 14px;font-size:12px;border-bottom:1px solid #e5e7eb;">${method}</td>
      <td style="padding:5px 14px;text-align:right;font-weight:600;font-family:monospace;border-bottom:1px solid #e5e7eb;">${fmtCurrency(Number(amount))}</td>
    </tr>`
  ).join('');

  const totalPayments = Object.values(paymentBreakdown).reduce((s, v) => s + Number(v), 0);

  const periodLabel = `${fmtDate(periodStart)} ${fmtTime(periodStart)} — ${periodEnd ? `${fmtDate(periodEnd)} ${fmtTime(periodEnd)}` : 'En curso'}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Ingresos de Hospedaje — Luxor Auto Hotel</title>
<style>
  @page { size: letter portrait; margin: 10mm 8mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 11px; color: #111; background: #fff; }
  .container { max-width: 100%; }
  .header { text-align: center; border-bottom: 3px double #111; padding-bottom: 14px; margin-bottom: 8px; }
  .header h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 4px; }
  .header h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #333; margin-bottom: 8px; }
  .meta { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-top: 6px; }
  .meta-left { text-align: left; }
  .meta-right { text-align: right; font-weight: bold; }
  .period { text-align: center; font-size: 10px; color: #666; margin-top: 4px; }
  table.main { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 12px; }
  table.main th {
    background: #1a1a2e; color: #fff; padding: 7px 8px; font-size: 10px;
    text-transform: uppercase; letter-spacing: 1px; font-weight: 700;
    border: 1px solid #1a1a2e; white-space: nowrap;
  }
  table.main td { padding: 5px 8px; border: 1px solid #d1d5db; font-size: 11px; }
  .totals-row td {
    background: #f3f4f6; font-weight: 700; border-top: 3px solid #111;
    padding: 8px; font-size: 12px;
  }
  .footer { display: flex; justify-content: space-between; margin-top: 16px; gap: 20px; }
  .footer-box { flex: 1; border: 2px solid #d1d5db; border-radius: 6px; padding: 12px; }
  .footer-box h4 {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px;
    color: #555; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;
  }
  .signature { margin-top: 50px; display: flex; justify-content: space-around; }
  .sig-line { text-align: center; width: 220px; }
  .sig-line .line { border-top: 1px solid #111; margin-bottom: 5px; margin-top: 40px; }
  .sig-line span { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #666; }
  .printed-at { text-align: right; font-size: 9px; color: #999; margin-top: 10px; }
</style>
</head>
<body onload="setTimeout(()=>window.print(),400)">
<div class="container">
  <div class="header">
    <div class="meta">
      <div class="meta-left">Fecha: ${new Date().toLocaleDateString('es-MX')}</div>
      <div class="meta-right">N° 0001</div>
    </div>
    <h1>Luxor Auto Hotel</h1>
    <h2>Ingresos de Hospedaje y Consumo Público en General</h2>
    <div class="period">Turno: ${periodLabel}</div>
  </div>

  <table class="main">
    <thead>
      <tr>
        <th style="width:35px">No.</th>
        <th style="width:55px">Horario</th>
        <th style="width:85px">Placas</th>
        <th style="width:45px">Hab.</th>
        <th style="width:80px">Aprobó</th>
        <th style="width:80px">Precio</th>
        <th style="width:70px">Extra</th>
        <th style="width:80px">Consumo</th>
        <th style="width:80px">Total</th>
        <th>Forma Pago</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="totals-row">
        <td colspan="5" style="text-align:right;text-transform:uppercase;letter-spacing:2px;font-size:11px;border:1px solid #d1d5db;">SUMA TOTAL</td>
        <td style="text-align:right;font-family:monospace;border:1px solid #d1d5db;">${fmtCurrency(totals.roomPrice)}</td>
        <td style="text-align:right;font-family:monospace;border:1px solid #d1d5db;">${fmtCurrency(totals.extra)}</td>
        <td style="text-align:right;font-family:monospace;border:1px solid #d1d5db;">${fmtCurrency(totals.consumption)}</td>
        <td style="text-align:right;font-family:monospace;font-size:13px;border:1px solid #d1d5db;">${fmtCurrency(totals.total)}</td>
        <td style="border:1px solid #d1d5db;"></td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div class="footer-box">
      <h4>Desglose por Método de Pago</h4>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${breakdownRows}
          <tr>
            <td style="padding:6px 14px;font-size:12px;font-weight:700;border-top:2px solid #111;">TOTAL</td>
            <td style="padding:6px 14px;text-align:right;font-family:monospace;font-weight:700;font-size:14px;border-top:2px solid #111;">${fmtCurrency(totalPayments)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="footer-box">
      <h4>Resumen</h4>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          <tr><td style="padding:4px 14px;font-size:11px;border-bottom:1px solid #e5e7eb;">Recepcionista</td><td style="padding:4px 14px;text-align:right;font-weight:600;border-bottom:1px solid #e5e7eb;">${receptionistName}</td></tr>
          <tr><td style="padding:4px 14px;font-size:11px;border-bottom:1px solid #e5e7eb;">Habitaciones</td><td style="padding:4px 14px;text-align:right;font-family:monospace;font-weight:600;border-bottom:1px solid #e5e7eb;">${fmtCurrency(totals.roomPrice)}</td></tr>
          <tr><td style="padding:4px 14px;font-size:11px;border-bottom:1px solid #e5e7eb;">Extras</td><td style="padding:4px 14px;text-align:right;font-family:monospace;font-weight:600;border-bottom:1px solid #e5e7eb;">${fmtCurrency(totals.extra)}</td></tr>
          <tr><td style="padding:4px 14px;font-size:11px;border-bottom:1px solid #e5e7eb;">Consumo</td><td style="padding:4px 14px;text-align:right;font-family:monospace;font-weight:600;border-bottom:1px solid #e5e7eb;">${fmtCurrency(totals.consumption)}</td></tr>
          <tr><td style="padding:6px 14px;font-size:12px;font-weight:700;border-top:2px solid #111;">TOTAL</td><td style="padding:6px 14px;text-align:right;font-family:monospace;font-weight:700;font-size:14px;border-top:2px solid #111;">${fmtCurrency(totals.total)}</td></tr>
          <tr><td style="padding:4px 14px;font-size:11px;">Registros</td><td style="padding:4px 14px;text-align:right;font-weight:600;">${entries.length}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="signature">
    <div class="sig-line"><div class="line"></div><span>Recepcionista</span></div>
    <div class="sig-line"><div class="line"></div><span>Supervisor / Gerente</span></div>
  </div>

  <div class="printed-at">Impreso: ${new Date().toLocaleString('es-MX')}</div>
</div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
