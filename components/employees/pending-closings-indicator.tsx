"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Receipt, Clock, X } from "lucide-react";
import { ShiftSession } from "./types";
import { ShiftClosingModal } from "./shift-closing";

interface PendingClosingsIndicatorProps {
    compact?: boolean;
    onClosingComplete?: () => void;
}

export function PendingClosingsIndicator({
    compact = false,
    onClosingComplete,
}: PendingClosingsIndicatorProps) {
    const supabase = createClient();
    const [pendingClosings, setPendingClosings] = useState<ShiftSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<ShiftSession | null>(null);
    const [showClosingModal, setShowClosingModal] = useState(false);

    const loadPendingClosings = async () => {
        try {
            // Obtener usuario actual
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            // Obtener empleado
            const { data: employee } = await supabase
                .from("employees")
                .select("id")
                .eq("auth_user_id", user.id)
                .single();

            if (!employee) {
                setLoading(false);
                return;
            }

            // Obtener sesiones pendientes de corte
            const { data, error } = await supabase
                .from("shift_sessions")
                .select("*, shift_definitions(*), employees(first_name, last_name)")
                .eq("employee_id", employee.id)
                .eq("status", "pending_closing")
                .order("clock_out_at", { ascending: false });

            if (error) throw error;

            setPendingClosings(data || []);
        } catch (err) {
            console.error("Error loading pending closings:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPendingClosings();

        // Polling cada 30 segundos para actualizar
        const interval = setInterval(loadPendingClosings, 30000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleOpenClosing = (session: ShiftSession) => {
        setSelectedSession(session);
        setShowClosingModal(true);
    };

    const handleClosingComplete = () => {
        setShowClosingModal(false);
        setSelectedSession(null);
        loadPendingClosings();
        onClosingComplete?.();
    };

    if (loading || pendingClosings.length === 0) return null;

    // Versión compacta (para navbar)
    if (compact) {
        return (
            <>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenClosing(pendingClosings[0])}
                    className="relative"
                >
                    <Receipt className="h-4 w-4 mr-2" />
                    <span>Cortes Pendientes</span>
                    {pendingClosings.length > 1 && (
                        <Badge
                            variant="destructive"
                            className="ml-2 h-5 w-5 p-0 flex items-center justify-center"
                        >
                            {pendingClosings.length}
                        </Badge>
                    )}
                </Button>

                {/* Modal de corte */}
                {showClosingModal && selectedSession && (
                    <ShiftClosingModal
                        session={selectedSession}
                        onClose={() => {
                            setShowClosingModal(false);
                            setSelectedSession(null);
                        }}
                        onComplete={handleClosingComplete}
                    />
                )}
            </>
        );
    }

    // Versión completa (para dashboard)
    return (
        <>
            <Alert className="border-amber-500 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertTitle className="text-amber-700 dark:text-amber-500">
                    Cortes Pendientes ({pendingClosings.length})
                </AlertTitle>
                <AlertDescription className="mt-2">
                    <p className="text-sm text-muted-foreground mb-3">
                        Tienes cortes de caja pendientes de completar:
                    </p>
                    <div className="space-y-2">
                        {pendingClosings.map((session) => (
                            <Button
                                key={session.id}
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenClosing(session)}
                                className="w-full justify-between border-amber-500/30 hover:bg-amber-500/10"
                            >
                                <div className="flex items-center gap-2">
                                    <Receipt className="h-4 w-4" />
                                    <span className="font-medium">
                                        {session.shift_definitions?.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(session.clock_out_at!).toLocaleDateString("es-MX", {
                                            weekday: "short",
                                            day: "numeric",
                                            month: "short",
                                        })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {new Date(session.clock_out_at!).toLocaleTimeString("es-MX", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </div>
                            </Button>
                        ))}
                    </div>
                </AlertDescription>
            </Alert>

            {/* Modal de corte */}
            {showClosingModal && selectedSession && (
                <ShiftClosingModal
                    session={selectedSession}
                    onClose={() => {
                        setShowClosingModal(false);
                        setSelectedSession(null);
                    }}
                    onComplete={handleClosingComplete}
                />
            )}
        </>
    );
}
