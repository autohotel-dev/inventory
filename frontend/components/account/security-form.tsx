"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail } from "lucide-react";

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
        <div className="space-y-8">
            <Card className="border-border/50 shadow-md">
                <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                            <Lock className="h-5 w-5" />
                        </div>
                        <CardTitle>Contraseña</CardTitle>
                    </div>
                    <CardDescription>
                        Asegúrate de usar una contraseña larga y única para proteger tu cuenta.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="new-password">Nueva Contraseña</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="bg-background"
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
                                    className="bg-background"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={updatingPassword} variant="default" className="min-w-[140px]">
                                {updatingPassword ? "Actualizando..." : "Actualizar Contraseña"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className="border-border/50 shadow-md">
                <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Mail className="h-5 w-5" />
                        </div>
                        <CardTitle>Correo Electrónico</CardTitle>
                    </div>
                    <CardDescription>
                        Cambiar tu dirección de email requerirá una confirmación en la nueva dirección.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdateEmail} className="space-y-4">
                        <div className="space-y-2 max-w-md">
                            <Label htmlFor="new-email">Nuevo Correo Electrónico</Label>
                            <Input
                                id="new-email"
                                type="email"
                                placeholder="ejemplo@correo.com"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                required
                                className="bg-background"
                            />
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={updatingEmail} variant="outline" className="min-w-[140px]">
                                {updatingEmail ? "Enviando..." : "Enviar Confirmación"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
