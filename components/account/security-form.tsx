"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function SecurityForm() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [updatingPassword, setUpdatingPassword] = useState(false);
    const [updatingEmail, setUpdatingEmail] = useState(false);
    const { success, error: showError } = useToast();
    const supabase = createClient();

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            showError("Error", "Las contraseñas no coinciden.");
            return;
        }

        setUpdatingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) throw error;

            success("Contraseña actualizada", "Tu contraseña ha sido cambiada exitosamente.");
            setPassword("");
            setConfirmPassword("");
        } catch (error) {
            showError(
                "Error",
                error instanceof Error ? error.message : "Ocurrió un error al actualizar la contraseña."
            );
        } finally {
            setUpdatingPassword(false);
        }
    };

    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();

        setUpdatingEmail(true);
        try {
            const { error } = await supabase.auth.updateUser({ email: newEmail });

            if (error) throw error;

            success("Correo de confirmación enviado", "Por favor revisa tu nuevo correo electrónico para confirmar el cambio.");
            setNewEmail("");
        } catch (error) {
            showError(
                "Error",
                error instanceof Error ? error.message : "Ocurrió un error al actualizar el correo."
            );
        } finally {
            setUpdatingEmail(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Cambiar Contraseña</CardTitle>
                    <CardDescription>
                        Asegúrate de usar una contraseña segura.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-password">Nueva Contraseña</Label>
                            <Input
                                id="new-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>
                        <Button type="submit" disabled={updatingPassword}>
                            {updatingPassword ? "Actualizando..." : "Actualizar Contraseña"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Cambiar Correo Electrónico</CardTitle>
                    <CardDescription>
                        Te enviaremos un enlace de confirmación a tu nueva dirección de correo.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdateEmail} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-email">Nuevo Correo Electrónico</Label>
                            <Input
                                id="new-email"
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={updatingEmail}>
                            {updatingEmail ? "Enviando..." : "Actualizar Correo"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
