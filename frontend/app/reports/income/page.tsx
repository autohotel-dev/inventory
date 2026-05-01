"use client";

import { Suspense } from "react";
import { useState, useEffect, useCallback } from "react";

import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IncomeReport } from "@/components/reports/income-report";
import { ShiftMigrationTool } from "@/components/reports/shift-migration-tool";
import { createClient } from "@/lib/supabase/client";
import { Filter, Settings2, ArrowDownCircle, CheckCircle2 } from "lucide-react";
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

    // Remove unused showFilters state since CollapsibleSection handles visibility
    const [shifts, setShifts] = useState<any[]>([]);
    const [rooms, setRooms] = useState<string[]>([]);


    const fetchShifts = useCallback(async () => {
        const supabase = createClient();

        // 1. Primero obtener TODOS los turnos para debugging
        const { data: allSessions, error: allSessionsError } = await supabase
            .from("shift_sessions")
            .select("id, clock_in_at, employee_id, status")
            .order("clock_in_at", { ascending: false })
            .limit(10);

        console.log("🔍 All recent sessions (for debugging):", { allSessions, allSessionsError });

        // 2. Obtener turnos activos (puede haber varios: recepcionista, cochero, etc.)
        const { data: activeSessions, error: sessionError } = await supabase
            .from("shift_sessions")
            .select(`
                id, 
                clock_in_at, 
                employee_id, 
                status,
                employees (
                    id,
                    first_name,
                    last_name,
                    role
                )
            `)
            .in("status", ["active", "open"])
            .order("clock_in_at", { ascending: false });

        console.log("🔍 Open sessions query result:", { activeSessions, sessionError });

        // Filtrar y priorizar sesión de recepción
        let activeSession = null;
        if (activeSessions && activeSessions.length > 0) {
            // Buscar primero un recepcionista, admin o manager
            activeSession = activeSessions.find((s: any) =>
                ['receptionist', 'admin', 'manager'].includes(s.employees?.role)
            );

            // Si no hay ninguno de esos, usar el primero que haya (fallback)
            if (!activeSession) {
                activeSession = activeSessions[0];
            }
        }

        if (sessionError) {
            console.error("Error fetching active session:", sessionError);
        }

        // Si hay turno activo, usar la info del empleado que ya trajimos (o buscarla si faltara)
        let employeeName = "Usuario Actual";
        let employeeRole = null;

        if (activeSession) {
            const emp = activeSession.employees as any;
            if (emp) {
                employeeName = `${emp.first_name} ${emp.last_name}`;
                employeeRole = emp.role;
            }
        }

        // 2. Obtener cierres históricos con información de empleado
        const { data: closedShifts, error } = await supabase
            .from("shift_closings")
            .select(`
                *,
                employees!shift_closings_employee_id_fkey (
                    first_name,
                    last_name,
                    role
                )
            `)
            .order("created_at", { ascending: false })
            .limit(50);

        if (error) {
            console.error("Error fetching closed shifts:", error);
            // Mostrar una alerta si es necesario, o solo loguear
        }

        // Combinar: Turno actual (si existe) + Históricos
        let allShifts: any[] = [];

        if (activeSession) {
            allShifts.push({
                id: activeSession.id,
                is_current: true, // Flag para identificar turno actual
                employee_name: employeeName,
                role: employeeRole,
                created_at: activeSession.clock_in_at,
                type: 'active'
            });
        }

        if (closedShifts) {
            allShifts = [...allShifts, ...closedShifts.map((s: any) => {
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

        // Mejor aproximación: Filtrar por los roles permitidos si tenemos la data
        const allowedRoles = ['receptionist'];

        const filteredShifts = allShifts.filter(s => {
            // SIEMPRE mostrar el turno actual (active) para que el usuario pueda seleccionarlo
            if (s.is_current) return true;

            // Si viene de closedShifts, tiene employees.role
            const empRole = s.employees?.role || s.role; // Helper si lo trajimos
            if (empRole) {
                return allowedRoles.includes(empRole);
            }
            return false; // Si no hay info de rol o no coincide, lo ocultamos para asegurar que solo se vean recepcionistas
        });

        console.log("📊 Filtered shifts:", filteredShifts);

        setShifts(filteredShifts);

        // Auto-seleccionar el turno actual si no hay selección y estamos en modo turno
        if (reportType === 'shift' && !selectedShift && activeSession) {
            setSelectedShift(activeSession.id);
        }
    }, [reportType, selectedShift]);

    const fetchRooms = useCallback(async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from("rooms")
            .select("number")
            .order("number");

        if (data) setRooms(data.map((r: any) => r.number));
    }, []);

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
    }, [searchParams, fetchShifts, fetchRooms]);

    return (
        <div className="container mx-auto px-2 sm:px-4 md:py-6 py-4 space-y-4 sm:space-y-6">
            <div>
                <h1 className="text-xl sm:text-3xl font-bold">Corte de Caja</h1>
                <p className="text-muted-foreground">
                    Reporte de ingresos por turno
                </p>
            </div>
            {/* Filtros estilo Productos */}
            <CollapsibleSection
                storageKey="income-report-filters"
                title="Configuración y Filtros"
                icon={<Settings2 className="h-4 w-4" />}
                defaultOpen={true}
                variant="default"
                badge={(() => {
                    const activeCount = [
                        statusFilter !== 'all',
                        paymentMethodFilter !== 'all',
                        roomFilter !== 'all',
                        reportType === 'dateRange' && (startDate || endDate),
                        reportType === 'shift' && selectedShift
                    ].filter(Boolean).length;
                    return activeCount > 0 ? `${activeCount} filtro${activeCount !== 1 ? 's' : ''}` : undefined;
                })()}
            >
                <div>
                    <Tabs value={reportType} onValueChange={(v) => setReportType(v as "shift" | "dateRange")}>
                        <TabsList className="w-full max-w-3xl grid grid-cols-2 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl mx-auto mb-6 sm:mb-8">
                            <TabsTrigger
                                value="dateRange"
                                className="py-3 sm:py-6 px-2 sm:px-4 data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:shadow-[0_0_25px_rgba(59,130,246,0.5)] data-[state=active]:border-blue-400/50 data-[state=active]:text-white"
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <div className="flex items-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                                            <line x1="16" x2="16" y1="2" y2="6" />
                                            <line x1="8" x2="8" y1="2" y2="6" />
                                            <line x1="3" x2="21" y1="10" y2="10" />
                                        </svg>
                                        <span className="text-sm sm:text-base font-bold">Por Fechas</span>
                                    </div>
                                    <span className="text-xs sm:text-sm opacity-90 font-normal hidden sm:block">Rango personalizado</span>
                                </div>
                            </TabsTrigger>
                            <TabsTrigger
                                value="shift"
                                className="py-3 sm:py-6 px-2 sm:px-4 data-[state=active]:from-amber-500 data-[state=active]:to-amber-600 data-[state=active]:shadow-[0_0_25px_rgba(245,158,11,0.5)] data-[state=active]:border-amber-400/50 data-[state=active]:text-white"
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <div className="flex items-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="20" height="14" x="2" y="3" rx="2" />
                                            <line x1="8" x2="16" y1="21" y2="21" />
                                            <line x1="12" x2="12" y1="17" y2="21" />
                                        </svg>
                                        <span className="text-sm sm:text-base font-bold">Por Turno</span>
                                    </div>
                                    <span className="text-xs sm:text-sm opacity-90 font-normal hidden sm:block">Cierre de Caja</span>
                                </div>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="dateRange" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative p-4 rounded-xl border bg-muted/30 border-border/50 transition-all focus-within:ring-2 focus-within:ring-blue-500/20">
                                    <Label className="flex items-center gap-2 text-sm font-medium mb-3">
                                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                                                <line x1="16" x2="16" y1="2" y2="6" />
                                                <line x1="8" x2="8" y1="2" y2="6" />
                                                <line x1="3" x2="21" y1="10" y2="10" />
                                            </svg>
                                        </div>
                                        <span className="text-muted-foreground">Fecha Inicio</span>
                                    </Label>
                                    <Input
                                        type="date"
                                        value={startDate ? startDate.toISOString().split('T')[0] : ""}
                                        onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                                        className="border-0 bg-background/90 backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-blue-500/30"
                                    />
                                </div>
                                <div className="relative p-4 rounded-xl border bg-muted/30 border-border/50 transition-all focus-within:ring-2 focus-within:ring-blue-500/20">
                                    <Label className="flex items-center gap-2 text-sm font-medium mb-3">
                                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                                                <line x1="16" x2="16" y1="2" y2="6" />
                                                <line x1="8" x2="8" y1="2" y2="6" />
                                                <line x1="3" x2="21" y1="10" y2="10" />
                                            </svg>
                                        </div>
                                        <span className="text-muted-foreground">Fecha Fin</span>
                                    </Label>
                                    <Input
                                        type="date"
                                        value={endDate ? endDate.toISOString().split('T')[0] : ""}
                                        onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                                        className="border-0 bg-background/90 backdrop-blur-sm shadow-sm focus:ring-2 focus:ring-blue-500/30"
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="shift" className="space-y-4">
                            <div className="relative p-4 rounded-xl border bg-gradient-to-br from-amber-500/5 to-amber-600/5 border-amber-200/50 dark:border-amber-800/30">
                                <Label className="flex items-center gap-2 text-sm font-medium mb-3">
                                    <div className="p-1.5 rounded-lg bg-amber-500 text-white shadow-sm shadow-amber-500/20">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="20" height="14" x="2" y="3" rx="2" />
                                            <line x1="8" x2="16" y1="21" y2="21" />
                                            <line x1="12" x2="12" y1="17" y2="21" />
                                        </svg>
                                    </div>
                                    <span className="text-amber-700 dark:text-amber-400 font-semibold">Seleccionar Turno (Cierre de Caja)</span>
                                </Label>
                                <Select value={selectedShift} onValueChange={setSelectedShift}>
                                    <SelectTrigger className="mt-2 bg-background/90 border-amber-200 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-700 focus:ring-2 focus:ring-amber-500/20 h-12">
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
                                <p className="text-xs text-muted-foreground mt-2 pl-1 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="16" y2="12" /><line x1="12" x2="12.01" y1="8" y2="8" /></svg>
                                    Mostrando los últimos 50 cierres de turno
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>

                    {/* Filtros Adicionales Estilo Moderno */}
                    <div className="mt-8 pt-6 border-t border-dashed">
                        <div className="flex items-center gap-2 mb-4">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-medium text-muted-foreground text-sm uppercase tracking-wider">Filtros Adicionales</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            {/* Estado de Habitación */}
                            <div className={`relative p-4 rounded-xl border transition-all duration-300 ${statusFilter !== 'all' ? 'bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/30 shadow-lg shadow-purple-500/5' : 'bg-muted/30 border-border/50 hover:border-purple-500/30 hover:bg-purple-500/5'}`}>
                                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                                    <div className={`p-1.5 rounded-lg ${statusFilter !== 'all' ? 'bg-purple-500 text-white' : 'bg-purple-500/10 text-purple-500'}`}>
                                        {statusFilter !== 'all' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>}
                                    </div>
                                    <span className={statusFilter !== 'all' ? 'text-purple-400' : 'text-muted-foreground'}>Estado</span>
                                </label>
                                <div className="relative group">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="w-full pl-4 pr-10 py-2.5 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-purple-500/30 focus:outline-none hover:bg-background shadow-sm"
                                    >
                                        <option value="all">✨ Todos los estados</option>
                                        <option value="FINALIZADA">🏁 Finalizadas (Checkout)</option>
                                        <option value="ACTIVA">⏱️ Activas (En curso)</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:translate-y-[-45%]">
                                        <ArrowDownCircle className={`h-4 w-4 ${statusFilter !== 'all' ? 'text-purple-500' : 'text-muted-foreground'}`} />
                                    </div>
                                </div>
                            </div>

                            {/* Método de Pago */}
                            <div className={`relative p-4 rounded-xl border transition-all duration-300 ${paymentMethodFilter !== 'all' ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/30 shadow-lg shadow-emerald-500/5' : 'bg-muted/30 border-border/50 hover:border-emerald-500/30 hover:bg-emerald-500/5'}`}>
                                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                                    <div className={`p-1.5 rounded-lg ${paymentMethodFilter !== 'all' ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
                                    </div>
                                    <span className={paymentMethodFilter !== 'all' ? 'text-emerald-400' : 'text-muted-foreground'}>Método Pago</span>
                                </label>
                                <div className="relative group">
                                    <select
                                        value={paymentMethodFilter}
                                        onChange={(e) => setPaymentMethodFilter(e.target.value)}
                                        className="w-full pl-4 pr-10 py-2.5 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none hover:bg-background shadow-sm"
                                    >
                                        <option value="all">✨ Todos los métodos</option>
                                        <option value="EFECTIVO">💵 Efectivo</option>
                                        <option value="TARJETA">💳 Tarjeta</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:translate-y-[-45%]">
                                        <ArrowDownCircle className={`h-4 w-4 ${paymentMethodFilter !== 'all' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                                    </div>
                                </div>
                            </div>

                            {/* Habitación */}
                            <div className={`relative p-4 rounded-xl border transition-all duration-300 ${roomFilter !== 'all' ? 'bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/30 shadow-lg shadow-cyan-500/5' : 'bg-muted/30 border-border/50 hover:border-cyan-500/30 hover:bg-cyan-500/5'}`}>
                                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                                    <div className={`p-1.5 rounded-lg ${roomFilter !== 'all' ? 'bg-cyan-500 text-white' : 'bg-cyan-500/10 text-cyan-500'}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14" /><path d="M2 20h3" /><path d="M13 20h9" /><path d="M10 12v.01" /><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z" /></svg>
                                    </div>
                                    <span className={roomFilter !== 'all' ? 'text-cyan-400' : 'text-muted-foreground'}>Habitación</span>
                                </label>
                                <div className="relative group">
                                    <select
                                        value={roomFilter}
                                        onChange={(e) => setRoomFilter(e.target.value)}
                                        className="w-full pl-4 pr-10 py-2.5 border-0 rounded-lg bg-background/90 backdrop-blur-sm text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-cyan-500/30 focus:outline-none hover:bg-background shadow-sm"
                                    >
                                        <option value="all">✨ Todas las habitaciones</option>
                                        {rooms.map((room) => (
                                            <option key={room} value={room}>
                                                🚪 Habitación {room}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-hover:translate-y-[-45%]">
                                        <ArrowDownCircle className={`h-4 w-4 ${roomFilter !== 'all' ? 'text-cyan-500' : 'text-muted-foreground'}`} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <Button
                            onClick={() => {
                                setStartDate(undefined);
                                setEndDate(undefined);
                                setSelectedShift(undefined);
                                setPaymentMethodFilter("all");
                                setRoomFilter("all");
                                setStatusFilter("all");
                            }}
                            variant="ghost"
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            Limpiar Filtros
                        </Button>
                    </div>
                </div>
            </CollapsibleSection>

            {/* Herramienta de reasignación de pagos por turno (Oculta por solicitud)
             <ShiftMigrationTool />
            */}

            {/* Componente de reporte */}
            <IncomeReport
                reportType={reportType}
                shiftId={selectedShift}
                startDate={startDate}
                endDate={endDate}
                paymentMethodFilter={paymentMethodFilter}
                roomFilter={roomFilter}
                statusFilter={statusFilter}
            />

            {/* Estilos de impresión para ocultar UI */}

        </div>
    );
}

export default function IncomeReportPage() {
    return (
        <Suspense fallback={<div className="container mx-auto py-6">Cargando...</div>}>
            <IncomeReportContent />
        </Suspense>
    );
}
