"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import { printHTML } from '@/lib/utils/print-helper';
import type { ClosingTicketData } from '@/lib/services/thermal-printer-service';

interface UsePrintClosingReturn {
    isPrinting: boolean;
    printClosing: (data: ClosingTicketData) => Promise<boolean>;
    error: string | null;
}

export function usePrintClosing(): UsePrintClosingReturn {
    const [isPrinting, setIsPrinting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const printClosing = async (data: ClosingTicketData): Promise<boolean> => {
        setIsPrinting(true);
        setError(null);

        try {
            // Generate HTML for ticket
            const ticketHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Corte de Caja - ${data.employeeName}</title>
                    <style>
                        @page {
                            size: 80mm auto;
                            margin: 0;
                        }
                        
                        body {
                            font-family: system-ui, -apple-system, sans-serif;
                            font-size: 12px;
                            margin: 0;
                            padding: 10px 0;
                            width: 80mm;
                            max-width: 100%;
                        }
                        
                        .center { text-align: center; }
                        .bold { font-weight: bold; }
                        .large { font-size: 16px; }
                        .divider { border-top: 1px dashed #000; margin: 8px 0; }
                        .line { display: flex; justify-content: space-between; margin: 2px 0; }
                        .separator { 
                            border-top: 2px solid #000; 
                            border-bottom: 2px solid #000;
                            text-align: center;
                            padding: 4px 0;
                            margin: 8px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="center bold large">CORTE DE CAJA</div>
                    <div class="center bold">AutoHotel Luxor</div>
                    <div class="separator">================================</div>
                    
                    <div class="line">
                        <span>Empleado:</span>
                        <span class="bold">${data.employeeName}</span>
                    </div>
                    <div class="line">
                        <span>Turno:</span>
                        <span class="bold">${data.shiftName}</span>
                    </div>
                    <div class="line">
                        <span>Inicio:</span>
                        <span>${new Date(data.periodStart).toLocaleString('es-MX')}</span>
                    </div>
                    <div class="line">
                        <span>Fin:</span>
                        <span>${new Date(data.periodEnd).toLocaleString('es-MX')}</span>
                    </div>
                    
                    <div class="divider"></div>
                    
                    <div class="center bold">RESUMEN DE PAGOS</div>
                    <div class="divider"></div>
                    
                    <div class="line">
                        <span>Efectivo:</span>
                        <span class="bold">$${data.totalCash.toFixed(2)}</span>
                    </div>
                    <div class="line">
                        <span>Tarjeta BBVA:</span>
                        <span class="bold">$${data.totalCardBBVA.toFixed(2)}</span>
                    </div>
                    <div class="line">
                        <span>Tarjeta GETNET:</span>
                        <span class="bold">$${data.totalCardGetnet.toFixed(2)}</span>
                    </div>
                    
                    <div class="separator">================================</div>
                    <div class="line large bold">
                        <span>TOTAL:</span>
                        <span>$${data.totalSales.toFixed(2)}</span>
                    </div>
                    <div class="separator">================================</div>
                    
                    <div class="center bold">EFECTIVO</div>
                    <div class="divider"></div>
                    
                    <div class="line">
                        <span>Esperado:</span>
                        <span>$${data.totalCash.toFixed(2)}</span>
                    </div>
                    <div class="line">
                        <span>Contado:</span>
                        <span>$${data.countedCash.toFixed(2)}</span>
                    </div>
                    <div class="line">
                        <span>Diferencia:</span>
                        <span>${data.cashDifference >= 0 ? '+' : ''}$${data.cashDifference.toFixed(2)}</span>
                    </div>
                    
                    <div class="separator">================================</div>
                    
                    <div class="line">
                        <span># Transacciones:</span>
                        <span class="bold">${data.totalTransactions}</span>
                    </div>
                    
                    <div class="separator">================================</div>
                    
                    ${data.transactions && data.transactions.length > 0 ? `
                    <div class="center bold" style="margin-top: 8px;">DETALLE DE TRANSACCIONES</div>
                    <div class="divider"></div>
                    
                    ${(() => {
                        // Group transactions by payment method
                        const cashTx = data.transactions.filter(t => t.paymentMethod === 'EFECTIVO');
                        const bbvaTx = data.transactions.filter(t =>
                            t.paymentMethod === 'TARJETA_BBVA' ||
                            (t.paymentMethod === 'TARJETA' && t.terminalCode === 'BBVA')
                        );
                        const getnetTx = data.transactions.filter(t =>
                            t.paymentMethod === 'TARJETA_GETNET' ||
                            (t.paymentMethod === 'TARJETA' && t.terminalCode === 'GETNET')
                        );

                        let html = '';

                        // Cash transactions
                        if (cashTx.length > 0) {
                            html += `
                            <div class="bold" style="margin-top: 8px;">EFECTIVO (${cashTx.length})</div>
                            ${cashTx.map((tx, idx) => `
                                <div style="margin: 4px 0 8px 0; padding-left: 4px; border-left: 2px solid #000;">
                                    <div class="line">
                                        <span>${idx + 1}. ${tx.time}</span>
                                        <span class="bold">$${tx.amount.toFixed(2)}</span>
                                    </div>
                                    ${tx.reference ? `<div style="font-size: 10px; padding-left: 8px;">Ref: ${tx.reference}</div>` : ''}
                                    ${tx.items && tx.items.length > 0 ? tx.items.map(item => `
                                        <div style="font-size: 10px; padding-left: 8px;">
                                            ${item.qty}x ${item.name}
                                        </div>
                                        <div style="font-size: 9px; padding-left: 16px; color: #444;">
                                            $${item.unitPrice.toFixed(2)} c/u = $${item.total.toFixed(2)}
                                        </div>
                                    `).join('') : ''}
                                    ${tx.concept && (!tx.items || tx.items.length === 0) ? `<div style="font-size: 10px; padding-left: 8px;">${tx.concept}</div>` : ''}
                                </div>
                            `).join('')}
                            `;
                        }

                        // BBVA transactions
                        if (bbvaTx.length > 0) {
                            html += `
                            <div class="bold" style="margin-top: 8px;">TARJETA BBVA (${bbvaTx.length})</div>
                            ${bbvaTx.map((tx, idx) => `
                                <div style="margin: 4px 0 8px 0; padding-left: 4px; border-left: 2px solid #000;">
                                    <div class="line">
                                        <span>${idx + 1}. ${tx.time}</span>
                                        <span class="bold">$${tx.amount.toFixed(2)}</span>
                                    </div>
                                    ${tx.reference ? `<div style="font-size: 10px; padding-left: 8px;">Ref: ${tx.reference}</div>` : ''}
                                    ${tx.items && tx.items.length > 0 ? tx.items.map(item => `
                                        <div style="font-size: 10px; padding-left: 8px;">
                                            ${item.qty}x ${item.name}
                                        </div>
                                        <div style="font-size: 9px; padding-left: 16px; color: #444;">
                                            $${item.unitPrice.toFixed(2)} c/u = $${item.total.toFixed(2)}
                                        </div>
                                    `).join('') : ''}
                                    ${tx.concept && (!tx.items || tx.items.length === 0) ? `<div style="font-size: 10px; padding-left: 8px;">${tx.concept}</div>` : ''}
                                </div>
                            `).join('')}
                            `;
                        }

                        // GETNET transactions
                        if (getnetTx.length > 0) {
                            html += `
                            <div class="bold" style="margin-top: 8px;">TARJETA GETNET (${getnetTx.length})</div>
                            ${getnetTx.map((tx, idx) => `
                                <div style="margin: 4px 0 8px 0; padding-left: 4px; border-left: 2px solid #000;">
                                    <div class="line">
                                        <span>${idx + 1}. ${tx.time}</span>
                                        <span class="bold">$${tx.amount.toFixed(2)}</span>
                                    </div>
                                    ${tx.reference ? `<div style="font-size: 10px; padding-left: 8px;">Ref: ${tx.reference}</div>` : ''}
                                    ${tx.items && tx.items.length > 0 ? tx.items.map(item => `
                                        <div style="font-size: 10px; padding-left: 8px;">
                                            ${item.qty}x ${item.name}
                                        </div>
                                        <div style="font-size: 9px; padding-left: 16px; color: #444;">
                                            $${item.unitPrice.toFixed(2)} c/u = $${item.total.toFixed(2)}
                                        </div>
                                    `).join('') : ''}
                                    ${tx.concept && (!tx.items || tx.items.length === 0) ? `<div style="font-size: 10px; padding-left: 8px;">${tx.concept}</div>` : ''}
                                </div>
                            `).join('')}
                            `;
                        }

                        return html;
                    })()}
                    
                    <div class="separator">================================</div>
                    ` : ''}
                    
                    ${data.notes ? `
                    <div class="bold" style="margin-top: 8px;">NOTAS:</div>
                    <div style="margin: 4px 0;">${data.notes}</div>
                    <div class="separator">================================</div>
                    ` : ''}
                    
                    <div class="center" style="margin-top: 16px;">
                        <div>Gracias por su preferencia</div>
                        <div style="font-size: 10px; margin-top: 8px;">
                            ${new Date().toLocaleString('es-MX')}
                        </div>
                    </div>
                </body>
                </html>
            `;

            const success = await printHTML(ticketHTML);

            if (success) {
                toast.success('Imprimiendo ticket de corte');
            }
            return success;

        } catch (err) {
            console.error('Print error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido al imprimir';
            setError(errorMessage);

            toast.error('Error al imprimir', {
                description: errorMessage,
                duration: 5000
            });

            return false;
        } finally {
            setIsPrinting(false);
        }
    };

    return {
        isPrinting,
        printClosing,
        error
    };
}
