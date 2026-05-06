"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ShieldCheck,
    RefreshCw,
    Copy,
    Check,
    XCircle,
    Timer,
    KeyRound,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";

const CODE_DURATION_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Genera un código numérico aleatorio de 4 dígitos.
 */
function generateRandomCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Componente que muestra el código de autorización temporal.
 * SOLO visible para administradores y gerentes.
 * El código se almacena en system_config y rota cada 30 minutos.
 * El supervisor puede invalidar el código manualmente en cualquier momento.
 */
export function EmergencyCodeViewer() {
    const [code, setCode] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<Date | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    // Cargar código actual desde la BD
    const fetchCurrentCode = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get('/system/crud/system_config') as any;
            const config = Array.isArray(data) ? data[0] : data;

            if (config?.emergency_code && config?.emergency_code_expires_at) {
                const expiry = new Date(config.emergency_code_expires_at);
                if (expiry > new Date()) {
                    setCode(config.emergency_code);
                    setExpiresAt(expiry);
                } else {
                    setCode(null);
                    setExpiresAt(null);
                }
            } else {
                setCode(null);
                setExpiresAt(null);
            }
        } catch (err) {
            console.error("Error fetching emergency code:", err);
            setCode(null);
            setExpiresAt(null);
        } finally {
            setLoading(false);
        }
    }, []);

    // Generar un nuevo código
    const generateNewCode = useCallback(async () => {
        setGenerating(true);
        try {
            const newCode = generateRandomCode();
            const expiryDate = new Date(Date.now() + CODE_DURATION_MS);

            // Get the first config ID to update
            const { data: configs } = await apiClient.get('/system/crud/system_config') as any;
            const configId = (Array.isArray(configs) ? configs[0] : configs)?.id;
            if (configId) {
                await apiClient.patch(`/system/crud/system_config/${configId}`, {
                    emergency_code: newCode,
                    emergency_code_expires_at: expiryDate.toISOString(),
                });
            }

            setCode(newCode);
            setExpiresAt(expiryDate);
            toast.success("Código generado", {
                description: `Nuevo código temporal válido por 30 minutos.`,
            });
        } catch (err) {
            console.error("Error generating code:", err);
            toast.error("Error al generar código temporal");
        } finally {
            setGenerating(false);
        }
    }, []);

    // Invalidar código actual
    const invalidateCode = useCallback(async () => {
        try {
            const { data: configs } = await apiClient.get('/system/crud/system_config') as any;
            const configId = (Array.isArray(configs) ? configs[0] : configs)?.id;
            if (configId) {
                await apiClient.patch(`/system/crud/system_config/${configId}`, {
                    emergency_code: null,
                    emergency_code_expires_at: null,
                });
            }

            setCode(null);
            setExpiresAt(null);
            toast.success("Código invalidado", {
                description: "El código temporal ya no puede ser utilizado.",
            });
        } catch (err) {
            console.error("Error invalidating code:", err);
            toast.error("Error al invalidar el código");
        }
    }, []);

    // Copiar código al clipboard
    const copyCode = useCallback(() => {
        if (!code) return;
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [code]);

    // Temporizador
    useEffect(() => {
        if (!expiresAt) {
            setTimeRemaining("");
            return;
        }

        const interval = setInterval(() => {
            const now = new Date();
            const diff = expiresAt.getTime() - now.getTime();

            if (diff <= 0) {
                setCode(null);
                setExpiresAt(null);
                setTimeRemaining("");
                clearInterval(interval);
                return;
            }

            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setTimeRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [expiresAt]);

    // Cargar al montar
    useEffect(() => {
        fetchCurrentCode();
    }, [fetchCurrentCode]);

    if (loading) {
        return (
            <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="p-4 flex items-center justify-center text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Cargando...
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 overflow-hidden">
            <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/10">
                            <KeyRound className="h-4 w-4 text-amber-500" />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold">Código de Autorización</h4>
                            <p className="text-[10px] text-muted-foreground">
                                Para recepción cuando no hay supervisor presente
                            </p>
                        </div>
                    </div>
                </div>

                {code ? (
                    <>
                        {/* Código activo */}
                        <div className="flex items-center gap-3 p-3 bg-background/80 rounded-lg border border-amber-500/20">
                            <div className="flex-1 text-center">
                                <p className="text-3xl font-mono font-bold tracking-[0.4em] text-amber-500 select-all">
                                    {code}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-500"
                                onClick={copyCode}
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>

                        {/* Timer y acciones */}
                        <div className="flex items-center justify-between">
                            <Badge
                                variant="outline"
                                className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30 flex items-center gap-1"
                            >
                                <Timer className="h-3 w-3" />
                                Expira en {timeRemaining}
                            </Badge>

                            <div className="flex items-center gap-1">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-muted-foreground hover:text-amber-500"
                                    onClick={generateNewCode}
                                    disabled={generating}
                                >
                                    <RefreshCw className={`h-3 w-3 mr-1 ${generating ? "animate-spin" : ""}`} />
                                    Nuevo
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                    onClick={invalidateCode}
                                >
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Invalidar
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Sin código activo */}
                        <div className="flex flex-col items-center gap-2 py-2">
                            <p className="text-xs text-muted-foreground text-center">
                                No hay código activo. Genera uno para compartir con recepción.
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-500"
                                onClick={generateNewCode}
                                disabled={generating}
                            >
                                <ShieldCheck className={`h-4 w-4 mr-2 ${generating ? "animate-spin" : ""}`} />
                                Generar Código Temporal
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
