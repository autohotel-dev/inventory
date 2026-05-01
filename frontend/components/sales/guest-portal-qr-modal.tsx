/**
 * Guest Portal QR Modal
 * Displays QR code and URL for guest portal access
 */

'use client';

import { useEffect, useState } from 'react';
import { X, Copy, Check, Download, Printer } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { generateGuestPortalQR, getGuestPortalURL } from '@/lib/utils/guest-portal-qr';
import { useThermalPrinter } from '@/hooks/use-thermal-printer';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";
import { Button } from "@/components/ui/button";

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
    const { printQRTicket } = useThermalPrinter();

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

            if (fetchError) throw fetchError;

            let token = data?.guest_access_token;

            // Si no hay token, generarlo y guardarlo (Self-healing for old records)
            if (!token) {
                token = crypto.randomUUID();
                const { error: updateError } = await supabase
                    .from('room_stays')
                    .update({ guest_access_token: token })
                    .eq('id', roomStayId);

                if (updateError) throw updateError;
            }

            const url = getGuestPortalURL(roomNumber, token);
            const qr = await generateGuestPortalQR(roomNumber, token);

            setPortalURL(url);
            setQRCodeDataURL(qr);
        } catch (err) {
            console.error("Error loading guest portal:", err);
            setError(err instanceof Error ? err.message : 'Error desconocido al cargar el portal');
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

    async function handlePrintQR() {
        try {
            await printQRTicket({
                roomNumber,
                url: portalURL,
            });
        } catch (error) {
            console.error("Failed to print:", error);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">
                        Portal de Huéspedes
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Habitación {roomNumber}
                    </p>
                </DialogHeader>

                {/* Content */}
                <div className="py-2">
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
                                    <Image
                                        src={qrCodeDataURL}
                                        alt="QR Code Portal Huésped"
                                        width={320}
                                        height={320}
                                        className="w-full max-w-xs"
                                        unoptimized
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
            </DialogContent>
        </Dialog>
    );
}

