/**
 * Guest Portal QR Modal
 * Displays QR code and URL for guest portal access
 */

'use client';

import { useEffect, useState } from 'react';
import { X, Copy, Check, Download, Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { generateGuestPortalQR, getGuestPortalURL } from '@/lib/utils/guest-portal-qr';

interface GuestPortalQRModalProps {
    isOpen: boolean;
    onClose: () => void;
    roomNumber: string;
    roomStayId: string;
}

export function GuestPortalQRModal({
    isOpen,
    onClose,
    roomNumber,
    roomStayId,
}: GuestPortalQRModalProps) {
    const [qrCodeDataURL, setQRCodeDataURL] = useState<string>('');
    const [portalURL, setPortalURL] = useState<string>('');
    const [isCopied, setIsCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && roomStayId) {
            loadGuestPortalData();
        }
    }, [isOpen, roomStayId]);

    async function loadGuestPortalData() {
        setIsLoading(true);
        setError(null);

        try {
            const supabase = createClient();
            const { data, error: fetchError } = await supabase
                .from('room_stays')
                .select('guest_access_token')
                .eq('id', roomStayId)
                .single();

            if (fetchError || !data || !data.guest_access_token) {
                throw new Error('No se pudo obtener el token de acceso');
            }

            const token = data.guest_access_token;
            const url = getGuestPortalURL(roomNumber, token);
            const qr = await generateGuestPortalQR(roomNumber, token);

            setPortalURL(url);
            setQRCodeDataURL(qr);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleCopyURL() {
        try {
            await navigator.clipboard.writeText(portalURL);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }

    function handleDownloadQR() {
        const link = document.createElement('a');
        link.download = `portal-habitacion-${roomNumber}.png`;
        link.href = qrCodeDataURL;
        link.click();
    }

    function handlePrintQR() {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
        <html>
          <head>
            <title>Portal Huésped - Habitación ${roomNumber}</title>
            <style>
              body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                font-family: system-ui, -apple-system, sans-serif;
                text-align: center;
                padding: 20px;
              }
              h1 { color: #1e293b; margin-bottom: 10px; }
              p { color: #64748b; margin-bottom: 30px; }
              img { max-width: 400px; border: 2px solid #e2e8f0; border-radius: 8px; }
              .footer { margin-top: 30px; font-size: 14px; color: #94a3b8; }
            </style>
          </head>
          <body>
            <h1>Portal de Huéspedes</h1>
            <p>Habitación ${roomNumber}</p>
            <img src="${qrCodeDataURL}" alt="QR Code" />
            <div class="footer">
              <p>Escanea este código para acceder al portal de huéspedes</p>
            </div>
          </body>
        </html>
      `);
            printWindow.document.close();
            printWindow.print();
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Portal de Huéspedes
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Habitación {roomNumber}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
                            ⚠️ {error}
                        </div>
                    ) : (
                        <>
                            {/* QR Code */}
                            <div className="flex justify-center mb-6">
                                <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-gray-200">
                                    <img
                                        src={qrCodeDataURL}
                                        alt="QR Code Portal Huésped"
                                        className="w-full max-w-xs"
                                    />
                                </div>
                            </div>

                            {/* URL */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    URL de Acceso
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={portalURL}
                                        readOnly
                                        className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white font-mono"
                                    />
                                    <button
                                        onClick={handleCopyURL}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        {isCopied ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                <span className="hidden sm:inline">Copiado</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                <span className="hidden sm:inline">Copiar</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={handleDownloadQR}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                                >
                                    <Download className="w-5 h-5" />
                                    <span>Descargar QR</span>
                                </button>
                                <button
                                    onClick={handlePrintQR}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                                >
                                    <Printer className="w-5 h-5" />
                                    <span>Imprimir</span>
                                </button>
                            </div>

                            {/* Info */}
                            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <p className="text-sm text-blue-900 dark:text-blue-300">
                                    <strong>💡 Tip:</strong> Comparte el QR code o la URL con el huésped para
                                    que pueda acceder al portal sin crear cuenta.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
