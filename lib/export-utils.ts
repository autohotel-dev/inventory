import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Tipos para los datos de exportación
export interface ExportColumn {
    header: string;
    key: string;
    width?: number;
}

export interface ExportOptions {
    filename: string;
    sheetName?: string;
    title?: string;
    columns: ExportColumn[];
    data: any[];
}

/**
 * Exportar datos a archivo Excel (.xlsx)
 */
export function exportToExcel(options: ExportOptions): void {
    const { filename, sheetName = 'Datos', columns, data } = options;

    // Crear datos con headers
    const headers = columns.map(col => col.header);
    const rows = data.map(row =>
        columns.map(col => row[col.key] ?? '')
    );

    // Crear worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Ajustar anchos de columnas
    const colWidths = columns.map(col => ({
        wch: col.width || 15
    }));
    ws['!cols'] = colWidths;

    // Crear workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Descargar archivo
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Exportar datos a archivo CSV
 */
export function exportToCSV(options: ExportOptions): void {
    const { filename, columns, data } = options;

    // Crear headers
    const headers = columns.map(col => col.header).join(',');

    // Crear filas
    const rows = data.map(row =>
        columns.map(col => {
            const value = row[col.key] ?? '';
            // Escapar comillas y agregar comillas si contiene coma
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(',')
    );

    // Combinar todo
    const csv = [headers, ...rows].join('\n');

    // Crear blob y descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Exportar datos a archivo PDF
 */
export function exportToPDF(options: ExportOptions): void {
    const { filename, title, columns, data } = options;

    // Crear documento PDF
    const doc = new jsPDF();

    // Agregar título si existe
    if (title) {
        doc.setFontSize(16);
        doc.text(title, 14, 15);
    }

    // Preparar datos para la tabla
    const headers = columns.map(col => col.header);
    const rows = data.map(row =>
        columns.map(col => String(row[col.key] ?? ''))
    );

    // Crear tabla
    autoTable(doc, {
        head: [headers],
        body: rows,
        startY: title ? 25 : 10,
        theme: 'grid',
        headStyles: {
            fillColor: [37, 99, 235], // Primary color
            textColor: 255,
            fontStyle: 'bold'
        },
        styles: {
            fontSize: 9,
            cellPadding: 3
        },
        columnStyles: columns.reduce((acc, col, index) => {
            if (col.width) {
                acc[index] = { cellWidth: col.width };
            }
            return acc;
        }, {} as any)
    });

    // Agregar footer con fecha
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
            `Página ${i} de ${pageCount} - Generado el ${new Date().toLocaleDateString('es-ES')}`,
            14,
            doc.internal.pageSize.height - 10
        );
    }

    // Descargar archivo
    doc.save(`${filename}.pdf`);
}

/**
 * Formatear número como moneda
 */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(value);
}

/**
 * Formatear fecha
 */
export function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Formatear fecha y hora
 */
export function formatDateTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}
