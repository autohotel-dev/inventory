"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { getMenuPermissions, type UserRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// Constants
const SIDEBAR_WIDTHS = { COMPACT: 72, EXPANDED: 256 } as const;

// Optimized Icon component with memoization
const Icon = React.memo(({ name, className }: { name: string; className?: string }) => {
  const common = className || "w-4 h-4";
  const iconMap = {
    home: "M3 12l9-9 9 9M9 21V9h6v12",
    box: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96L12 12l8.73-5.04",
    users: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 7a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    truck: "M10 17h4V5H2v12h3M14 17h3l3-5h-3l-3 5ZM5.5 17.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5ZM18.5 17.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z",
    building: "M3 22h18M6 22V2h12v20M6 7h12M6 12h12M6 17h12",
    bag: "M6 2l.34 2H18l.66-2M3 6h18l-1.5 14a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-1.8L3 6ZM8 10v-1a4 4 0 0 1 8 0v1",
    cart: "M9 21a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM20 21a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h8.72a2 2 0 0 0 2-1.61L23 6H6",
    arrows: "M7 13l5 5 5-5M7 6l5 5 5-5",
    activity: "M22 12h-4l-3 9L9 3l-3 9H2",
    chart: "M3 3v18h18M18.7 8l-5.1 5.2-2.8-2.7L7 14.3",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    sun: "M12 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10ZM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
    moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
    expand: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7",
    compress: "M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    fileText: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
    graduation: "M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5",
    bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
    image: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M14 19a2 2 0 0 1-2 2 2 2 0 0 1-2-2M3 6h18v7H3zM12 3v6",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
  };

  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={iconMap[name as keyof typeof iconMap] || "M12 12h.01"} />
    </svg>
  );
});
Icon.displayName = "Icon";

// Navigation link type
type NavLink = { href: string; label: string; icon: string; permissionId: string; adminOnly?: boolean; allowedForNonAdmin?: boolean; allowedForReceptionist?: boolean } | { divider: true; adminOnly?: boolean };

