"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useTheme } from "next-themes";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";

// Constants
const SIDEBAR_WIDTHS = { COMPACT: 72, EXPANDED: 256 } as const;
const BREAKPOINTS = { sm: "640px", md: "768px", lg: "1024px" } as const;

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

// Responsive utility hook
function useResponsiveClasses(compact: boolean) {
  return React.useMemo(() => ({
    container: compact ? "justify-center" : "flex-col items-center justify-center",
    button: compact ? 'p-2 flex items-center justify-center' : 'px-2 py-2 flex w-full items-center justify-center gap-1',
    navItem: compact ? "" : "whitespace-nowrap"
  }), [compact]);
}

// Navigation link type
type NavLink = { href: string; label: string; icon: string; adminOnly?: boolean; allowedForNonAdmin?: boolean; allowedForReceptionist?: boolean } | { divider: true; adminOnly?: boolean };

// Links para administradores/managers
const adminLinks: readonly NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home", allowedForNonAdmin: true, allowedForReceptionist: true },
  { href: "/products", label: "Productos", icon: "box", adminOnly: true },
  { href: "/categories", label: "Categorías", icon: "arrows", adminOnly: true },
  { href: "/warehouses", label: "Almacenes", icon: "building", adminOnly: true },
  { href: "/suppliers", label: "Proveedores", icon: "truck", adminOnly: true },
  { href: "/customers", label: "Clientes", icon: "users", adminOnly: true },
  { href: "/notifications-admin", label: "Notificaciones", icon: "bell", adminOnly: true },
  { divider: true, adminOnly: true },
  { href: "/movements", label: "Movimientos", icon: "activity", adminOnly: true },
  { href: "/stock", label: "Stock", icon: "box", adminOnly: true },
  { href: "/kardex", label: "Kardex", icon: "activity", adminOnly: true },
  { divider: true, adminOnly: true },
  { href: "/analytics", label: "Analytics", icon: "chart", adminOnly: true },
  { href: "/export", label: "Exportar", icon: "download", adminOnly: true },
  { divider: true, adminOnly: true },
  { href: "/purchases-sales", label: "Dashboard Compras/Ventas", icon: "chart", adminOnly: true },
  { href: "/purchases", label: "Compras", icon: "cart", adminOnly: true },
  { href: "/sales", label: "Ventas", icon: "cart", adminOnly: true },
  { href: "/sales/pos", label: "Habitaciones (POS)", icon: "building", allowedForNonAdmin: true, allowedForReceptionist: true },
  { href: "/sensors", label: "Sensores (Tuya)", icon: "activity", adminOnly: true },
  { divider: true, adminOnly: true },
  { href: "/employees", label: "Empleados", icon: "users", adminOnly: true },
  { href: "/employees/schedules", label: "Horarios", icon: "activity", adminOnly: true },
  { href: "/employees/closings", label: "Cortes de Caja", icon: "bag", allowedForReceptionist: true },
  { divider: true },
  { href: "/reports/income", label: "Reporte de Ingresos", icon: "fileText", allowedForReceptionist: true },
  { divider: true },
  { href: "/training", label: "Capacitación", icon: "graduation", allowedForReceptionist: true },
  { href: "/settings", label: "Configuración", icon: "settings", adminOnly: true },
  { href: "/settings/roles", label: "Gestión de Roles", icon: "users", adminOnly: true },
  { href: "/settings/media", label: "Biblioteca de Medios", icon: "image", adminOnly: true },
  { href: "/settings/permissions", label: "Permisos de Roles", icon: "settings", adminOnly: true },
] as const;

