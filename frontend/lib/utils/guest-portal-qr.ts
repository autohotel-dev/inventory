/**
 * QR Code Generator for Guest Portal
 * Generates QR codes with secure access tokens
 */

import QRCode from 'qrcode';

/**
 * Generate QR code data URL for guest portal access
 */
export async function generateGuestPortalQR(
    roomNumber: string,
    token: string
): Promise<string> {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const url = `${baseUrl}/guest-portal/${roomNumber}?token=${token}`;

    try {
        const qrDataURL = await QRCode.toDataURL(url, {
            width: 400,
            margin: 2,
            color: {
                dark: '#1e293b', // Dark blue-gray
                light: '#ffffff',
            },
            errorCorrectionLevel: 'H', // High error correction
        });

        return qrDataURL;
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw new Error('Failed to generate QR code');
    }
}

/**
 * Get guest portal URL with token
 */
export function getGuestPortalURL(roomNumber: string, token: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    return `${baseUrl}/guest-portal/${roomNumber}?token=${token}`;
}
