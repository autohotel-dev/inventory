"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { User as UserIcon, Mail, Camera } from "lucide-react";

export function AccountForm() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [fullName, setFullName] = useState("");
    const [initials, setInitials] = useState("U");
    const { success, error: showError } = useToast();
    const supabase = createClient();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                setFullName(user.user_metadata?.full_name || "");

                const name = user.user_metadata?.full_name || user.email || "";
                if (name) {
                    const parts = name.split(" ").filter(Boolean);
                    if (parts.length >= 2) {
                        setInitials(`${parts[0][0]}${parts[1][0]}`.toUpperCase());
                    } else {
                        setInitials(name.slice(0, 2).toUpperCase());
                    }
                }
            }
            setLoading(false);
        };

        getUser();
    }, [supabase.auth]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setUpdating(true);
        try {
            const { error } = await supabase.auth.updateUser({
                data: { full_name: fullName },
            });

            if (error) throw error;

            success("Perfil actualizado", "Tus datos personales han sido guardados correctamente.");
        } catch (error) {
            showError(
                "Error",
                error instanceof Error ? error.message : "Ocurrió un error al actualizar el perfil."
            );
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center p-8 text-muted-foreground">Cargando información...</div>;
    }

    return (
        <Card className="border-border/50 shadow-md">
            <CardHeader className="pb-4">
                <CardTitle>Información Personal</CardTitle>
                <CardDescription>
                    Actualiza tu foto y detalles personales aquí.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-6 pb-6 border-b border-border/50">
                    <div className="relative group">
                        <Avatar className="h-24 w-24 border-4 border-background shadow-lg ring-2 ring-muted">
                            <AvatarImage src={user?.user_metadata?.avatar_url} className="object-cover" />
                            <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1.5 rounded-full shadow-md cursor-pointer hover:bg-primary/90 transition-colors">
                            <Camera className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-medium text-lg text-foreground">Tu Foto</h3>
                        <p className="text-sm text-muted-foreground">
                            Haz clic en el icono de cámara para actualizar.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="email">Correo Electrónico</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="email"
                                value={user?.email || ""}
                                disabled
                                className="pl-9 bg-muted/50"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                            SOLO LECTURA
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Nombre Completo</Label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="fullName"
                                placeholder="Tu nombre completo"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button type="submit" disabled={updating} className="min-w-[120px]">
                            {updating ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
