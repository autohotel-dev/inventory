"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IncomeReport } from "@/components/reports/income-report";
import { createClient } from "@/lib/supabase/client";
import { Filter, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

function IncomeReportContent() {
    const searchParams = useSearchParams();
    const [reportType, setReportType] = useState<"shift" | "dateRange">("dateRange");
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [selectedShift, setSelectedShift] = useState<string | undefined>();
    const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
    const [roomFilter, setRoomFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [showFilters, setShowFilters] = useState(true);

    const [shifts, setShifts] = useState<any[]>([]);
    const [rooms, setRooms] = useState<string[]>([]);

    useEffect(() => {
        fetchShifts();
        fetchRooms();

        // Auto-seleccionar turno si viene en la URL
        const shiftId = searchParams.get('shiftId');
        const autoPrint = searchParams.get('autoPrint');

        if (shiftId) {
            setReportType("shift");
            setSelectedShift(shiftId);

            // Auto-imprimir si viene el parámetro
            if (autoPrint === 'true') {
                setTimeout(() => {
                    window.print();
                }, 1500); // Dar tiempo para que cargue el reporte
            }
        }
    }, [searchParams]);

    const fetchShifts = async () => {
        const supabase = createClient();

        // 1. Primero obtener TODOS los turnos para debugging
        const { data: allSessions, error: allSessionsError } = await supabase
            .from("shift_sessions")
            .select("id, clock_in_at, employee_id, status")
            .order("clock_in_at", { ascending: false })
            .limit(10);

        console.log("🔍 All recent sessions (for debugging):", { allSessions, allSessionsError });

        // 2. Obtener turno actual activo
        const { data: activeSessions, error: sessionError } = await supabase
            .from("shift_sessions")
            .select("id, clock_in_at, employee_id, status")
            .eq("status", "active");

        console.log("🔍 Open sessions query result:", { activeSessions, sessionError });

        // Tomar la primera sesión abierta (debería haber solo una)
        const activeSession = activeSessions && activeSessions.length > 0 ? activeSessions[0] : null;

        if (sessionError) {
            console.error("Error fetching active session:", sessionError);
        }

        // Si hay turno activo, obtener info del empleado por separado
        let employeeName = "Usuario Actual";
        if (activeSession?.employee_id) {
            const { data: employee } = await supabase
                .from("employees")
                .select("first_name, last_name")
                .eq("id", activeSession.employee_id)
                .single();

            console.log("👤 Employee data:", employee);

            if (employee) {
                employeeName = `${employee.first_name} ${employee.last_name}`;
            }
        }

        // 2. Obtener cierres históricos con información de empleado
        const { data: closedShifts, error } = await supabase
            .from("shift_closings")
            .select(`
                *,
                employees!shift_closings_employee_id_fkey (
                    first_name,
                    last_name
                )
            `)
            .order("created_at", { ascending: false })
            .limit(50);

        if (error) {
            console.error("Error fetching shifts:", error);
            return;
        }

        // Combinar: Turno actual (si existe) + Históricos
        let allShifts = [];

        if (activeSession) {
            allShifts.push({
                id: activeSession.id,
                is_current: true, // Flag para identificar turno actual
                employee_name: employeeName,
                created_at: activeSession.clock_in_at,
                type: 'active'
            });
        }

        if (closedShifts) {
            allShifts = [...allShifts, ...closedShifts.map(s => {
                // Extraer nombre del empleado de la relación
                const emp = s.employees as any;
                const empName = emp ? `${emp.first_name} ${emp.last_name}` : null;
                return {
                    ...s,
                    employee_name: empName || s.employee_name,
                    type: 'closed'
                };
            })];
        }

        console.log("📊 All shifts combined:", allShifts);

        setShifts(allShifts);

        // Auto-seleccionar el turno actual si no hay selección y estamos en modo turno
        if (reportType === 'shift' && !selectedShift && activeSession) {
            setSelectedShift(activeSession.id);
        }
    };

    const fetchRooms = async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from("rooms")
            .select("number")
            .order("number");

        if (data) setRooms(data.map(r => r.number));
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Reportes de Ingresos</h1>
                <p className="text-muted-foreground">
                    Consulta y genera reportes de ingresos por hospedaje y consumo
                </p>
            </div>
            <Card className="border-border shadow-sm">
                <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors border-b border-border"
                    onClick={() => setShowFilters(!showFilters)}
                >
                    <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        <h2 className="font-medium">Configuración y Filtros</h2>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </div>

                {showFilters && (
                    <CardContent className="pt-6 animate-in slide-in-from-top-2 fade-in duration-200">
                        <Tabs value={reportType} onValueChange={(v) => setReportType(v as "shift" | "dateRange")}>
                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="dateRange">Por Rango de Fechas</TabsTrigger>
                                <TabsTrigger value="shift">Por Turno</TabsTrigger>
                            </TabsList>

                            <TabsContent value="dateRange" className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>Fecha Inicio</Label>
                                        <Input
                                            type="date"
                                            value={startDate ? startDate.toISOString().split('T')[0] : ""}
                                            onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Fecha Fin</Label>
                                        <Input
                                            type="date"
                                            value={endDate ? endDate.toISOString().split('T')[0] : ""}
                                            onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                                        />
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="shift" className="space-y-4">
                                <div>
                                    <Label className="text-sm font-medium">Seleccionar Turno (Cierre de Caja)</Label>
                                    <Select value={selectedShift} onValueChange={setSelectedShift}>
                                        <SelectTrigger className="mt-2">
                                            <SelectValue placeholder="Selecciona un turno" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {shifts.length === 0 ? (
                                                <SelectItem value="none" disabled>No hay turnos disponibles</SelectItem>
                                            ) : (
                                                shifts.map((shift) => (
                                                    <SelectItem key={shift.id} value={shift.id}>
                                                        {shift.type === 'active' ? (
                                                            <span className="flex items-center gap-2 font-semibold text-emerald-600">
                                                                <span className="relative flex h-2 w-2">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                                </span>
                                                                TURNO ACTUAL - {shift.employee_name} (Desde {new Date(shift.created_at).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' })})
                                                            </span>
                                                        ) : (
                                                            <span>
                                                                {shift.employee_name || "Sin empleado"} - {new Date(shift.created_at).toLocaleDateString("es-MX", {
                                                                    year: "numeric",
                                                                    month: "long",
                                                                    day: "numeric",
                                                                    hour: "2-digit",
                                                                    minute: "2-digit"
                                                                })}
                                                            </span>
                                                        )}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Mostrando los últimos 50 cierres de turno
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* Filtros adicionales */}
                        <div className="mt-6 pt-6 border-t">
                            <div className="flex items-center gap-2 mb-4">
                                <Filter className="h-4 w-4" />
                                <h3 className="font-semibold">Filtros Adicionales</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <Label>Estado de Habitación</Label>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas (Activas + Finalizadas)</SelectItem>
                                            <SelectItem value="FINALIZADA">Solo Finalizadas (Checkout)</SelectItem>
                                            <SelectItem value="ACTIVA">Solo Activas (En curso)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Método de Pago</Label>
                                    <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                                            <SelectItem value="TARJETA">Tarjeta</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Habitación</Label>
                                    <Select value={roomFilter} onValueChange={setRoomFilter}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas</SelectItem>
                                            {rooms.map((room) => (
                                                <SelectItem key={room} value={room}>
                                                    Habitación {room}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                            <Button
                                onClick={() => {
                                    setStartDate(undefined);
                                    setEndDate(undefined);
                                    setSelectedShift(undefined);
                                    setPaymentMethodFilter("all");
                                    setRoomFilter("all");
                                    setStatusFilter("all");
                                }}
                                variant="outline"
                            >
                                Limpiar Filtros
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Componente de reporte */}
            < IncomeReport
                reportType={reportType}
                shiftId={selectedShift}
                startDate={startDate}
                endDate={endDate}
                paymentMethodFilter={paymentMethodFilter}
                roomFilter={roomFilter}
                statusFilter={statusFilter}
            />

            {/* Estilos de impresión para ocultar UI */}

        </div >
    );
}

export default function IncomeReportPage() {
    return (
        <Suspense fallback={<div className="container mx-auto py-6">Cargando...</div>}>
            <IncomeReportContent />
        </Suspense>
    );
}