// Hook para cargar permisos de menú desde DB para roles no-admin
function useMenuPermissions(role: UserRole | null): { allowedMenuIds: Set<string>; isLoading: boolean } {
  const [allowedMenuIds, setAllowedMenuIds] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!role || role === 'admin' || role === 'manager' || role === 'supervisor') {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    async function fetchPerms() {
      try {
        const perms = await getMenuPermissions(role as UserRole);
        if (!cancelled) setAllowedMenuIds(new Set(perms));
      } catch (err) {
        console.error('Error fetching menu permissions:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchPerms();
    return () => { cancelled = true; };
  }, [role]);

  return { allowedMenuIds, isLoading };
}

// Links para administradores/managers - ORGANIZADOS POR MÓDULOS
const adminLinks: readonly NavLink[] = [
  // 🏠 OPERACIONES PRINCIPALES
  { href: "/dashboard", label: "Dashboard", icon: "home", permissionId: "dashboard", allowedForNonAdmin: true, allowedForReceptionist: true },
  { href: "/sales/pos", label: "Habitaciones (POS)", icon: "building", permissionId: "sales.pos", allowedForNonAdmin: true, allowedForReceptionist: true },
  { divider: true },
  
  // 🏨 GESTIÓN HOTELERA
  { href: "/room-types", label: "Tipos de Habitación", icon: "settings", permissionId: "room-types", adminOnly: true },
  { href: "/sensors", label: "Sensores (Tuya)", icon: "activity", permissionId: "sensors", adminOnly: true },
  { divider: true, adminOnly: true },
  
  // 📦 INVENTARIO Y COMPRAS
  { href: "/products", label: "Productos", icon: "box", permissionId: "products", adminOnly: true },
  { href: "/categories", label: "Categorías", icon: "arrows", permissionId: "categories", adminOnly: true },
  { href: "/warehouses", label: "Almacenes", icon: "building", permissionId: "warehouses", adminOnly: true },
  { href: "/suppliers", label: "Proveedores", icon: "truck", permissionId: "suppliers", adminOnly: true },
  { href: "/customers", label: "Clientes", icon: "users", permissionId: "customers", adminOnly: true },
  { divider: true, adminOnly: true },
  
  // Compras y Ventas
  { href: "/purchases-sales", label: "Dashboard Compras/Ventas", icon: "chart", permissionId: "purchases-sales", adminOnly: true },
  { href: "/purchases", label: "Compras", icon: "cart", permissionId: "purchases", adminOnly: true },
  { href: "/sales", label: "Ventas", icon: "cart", permissionId: "sales", adminOnly: true },
  { divider: true, adminOnly: true },
  
  // Control de Inventario
  { href: "/movements", label: "Movimientos", icon: "activity", permissionId: "movements", adminOnly: true },
  { href: "/stock", label: "Stock", icon: "box", permissionId: "stock", adminOnly: true },
  { href: "/kardex", label: "Kardex", icon: "activity", permissionId: "kardex", adminOnly: true },
  { divider: true, adminOnly: true },
  
  // 💰 FINANZAS Y REPORTES
  { href: "/reports/income", label: "Pre-Cortes de Caja", icon: "fileText", permissionId: "reports.income", allowedForReceptionist: true },
  { href: "/employees/closings", label: "Cortes de Caja (Cierre)", icon: "bag", permissionId: "employees.closings", allowedForReceptionist: true },
  { divider: true },
  
  { href: "/analytics", label: "Analytics", icon: "chart", permissionId: "analytics", adminOnly: true },
  { href: "/analytics/performance", label: "Rendimiento y Tiempos", icon: "activity", permissionId: "analytics.performance", adminOnly: true },
  { href: "/export", label: "Exportar", icon: "download", permissionId: "export", adminOnly: true },
  { href: "/auditoria", label: "Auditoría", icon: "activity", permissionId: "auditoria", adminOnly: true },
  { divider: true, adminOnly: true },
  
  // 👥 RECURSOS HUMANOS
  { href: "/employees", label: "Empleados", icon: "users", permissionId: "employees", adminOnly: true },
  { href: "/employees/schedules", label: "Horarios", icon: "activity", permissionId: "employees.schedules", adminOnly: true },
  { href: "/training", label: "Capacitación", icon: "graduation", permissionId: "training", allowedForReceptionist: true },
  { divider: true, adminOnly: true },
  
  // ⚙️ CONFIGURACIÓN Y SISTEMA
  { href: "/settings", label: "Configuración", icon: "settings", permissionId: "settings", adminOnly: true },
  { href: "/settings/roles", label: "Gestión de Roles", icon: "users", permissionId: "settings.roles", adminOnly: true },
  { href: "/settings/permissions", label: "Permisos de Roles", icon: "settings", permissionId: "settings.permissions", adminOnly: true },
  { href: "/settings/media", label: "Biblioteca de Medios", icon: "image", permissionId: "settings.media", adminOnly: true },
  { href: "/notifications-admin", label: "Notificaciones", icon: "bell", permissionId: "notifications-admin", adminOnly: true },
  { href: "/staff-notifications", label: "Comunicados Staff", icon: "bell", permissionId: "staff-notifications", adminOnly: true },
] as const;

const MobileHeader = React.memo(({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) => (
  <div className="md:hidden sticky top-0 z-30 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
    <div className="flex items-center justify-between px-4 py-3">
      <Link href="/dashboard" className="font-semibold text-lg flex items-center gap-2.5">
        <div className="relative w-7 h-7">
          <Image src="/luxor-logo.png" alt="Luxor Logo" fill className="object-contain" />
        </div>
        <span className="text-foreground/90">Luxor</span>
      </Link>
      <button
        type="button"
        aria-label="Toggle sidebar"
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-sm hover:bg-white/[0.06] transition-colors text-muted-foreground"
      >
        ☰
      </button>
    </div>
  </div>
));
MobileHeader.displayName = "MobileHeader";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [compact, setCompact] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const { canAccessAdmin, isLoading: roleLoading, isReceptionist, hasActiveShift, role } = useUserRole();
  const { allowedMenuIds, isLoading: permsLoading } = useMenuPermissions(role);

  const visibleLinks = React.useMemo(() => {
    if (roleLoading || permsLoading) return [];
    if (canAccessAdmin) return adminLinks;

    const isLinkAllowed = (link: NavLink): boolean => {
      if ("divider" in link) return false;
      if (allowedMenuIds.has(link.permissionId)) return true;
      if (allowedMenuIds.size === 0) {
        if (isReceptionist && "allowedForReceptionist" in link && link.allowedForReceptionist) return true;
        if ("allowedForNonAdmin" in link && link.allowedForNonAdmin) return true;
      }
      return false;
    };

    return adminLinks.filter((link, index, array) => {
      if (!("divider" in link)) {
        if (!isLinkAllowed(link)) return false;
        if (isReceptionist && !hasActiveShift && (
          link.href === "/sales/pos" || link.href === "/sales" || link.href === "/sales/new"
        )) return false;
        return true;
      }
      if ("divider" in link) {
        for (let i = index + 1; i < array.length; i++) {
          const next = array[i];
          if ("divider" in next) break;
          if (isLinkAllowed(next)) {
            if (isReceptionist && !hasActiveShift && "href" in next && (
              next.href === "/sales/pos" || next.href === "/sales" || next.href === "/sales/new"
            )) continue;
            return true;
          }
        }
        return false;
      }
      return false;
    });
  }, [canAccessAdmin, roleLoading, permsLoading, isReceptionist, hasActiveShift, allowedMenuIds]);

  React.useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("sidebar-compact");
    if (stored) setCompact(stored === "1");
  }, []);

  React.useEffect(() => { setOpen(false); }, [pathname]);

  const toggleCompact = React.useCallback(() => {
    setCompact(prev => {
      const newValue = !prev;
      localStorage.setItem("sidebar-compact", newValue ? "1" : "0");
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("sidebar-compact-change"));
      }, 0);
      return newValue;
    });
  }, []);

  const handleLogout = React.useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }, [router]);

  if (!mounted) {
    return (
      <>
        <div className="md:hidden sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/dashboard" className="font-semibold text-lg">🏨 Luxor Manager</Link>
          </div>
        </div>
        <aside
          className="fixed md:static inset-y-0 left-0 z-40 md:w-auto transform md:transform-none bg-background border-r -translate-x-full md:translate-x-0"
          style={{ width: SIDEBAR_WIDTHS.EXPANDED }}
        >
          <div className="h-full p-4 space-y-4 overflow-auto scrollbar-hide" />
        </aside>
      </>
    );
  }

  return (
    <>
      <MobileHeader open={open} setOpen={setOpen} />

      {/* Backdrop for mobile */}
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm md:hidden z-40" onClick={() => setOpen(false)} />
      )}

      <aside
        id="tour-sidebar"
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 md:w-auto transform md:transform-none transition-all duration-300 ease-out",
          "bg-background/95 md:bg-background/60 backdrop-blur-xl border-r border-white/[0.06]",
          "shadow-2xl md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ width: compact ? SIDEBAR_WIDTHS.COMPACT : SIDEBAR_WIDTHS.EXPANDED }}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Logo */}
          <div className={cn(
            "shrink-0 border-b border-white/[0.06]",
            compact ? "px-3 py-4" : "px-5 py-5"
          )}>
            <Link href="/dashboard" className="block">
              <div className={cn(
                "flex items-center",
                compact ? "justify-center" : "gap-3"
              )}>
                <div className="relative w-8 h-8 shrink-0">
                  <Image src="/luxor-logo.png" alt="Luxor Logo" fill className="object-contain" />
                </div>
                {!compact && (
                  <span className="font-bold text-lg tracking-tight text-foreground/90">
                    Luxor
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-3" role="navigation" aria-label="Main navigation">
            <div className="space-y-0.5">
              {visibleLinks.map((link: NavLink, idx: number) =>
                ("divider" in link) ? (
                  <div key={`divider-${idx}`} className="my-3 h-px bg-white/[0.05] mx-2" role="separator" />
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={compact ? link.label : undefined}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 relative",
                      compact ? "p-2.5 justify-center" : "px-3 py-2",
                      pathname === link.href
                        ? "bg-white/[0.08] text-foreground"
                        : "text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.04]"
                    )}
                    aria-current={pathname === link.href ? "page" : undefined}
                  >
                    {/* Active indicator bar */}
                    {pathname === link.href && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-foreground/60" />
                    )}
                    <Icon
                      name={link.icon}
                      className={cn(
                        "w-4 h-4 shrink-0 transition-colors duration-200",
                        pathname === link.href
                          ? "text-foreground"
                          : "text-muted-foreground/50 group-hover:text-foreground/70"
                      )}
                    />
                    {!compact && <span className="truncate">{link.label}</span>}
                  </Link>
                )
              )}
            </div>
          </nav>

          {/* Footer controls */}
          <div className="shrink-0 border-t border-white/[0.06] p-3 space-y-1">
            <button
              type="button"
              onClick={toggleCompact}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-lg text-xs font-medium text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.04] transition-all duration-200",
                compact ? "p-2.5 justify-center" : "px-3 py-2"
              )}
              title="Toggle sidebar"
            >
              <Icon name={compact ? "expand" : "compress"} className="w-3.5 h-3.5" />
              {!compact && <span>Compacto</span>}
            </button>

            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-lg text-xs font-medium text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.04] transition-all duration-200",
                compact ? "p-2.5 justify-center" : "px-3 py-2"
              )}
              title="Toggle theme"
            >
              <Icon name={mounted ? (theme === "dark" ? "sun" : "moon") : "sun"} className="w-3.5 h-3.5" />
              {!compact && <span>{mounted && theme === "dark" ? "Cambiar a claro" : "Cambiar a oscuro"}</span>}
            </button>

            <div className="h-px bg-white/[0.04] my-1" />

            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-lg text-xs font-medium text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-200",
                compact ? "p-2.5 justify-center" : "px-3 py-2"
              )}
              title="Cerrar sesión"
            >
              <Icon name="logout" className="w-3.5 h-3.5" />
              {!compact && <span>Cerrar Sesión</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
