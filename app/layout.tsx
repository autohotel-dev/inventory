import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { ConditionalLayout } from "@/components/layout/conditional-layout";
import { AuthDebug } from "@/components/auth/auth-debug";
import { ToastProvider } from "@/components/providers/toast-provider";
import { DataDebug } from "@/components/debug/data-debug";
import { PWAInstaller, PWAStatus } from "@/components/pwa/pwa-installer";

const defaultUrl = String(process.env.NEXT_PUBLIC_SITE_URL);

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Sistema de Inventario Profesional",
  description: "Sistema completo de gestión de inventario con analytics avanzados, movimientos en tiempo real y exportación de datos",
  keywords: ["inventario", "gestión", "stock", "almacén", "productos", "analytics"],
  authors: [{ name: "Sistema de Inventario Pro" }],
  creator: "Sistema de Inventario Pro",
  publisher: "Sistema de Inventario Pro",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: "/api/manifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Inventario Pro",
    startupImage: [
      {
        url: "/icons/icon-512x512.svg",
        media: "(device-width: 768px) and (device-height: 1024px)"
      }
    ]
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Inventario Pro",
    "application-name": "Inventario Pro",
    "msapplication-TileColor": "#2563eb",
    "msapplication-config": "/browserconfig.xml"
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
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: "#000000" }
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
          <ToastProvider />
          <PWAInstaller />
          <PWAStatus />
          <AuthDebug />
          <DataDebug />
        </ThemeProvider>
      </body>
    </html>
  );
}
