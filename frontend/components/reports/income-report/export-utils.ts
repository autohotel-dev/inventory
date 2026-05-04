import { IncomeEntry, IncomeTotals } from "./types";
import { openIncomeReportPrintWindow } from "@/lib/utils/income-report-print";

interface ExportParams {
    entries: IncomeEntry[];
    totals: IncomeTotals;
    receptionistName: string;
    periodLabel: string;
    reportType: "shift" | "dateRange";
    shiftInfo?: any;
    startDate?: Date;
    endDate?: Date;
}

export const generatePaymentBreakdown = (entries: IncomeEntry[]) => {
    const paymentBreakdown: Record<string, number> = {};
    entries.forEach(entry => {
        if (entry.payments && entry.payments.length > 0) {
            entry.payments.forEach(p => {
                const key = p.payment_method === "TARJETA"
                    ? `TARJETA ${p.terminal_code || ""} ${p.card_type || ""}`.trim()
                    : p.payment_method;
                paymentBreakdown[key] = (paymentBreakdown[key] || 0) + p.amount;
            });
        } else if (entry.payment_method && entry.payment_method !== "PENDIENTE") {
            paymentBreakdown[entry.payment_method] = (paymentBreakdown[entry.payment_method] || 0) + entry.total;
        }
    });
    return paymentBreakdown;
};

