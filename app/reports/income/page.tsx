"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IncomeReport } from "@/components/reports/income-report";
import { createClient } from "@/lib/supabase/client";
import { Filter } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function IncomeReportPage() {
    const searchParams = useSearchParams();
    const [reportType, setReportType] = useState<"shift" | "dateRange">("dateRange");
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();
    const [selectedShift, setSelectedShift] = useState<string | undefined>();
    const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
    const [roomFilter, setRoomFilter] = useState("all");

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
        const { data, error } = await supabase
            .from("shift_closings")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50);

        if (error) {
            console.error("Error fetching shifts:", error);
            return;
        }
        if (data) setShifts(data);
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

            {/* Filtros */}
            <Card>
                <CardContent className="pt-6">
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
                                                    {shift.employee_name || "Sin empleado"} - {new Date(shift.created_at).toLocaleDateString("es-MX", {
                                                        year: "numeric",
                                                        month: "long",
                                                        day: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit"
                                                    })}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            }}
                            variant="outline"
                        >
                            Limpiar Filtros
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Componente de reporte */}
            <IncomeReport
                reportType={reportType}
                shiftId={selectedShift}
                startDate={startDate}
                endDate={endDate}
                paymentMethodFilter={paymentMethodFilter}
                roomFilter={roomFilter}
            />

            {/* Estilos de impresión para ocultar UI */}

        </div>
    );
}
