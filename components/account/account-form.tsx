"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";

export function AccountForm() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [fullName, setFullName] = useState("");
    const { success, error: showError } = useToast();
    const supabase = createClient();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                setFullName(user.user_metadata?.full_name || "");
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
        return <div>Cargando información...</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Datos Personales</CardTitle>
                <CardDescription>
                    Actualiza tu información personal.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Correo Electrónico</Label>
                        <Input id="email" value={user?.email || ""} disabled />
                        <p className="text-xs text-muted-foreground">
                            Para cambiar tu correo electrónico, ve a la sección de Seguridad.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Nombre Completo</Label>
                        <Input
                            id="fullName"
                            placeholder="Tu nombre completo"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>
                    <Button type="submit" disabled={updating}>
                        {updating ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
