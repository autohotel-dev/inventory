"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
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

    const analyzeShifts = async () => {
        setAnalyzing(true);
        try {
            // 1. Obtener sesiones activas via FastAPI
            let activeSessions: any[] = [];
            try {
                const res = await apiClient.get("/system/crud/shift_sessions/", { params: { status: "active", limit: 100 } });
                const raw = res.data;
                activeSessions = Array.isArray(raw) ? raw : (raw?.items || raw?.results || []);
            } catch (e) {
                console.error("Error fetching active sessions:", e);
            }

            // 2. Identificar sesión de recepción (Target)
            let receptionSession: any = activeSessions.find((s: any) =>
                ['receptionist', 'admin', 'manager'].includes(s.employee_role || s.employees?.role)
            );

            if (!receptionSession && activeSessions.length > 0) {
                receptionSession = activeSessions[0];
            }

            if (!receptionSession) {
                setMigrationStats(null);
                return;
            }

            const empData = receptionSession.employees || receptionSession;
            const receptionName = empData.employee_name || `${empData.first_name || ''} ${empData.last_name || ''}`.trim() || "Recepción";

            // 3. Obtener pagos posteriores al inicio del turno
            let allPayments: any[] = [];
            try {
                const res = await apiClient.get("/system/crud/payments/", {
                    params: { created_after: receptionSession.clock_in_at, limit: 10000 }
                });
                const raw = res.data;
                allPayments = Array.isArray(raw) ? raw : (raw?.items || raw?.results || []);
            } catch (e) {
                console.error("Error fetching payments:", e);
            }

            // 4. Obtener información de habitaciones via sales orders -> room_stays -> rooms
            const salesOrderIds = Array.from(new Set(allPayments.map((p: any) => p.sales_order_id).filter(Boolean)));
            const salesOrderRoomMap = new Map<string, string>();

            if (salesOrderIds.length > 0) {
                try {
                    const staysRes = await apiClient.get("/system/crud/room_stays/", { params: { limit: 10000 } });
                    const staysRaw = staysRes.data;
                    const stays = Array.isArray(staysRaw) ? staysRaw : (staysRaw?.items || staysRaw?.results || []);

                    const roomsRes = await apiClient.get("/rooms/", { params: { limit: 1000 } });
                    const roomsRaw = roomsRes.data;
                    const rooms = Array.isArray(roomsRaw) ? roomsRaw : (roomsRaw?.items || roomsRaw?.results || []);

                    const roomMap = new Map<string, string>();
                    rooms.forEach((r: any) => roomMap.set(r.id, r.number));

                    stays.forEach((s: any) => {
                        const number = roomMap.get(s.room_id);
                        if (s.sales_order_id && number) {
                            salesOrderRoomMap.set(s.sales_order_id, number);
                        }
                    });
                } catch (e) {
                    console.error("Error fetching room info:", e);
                }
            }

            // FILTRADO y conteos
            let totalFound = 0;
            let excludedCount = 0;
            let alreadyAssigned = 0;
            const idsToMigrate: string[] = [];
            const sourceMap = new Map<string, { name: string; count: number; id: string }>();

            allPayments.forEach((p: any) => {
                const roomNumber = salesOrderRoomMap.get(p.sales_order_id);

                if (roomNumber === '13' || roomNumber === '113' || roomNumber === 'Habitación 13' || roomNumber === 'Habitación 113') {
                    excludedCount++;
                    return;
                }

                totalFound++;

                if (p.shift_session_id === receptionSession.id) {
                    alreadyAssigned++;
                    return;
                }

                const needsMigration = p.shift_session_id &&
                    p.shift_session_id !== receptionSession.id &&
                    p.shift_session_id !== "sin_turno" &&
                    p.collected_by;

                if (needsMigration) {
                    idsToMigrate.push(p.id);
                }

                const shiftId = p.shift_session_id || "sin_turno";
                let empName = "Sin Turno";

                if (p.shift_sessions?.employees) {
                    empName = `${p.shift_sessions.employees.first_name} (${p.shift_sessions.employees.role})`;
                } else if (p.collected_by) {
                    empName = `Cochero (ID: ${p.collected_by.slice(0, 8)}...)`;
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
                    name: receptionName,
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
            // Migración via FastAPI
            const res = await apiClient.post("/system/crud/payments/bulk-reassign/", {
                payment_ids: migrationStats.idsToMigrate,
                target_shift_session_id: migrationStats.receptionShift!.id
            });

            toast.success(`Migración completada: ${migrationStats.idsToMigrate.length} pagos reasignados`);
            await analyzeShifts();

            setTimeout(() => {
                window.location.reload();
            }, 1500);

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
                                    Pagos del cochero para asignar a recepción:
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
                                {loading ? "Asignando..." : `Asignar a Recepción (${migrationStats.totalToMigrate})`}
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
