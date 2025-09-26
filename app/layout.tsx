import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Next.js and Supabase Starter Kit",
  description: "The fastest way to build apps with Next.js and Supabase",
};

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
          <header className="border-b">
            <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
              <a className="font-semibold mr-4" href="/">Inventory</a>
              <a className="hover:underline" href="/products">Products</a>
              <a className="hover:underline" href="/categories">Categories</a>
              <a className="hover:underline" href="/warehouses">Warehouses</a>
              <a className="hover:underline" href="/suppliers">Suppliers</a>
              <a className="hover:underline" href="/customers">Customers</a>
              <span className="mx-2 text-muted-foreground">|</span>
              <a className="hover:underline" href="/movements">Movements</a>
              <a className="hover:underline" href="/stock">Stock</a>
              <a className="hover:underline" href="/kardex">Kardex</a>
              <span className="mx-2 text-muted-foreground">|</span>
              <a className="hover:underline" href="/purchases">Purchases</a>
              <a className="hover:underline" href="/sales">Sales</a>
            </nav>
          </header>
          <main className="max-w-7xl mx-auto px-4 py-6">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
