"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { type User } from "@supabase/supabase-js";
import {
    LogOut,
    User as UserIcon,
    Settings,
    CreditCard,
    LayoutDashboard
} from "lucide-react";
import { logAudit } from "@/lib/audit-logger";

export function UserNav() {
    const [user, setUser] = useState<User | null>(null);
    const [initials, setInitials] = useState("U");
    const { error: showError } = useToast();
    const router = useRouter();
    const supabase = createClient();

    // Fetch current user
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        fetchUser();
    }, [supabase]);

    // Calculate initials whenever user data changes
    useEffect(() => {
        if (!user) {
            setInitials("U");
            return;
        }

        const name = user.user_metadata?.full_name || user.email || "";
        if (!name) {
            setInitials("U");
            return;
        }

        const parts = name.split(" ").filter(Boolean);
        if (parts.length >= 2) {
            setInitials(`${parts[0][0]}${parts[1][0]}`.toUpperCase());
        } else {
            setInitials(name.slice(0, 2).toUpperCase());
        }
    }, [user]);

    const handleLogout = async () => {
        try {
            // FIX: Auto-cerrar turno si es cochero
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: employee } = await supabase
                    .from("employees")
                    .select("id, role")
                    .eq("auth_user_id", user.id)
                    .single();

                if (employee && employee.role === 'cochero') {
                    // Buscar sesión activa
                    const { data: session } = await supabase
                        .from("shift_sessions")
                        .select("id")
                        .eq("employee_id", employee.id)
                        .eq("status", "active")
                        .is("clock_out_at", null)
                        .maybeSingle();

                    if (session) {
                        // Cerrar sesión automáticamente
                        await supabase
                            .from("shift_sessions")
                            .update({
                                clock_out_at: new Date().toISOString(),
                                status: "closed"
                            })
                            .eq("id", session.id);

                        console.log("🚗 Turno de cochero cerrado automáticamente al salir.");
                    }
                }
            }

            logAudit("LOGOUT", { description: `Logout: ${user?.email}` });
            await supabase.auth.signOut();
            router.push("/auth/login");
        } catch (error) {
            console.error("Logout error", error);
            showError("Error", "No se pudo cerrar sesión");
        }
    };

    if (!user) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-offset-background transition-all hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <Avatar className="h-10 w-10 border-2 border-background shadow-md ring-2 ring-muted ring-offset-2">
                        <AvatarImage
                            src={user.user_metadata?.avatar_url}
                            alt={user.user_metadata?.full_name || "Usuario"}
                            className="object-cover"
                        />
                        <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-sm font-bold shadow-inner">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-0 overflow-hidden border-border/50 shadow-xl" align="end" forceMount>
                <div className="bg-gradient-to-b from-muted/50 to-background p-4 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border/50 shadow-sm">
                            <AvatarImage src={user.user_metadata?.avatar_url} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col space-y-0.5">
                            <p className="text-sm font-semibold leading-none text-foreground">
                                {user.user_metadata?.full_name || "Usuario"}
                            </p>
                            <p className="text-xs leading-none text-muted-foreground w-full truncate max-w-[150px]">
                                {user.email}
                            </p>
                            <span className="inline-flex w-fit items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary shadow-none hover:bg-primary/20 mt-1">
                                Pro
                            </span>
                        </div>
                    </div>
                </div>

                <DropdownMenuGroup className="p-2 space-y-1">
                    <DropdownMenuItem asChild className="group cursor-pointer rounded-md px-3 py-2.5 transition-all text-muted-foreground focus:text-foreground focus:bg-muted/50">
                        <Link href="/account" className="flex items-center w-full">
                            <UserIcon className="mr-3 h-4 w-4 transition-colors group-hover:text-blue-500" />
                            <span className="text-sm font-medium">Mi Perfil</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="group cursor-pointer rounded-md px-3 py-2.5 transition-all text-muted-foreground focus:text-foreground focus:bg-muted/50">
                        <Link href="/dashboard" className="flex items-center w-full">
                            <LayoutDashboard className="mr-3 h-4 w-4 transition-colors group-hover:text-indigo-500" />
                            <span className="text-sm font-medium">Dashboard</span>
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="group cursor-pointer rounded-md px-3 py-2.5 transition-all text-muted-foreground focus:text-foreground focus:bg-muted/50">
                        <Link href="/settings" className="flex items-center w-full">
                            <Settings className="mr-3 h-4 w-4 transition-colors group-hover:text-gray-500" />
                            <span className="text-sm font-medium">Configuración</span>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator className="my-0" />

                <div className="p-2">
                    <DropdownMenuItem onClick={handleLogout} className="group cursor-pointer rounded-md px-3 py-2.5 transition-all text-muted-foreground focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20">
                        <LogOut className="mr-3 h-4 w-4 transition-colors group-hover:text-red-500" />
                        <span className="text-sm font-medium">Cerrar Sesión</span>
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
