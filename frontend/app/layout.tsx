import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { ConditionalLayout } from "@/components/layout/conditional-layout";
import { ToastProvider } from "@/components/providers/toast-provider";
import { DataDebug } from "@/components/debug/data-debug";
import { PWAInstaller, PWAStatus } from "@/components/pwa/pwa-installer";
import { TrainingProvider } from "@/contexts/training-context";
import { InteractiveOverlay } from "@/components/training/interactive-overlay";
import { ChatProvider } from "@/contexts/chat-context";
import { ChatWidget } from "@/components/chat/chat-widget";
import { AuthListener } from "@/components/auth/auth-listener";
import { PrintCenterProvider } from "@/contexts/print-center-context";
import { PrintCenterModal } from "@/components/print-center/print-center-modal";

// Detectar URL base con fallbacks para diferentes entornos
const getBaseUrl = () => {
  try {
    if (process.env.VERCEL_URL && process.env.VERCEL_URL !== 'undefined') {
      return `https://${process.env.VERCEL_URL}`;
    }
    if (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL !== 'undefined') {
      const url = process.env.NEXT_PUBLIC_SITE_URL;
      return url.startsWith('http') ? url : `https://${url}`;
    }
  } catch (e) {
    console.error("Error parsing base URL", e);
  }
  return 'http://localhost:3000';
};
const defaultUrl = getBaseUrl();

let metadataBaseUrl: URL | undefined;
try {
  metadataBaseUrl = new URL(defaultUrl);
} catch (e) {
  console.warn("Could not create metadataBase URL, falling back to localhost", e);
  metadataBaseUrl = new URL('http://localhost:3000');
}

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl,
  title: "AHLM",
  description: "Sistema completo de gestión para Auto Hotel Luxor - Inventario, Ventas y Turnos",
  keywords: ["hotel", "autohotel", "luxor", "gestión", "pms", "inventario", "turnos"],
  authors: [{ name: "Ricardo Minor" }],
  creator: "Ricardo Minor",
  publisher: "Auto Hotel Luxor",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AHLM',
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "AHLM",
    "application-name": "AHLM",
    "msapplication-TileColor": "#2563eb",
    "msapplication-config": "/browserconfig.xml"
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192.png',
    apple: [
      { url: '/icons/icon-192.png' },
    ],
  }
};

export function generateViewport(): Viewport {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    themeColor: [
      { media: "(prefers-color-scheme: dark)", color: "#09090b" },
      { media: "(prefers-color-scheme: light)", color: "#ffffff" }
    ]
  };
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

import QueryProvider from "@/providers/query-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <TrainingProvider>
              <PrintCenterProvider>
                <ChatProvider>
                  <ConditionalLayout>
                    {children}
                  </ConditionalLayout>
                  <InteractiveOverlay />
                  <ChatWidget />
                  <ToastProvider />
                  <AuthListener />
                  <PWAInstaller />
                  <PWAStatus />
                  <DataDebug />
                  <PrintCenterModal />
                </ChatProvider>
              </PrintCenterProvider>
            </TrainingProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
