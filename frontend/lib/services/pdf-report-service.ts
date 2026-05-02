"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ShiftReportData {
  shiftType: string;
  startTime: string;
  endTime: string;
  employeeName: string;
  totalRevenue: number;
  paymentBreakdown: { method: string; total: number; count: number }[];
  roomStats: { total: number; completed: number; cancelled: number };
  topProducts: { name: string; qty: number; revenue: number }[];
  expenses: { description: string; amount: number }[];
}

export function generateShiftPDF(data: ShiftReportData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // ── HEADER ──
  doc.setFillColor(24, 24, 27); // zinc-950
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("LUXOR MANAGER", 15, 18);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Reporte de Cierre de Turno", 15, 26);

  doc.setFontSize(9);
  doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 15, 33);

  // Shift badge (right side)
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Turno: ${data.shiftType}`, pageWidth - 15, 18, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.startTime} — ${data.endTime}`, pageWidth - 15, 26, { align: "right" });
  doc.text(`Responsable: ${data.employeeName}`, pageWidth - 15, 33, { align: "right" });

  y = 50;
  doc.setTextColor(0, 0, 0);

  // ── REVENUE SUMMARY ──
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(15, y, pageWidth - 30, 22, 3, 3, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("INGRESO TOTAL DEL TURNO", 20, y + 8);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(`$${data.totalRevenue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, 20, y + 18);

  // Room stats (right side of box)
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Estancias: ${data.roomStats.total}`, pageWidth - 70, y + 8);
  doc.text(`Completadas: ${data.roomStats.completed}`, pageWidth - 70, y + 14);
  doc.text(`Canceladas: ${data.roomStats.cancelled}`, pageWidth - 70, y + 20);
  y += 30;

  // ── PAYMENT BREAKDOWN ──
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Desglose por Método de Pago", 15, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 15 },
    head: [["Método", "Transacciones", "Total"]],
    body: data.paymentBreakdown.map((p) => [
      p.method,
      p.count.toString(),
      `$${p.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
    ]),
    theme: "grid",
    headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── TOP PRODUCTS ──
  if (data.topProducts.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Productos Más Vendidos", 15, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: 15, right: 15 },
      head: [["Producto", "Cantidad", "Ingreso"]],
      body: data.topProducts.slice(0, 10).map((p) => [
        p.name,
        p.qty.toString(),
        `$${p.revenue.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      ]),
      theme: "grid",
      headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── EXPENSES ──
  if (data.expenses.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Gastos del Turno", 15, y);
    y += 3;

    const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0);

    autoTable(doc, {
      startY: y,
      margin: { left: 15, right: 15 },
      head: [["Descripción", "Monto"]],
      body: [
        ...data.expenses.map((e) => [
          e.description,
          `$${e.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
        ]),
        ["TOTAL GASTOS", `$${totalExpenses.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`],
      ],
      theme: "grid",
      headStyles: { fillColor: [153, 27, 27], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── FOOTER ──
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text("Auto Hotel Luxor — Sistema de Gestión", 15, footerY);
  doc.text(`Página 1 de 1 · ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}`, pageWidth - 15, footerY, { align: "right" });

  return doc;
}

export function downloadShiftPDF(data: ShiftReportData) {
  const doc = generateShiftPDF(data);
  const filename = `reporte-turno-${data.shiftType.toLowerCase()}-${format(new Date(), "yyyy-MM-dd-HHmm")}.pdf`;
  doc.save(filename);
}

export function previewShiftPDF(data: ShiftReportData): string {
  const doc = generateShiftPDF(data);
  return doc.output("datauristring");
}
