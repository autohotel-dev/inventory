"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    FileText,
    LogIn,
    LogOut,
    Trash2,
    Pencil,
    PlusCircle,
    Zap,
    Wrench,
    ShieldAlert,
    XCircle,
    RefreshCw,
    Search,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    INSERT: { label: "Crear", icon: <PlusCircle className="h-3.5 w-3.5" />, color: "bg-green-500/10 text-green-600 border-green-300" },
    UPDATE: { label: "Actualizar", icon: <Pencil className="h-3.5 w-3.5" />, color: "bg-blue-500/10 text-blue-600 border-blue-300" },
    DELETE: { label: "Eliminar", icon: <Trash2 className="h-3.5 w-3.5" />, color: "bg-red-500/10 text-red-600 border-red-300" },
    LOGIN: { label: "Login", icon: <LogIn className="h-3.5 w-3.5" />, color: "bg-emerald-500/10 text-emerald-600 border-emerald-300" },
    LOGOUT: { label: "Logout", icon: <LogOut className="h-3.5 w-3.5" />, color: "bg-slate-500/10 text-slate-600 border-slate-300" },
    LOGIN_FAILED: { label: "Login Fallido", icon: <XCircle className="h-3.5 w-3.5" />, color: "bg-orange-500/10 text-orange-600 border-orange-300" },
    PERMISSION_CHANGE: { label: "Permisos", icon: <ShieldAlert className="h-3.5 w-3.5" />, color: "bg-purple-500/10 text-purple-600 border-purple-300" },
    PURGE_SYSTEM: { label: "Purge", icon: <Zap className="h-3.5 w-3.5" />, color: "bg-red-500/10 text-red-700 border-red-400" },
    MAINTENANCE: { label: "Mantenimiento", icon: <Wrench className="h-3.5 w-3.5" />, color: "bg-amber-500/10 text-amber-600 border-amber-300" },
};

interface AuditLog {
    id: string;
    action: string;
    table_name: string | null;
    record_id: string | null;
    description: string | null;
    employee_name: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

const PAGE_SIZE = 20;

export function AuditLogsViewer() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionFilter, setActionFilter] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const supabase = createClient();

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from("audit_logs")
                .select("id, action, table_name, record_id, description, employee_name, metadata, created_at", { count: "exact" })
                
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (actionFilter !== "all") {
                query = query;
            }

            if (searchTerm.trim()) {
                query = query.or(`description.ilike.%${searchTerm}%,employee_name.ilike.%${searchTerm}%,table_name.ilike.%${searchTerm}%`);
            }

            const { data, error, count } = await query;

            if (error) {
                console.error("Error fetching audit logs:", error);
                setLogs([]);
            } else {
                setLogs(data || []);
                setTotalCount(count || 0);
            }
        } catch (err) {
            console.error("Unexpected error fetching audit logs:", err);
        } finally {
            setLoading(false);
        }
    }, [supabase, actionFilter, searchTerm, page]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        setPage(0);
    }, [actionFilter, searchTerm]);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    return (
        <Card className="border-0 shadow-md border-t-4 border-t-indigo-500">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                            <FileText className="h-5 w-5 text-indigo-500" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Logs de Auditoría</CardTitle>
                            <CardDescription>Registro de acciones del sistema</CardDescription>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-1.5">
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                        Actualizar
                    </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por descripción, empleado o tabla..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 h-9 text-sm"
                        />
                    </div>
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                        <SelectTrigger className="w-full sm:w-[180px] h-9">
                            <SelectValue placeholder="Filtrar por acción" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las acciones</SelectItem>
                            {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
                                <SelectItem key={key} value={key}>
                                    <span className="flex items-center gap-1.5">
                                        {cfg.icon} {cfg.label}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>

            <CardContent>
                <ScrollArea className="h-[400px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                            <FileText className="h-8 w-8 mb-2 opacity-40" />
                            <p className="text-sm">No hay logs de auditoría</p>
                            <p className="text-xs">Los eventos aparecerán aquí automáticamente</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {logs.map((log) => {
                                const cfg = ACTION_CONFIG[log.action] || {
                                    label: log.action,
                                    icon: <FileText className="h-3.5 w-3.5" />,
                                    color: "bg-gray-500/10 text-gray-600 border-gray-300",
                                };

                                return (
                                    <div
                                        key={log.id}
                                        className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                                    >
                                        <Badge
                                            variant="outline"
                                            className={`gap-1 text-[10px] shrink-0 mt-0.5 ${cfg.color}`}
                                        >
                                            {cfg.icon}
                                            {cfg.label}
                                        </Badge>

                                        <div className="flex-1 min-w-0 space-y-0.5">
                                            <p className="text-sm leading-tight">
                                                {log.description || <span className="text-muted-foreground italic">Sin descripción</span>}
                                            </p>
                                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                                {log.employee_name && (
                                                    <span className="font-medium">{log.employee_name}</span>
                                                )}
                                                {log.table_name && (
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                                        {log.table_name}
                                                    </Badge>
                                                )}
                                                <span className="ml-auto shrink-0">{formatDate(log.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t mt-3">
                        <p className="text-xs text-muted-foreground">
                            {totalCount} registros · Página {page + 1} de {totalPages}
                        </p>
                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={page === 0}
                                onClick={() => setPage((p) => p - 1)}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={page >= totalPages - 1}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
