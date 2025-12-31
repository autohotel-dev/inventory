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

// Detectar URL base con fallbacks para diferentes entornos
const getBaseUrl = () => {
  // Vercel automáticamente provee VERCEL_URL en producción
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Variable de entorno personalizada
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  // Fallback para desarrollo local
  return 'http://localhost:3000';
};

const defaultUrl = getBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Auto Hotel Luxor Manager",
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
    title: 'Luxor Manager',
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Luxor Manager",
    "application-name": "Luxor Manager",
    "msapplication-TileColor": "#2563eb",
    "msapplication-config": "/browserconfig.xml"
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TrainingProvider>
            <ChatProvider>
              <ConditionalLayout>
                {children}
              </ConditionalLayout>
              <InteractiveOverlay />
              <ChatWidget />
              <ToastProvider />
              <PWAInstaller />
              <PWAStatus />
              <DataDebug />
            </ChatProvider>
          </TrainingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
