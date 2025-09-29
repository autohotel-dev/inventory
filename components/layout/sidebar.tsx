"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { useTheme } from "next-themes";
import { LogoutButton } from "@/components/logout-button";
// import { LanguageSwitcher } from "@/components/language-switcher"; // Temporarily disabled

function Icon({ name, className }: { name: string; className?: string }) {
  // Minimal inline icons to avoid adding deps
  const common = "w-4 h-4" + (className ? ` ${className}` : "");
  switch (name) {
    case "home":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9"/><path d="M9 21V9h6v12"/></svg>
      );
    case "box":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12l8.73-5.04"/></svg>
      );
    case "users":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      );
    case "truck":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M14 17h3l3-5h-3l-3 5Z"/><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/></svg>
      );
    case "building":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22h18"/><path d="M6 22V2h12v20"/><path d="M6 7h12"/><path d="M6 12h12"/><path d="M6 17h12"/></svg>
      );
    case "bag":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2l.34 2H18l.66-2"/><path d="M3 6h18l-1.5 14a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-1.8L3 6Z"/><path d="M8 10v-1a4 4 0 0 1 8 0v1"/></svg>
      );
    case "cart":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h8.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
      );
    case "arrows":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
      );
    case "activity":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      );
    case "chart":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
      );
    case "download":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      );
    default:
      return <span className={common}>•</span>;
  }
}

const links = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/products", label: "Productos", icon: "box" },
  { href: "/categories", label: "Categorías", icon: "arrows" },
  { href: "/warehouses", label: "Almacenes", icon: "building" },
  { href: "/suppliers", label: "Proveedores", icon: "truck" },
  { href: "/customers", label: "Clientes", icon: "users" },
  { divider: true },
  { href: "/movements", label: "Movimientos", icon: "activity" },
  { href: "/stock", label: "Stock", icon: "box" },
  { href: "/kardex", label: "Kardex", icon: "activity" },
  { divider: true },
  { href: "/analytics", label: "Analytics", icon: "chart" },
  { href: "/export", label: "Exportar", icon: "download" },
  { divider: true },
  { href: "/purchases-sales", label: "Dashboard Compras/Ventas", icon: "chart" },
  { href: "/purchases", label: "Compras", icon: "bag" },
  { href: "/sales", label: "Ventas", icon: "cart" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [compact, setCompact] = React.useState(false);
  const { theme, setTheme } = useTheme();

  React.useEffect(() => {
    // close on route change
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const stored = localStorage.getItem("sidebar-compact");
    if (stored) setCompact(stored === "1");
  }, []);

  const toggleCompact = () => {
    setCompact((v) => {
      const nv = !v;
      localStorage.setItem("sidebar-compact", nv ? "1" : "0");
      return nv;
    });
  };

  return (
    <>
      <div className="md:hidden sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="font-semibold text-lg">📦 Inventory</Link>
          <button
            type="button"
            aria-label="Toggle sidebar"
            onClick={() => setOpen((v) => !v)}
            className="border rounded px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            ☰ Menu
          </button>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {open && (
        <div className="fixed inset-0 bg-black/50 md:hidden z-30" onClick={() => setOpen(false)} />
      )}

      <aside className={`fixed md:static inset-y-0 left-0 z-40 md:w-auto transform md:transform-none bg-background md:bg-muted/20 border-r shadow-lg md:shadow-none ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`} style={{ width: compact ? 72 : 256, transition: "transform 200ms ease, width 200ms ease" }}>
        <div className="h-full p-3 md:p-4 space-y-4 overflow-auto">
          {/* Mobile header inside sidebar */}
          <div className="md:hidden px-1 pb-4 border-b">
            <Link href="/dashboard" className="font-semibold text-lg">📦 Inventory</Link>
          </div>
          
          <div className="px-1 flex items-center justify-between gap-2">
            <Link href="/dashboard" className={`hidden md:block font-semibold text-lg ${compact ? "truncate" : ""}`}>{compact ? "📦" : "📦 Inventory"}</Link>
            <div className="hidden md:flex items-center gap-2">
              {/* <LanguageSwitcher /> */}
              <button
                type="button"
                className="border rounded px-2 py-1 text-xs"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title="Toggle theme"
              >
{theme === "dark" ? "Claro" : "Oscuro"}
              </button>
              <button
                type="button"
                className="border rounded px-2 py-1 text-xs"
                onClick={toggleCompact}
                title="Toggle compact"
              >
{compact ? "Expandir" : "Compacto"}
              </button>
            </div>
          </div>
          <nav className="grid gap-1 text-sm">
            {links.map((l, idx) =>
              ("divider" in l) ? (
                <div key={`d-${idx}`} className="h-px bg-border my-2" />
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-muted transition-colors ${pathname === l.href ? "bg-muted font-medium border border-border" : ""}`}
                >
                  <Icon name={l.icon} />
                  {!compact && <span className="whitespace-nowrap">{l.label}</span>}
                </Link>
              )
            )}
          </nav>
          
          {/* Desktop logout section */}
          <div className="hidden md:flex flex-col gap-2 pt-2 border-t mt-auto">
            <div className="pt-2">
              <LogoutButton />
            </div>
          </div>
          
          <div className="md:hidden flex flex-col gap-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              {/* <LanguageSwitcher /> */}
              <button
                type="button"
                className="border rounded px-2 py-1 text-xs"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title="Toggle theme"
              >
{theme === "dark" ? "Claro" : "Oscuro"}
              </button>
              <button
                type="button"
                className="border rounded px-2 py-1 text-xs"
                onClick={toggleCompact}
                title="Toggle compact"
              >
{compact ? "Expandir" : "Compacto"}
              </button>
            </div>
            <div className="pt-2">
              <LogoutButton />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
