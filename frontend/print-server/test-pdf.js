const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');

const fonts = {
    Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
    }
};

try {
    const printer = new PdfPrinter(fonts);

    const docDefinition = {
        pageSize: 'LETTER',
        defaultStyle: { font: 'Helvetica', fontSize: 10 },
        content: [
            { text: 'LUXOR AUTO HOTEL', fontSize: 16, bold: true, alignment: 'center' },
            { text: 'INGRESOS DE HOSPEDAJE', fontSize: 12, bold: true, alignment: 'center', marginBottom: 10 },
            {
                table: {
                    headerRows: 1,
                    widths: [30, 50, 60, 30, 60, 50, 40, 50, 50, '*'],
                    body: [
                        [
                            { text: 'No.', bold: true, fillColor: '#1a1a2e', color: '#fff', fontSize: 8 },
                            { text: 'Hora', bold: true, fillColor: '#1a1a2e', color: '#fff', fontSize: 8 },
                            { text: 'Placas', bold: true, fillColor: '#1a1a2e', color: '#fff', fontSize: 8 },
                            { text: 'Hab.', bold: true, fillColor: '#1a1a2e', color: '#fff', fontSize: 8 },
                            { text: 'Aprobo', bold: true, fillColor: '#1a1a2e', color: '#fff', fontSize: 8 },
                            { text: 'Precio', bold: true, fillColor: '#1a1a2e', color: '#fff', fontSize: 8 },
                            { text: 'Extra', bold: true, fillColor: '#1a1a2e', color: '#fff', fontSize: 8 },
                            { text: 'Consumo', bold: true, fillColor: '#1a1a2e', color: '#fff', fontSize: 8 },
                            { text: 'Total', bold: true, fillColor: '#1a1a2e', color: '#fff', fontSize: 8 },
                            { text: 'F.Pago', bold: true, fillColor: '#1a1a2e', color: '#fff', fontSize: 8 },
                        ],
                        ['1', '21:19', 'SMJ 59 46', '136', '—', '$220.00', '—', '$220.00', '$220.00', 'EFECTIVO'],
                        ['2', '22:12', 'ECOSPORT', '121', '—', '$600.00', '—', '—', '$600.00', 'TARJETA BBVA'],
                    ],
                },
            },
        ],
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        console.log('PDF generated successfully! Size:', pdfBuffer.length, 'bytes');

        // Save to file for inspection
        const outFile = path.join(__dirname, 'test-output.pdf');
        fs.writeFileSync(outFile, pdfBuffer);
        console.log('Saved to:', outFile);
    });
    pdfDoc.on('error', (err) => {
        console.error('PDF ERROR:', err);
    });
    pdfDoc.end();
} catch (err) {
    console.error('CAUGHT ERROR:', err);
}
