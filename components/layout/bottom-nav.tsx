"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BedDouble, ShoppingCart, GraduationCap, Menu, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

import { useUserRole } from "@/hooks/use-user-role";

export function BottomNav() {
    const pathname = usePathname();
    const { isValet, isHousekeeping, isMaintenance } = useUserRole();

    const isRestrictedRole = isValet || isHousekeeping || isMaintenance;

    const allLinks = [
        {
            href: "/dashboard",
            label: "Inicio",
            icon: LayoutDashboard,
            active: pathname === "/dashboard",
        },
        {
            href: "/sales/pos",
            label: "Habitaciones",
            icon: BedDouble,
            active: pathname === "/sales/pos",
        },
        {
            href: "/sales",
            label: "Ventas",
            icon: ShoppingCart,
            active: pathname === "/sales",
        },
        {
            href: "/training",
            label: "Academia",
            icon: GraduationCap,
            active: pathname.startsWith("/training"),
        },
    ];

    const links = isRestrictedRole
        ? allLinks.filter(link => ["/dashboard", "/sales/pos"].includes(link.href))
        : allLinks;

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t h-16 pb-safe">
            <nav className={`grid ${isRestrictedRole ? 'grid-cols-2' : 'grid-cols-4'} h-full`}>
                {links.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                            "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors hover:bg-muted/50",
                            link.active ? "text-primary" : "text-muted-foreground"
                        )}
                    >
                        <link.icon className={cn("h-6 w-6", link.active && "fill-current/20")} />
                        <span>{link.label}</span>
                    </Link>
                ))}
            </nav>
        </div>
    );
}