// Reusable components
const SidebarButton = React.memo(({
  compact,
  icon,
  children,
  onClick,
  className = "",
  title
}: {
  compact: boolean;
  icon?: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  title?: string;
}) => {
  const classes = useResponsiveClasses(compact);
  return (
    <button
      type="button"
      className={`border rounded ${classes.button} text-xs w-full ${className}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {icon && <Icon name={icon} className="w-3 h-3" />}
      {!compact && <span>{children}</span>}
    </button>
  );
});
SidebarButton.displayName = "SidebarButton";

const ThemeToggle = React.memo(({
  theme,
  setTheme,
  mounted,
  compact
}: {
  theme?: string | null;
  setTheme: (theme: string) => void;
  mounted: boolean;
  compact: boolean;
}) => {
  const classes = useResponsiveClasses(compact);
  return (
    <SidebarButton
      compact={compact}
      icon={mounted ? (theme === "dark" ? "sun" : "moon") : "sun"}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title="Toggle theme"
      className="hover:bg-accent hover:border-accent"
    >
      {mounted && !compact ? (theme === "dark" ? "Cambiar a claro" : "Cambiar a oscuro") : "Tema"}
    </SidebarButton>
  );
});
ThemeToggle.displayName = "ThemeToggle";

const LogoutSection = React.memo(({
  compact,
  handleLogout
}: {
  compact: boolean;
  handleLogout: () => void;
}) => {
  const classes = useResponsiveClasses(compact);
  return (
    <div className={classes.container}>
      <SidebarButton
        compact={compact}
        icon="logout"
        onClick={handleLogout}
        title="Cerrar sesión"
        className="hover:bg-destructive/10 hover:border-destructive"
      >
        {!compact && "Cerrar Sesión"}
      </SidebarButton>
    </div>
  );
});
LogoutSection.displayName = "LogoutSection";

const CompactToggle = React.memo(({
  compact,
  toggleCompact
}: {
  compact: boolean;
  toggleCompact: () => void;
}) => {
  const classes = useResponsiveClasses(compact);
  return (
    <SidebarButton
      compact={compact}
      icon={compact ? "expand" : "compress"}
      onClick={toggleCompact}
      title="Toggle compact"
    >
      {!compact && "Compacto"}
    </SidebarButton>
  );
});
CompactToggle.displayName = "CompactToggle";

const MobileHeader = React.memo(({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) => (
  <div className="md:hidden sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm">
    <div className="flex items-center justify-between px-4 py-3">
      <Link href="/dashboard" className="font-semibold text-lg">🏨 Luxor Manager</Link>
      <button
        type="button"
        aria-label="Toggle sidebar"
        onClick={() => setOpen(!open)}
        className="border rounded px-3 py-2 text-sm hover:bg-muted transition-colors"
      >
        ☰ Menu
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
  const classes = useResponsiveClasses(compact);
  const { canAccessAdmin, isLoading: roleLoading, isReceptionist } = useUserRole();

  // Filtrar links según el rol del usuario
  const visibleLinks = React.useMemo(() => {
    if (roleLoading) return [];

    // Si es admin o manager, mostrar todos los links
    if (canAccessAdmin) {
      return adminLinks;
    }

    // Si es recepcionista, mostrar items con allowedForReceptionist: true
    if (isReceptionist) {
      return adminLinks.filter((link, index, array) => {
        if ("allowedForReceptionist" in link && link.allowedForReceptionist) {
          return true;
        }
        // Mostrar divisores solo si no están marcados como adminOnly
        // Y evitar doble divisor o divisor al final
        if ("divider" in link && !link.adminOnly) {
          const nextLink = array[index + 1];
          // Solo mostrar si el siguiente elemento es un link visible
          if (nextLink && !("divider" in nextLink) &&
            ((nextLink as any).allowedForReceptionist)) {
            return true;
          }
        }
        return false;
      });
    }

    // Para otros usuarios no-admin (cochero, camarista, mant), filtrar agresivamente
    const filtered = adminLinks.filter(link => {
      if ("allowedForNonAdmin" in link && link.allowedForNonAdmin) {
        return true;
      }
      return false;
    });

    // Agregar divisores manualmente solo si es necesario (ej: separar grupos grandes)
    // Para roles restringidos que ven muy pocos items, mejor retornar sin divisores o con lógica simple
    return filtered;
  }, [canAccessAdmin, roleLoading, isReceptionist]);

  React.useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("sidebar-compact");
    if (stored) setCompact(stored === "1");
  }, []);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const toggleCompact = React.useCallback(() => {
    setCompact(prev => {
      const newValue = !prev;
      localStorage.setItem("sidebar-compact", newValue ? "1" : "0");
      // Disparar evento después del render para evitar warning de React
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

  // Evitar hydration mismatch - no renderizar hasta que esté montado
  if (!mounted) {
    return (
      <>
        <div className="md:hidden sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/dashboard" className="font-semibold text-lg">🏨 Luxor Manager</Link>
            <button
              type="button"
              aria-label="Toggle sidebar"
              className="border rounded px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              ☰ Menu
            </button>
          </div>
        </div>
        <aside
          className="fixed md:static inset-y-0 left-0 z-40 md:w-auto transform md:transform-none bg-background md:bg-muted/20 border-r shadow-lg md:shadow-none -translate-x-full md:translate-x-0"
          style={{ width: SIDEBAR_WIDTHS.EXPANDED }}
        >
          <div className="h-full p-3 md:p-4 space-y-4 overflow-auto scrollbar-hide">
            <div className="px-1 hidden md:block">
              <Link href="/dashboard" className="font-semibold text-lg block">🏨 Luxor Manager</Link>
            </div>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      <MobileHeader open={open} setOpen={setOpen} />

      {/* Backdrop for mobile */}
      {open && (
        <div className="fixed inset-0 bg-black/50 md:hidden z-30" onClick={() => setOpen(false)} />
      )}

      <aside
        id="tour-sidebar"
        className={`fixed md:static inset-y-0 left-0 z-40 md:w-auto transform md:transform-none bg-background md:bg-muted/20 border-r shadow-lg md:shadow-none transition-all duration-200 ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        style={{ width: compact ? SIDEBAR_WIDTHS.COMPACT : SIDEBAR_WIDTHS.EXPANDED }}
      >
        <div className="h-full p-3 md:p-4 space-y-4 overflow-auto scrollbar-hide">
          {/* Mobile header inside sidebar */}
          <div className="md:hidden px-1 pb-4 border-b">
            <Link href="/dashboard" className="font-semibold text-lg flex items-center gap-2">
              <div className="relative w-8 h-8">
                <img src="/luxor-logo.png" alt="Luxor Logo" className="object-contain w-full h-full" />
              </div>
              Luxor Manager
            </Link>
          </div>

          {/* Logo section */}
          <div className="px-1 hidden md:block">
            <Link href="/dashboard" className="block text-center py-2">
              <div className="relative w-full h-12 mx-auto flex justify-center items-center">
                <img src="/luxor-logo.png" alt="Luxor Logo" className="object-contain h-full w-auto" />
              </div>
            </Link>
          </div>

          <nav className="grid gap-1 text-sm" role="navigation" aria-label="Main navigation">
            {visibleLinks.map((link: NavLink, idx: number) =>
              ("divider" in link) ? (
                <div key={`divider-${idx}`} className="h-px bg-border my-2" role="separator" />
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-muted transition-colors ${pathname === link.href ? "bg-muted font-medium border border-border" : ""}`}
                  aria-current={pathname === link.href ? "page" : undefined}
                >
                  <Icon name={link.icon} />
                  {!compact && <span className={classes.navItem}>{link.label}</span>}
                </Link>
              )
            )}
          </nav>

          {/* Desktop controls */}
          <div className="hidden md:flex flex-col gap-2 pt-4 border-t">
            <div className={classes.container}>
              <CompactToggle compact={compact} toggleCompact={toggleCompact} />
            </div>

            <div className={`${classes.container} border-t pb-1`}>
              <ThemeToggle theme={theme} setTheme={setTheme} mounted={mounted} compact={compact} />
            </div>

            <div className={`${classes.container} mt-auto border-t pt-3`}>
              <LogoutSection compact={compact} handleLogout={handleLogout} />
            </div>
          </div>

          {/* Mobile controls */}
          <div className="md:hidden flex flex-col gap-2 pt-4 border-t">
            <div className={classes.container}>
              <CompactToggle compact={compact} toggleCompact={toggleCompact} />
            </div>

            <div className={`${classes.container} border-t pb-1`}>
              <ThemeToggle theme={theme} setTheme={setTheme} mounted={mounted} compact={compact} />
            </div>

            <div className={`${classes.container} mt-auto border-t pt-3`}>
              <LogoutSection compact={compact} handleLogout={handleLogout} />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
