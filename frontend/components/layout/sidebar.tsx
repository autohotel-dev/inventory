"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { getMenuPermissions, getAllMenuResources, getMenuGroups, type UserRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  Home,
  Building,
  Activity,
  ClipboardList,
  Settings,
  Package,
  ArrowRightLeft,
  Truck,
  Users,
  BarChart3,
  ShoppingCart,
  Briefcase,
  FileText,
  Download,
  GraduationCap,
  Bell,
  Image as ImageIcon,
  Sun,
  Moon,
  Maximize,
  Minimize,
  LogOut,
  LucideIcon,
  Utensils
} from "lucide-react";

// Constants
const SIDEBAR_WIDTHS = { COMPACT: 80, EXPANDED: 260 } as const;

// Navigation link types
type NavItem = 
  | { href: string; label: string; icon: LucideIcon; permissionId: string; adminOnly?: boolean; allowedForNonAdmin?: boolean; allowedForReceptionist?: boolean }
  | { section: string; adminOnly?: boolean; allowedForNonAdmin?: boolean; allowedForReceptionist?: boolean };

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
// Icon lookup — maps iconName strings from the permissions registry to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  Home, Building, Activity, ClipboardList, Settings, Package,
  ArrowRightLeft, Truck, Users, BarChart3, ShoppingCart, Briefcase,
  FileText, Download, GraduationCap, Bell, Image: ImageIcon, Utensils,
};

/**
 * Build sidebar nav items DYNAMICALLY from the permissions registry.
 * This is the key to zero dual-maintenance: add a module in permissions.ts
 * and the sidebar picks it up automatically.
 */
function buildSidebarNavItems(): readonly NavItem[] {
  const allItems = getAllMenuResources();
  const groups = getMenuGroups();
  const result: NavItem[] = [];
  let lastGroup = "";

  // Sort items by group order
  const sortedItems = [...allItems].sort((a, b) => {
    const gA = groups[a.group]?.order ?? 99;
    const gB = groups[b.group]?.order ?? 99;
    return gA - gB;
  });

  for (const item of sortedItems) {
    // Insert section header when group changes
    if (item.group !== lastGroup) {
      const groupMeta = groups[item.group];
      if (groupMeta) {
        result.push({
          section: groupMeta.label,
          adminOnly: groupMeta.adminOnly,
          allowedForNonAdmin: groupMeta.allowedForNonAdmin,
          allowedForReceptionist: groupMeta.allowedForReceptionist,
        });
      }
      lastGroup = item.group;
    }

    const icon = ICON_MAP[item.iconName] || Activity;
    result.push({
      href: item.href,
      label: item.label,
      icon,
      permissionId: item.id,
      adminOnly: item.adminOnly,
      allowedForNonAdmin: item.allowedForNonAdmin,
      allowedForReceptionist: item.allowedForReceptionist,
    });
  }

  return result;
}