export const handlePrintHtml = ({ entries, totals, receptionistName, periodLabel }: ExportParams) => {
    const paymentBreakdown = generatePaymentBreakdown(entries);

    const tableRows = entries.map((e, idx) => {
        let payDetail = "";
        if (e.payment_method === "MIXTO" && e.payments) {
            payDetail = e.payments.map(p =>
                `${p.payment_method}${p.payment_method === "TARJETA" ? ` (${p.terminal_code || "TPV"} ${p.card_type === "CREDITO" ? "CRÉD" : "DÉB"} ****${p.card_last_4 || ""})` : ""}: $${Number(p.amount).toFixed(2)}`
            ).join(" | ");
        } else if (e.payment_method === "TARJETA") {
            payDetail = `${e.terminal_code || "TPV"} ${e.card_type === "CREDITO" ? "CRÉD" : "DÉB"} ****${e.card_last_4 || ""}`;
        } else {
            payDetail = e.payment_method;
        }

        return `<tr style="${idx % 2 === 0 ? "" : "background:#f9fafb;"}">
            <td style="text-align:center;font-weight:600;">${e.no}</td>
            <td style="text-align:center;">${e.time}</td>
            <td style="text-align:center;text-transform:uppercase;font-size:10px;">${e.vehicle_plate || "—"}</td>
            <td style="text-align:center;font-weight:600;">${e.room_number}${e.stay_status === "CANCELADA" ? ' <span style="color:#dc2626;font-size:9px;">(CANC)</span>' : e.stay_status === "ACTIVA" ? ' <span style="color:#d97706;font-size:9px;">(ACT)</span>' : ""}</td>
            <td style="text-align:center;font-size:10px;color:#4b5563;">${e.checkout_valet_name || "—"}</td>
            <td style="text-align:right;font-family:monospace;">$${Number(e.room_price).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;">${e.extra > 0 ? "$" + Number(e.extra).toFixed(2) : "—"}</td>
            <td style="text-align:right;font-family:monospace;">${e.consumption > 0 ? "$" + Number(e.consumption).toFixed(2) : "—"}</td>
            <td style="text-align:right;font-weight:700;font-family:monospace;">$${Number(e.total).toFixed(2)}</td>
            <td style="text-align:center;font-size:10px;">${payDetail}</td>
        </tr>`;
    }).join("");

    const breakdownRows = Object.entries(paymentBreakdown).map(([method, amount]) =>
        `<tr><td style="padding:4px 12px;font-size:11px;border-bottom:1px solid #e5e7eb;">${method}</td><td style="padding:4px 12px;text-align:right;font-weight:600;font-family:monospace;border-bottom:1px solid #e5e7eb;">$${Number(amount).toFixed(2)}</td></tr>`
    ).join("");

    const printHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Corte de Caja — Luxor Auto Hotel</title>
<style>
    @page { size: portrait; margin: 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 11px; color: #111; background: #fff; }
    .header { text-align: center; border-bottom: 3px double #111; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 2px; }
    .header h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #444; margin-bottom: 8px; }
    .meta { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #111; color: #fff; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; border: 1px solid #111; }
    td { padding: 5px 8px; border: 1px solid #d1d5db; font-size: 11px; }
    .totals-row td { background: #f3f4f6; font-weight: 700; border-top: 2px solid #111; }
    .footer { display: flex; justify-content: space-between; margin-top: 20px; gap: 20px; }
    .footer-box { flex: 1; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; }
    .footer-box h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #666; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .signature { margin-top: 40px; display: flex; justify-content: space-around; }
    .sig-line { text-align: center; width: 200px; }
    .sig-line .line { border-top: 1px solid #111; margin-bottom: 4px; }
    .sig-line span { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
</style>
</head>
<body onload="setTimeout(()=>window.print(),300)">
<div class="header">
    <h1>Luxor Auto Hotel</h1>
    <h2>Corte de Caja</h2>
    <div class="meta">
        <span><b>Recepcionista:</b> ${receptionistName}</span>
        <span><b>Periodo:</b> ${periodLabel}</span>
        <span><b>Impreso:</b> ${new Date().toLocaleString("es-MX")}</span>
        <span><b>Registros:</b> ${entries.length}</span>
    </div>
</div>
<table>
    <thead>
        <tr>
            <th style="width:35px">No.</th>
            <th style="width:55px">Hora</th>
            <th style="width:80px">Placas</th>
            <th style="width:50px">Hab.</th>
            <th style="width:60px">Aprobó</th>
            <th style="width:75px">Precio</th>
            <th style="width:70px">Extra</th>
            <th style="width:75px">Consumo</th>
            <th style="width:80px">Total</th>
            <th>Forma de Pago</th>
        </tr>
    </thead>
    <tbody>
        ${tableRows}
        <tr class="totals-row">
            <td colspan="4" style="text-align:right;text-transform:uppercase;letter-spacing:2px;font-size:10px;">Suma Total</td>
            <td style="text-align:right;font-family:monospace;">$${Number(totals.roomPrice).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;">$${Number(totals.extra).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;">$${Number(totals.consumption).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace;font-size:13px;">$${Number(totals.total).toFixed(2)}</td>
            <td></td>
        </tr>
    </tbody>
</table>
<div class="footer">
    <div class="footer-box">
        <h4>Desglose por Método de Pago</h4>
        <table style="margin:0;"><tbody>${breakdownRows}</tbody></table>
    </div>
    <div class="footer-box">
        <h4>Resumen</h4>
        <table style="margin:0;"><tbody>
            <tr><td style="padding:4px 12px;font-size:11px;border-bottom:1px solid #e5e7eb;">Habitaciones</td><td style="padding:4px 12px;text-align:right;font-family:monospace;font-weight:600;border-bottom:1px solid #e5e7eb;">$${Number(totals.roomPrice).toFixed(2)}</td></tr>
            <tr><td style="padding:4px 12px;font-size:11px;border-bottom:1px solid #e5e7eb;">Extras</td><td style="padding:4px 12px;text-align:right;font-family:monospace;font-weight:600;border-bottom:1px solid #e5e7eb;">$${Number(totals.extra).toFixed(2)}</td></tr>
            <tr><td style="padding:4px 12px;font-size:11px;border-bottom:1px solid #e5e7eb;">Consumo</td><td style="padding:4px 12px;text-align:right;font-family:monospace;font-weight:600;border-bottom:1px solid #e5e7eb;">$${Number(totals.consumption).toFixed(2)}</td></tr>
            <tr><td style="padding:4px 12px;font-size:12px;font-weight:700;border-top:2px solid #111;">TOTAL</td><td style="padding:4px 12px;text-align:right;font-family:monospace;font-weight:700;font-size:14px;border-top:2px solid #111;">$${Number(totals.total).toFixed(2)}</td></tr>
        </tbody></table>
    </div>
</div>
<div class="signature">
    <div class="sig-line"><div class="line"></div><span>Recepcionista</span></div>
    <div class="sig-line"><div class="line"></div><span>Supervisor / Gerente</span></div>
</div>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
        printWindow.document.write(printHtml);
        printWindow.document.close();
    }
};

export const handleHpPrint = async ({ entries, receptionistName, shiftInfo, startDate, endDate }: ExportParams) => {
    const paymentBreakdown = generatePaymentBreakdown(entries);

    openIncomeReportPrintWindow({
        entries: entries.map(e => ({
            time: e.time,
            vehicle_plate: e.vehicle_plate,
            room_number: e.room_number,
            checkout_valet_name: e.checkout_valet_name,
            room_price: e.room_price,
            extra: e.extra,
            consumption: e.consumption,
            total: e.total,
            payment_method: e.payment_method,
        })),
        receptionistName,
        periodStart: shiftInfo?.shift_start || startDate?.toISOString() || new Date().toISOString(),
        periodEnd: shiftInfo?.shift_end || endDate?.toISOString() || new Date().toISOString(),
        paymentBreakdown,
    });
};

export const handleCsvExport = ({ entries, totals, receptionistName, periodLabel }: ExportParams) => {
    const lines: string[] = [];
    lines.push(`"CORTE DE CAJA — LUXOR AUTO HOTEL"`);
    lines.push(`"Recepcionista:","${receptionistName}","Periodo:","${periodLabel}","Exportado:","${new Date().toLocaleString("es-MX")}"`);
    lines.push("");

    lines.push(["No.", "Horario", "Placas", "Habitación", "Aprobó Salida", "Estado", "Precio Hab.", "Extras", "Consumo", "Total", "Forma Pago", "Detalle Pago"].map(h => `"${h}"`).join(","));

    entries.forEach(e => {
        let payDetail = "";
        if (e.payment_method === "MIXTO" && e.payments) {
            payDetail = e.payments.map(p =>
                `${p.payment_method}${p.payment_method === "TARJETA" ? ` (${p.terminal_code || "TPV"} ${p.card_type === "CREDITO" ? "CRÉD" : "DÉB"} ****${p.card_last_4 || ""})` : ""}: $${Number(p.amount).toFixed(2)}`
            ).join(" | ");
        } else if (e.payment_method === "TARJETA") {
            payDetail = `${e.terminal_code || "TPV"} ${e.card_type === "CREDITO" ? "CRÉD" : "DÉB"} ****${e.card_last_4 || ""}`;
        } else {
            payDetail = e.payment_method;
        }

        lines.push([
            e.no,
            e.time,
            e.vehicle_plate,
            e.room_number,
            e.checkout_valet_name || "—",
            e.stay_status || "",
            e.room_price.toFixed(2),
            e.extra.toFixed(2),
            e.consumption.toFixed(2),
            e.total.toFixed(2),
            e.payment_method,
            payDetail
        ].map(val => `"${val}"`).join(","));
    });

    lines.push("");
    lines.push(["", "", "", "", "", "TOTALES:", totals.roomPrice.toFixed(2), totals.extra.toFixed(2), totals.consumption.toFixed(2), totals.total.toFixed(2), "", ""].map(v => `"${v}"`).join(","));

    const paymentBreakdown = generatePaymentBreakdown(entries);
    lines.push("");
    lines.push(`"DESGLOSE POR MÉTODO DE PAGO"`);
    Object.entries(paymentBreakdown).forEach(([method, amount]) => {
        lines.push(`"${method}","$${Number(amount).toFixed(2)}"`);
    });

    const BOM = "\uFEFF";
    const csvContent = BOM + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `corte_caja_luxor_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
