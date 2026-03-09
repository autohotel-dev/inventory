"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, RefreshCw, AlertTriangle, AlertOctagon } from "lucide-react";
import { toast } from "sonner";

export function ShiftMigrationTool() {
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [migrationStats, setMigrationStats] = useState<{
        valetShifts: { id: string; name: string; count: number }[];
        receptionShift: { id: string; name: string; start: string } | null;
        totalPaymentsFound: number;
        alreadyAssigned: number;
        totalToMigrate: number;
        excludedCount: number;
        idsToMigrate: string[];
    } | null>(null);

    const supabase = createClient();

    const analyzeShifts = async () => {
        setAnalyzing(true);
        try {
            // 1. Obtener sesiones activas
            const { data: activeSessions, error } = await supabase
                .from("shift_sessions")
                .select(`
          id,
          clock_in_at,
          status,
          employees (
            id,
            first_name,
            last_name,
            role
          )
        `)
                .in("status", ["active", "open"]);

            if (error) throw error;

            // 2. Identificar sesión de recepción (Target)
            const receptionSession = activeSessions?.find((s: any) =>
                ['receptionist', 'admin', 'manager'].includes(s.employees?.role)
            );

            if (!receptionSession) {
                console.warn("No active reception shift found for migration target.");
                toast.error("No se encontró un turno de recepción activo.");
                setMigrationStats(null);
                return;
            }

            // 3. Obtener TODOS los pagos posteriores al inicio del turno
            // Fetch sales_order_id to link with rooms later

            const { data: allPayments, error: paymentsError } = await supabase
                .from("payments")
                .select(`
            id,
            amount,
            created_at,
            shift_session_id,
            sales_order_id,
            shift_sessions (
                employees (
                    first_name, 
                    role
                )
            )
        `)
                .gte("created_at", receptionSession.clock_in_at);

            if (paymentsError) throw paymentsError;

            // 4. Obtener información de habitaciones via sales_order_id (Manual Join para evitar error de relación)
            // Extraer IDs de ordenes únicas
            const salesOrderIds = Array.from(new Set(allPayments?.map((p: any) => p.sales_order_id).filter(Boolean)));

            const salesOrderRoomMap = new Map<string, string>();

            if (salesOrderIds.length > 0) {
                // Paso 4a: Obtener room_stays para tener room_id
                const { data: stays, error: staysError } = await supabase
                    .from("room_stays")
                    .select("sales_order_id, room_id")
                    .in("sales_order_id", salesOrderIds);

                if (staysError) {
                    console.error("Error fetching room stays:", staysError);
                    toast.error("Error verificando habitaciones (stays)");
                } else if (stays && stays.length > 0) {

                    // Paso 4b: Obtener nombres de rooms (USANDO NUMBER, NO NAME)
                    const roomIds = Array.from(new Set(stays.map((s: any) => s.room_id).filter(Boolean)));

                    const { data: rooms, error: roomsError } = await supabase
                        .from("rooms")
                        .select("id, number") // FIX: Usar 'number' porque 'name' no existe
                        .in("id", roomIds);

                    if (roomsError) {
                        console.error("Error fetching rooms:", roomsError);
                        toast.error("Error verificando habitaciones (rooms)");
                    } else {
                        // Paso 4c: Mapear todo en memoria
                        const roomMap = new Map<string, string>(); // room_id -> number
                        rooms?.forEach((r: any) => {
                            roomMap.set(r.id, r.number);
                        });

                        stays.forEach((s: any) => {
                            const number = roomMap.get(s.room_id);
                            if (s.sales_order_id && number) {
                                salesOrderRoomMap.set(s.sales_order_id, number);
                            }
                        });
                    }
                }
            }

            // FILTRADO DE HABITACIÓN 13 y conteos
            let totalFound = 0;
            let excludedCount = 0;
            let alreadyAssigned = 0;
            const idsToMigrate: string[] = [];

            // Mapas para estadísticas
            const sourceMap = new Map<string, { name: string; count: number; id: string }>();

            allPayments?.forEach((p: any) => {
                const roomNumber = salesOrderRoomMap.get(p.sales_order_id);

                // EXCLUSIÓN: Habitación 13 y 113
                // Verifica contra el número de habitación (string)
                if (roomNumber === '13' || roomNumber === '113' || roomNumber === 'Habitación 13' || roomNumber === 'Habitación 113') {
                    excludedCount++;
                    return;
                }

                totalFound++;

                // Si ya es del turno correcto, contarlo
                if (p.shift_session_id === receptionSession.id) {
                    alreadyAssigned++;
                    return;
                }

                // Si no, es candidato a migración
                idsToMigrate.push(p.id);

                // Stats del origen
                const shiftId = p.shift_session_id || "sin_turno";
                let empName = "Sin Turno";
                if (p.shift_sessions?.employees) {
                    empName = `${p.shift_sessions.employees.first_name} (${p.shift_sessions.employees.role})`;
                } else if (p.shift_session_id) {
                    empName = "Turno Desconocido/Cerrado";
                }

                if (!sourceMap.has(shiftId)) {
                    sourceMap.set(shiftId, { name: empName, count: 0, id: shiftId });
                }
                sourceMap.get(shiftId)!.count++;
            });

            const stats = Array.from(sourceMap.values());

            setMigrationStats({
                valetShifts: stats,
                receptionShift: {
                    id: receptionSession.id,
                    name: `${receptionSession.employees.first_name} ${receptionSession.employees.last_name}`,
                    start: receptionSession.clock_in_at
                },
                totalPaymentsFound: totalFound,
                alreadyAssigned: alreadyAssigned,
                totalToMigrate: idsToMigrate.length,
                idsToMigrate: idsToMigrate,
                excludedCount: excludedCount
            });

        } catch (error) {
            console.error("Error analyzing shifts:", error);
            toast.error("Error al analizar turnos");
        } finally {
            setAnalyzing(false);
        }
    };

    const executeMigration = async () => {
        if (!migrationStats || !migrationStats.idsToMigrate.length) return;

        setLoading(true);
        try {
            // Migración segura por IDs (ya filtrados)
            const { error, count } = await supabase
                .from("payments")
                .update({ shift_session_id: migrationStats.receptionShift!.id })
                .in("id", migrationStats.idsToMigrate)
                .select("id", { count: 'exact' });

            if (error) {
                console.error("Error migrating payments:", error);
                toast.error("Error migrando pagos");
            } else {
                toast.success(`Migración completada: ${count} pagos reasignados`);
                await analyzeShifts();

                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }

        } catch (error) {
            console.error("Error executing migration:", error);
            toast.error("Error crítico durante la migración");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        analyzeShifts();
    }, []);

    if (!migrationStats) return null;

    return (
        <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <RefreshCw className="h-5 w-5" />
                    Diagnóstico de Pagos y Turnos
                </CardTitle>
                <CardDescription>
                    Analizando pagos desde {new Date(migrationStats.receptionShift?.start || "").toLocaleTimeString()} (Excluyendo Hab. 13 y 113).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-2 text-center mb-2">
                        <div className="bg-white dark:bg-black/20 p-2 rounded border">
                            <p className="text-[10px] text-muted-foreground uppercase">Válidos</p>
                            <p className="text-lg font-bold">{migrationStats.totalPaymentsFound}</p>
                        </div>
                        <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded border border-emerald-200">
                            <p className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase">Bien</p>
                            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{migrationStats.alreadyAssigned}</p>
                        </div>
                        <div className={`p-2 rounded border ${migrationStats.totalToMigrate > 0 ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-200' : 'bg-gray-100 border-gray-200'}`}>
                            <p className="text-[10px] uppercase text-amber-800 dark:text-amber-300">Mal Asig.</p>
                            <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{migrationStats.totalToMigrate}</p>
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-200 opacity-70">
                            <p className="text-[10px] text-muted-foreground uppercase">Excluidos</p>
                            <p className="text-lg font-bold text-gray-500">{migrationStats.excludedCount}</p>
                        </div>
                    </div>

                    <div className="text-sm">

                        {migrationStats.totalToMigrate > 0 ? (
                            <div className="mt-2 p-2 bg-white dark:bg-black/20 rounded border border-amber-200">
                                <div className="flex items-center gap-2 text-amber-600 mb-2 font-semibold">
                                    <AlertTriangle className="h-4 w-4" />
                                    Se reasignarán estos pagos:
                                </div>
                                <ul className="list-disc pl-5 max-h-32 overflow-y-auto text-xs">
                                    {migrationStats.valetShifts.map(v => (
                                        <li key={v.id}>
                                            {v.name}: {v.count} pago(s)
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div className="mt-2 flex items-center gap-2 text-emerald-600 font-medium p-2 bg-emerald-50 rounded border border-emerald-100">
                                <CheckCircle className="h-4 w-4" />
                                Todo correcto.
                            </div>
                        )}

                        {migrationStats.excludedCount > 0 && (
                            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                <AlertOctagon className="h-3 w-3" />
                                Se ignoraron {migrationStats.excludedCount} pagos de Habitaciones 13 y 113.
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" size="sm" onClick={analyzeShifts} disabled={loading || analyzing}>
                            {analyzing ? "Analizando..." : "Re-analizar"}
                        </Button>
                        {migrationStats.totalToMigrate > 0 && (
                            <Button
                                size="sm"
                                onClick={executeMigration}
                                disabled={loading || analyzing}
                                className="bg-amber-600 hover:bg-amber-700 text-white w-full"
                            >
                                {loading ? "Forzando..." : `Forzar Migración (${migrationStats.totalToMigrate})`}
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