// Build once at module level — no runtime cost per render
const adminLinks: readonly NavItem[] = buildSidebarNavItems();

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
        <span className="block w-5 h-0.5 bg-current mb-1.5 rounded-full" />
        <span className="block w-5 h-0.5 bg-current mb-1.5 rounded-full" />
        <span className="block w-5 h-0.5 bg-current rounded-full" />
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

    const isItemAllowed = (item: NavItem): boolean => {
      if ("section" in item) return false; // Handled below
      if (allowedMenuIds.has(item.permissionId)) return true;
      if (allowedMenuIds.size === 0) {
        if (isReceptionist && "allowedForReceptionist" in item && item.allowedForReceptionist) return true;
        if ("allowedForNonAdmin" in item && item.allowedForNonAdmin) return true;
      }
      return false;
    };

    return adminLinks.filter((item, index, array) => {
      if ("href" in item) {
        if (!isItemAllowed(item)) return false;
        if (isReceptionist && !hasActiveShift && (
          item.href === "/sales/pos" || item.href === "/sales" || item.href === "/sales/new"
        )) return false;
        return true;
      }
      if ("section" in item) {
        // Only show section if at least one item under it is visible
        for (let i = index + 1; i < array.length; i++) {
          const next = array[i];
          if ("section" in next) break;
          if (isItemAllowed(next)) {
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
            <Link href="/dashboard" className="font-semibold text-lg flex items-center gap-2">
               <div className="relative w-6 h-6 shrink-0">
                  <Image src="/luxor-logo.png" alt="Luxor Logo" fill className="object-contain" />
               </div>
               Luxor Manager
            </Link>
          </div>
        </div>
        <aside
          className="fixed md:static inset-y-0 left-0 z-40 md:w-auto transform md:transform-none bg-background border-r border-white/5 -translate-x-full md:translate-x-0"
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
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm md:hidden z-40 transition-opacity duration-300" 
          onClick={() => setOpen(false)} 
        />
      )}

      <aside
        id="tour-sidebar"
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 md:w-auto transform md:transform-none transition-all duration-300 ease-in-out",
          "bg-background/80 backdrop-blur-2xl border-r border-border/40",
          "shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)] md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ width: compact ? SIDEBAR_WIDTHS.COMPACT : SIDEBAR_WIDTHS.EXPANDED }}
      >
        <div className="h-full flex flex-col overflow-hidden relative">
          
          {/* Logo Section */}
          <div className={cn(
            "shrink-0 transition-all duration-300 ease-in-out border-b border-border/40",
            compact ? "px-4 py-5" : "px-6 py-6"
          )}>
            <Link href="/dashboard" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
              <div className={cn(
                "flex items-center transition-all duration-300",
                compact ? "justify-center" : "gap-3.5"
              )}>
                <div className="relative w-9 h-9 shrink-0 drop-shadow-sm">
                  <Image src="/luxor-logo.png" alt="Luxor Logo" fill className="object-contain" priority />
                </div>
                {!compact && (
                  <span className="font-bold text-xl tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Luxor
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-5" role="navigation" aria-label="Main navigation">
            <div className="flex flex-col gap-1">
              {visibleLinks.map((item: NavItem, idx: number) => {
                if ("section" in item) {
                  return compact ? (
                    <div key={`section-${idx}`} className="my-3 mx-auto w-8 h-px bg-border/50 rounded-full" role="separator" />
                  ) : (
                    <div key={`section-${idx}`} className={cn("px-4 pt-5 pb-2 text-[10px] font-bold tracking-wider text-muted-foreground/50 uppercase", idx === 0 && "pt-0")}>
                      {item.section}
                    </div>
                  );
                }

                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3.5 rounded-xl font-medium transition-all duration-300 relative",
                      compact ? "p-3 justify-center mb-1" : "px-4 py-2.5 mb-0.5",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {/* Active Indicator Line */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                    )}
                    
                    {/* Icon */}
                    <item.icon
                      strokeWidth={isActive ? 2.5 : 2}
                      className={cn(
                        "shrink-0 transition-all duration-300",
                        compact ? "w-5 h-5" : "w-4 h-4",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground/70 group-hover:text-foreground group-hover:scale-110"
                      )}
                    />
                    
                    {/* Label */}
                    {!compact && (
                      <span className={cn("truncate text-[13px]", isActive ? "font-semibold" : "font-medium")}>
                        {item.label}
                      </span>
                    )}

                    {/* CSS Tooltip for Compact Mode */}
                    {compact && (
                      <div className="absolute left-full ml-4 px-3 py-1.5 bg-popover text-popover-foreground text-xs font-semibold rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg border border-border whitespace-nowrap pointer-events-none">
                        {item.label}
                        <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-popover border-l border-b border-border rotate-45" />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer controls */}
          <div className="shrink-0 border-t border-border/40 p-4 flex flex-col gap-1.5 bg-background/50 backdrop-blur-md">
            <button
              type="button"
              onClick={toggleCompact}
              className={cn(
                "w-full group flex items-center rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-all duration-300 relative",
                compact ? "p-3 justify-center" : "px-4 py-2.5 gap-3.5"
              )}
              title="Alternar ancho del menú"
            >
              {compact ? <Maximize className="w-5 h-5 text-muted-foreground/70 group-hover:text-foreground group-hover:scale-110 transition-all" /> : <Minimize className="w-4 h-4 text-muted-foreground/70 group-hover:text-foreground" />}
              {!compact && <span>Contraer</span>}
              {compact && (
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-popover text-popover-foreground text-xs font-semibold rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg border border-border whitespace-nowrap pointer-events-none">
                  Expandir
                  <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-popover border-l border-b border-border rotate-45" />
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={cn(
                "w-full group flex items-center rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-all duration-300 relative",
                compact ? "p-3 justify-center" : "px-4 py-2.5 gap-3.5"
              )}
              title="Cambiar tema"
            >
              {mounted && theme === "dark" ? (
                <Sun className={cn("transition-all text-muted-foreground/70 group-hover:text-foreground", compact ? "w-5 h-5 group-hover:scale-110" : "w-4 h-4")} />
              ) : (
                <Moon className={cn("transition-all text-muted-foreground/70 group-hover:text-foreground", compact ? "w-5 h-5 group-hover:scale-110" : "w-4 h-4")} />
              )}
              {!compact && <span>{mounted && theme === "dark" ? "Modo Claro" : "Modo Oscuro"}</span>}
              {compact && (
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-popover text-popover-foreground text-xs font-semibold rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg border border-border whitespace-nowrap pointer-events-none">
                  Cambiar Tema
                  <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-popover border-l border-b border-border rotate-45" />
                </div>
              )}
            </button>

            <div className="h-px bg-border/40 my-1.5 mx-2" />

            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                "w-full group flex items-center rounded-xl text-[13px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-300 relative",
                compact ? "p-3 justify-center" : "px-4 py-2.5 gap-3.5"
              )}
              title="Cerrar sesión"
            >
              <LogOut className={cn("transition-all text-muted-foreground/70 group-hover:text-destructive", compact ? "w-5 h-5 group-hover:scale-110" : "w-4 h-4")} />
              {!compact && <span>Cerrar Sesión</span>}
              {compact && (
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-popover text-popover-foreground text-xs font-semibold rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg border border-border whitespace-nowrap pointer-events-none">
                  Cerrar Sesión
                  <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-popover border-l border-b border-border rotate-45" />
                </div>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
