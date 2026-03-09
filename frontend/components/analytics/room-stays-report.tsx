"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Calendar,
    FileSpreadsheet,
    FileText,
    Hotel,
    Car,
    Clock,
    DollarSign,
    CheckCircle2,
    ArrowUpRight,
    Search
} from "lucide-react";
import { exportToExcel, exportToPDF, formatCurrency, formatDateTime } from "@/lib/export-utils";
import { cn } from "@/lib/utils";

interface RoomStayReportItem {
    id: string;
    room_name: string;
    status: string;
    check_in: string;
    check_in_at: string | null;  // Raw required for calculation if needed
    check_out: string | null;
    duration_minutes: number;
    entrance_valet: string | null;
    exit_valet: string | null;
    vehicle_plate: string | null;
    vehicle_model: string | null;
    total_amount: number;
    payment_status: string;
}

export function RoomStaysReport() {
    const [data, setData] = useState<RoomStayReportItem[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchReport = useCallback(async () => {
        const supabase = createClient();
        setLoading(true);

        try {
            const { data: stays, error } = await supabase
                .from("room_stays")
                .select(`
                    id,
                    status,
                    check_in_at,
                    actual_check_out_at,
                    vehicle_plate,
                    vehicle_model,
                    room:rooms(number),
                    valet_start:employees!room_stays_valet_employee_id_fkey(first_name, last_name),
                    valet_end:employees!room_stays_checkout_valet_employee_id_fkey(first_name, last_name),
                    sales_order:sales_orders(
                        total,
                        status,
                        remaining_amount
                    )
                `)
                .gte("created_at", startDate)
                .lte("created_at", endDate + 'T23:59:59')
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching room stays report:", error);
                return;
            }

            const formattedData: RoomStayReportItem[] = stays.map((stay: any, index: number) => {
                const checkIn = stay.check_in_at;
                const checkOut = stay.actual_check_out_at;

                let duration = 0;
                if (checkIn && checkOut) {
                    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
                    duration = Math.round(diff / 1000 / 60); // minutes
                }

                // Handle sales_order (could be array or object depending on query/client version)
                const rawOrder = stay.sales_order;
                const salesOrder = Array.isArray(rawOrder) ? rawOrder[0] : rawOrder;

                // Debug log
                if (index === 0) console.log("First stay raw order:", rawOrder, "Processed:", salesOrder);
                const total = salesOrder?.total || 0;
                const remaining = salesOrder?.remaining_amount || 0;

                let paymentStatus = 'PENDING';
                if (salesOrder?.status === 'CLOSED' || (total > 0 && remaining <= 0)) {
                    paymentStatus = 'PAID';
                }

                return {
                    id: stay.id,
                    room_name: stay.room?.number || '?',
                    status: stay.status,
                    check_in: checkIn,
                    check_in_at: checkIn,
                    check_out: checkOut,
                    duration_minutes: duration,
                    entrance_valet: stay.valet_start ? `${stay.valet_start.first_name} ${stay.valet_start.last_name}` : null,
                    exit_valet: stay.valet_end ? `${stay.valet_end.first_name} ${stay.valet_end.last_name}` : null,
                    vehicle_plate: stay.vehicle_plate,
                    vehicle_model: stay.vehicle_model,
                    total_amount: total,
                    payment_status: paymentStatus
                };
            });

            setData(formattedData);

        } catch (_error) {
            console.error("Error in fetchReport:", _error);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    // Computed Metrics
    const metrics = useMemo(() => {
        if (!data) return { totalStays: 0, totalRevenue: 0, avgDuration: 0, completionRate: 0 };

        const totalStays = data.length;
        const totalRevenue = data.reduce((acc, curr) => acc + curr.total_amount, 0);
        const completedStays = data.filter(s => s.status === 'FINALIZADA').length;
        const totalDuration = data.reduce((acc, curr) => acc + curr.duration_minutes, 0);

        return {
            totalStays,
            totalRevenue,
            avgDuration: completedStays > 0 ? Math.round(totalDuration / completedStays) : 0,
            completionRate: totalStays > 0 ? Math.round((completedStays / totalStays) * 100) : 0
        };
    }, [data]);

    const filteredData = useMemo(() => {
        if (!data) return [];
        return data.filter(item =>
            item.room_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.vehicle_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.entrance_valet?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    const handleExportExcel = () => {
        if (!data) return;
        exportToExcel({
            filename: `reporte-estancias-${startDate}-${endDate}`,
            sheetName: 'Estancias Detail',
            columns: [
                { header: 'Habitación', key: 'room_name', width: 10 },
                { header: 'Estado', key: 'status', width: 15 },
                { header: 'Ingreso', key: 'check_in', width: 22 },
                { header: 'Salida', key: 'check_out', width: 22 },
                { header: 'Duración (m)', key: 'duration_minutes', width: 12 },
                { header: 'Valet Entrada', key: 'entrance_valet', width: 20 },
                { header: 'Valet Salida', key: 'exit_valet', width: 20 },
                { header: 'Placa', key: 'vehicle_plate', width: 15 },
                { header: 'Modelo', key: 'vehicle_model', width: 20 },
                { header: 'Total', key: 'total_amount', width: 15 },
                { header: 'Estatus Pago', key: 'payment_status', width: 15 }
            ],
            data: data
        });
    };

    const handleExportPDF = () => {
        if (!data) return;
        exportToPDF({
            filename: `reporte-estancias-${startDate}-${endDate}`,
            title: `Reporte de Operaciones (${startDate} - ${endDate})`,
            columns: [
                { header: 'Hab', key: 'room_name' },
                { header: 'Entrada', key: 'check_in' },
                { header: 'Salida', key: 'check_out' },
                { header: 'Valet', key: 'entrance_valet' },
                { header: 'Vehículo', key: 'vehicle_plate' },
                { header: 'Total', key: 'total_amount' }
            ],
            data: data.map(d => ({
                ...d,
                check_in: d.check_in ? formatDateTime(d.check_in) : '-',
                check_out: d.check_out ? formatDateTime(d.check_out) : 'En curso',
                total_amount: formatCurrency(d.total_amount),
                entrance_valet: d.entrance_valet?.split(' ')[0] || '-'
            }))
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b border-border pb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Historial de Estancias</h2>
                    <p className="text-muted-foreground mt-1">
                        Auditoría completa de ocupación, tiempos y staff operativo.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-muted/50 border border-border px-3 py-2 rounded-md shadow-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <input
                            type="date"
                            className="bg-transparent border-none text-sm focus:ring-0 p-0 w-32 text-foreground color-invert"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="text-muted-foreground">-</span>
                        <input
                            type="date"
                            className="bg-transparent border-none text-sm focus:ring-0 p-0 w-32 text-foreground"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-10 border-border hover:bg-muted font-medium">
                            <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" /> Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-10 border-border hover:bg-muted font-medium">
                            <FileText className="h-4 w-4 mr-2 text-red-600" /> PDF
                        </Button>
                        <Button onClick={fetchReport} className="h-10 font-medium">
                            Actualizar
                        </Button>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="shadow-sm border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Estancias Totales</CardTitle>
                        <Hotel className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-card-foreground">{metrics.totalStays}</div>
                        <p className="text-xs text-muted-foreground">+0% desde ayer (simulado)</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Generados</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-card-foreground">{formatCurrency(metrics.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">En el período seleccionado</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Duración Promedio</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-card-foreground">{Math.floor(metrics.avgDuration / 60)}h {metrics.avgDuration % 60}m</div>
                        <p className="text-xs text-muted-foreground">Tiempo de uso efectivo</p>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Tasa Finalización</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-card-foreground">{metrics.completionRate}%</div>
                        <p className="text-xs text-muted-foreground">Estancias con checkout exitoso</p>
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            <Card className="border-border shadow-sm overflow-hidden bg-card">
                <div className="p-4 border-b border-border bg-muted/30 flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar hab, placa o valet..."
                            className="pl-9 bg-background border-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="relative w-full overflow-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-muted-foreground text-sm">Cargando datos detallados...</p>
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                                <Search className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground">No se encontraron resultados</h3>
                            <p className="text-muted-foreground text-sm mt-1">
                                Intenta ajustar los filtros de fecha o la búsqueda.
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium border-b border-border">
                                <tr>
                                    <th className="px-6 py-4 font-semibold w-[100px]">Habitación</th>
                                    <th className="px-6 py-4 font-semibold">Vehículo</th>
                                    <th className="px-6 py-4 font-semibold">Tiempos</th>
                                    <th className="px-6 py-4 font-semibold">Staff (Valet)</th>
                                    <th className="px-6 py-4 font-semibold text-right">Detalles Pago</th>
                                    <th className="px-6 py-4 font-semibold text-center w-[120px]">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredData.map((item) => (
                                    <tr key={item.id} className="hover:bg-muted/50 transition-colors group">
                                        <td className="px-6 py-4 align-top">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-foreground font-bold text-lg border border-border">
                                                {item.room_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            {item.vehicle_plate ? (
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="font-mono bg-background text-foreground border-border px-1.5 py-0 h-5 text-[10px]">
                                                            {item.vehicle_plate}
                                                        </Badge>
                                                    </div>
                                                    {item.vehicle_model && (
                                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Car className="h-3 w-3" />
                                                            <span className="truncate max-w-[120px]">{item.vehicle_model}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs italic">Sin vehículo</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2 text-foreground">
                                                    <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
                                                    <span className="font-medium">{item.check_in ? formatDateTime(item.check_in) : '-'}</span>
                                                </div>
                                                {item.check_out && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        <span>{formatDateTime(item.check_out)}</span>
                                                    </div>
                                                )}
                                                {item.duration_minutes > 0 && (
                                                    <div className="ml-5 text-xs text-muted-foreground font-mono">
                                                        {Math.floor(item.duration_minutes / 60)}h {item.duration_minutes % 60}m
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-top">
                                            <div className="space-y-2">
                                                {item.entrance_valet && (
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 text-[10px] font-bold">
                                                            IN
                                                        </div>
                                                        <span className="text-foreground">{item.entrance_valet}</span>
                                                    </div>
                                                )}
                                                {item.exit_valet && (
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-bold">
                                                            OUT
                                                        </div>
                                                        <span className="text-muted-foreground">{item.exit_valet}</span>
                                                    </div>
                                                )}
                                                {!item.entrance_valet && !item.exit_valet && (
                                                    <span className="text-muted-foreground text-xs">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-top text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="font-bold text-base tracking-tight text-foreground">{formatCurrency(item.total_amount)}</span>
                                                {item.payment_status === 'PAID' ? (
                                                    <Badge variant="secondary" className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-none text-[10px] px-2">
                                                        PAGADO
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-yellow-600 border-yellow-600/30 bg-yellow-500/10 text-[10px] px-2">
                                                        PENDIENTE
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 align-top text-center">
                                            <div className={cn(
                                                "inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                                item.status === 'FINALIZADA' && "bg-muted text-muted-foreground border-border",
                                                item.status === 'OCUPADA' && "bg-blue-500/10 text-blue-600 border-blue-500/20",
                                                item.status === 'SUCIA' && "bg-orange-500/10 text-orange-600 border-orange-500/20",
                                                !['FINALIZADA', 'OCUPADA', 'SUCIA'].includes(item.status) && "bg-muted text-muted-foreground"
                                            )}>
                                                {item.status}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </div>
    );
}
