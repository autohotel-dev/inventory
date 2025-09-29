"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useTheme } from "next-themes";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/client";
// import { LanguageSwitcher } from "@/components/language-switcher"; // Temporarily disabled

function Icon({ name, className }: { name: string; className?: string }) {
  // Minimal inline icons to avoid adding deps
  const common = className || "w-4 h-4";
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
    case "sun":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      );
    case "moon":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      );
    case "expand":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
      );
    case "compress":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
      );
    case "logout":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
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
  { href: "/sales", label: "Ventas", icon: "cart" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [compact, setCompact] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
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
          
          {/* Logo section */}
          <div className="px-1 hidden md:block">
            <Link href="/dashboard" className={`font-semibold text-lg block ${compact ? "text-center" : ""}`}>
              {compact ? "📦" : "📦 Inventory"}
            </Link>
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
            {/* Compact toggle button */}
            <button
              type="button"
              className={`border rounded ${compact ? 'p-1.5 flex items-center justify-center' : 'px-2 py-1 flex items-center gap-1'} text-xs w-full`}
              onClick={toggleCompact}
              title="Toggle compact"
            >
              {compact ? (
                <div className="w-4 h-4 flex items-center justify-center">
                  <Icon name="expand" className="w-3 h-3" />
                </div>
              ) : (
                <>
                  <Icon name="compress" className="w-3 h-3" />
                  Compacto
                </>
              )}
            </button>
            {/* Theme button */}
            <button
              type="button"
              className={`border rounded ${compact ? 'p-1.5 flex items-center justify-center' : 'px-2 py-1 flex items-center gap-1'} text-xs w-full`}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme"
            >
              {mounted ? (
                compact ? (
                  <div className="w-4 h-4 flex items-center justify-center">
                    <Icon name={theme === "dark" ? "sun" : "moon"} className="w-3 h-3" />
                  </div>
                ) : (
                  <>
                    <Icon name={theme === "dark" ? "sun" : "moon"} className="w-3 h-3" />
                    {theme === "dark" ? "Claro" : "Oscuro"}
                  </>
                )
              ) : (
                compact ? (
                  <div className="w-4 h-4 flex items-center justify-center">
                    <Icon name="sun" className="w-3 h-3" />
                  </div>
                ) : (
                  "Tema"
                )
              )}
            </button>
            {/* Logout button */}
            {compact ? (
              <button
                type="button"
                className="border rounded p-1.5 flex items-center justify-center text-xs w-full hover:bg-red-50 hover:border-red-200 transition-colors"
                onClick={handleLogout}
                title="Cerrar sesión"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <Icon name="logout" className="w-3 h-3 text-red-500" />
                </div>
              </button>
            ) : (
              <LogoutButton />
            )}
          </div>
          
          <div className="md:hidden flex flex-col gap-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="border rounded px-2 py-1 text-xs flex items-center gap-1"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title="Toggle theme"
              >
                {mounted ? (
                  <>
                    <Icon name={theme === "dark" ? "sun" : "moon"} />
                    {theme === "dark" ? "Claro" : "Oscuro"}
                  </>
                ) : (
                  <>
                    <Icon name="sun" />
                    Tema
                  </>
                )}
              </button>
              <div className="flex-1">
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
