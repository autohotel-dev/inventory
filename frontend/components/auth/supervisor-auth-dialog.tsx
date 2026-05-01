"use client";

import { useState, useRef, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, X, AlertTriangle, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";

interface SupervisorAuthDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAuthorized: (supervisorName: string, reason: string) => void;
    title?: string;
    description?: string;
    actionLabel?: string;
    variant?: "warning" | "danger";
    requireReason?: boolean;
}

/**
 * Dialog de autorización por PIN de supervisor o código temporal.
 * 
 * Validaciones (en orden):
 * 1. Si el usuario logueado es admin/manager/gerente → se autoriza directamente con confirmación.
 * 2. Si se ingresa un PIN → valida contra empleados activos con rol supervisor.
 * 3. Si se ingresa un código temporal → valida contra system_config.emergency_code.
 */
export function SupervisorAuthDialog({
    isOpen,
    onClose,
    onAuthorized,
    title = "Autorización Requerida",
    description = "Esta acción requiere el PIN de un administrador, gerente, o un código temporal.",
    actionLabel = "Autorizar",
    variant = "warning",
    requireReason = true,
}: SupervisorAuthDialogProps) {
    const [pin, setPin] = useState("");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { role, employeeName, isAdmin, isManager, isSupervisor } = useUserRole();

    // Si el usuario logueado es admin/manager, autorizar directamente al abrir
    const isSupervisorRole = isAdmin || isManager || isSupervisor;

    // Auto-focus el input cuando se abre el dialog
    useEffect(() => {
        if (isOpen) {
            setPin("");
            setReason("");
            setError(null);

            // Si es supervisor, no necesita PIN → auto-focus no es necesario
            if (!isSupervisorRole) {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }
    }, [isOpen, isSupervisorRole]);

    // Bypass: si el usuario logueado es supervisor, autorizar directamente
    const handleSupervisorBypass = () => {
        if (requireReason && !reason.trim()) {
            setError("Debes ingresar el motivo de la autorización");
            return;
        }
        onAuthorized(employeeName || "Supervisor", reason.trim());
        onClose();
    };

    const handleAuthorize = async () => {
        if (!pin.trim()) {
            setError("Ingresa el PIN o código temporal");
            return;
        }

        if (requireReason && !reason.trim()) {
            setError("Debes ingresar el motivo de la autorización");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const supabase = createClient();
            const trimmedPin = pin.trim();

            // 1. Intentar validar como PIN de supervisor
            const { data: supervisor, error: dbError } = await supabase
                .from("employees")
                .select("id, first_name, last_name, role, pin_code")
                .eq("pin_code", trimmedPin)
                .eq("is_active", true)
                .in("role", ["admin", "manager", "supervisor"])
                .maybeSingle();

            if (dbError) {
                console.error("Error verifying supervisor PIN:", dbError);
                setError("Error al verificar. Intenta de nuevo.");
                return;
            }

            if (supervisor) {
                const supervisorName = `${supervisor.first_name} ${supervisor.last_name}`;
                onAuthorized(supervisorName, reason.trim());
                onClose();
                return;
            }

            // 2. Si no fue PIN de supervisor, intentar como código temporal
            const { data: configData, error: configError } = await supabase
                .from("system_config")
                .select("emergency_code, emergency_code_expires_at")
                .limit(1)
                .single();

            if (!configError && configData?.emergency_code) {
                const expiresAt = new Date(configData.emergency_code_expires_at);
                const now = new Date();

                if (configData.emergency_code === trimmedPin && expiresAt > now) {
                    // Código temporal válido
                    onAuthorized("Código Temporal", reason.trim());
                    onClose();
                    return;
                }
            }

            // 3. Nada coincidió
            setError("PIN o código inválido. Verifica e intenta de nuevo.");
            setPin("");
            setTimeout(() => inputRef.current?.focus(), 100);
        } catch (err) {
            console.error("Error in supervisor auth:", err);
            setError("Error inesperado. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const variantColors = {
        warning: {
            icon: "text-amber-500",
            badge: "bg-amber-500/10 text-amber-500 border-amber-500/30",
            button: "bg-amber-600 hover:bg-amber-700",
        },
        danger: {
            icon: "text-red-500",
            badge: "bg-red-500/10 text-red-500 border-red-500/30",
            button: "bg-red-600 hover:bg-red-700",
        },
    };

    const colors = variantColors[variant];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-[420px] bg-background border-border">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ShieldCheck className={`h-5 w-5 ${colors.icon}`} />
                        {title}
                    </DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                {isSupervisorRole ? (
                    /* Si el usuario logueado es supervisor → confirmación directa */
                    <div className="space-y-4 py-2">
                        <div className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                            <ShieldCheck className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <div className="text-sm">
                                <p className="font-medium text-green-600 dark:text-green-400">
                                    Sesión de supervisor detectada
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Estás logueado como <strong>{employeeName}</strong> ({role}). Puedes autorizar directamente.
                                </p>
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button variant="ghost" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSupervisorBypass}
                                className={`${colors.button} text-white`}
                            >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                {actionLabel}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    /* Si es recepcionista u otro rol → pedir PIN o código temporal */
                    <div className="space-y-4 py-2">
                        <Badge
                            variant="outline"
                            className={`${colors.badge} text-xs w-full justify-center py-1.5`}
                        >
                            <AlertTriangle className="h-3 w-3 mr-1.5" />
                            Ingresa PIN de supervisor o código temporal
                        </Badge>

                        <div className="space-y-2">
                            <Label htmlFor="supervisor-reason" className="text-sm font-medium">
                                Motivo de la Autorización <span className="text-red-500 font-black">*</span>
                            </Label>
                            <Input
                                id="supervisor-reason"
                                placeholder="Ej: Error en captura, Solicitud cliente..."
                                value={reason}
                                onChange={(e) => {
                                    setReason(e.target.value);
                                    setError(null);
                                }}
                                className={`text-sm ${error && !reason.trim() ? "border-red-500" : ""}`}
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="supervisor-pin" className="text-sm font-medium">
                                PIN / Código Temporal <span className="text-red-500 font-black">*</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    ref={inputRef}
                                    id="supervisor-pin"
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    placeholder="••••"
                                    value={pin}
                                    onChange={(e) => {
                                        setPin(e.target.value.replace(/\D/g, ""));
                                        setError(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleAuthorize();
                                        }
                                    }}
                                    className={`text-center text-2xl tracking-[0.5em] font-mono h-12 ${error && !pin.trim() ? "border-red-500 focus-visible:ring-red-500" : ""
                                        }`}
                                    disabled={loading}
                                    autoComplete="off"
                                />
                            </div>
                            {error && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <X className="h-3 w-3" />
                                    {error}
                                </p>
                            )}
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <KeyRound className="h-3 w-3" />
                                Solicita el código temporal al supervisor por teléfono si no está presente.
                            </p>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button variant="ghost" onClick={onClose} disabled={loading}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleAuthorize}
                                disabled={loading || !pin.trim()}
                                className={`${colors.button} text-white`}
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                )}
                                {actionLabel}
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
