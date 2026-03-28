"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
    Settings,
    Barcode,
    Volume2,
    Printer,
    RotateCcw,
    Save,
    Info,
    Zap,
    Wallet,
    TrendingUp,
    Package,
    Tag,
    History,
    Shield,
    Globe,
    Monitor,
    ChevronRight,
    Loader2,
    CheckCircle2,
    Clock,
    User,
    DoorOpen,
} from "lucide-react";
import { usePOSConfig, type POSConfig } from "@/hooks/use-pos-config";
import { useSystemConfig } from "@/hooks/use-system-config";
import { usePrinterSettings } from "@/hooks/use-printer-settings";
import { useUserRole } from "@/hooks/use-user-role";
import { BottlePackageRules } from "@/components/settings/bottle-package-rules";
import { ProductPromotions } from "@/components/settings/product-promotions";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit-logger";
import { AuditLogsViewer } from "@/components/settings/audit-logs-viewer";

// --- Section definitions ---
type SectionId = "general" | "rooms" | "reports" | "printing" | "scanner" | "sounds" | "packages" | "promotions" | "history" | "maintenance";

interface SectionDef {
    id: SectionId;
    label: string;
    icon: React.ReactNode;
    color: string;
    scope: "shared" | "local" | "info";
    adminOnly?: boolean;
}

const SECTIONS: SectionDef[] = [
    { id: "general", label: "General", icon: <Wallet className="h-4 w-4" />, color: "text-emerald-500", scope: "shared" },
    { id: "rooms", label: "Habitaciones", icon: <DoorOpen className="h-4 w-4" />, color: "text-orange-500", scope: "shared" },
    { id: "reports", label: "Reportes", icon: <TrendingUp className="h-4 w-4" />, color: "text-indigo-500", scope: "shared" },
    { id: "printing", label: "Impresión", icon: <Printer className="h-4 w-4" />, color: "text-purple-500", scope: "local" },
    { id: "scanner", label: "Escáner", icon: <Barcode className="h-4 w-4" />, color: "text-blue-500", scope: "local" },
    { id: "sounds", label: "Sonidos", icon: <Volume2 className="h-4 w-4" />, color: "text-green-500", scope: "local" },
    { id: "packages", label: "Paquetes", icon: <Package className="h-4 w-4" />, color: "text-amber-500", scope: "shared" },
    { id: "promotions", label: "Promociones", icon: <Tag className="h-4 w-4" />, color: "text-rose-500", scope: "shared" },
    { id: "history", label: "Historial", icon: <History className="h-4 w-4" />, color: "text-gray-500", scope: "info", adminOnly: true },
    { id: "maintenance", label: "Mantenimiento", icon: <Zap className="h-4 w-4" />, color: "text-red-500", scope: "shared", adminOnly: true },
];

function ScopeBadge({ scope }: { scope: "shared" | "local" | "info" }) {
    if (scope === "shared") {
        return (
            <Badge variant="outline" className="text-[10px] gap-1 bg-sky-500/10 text-sky-600 border-sky-300 dark:border-sky-700">
                <Globe className="h-3 w-3" /> Compartido
            </Badge>
        );
    }
    if (scope === "local") {
        return (
            <Badge variant="outline" className="text-[10px] gap-1 bg-slate-500/10 text-slate-600 border-slate-300 dark:border-slate-600">
                <Monitor className="h-3 w-3" /> Este dispositivo
            </Badge>
        );
    }
    return null;
}

function ReadOnlyNotice() {
    return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
            <Shield className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
                Solo los administradores pueden modificar esta sección. Los cambios se aplican a todos los dispositivos.
            </p>
        </div>
    );
}

// --- Componente de Botón de Reinicio ---
function NuclearResetButton() {
    const [isConfirming, setIsConfirming] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const supabase = createClient();

    const handleNuclearReset = async () => {
        if (confirmText !== "REINICIAR") {
            toast.error("Debes escribir REINICIAR exactamente para proceder");
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.rpc("purgesystem", { confirm: confirmText });

            if (error) {
                console.error("Error in nuclear reset:", JSON.stringify(error, null, 2));
                toast.error("Error al reiniciar el sistema", {
                    description: error.message || error.code || JSON.stringify(error)
                });
            } else {
                logAudit("PURGE_SYSTEM", {
                    description: "Reinicio nuclear ejecutado desde panel de mantenimiento",
                });
                toast.success("Sistema reiniciado con éxito", {
                    description: "Todos los datos de prueba han sido purgados."
                });
                // Recargar para limpiar estados de React
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (err) {
            console.error("Unexpected error in nuclear reset:", err);
            toast.error("Error inesperado");
        } finally {
            setIsLoading(false);
            setIsConfirming(false);
            setConfirmText("");
        }
    };

    return (
        <>
            <Button
                variant="destructive"
                className="w-full sm:w-auto shadow-lg shadow-red-500/20"
                onClick={() => setIsConfirming(true)}
                disabled={isLoading}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Reiniciando...
                    </>
                ) : (
                    <>
                        <Zap className="mr-2 h-4 w-4" />
                        Ejecutar Reinicio Nuclear
                    </>
                )}
            </Button>

            <ConfirmDialog
                isOpen={isConfirming}
                onClose={() => {
                    setIsConfirming(false);
                    setConfirmText("");
                }}
                onConfirm={handleNuclearReset}
                title="¿ESTÁS TOTALMENTE SEGURO?"
                description="Esta acción eliminará todas las estancias, pagos, órdenes y logs de forma permanente. Para continuar, escribe REINICIAR abajo y haz clic en confirmar."
                confirmText="SÍ, BORRAR TODO"
                variant="destructive"
            >
                <div className="space-y-3">
                    <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-tight">
                       ⚠️ Confirma con la palabra clave:
                    </p>
                    <Input
                        placeholder="Escribe REINICIAR"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                        className="font-black text-center text-lg border-2 border-red-500/30 focus-visible:ring-red-500 h-12"
                        autoFocus
                    />
                </div>
            </ConfirmDialog>
        </>
    );
}

// --- Main Component ---
export default function SettingsPage() {
    const { config, isLoaded, saveConfig, resetConfig } = usePOSConfig();
    const { config: systemConfig, meta, isLoaded: systemLoaded, isSaving: systemSaving, saveConfig: saveSystemConfig } = useSystemConfig();
    const { size: printerSize, saveSize: savePrinterSize } = usePrinterSettings();
    const { role, isAdmin, isManager, isLoading: roleLoading, employeeName } = useUserRole();

    const [localConfig, setLocalConfig] = useState<POSConfig | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [activeSection, setActiveSection] = useState<SectionId>("general");

    const canEditShared = isAdmin || isManager;

    useEffect(() => {
        if (isLoaded && config && systemLoaded) {
            if (!localConfig) {
                setLocalConfig({
                    ...config,
                    initialCashFund: systemConfig.initialCashFund,
                    valetAdvanceAmount: systemConfig.valetAdvanceAmount,
                    includeGlobalSalesInShift: systemConfig.includeGlobalSalesInShift,
                    maxPendingQuickCheckins: systemConfig.maxPendingQuickCheckins,
                    maxShiftsReceptionist: systemConfig.maxShiftsReceptionist,
                    maxShiftsValet: systemConfig.maxShiftsValet,
                    maxShiftsAdmin: systemConfig.maxShiftsAdmin,
                });
            }
        }
    }, [isLoaded, config, systemLoaded, systemConfig, localConfig]);

    useEffect(() => {
        if (localConfig && isLoaded) {
            const changed = JSON.stringify(localConfig) !== JSON.stringify(config);
            setHasChanges(changed);
        }
    }, [localConfig, config, isLoaded]);

    const updateLocalConfig = (key: keyof POSConfig, value: boolean | number) => {
        if (localConfig) {
            setLocalConfig({ ...localConfig, [key]: value });
        }
    };

    const handleSave = async () => {
        if (localConfig) {
            saveConfig(localConfig);
            try {
                await saveSystemConfig({
                    initialCashFund: localConfig.initialCashFund,
                    valetAdvanceAmount: localConfig.valetAdvanceAmount,
                    includeGlobalSalesInShift: localConfig.includeGlobalSalesInShift,
                    maxPendingQuickCheckins: localConfig.maxPendingQuickCheckins,
                    maxShiftsReceptionist: localConfig.maxShiftsReceptionist,
                    maxShiftsValet: localConfig.maxShiftsValet,
                    maxShiftsAdmin: localConfig.maxShiftsAdmin,
                });
                toast.success("Configuración guardada", {
                    description: "Los cambios se aplicarán en todos los dispositivos"
                });
            } catch (err) {
                console.error('Error saving system config:', err);
                toast.error("Error al guardar", {
                    description: "Los ajustes locales se guardaron, pero no se pudo sincronizar con el servidor."
                });
            }
            setHasChanges(false);
        }
    };

    const handleReset = () => {
        resetConfig();
        setLocalConfig(null);
        toast.info("Configuración restablecida", {
            description: "Se han restaurado los valores por defecto"
        });
        setTimeout(() => window.location.reload(), 500);
    };

    if (!isLoaded || !systemLoaded || !localConfig || roleLoading) {
        return (
            <div className="container mx-auto py-8 px-4">
                <div className="flex items-center justify-center h-64 gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Cargando configuración...</span>
                </div>
            </div>
        );
    }

    const visibleSections = SECTIONS.filter(s => !s.adminOnly || canEditShared);

    return (
        <div className="mx-auto py-6 px-4 lg:px-8">
            {/* --- Header --- */}
            <div className="mb-6">
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 p-6 text-white">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                                <Settings className="h-7 w-7" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
                                <p className="text-sm text-white/60">Personaliza el comportamiento del sistema</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {hasChanges && (
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse">
                                    Cambios sin guardar
                                </Badge>
                            )}
                            <Badge variant="outline" className="bg-white/10 text-white/80 border-white/20 gap-1.5">
                                <User className="h-3 w-3" />
                                {employeeName || role || "Admin"}
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Main Layout: Sidebar + Content --- */}
            <div className="flex gap-6">
                {/* Sidebar */}
                <div className="w-56 shrink-0 hidden md:block">
                    <div className="sticky top-20 space-y-1">
                        {visibleSections.map((section) => {
                            const isActive = activeSection === section.id;
                            return (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group text-left",
                                        isActive
                                            ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <span className={cn(
                                        "transition-colors",
                                        isActive ? section.color : "text-muted-foreground group-hover:text-foreground"
                                    )}>
                                        {section.icon}
                                    </span>
                                    <span className="flex-1">{section.label}</span>
                                    {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary/50" />}
                                </button>
                            );
                        })}

                        <Separator className="my-3" />

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleReset}
                            className="w-full justify-start text-destructive hover:bg-destructive/10 text-xs gap-2"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restablecer valores
                        </Button>
                    </div>
                </div>

                {/* Mobile Section Selector */}
                <div className="md:hidden w-full">
                    <ScrollArea className="w-full">
                        <div className="flex gap-2 pb-4">
                            {visibleSections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                                        activeSection === section.id
                                            ? "bg-primary/10 text-primary border border-primary/20"
                                            : "bg-muted text-muted-foreground"
                                    )}
                                >
                                    <span className={section.color}>{section.icon}</span>
                                    {section.label}
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Content Panel */}
                <div className="flex-1 min-w-0">
                    <div className="space-y-6">
                        {/* ==================== GENERAL ==================== */}
                        {activeSection === "general" && (
                            <Card className="border-0 shadow-md">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-lg bg-emerald-500/10">
                                                <Wallet className="h-5 w-5 text-emerald-500" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">Configuración de Caja</CardTitle>
                                                <CardDescription>Parámetros financieros del turno</CardDescription>
                                            </div>
                                        </div>
                                        <ScopeBadge scope="shared" />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {!canEditShared && <ReadOnlyNotice />}

                                    <div className="space-y-2">
                                        <Label className="text-base font-medium">Fondo de Caja Inicial</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Monto de efectivo disponible al iniciar cada turno.
                                        </p>
                                        <div className="flex items-center gap-2 max-w-xs">
                                            <span className="text-lg font-medium text-muted-foreground">$</span>
                                            <Input
                                                type="number"
                                                value={localConfig.initialCashFund}
                                                onChange={(e) => updateLocalConfig('initialCashFund', parseFloat(e.target.value) || 0)}
                                                min={0}
                                                step={100}
                                                className="text-lg"
                                                disabled={!canEditShared}
                                            />
                                            <span className="text-sm text-muted-foreground">MXN</span>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <Label className="text-base font-medium">Adelanto por Cochero</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Monto que recepción entrega a cada cochero al inicio de turno.
                                        </p>
                                        <div className="flex items-center gap-2 max-w-xs">
                                            <span className="text-lg font-medium text-muted-foreground">$</span>
                                            <Input
                                                type="number"
                                                value={localConfig.valetAdvanceAmount}
                                                onChange={(e) => updateLocalConfig('valetAdvanceAmount', parseFloat(e.target.value) || 0)}
                                                min={0}
                                                step={50}
                                                className="text-lg"
                                                disabled={!canEditShared}
                                            />
                                            <span className="text-sm text-muted-foreground">MXN c/u</span>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2 p-3 bg-emerald-500/10 rounded-lg">
                                        <Info className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                            <strong>Fórmula:</strong> Disponible = Fondo + Cobros − Gastos − (Cocheros × Adelanto)
                                        </p>
                                    </div>

                                    <Separator />

                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <Label className="text-base font-medium">Límites de Turnos Activos</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Máximo número de empleados por rol que pueden tener turno abierto simultáneamente.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-sm">Recepcionistas</Label>
                                                <Input
                                                    type="number"
                                                    value={localConfig.maxShiftsReceptionist}
                                                    onChange={(e) => updateLocalConfig('maxShiftsReceptionist', parseInt(e.target.value) || 1)}
                                                    min={1}
                                                    max={10}
                                                    className="max-w-[120px]"
                                                    disabled={!canEditShared}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm">Cocheros</Label>
                                                <Input
                                                    type="number"
                                                    value={localConfig.maxShiftsValet}
                                                    onChange={(e) => updateLocalConfig('maxShiftsValet', parseInt(e.target.value) || 1)}
                                                    min={1}
                                                    max={20}
                                                    className="max-w-[120px]"
                                                    disabled={!canEditShared}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm">Administradores</Label>
                                                <Input
                                                    type="number"
                                                    value={localConfig.maxShiftsAdmin}
                                                    onChange={(e) => updateLocalConfig('maxShiftsAdmin', parseInt(e.target.value) || 1)}
                                                    min={1}
                                                    max={10}
                                                    className="max-w-[120px]"
                                                    disabled={!canEditShared}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ==================== HABITACIONES ==================== */}
                        {activeSection === "rooms" && (
                            <Card className="border-0 shadow-md">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-lg bg-orange-500/10">
                                                <DoorOpen className="h-5 w-5 text-orange-500" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">Habitaciones</CardTitle>
                                                <CardDescription>Límites y reglas de entrada rápida</CardDescription>
                                            </div>
                                        </div>
                                        <ScopeBadge scope="shared" />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {!canEditShared && <ReadOnlyNotice />}

                                    <div className="space-y-2">
                                        <Label className="text-base font-medium">Máx. habitaciones con pago pendiente</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Número máximo de habitaciones que pueden tener cobro pendiente (Entrada Rápida) antes de bloquear nuevas entradas.
                                        </p>
                                        <div className="flex items-center gap-2 max-w-xs">
                                            <Input
                                                type="number"
                                                value={localConfig.maxPendingQuickCheckins}
                                                onChange={(e) => updateLocalConfig('maxPendingQuickCheckins' as any, parseInt(e.target.value) || 1)}
                                                min={1}
                                                max={20}
                                                step={1}
                                                className="text-lg"
                                                disabled={!canEditShared}
                                            />
                                            <span className="text-sm text-muted-foreground">habitaciones</span>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2 p-3 bg-orange-500/10 rounded-lg">
                                        <Info className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-orange-700 dark:text-orange-300">
                                            <strong>Entrada Rápida:</strong> Permite registrar huéspedes sin cobrar de inmediato.
                                            Este límite previene que se acumulen demasiados cobros pendientes.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ==================== REPORTES ==================== */}
                        {activeSection === "reports" && (
                            <Card className="border-0 shadow-md">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-lg bg-indigo-500/10">
                                                <TrendingUp className="h-5 w-5 text-indigo-500" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">Reportes del Dashboard</CardTitle>
                                                <CardDescription>Cómo se calculan los totales en recepción</CardDescription>
                                            </div>
                                        </div>
                                        <ScopeBadge scope="shared" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {!canEditShared && <ReadOnlyNotice />}

                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5 flex-1 mr-4">
                                            <Label className="text-base font-medium">Incluir ventas globales en turno</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Si está activo, el dashboard sumará TODAS las ventas del turno (incluyendo admins).
                                                Si se desactiva, solo las del usuario logueado.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={localConfig.includeGlobalSalesInShift ?? true}
                                            onCheckedChange={(checked) => updateLocalConfig('includeGlobalSalesInShift', checked)}
                                            disabled={!canEditShared}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ==================== IMPRESIÓN ==================== */}
                        {activeSection === "printing" && (
                            <Card className="border-0 shadow-md">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-lg bg-purple-500/10">
                                                <Printer className="h-5 w-5 text-purple-500" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">Impresión de Tickets</CardTitle>
                                                <CardDescription>Opciones de impresión automática</CardDescription>
                                            </div>
                                        </div>
                                        <ScopeBadge scope="local" />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-medium">Impresión automática</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Imprimir tickets al registrar consumos
                                            </p>
                                        </div>
                                        <Switch
                                            checked={localConfig.autoPrintTickets}
                                            onCheckedChange={(checked) => updateLocalConfig('autoPrintTickets', checked)}
                                        />
                                    </div>

                                    {localConfig.autoPrintTickets && (
                                        <>
                                            <Separator />

                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label className="text-base font-medium">Tamaño de Papel</Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        Ancho del papel de la impresora térmica
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                                                    <Button
                                                        variant={printerSize === '90mm' ? 'default' : 'ghost'}
                                                        size="sm"
                                                        onClick={() => savePrinterSize('90mm')}
                                                        className="h-7 text-xs"
                                                    >
                                                        90mm
                                                    </Button>
                                                    <Button
                                                        variant={printerSize === '58mm' ? 'default' : 'ghost'}
                                                        size="sm"
                                                        onClick={() => savePrinterSize('58mm')}
                                                        className="h-7 text-xs"
                                                    >
                                                        58mm
                                                    </Button>
                                                </div>
                                            </div>

                                            <Separator />

                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label className="text-base font-medium">Ticket de cliente</Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        Imprimir ticket para el cliente
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={localConfig.printClientTicket}
                                                    onCheckedChange={(checked) => updateLocalConfig('printClientTicket', checked)}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <Label className="text-base font-medium">Comanda de recepción</Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        Imprimir comanda para recepción/cocina
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={localConfig.printReceptionTicket}
                                                    onCheckedChange={(checked) => updateLocalConfig('printReceptionTicket', checked)}
                                                />
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* ==================== ESCÁNER ==================== */}
                        {activeSection === "scanner" && (
                            <Card className="border-0 shadow-md">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-lg bg-blue-500/10">
                                                <Barcode className="h-5 w-5 text-blue-500" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">Escáner de Código de Barras</CardTitle>
                                                <CardDescription>Comportamiento de la pistola de escaneo</CardDescription>
                                            </div>
                                        </div>
                                        <ScopeBadge scope="local" />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-medium">Detección automática de escaneo</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Detecta automáticamente cuando se usa la pistola y agrega el producto sin presionar Enter.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={localConfig.autoScanDetection}
                                            onCheckedChange={(checked) => updateLocalConfig('autoScanDetection', checked)}
                                        />
                                    </div>

                                    {localConfig.autoScanDetection && (
                                        <>
                                            <Separator />
                                            <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-border/50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Zap className="h-4 w-4 text-amber-500" />
                                                    <span className="text-sm font-medium">Configuración avanzada</span>
                                                </div>

                                                <div className="grid gap-4 sm:grid-cols-3">
                                                    <div className="space-y-2">
                                                        <Label className="text-sm">Velocidad (ms)</Label>
                                                        <Input
                                                            type="number"
                                                            value={localConfig.scanSpeedThreshold}
                                                            onChange={(e) => updateLocalConfig('scanSpeedThreshold', parseInt(e.target.value) || 50)}
                                                            min={10} max={200}
                                                        />
                                                        <p className="text-[11px] text-muted-foreground">Tiempo máx entre caracteres (50ms default)</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-sm">Delay completado (ms)</Label>
                                                        <Input
                                                            type="number"
                                                            value={localConfig.scanCompleteDelay}
                                                            onChange={(e) => updateLocalConfig('scanCompleteDelay', parseInt(e.target.value) || 150)}
                                                            min={50} max={500}
                                                        />
                                                        <p className="text-[11px] text-muted-foreground">Espera para considerar completo (150ms default)</p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-sm">Longitud mínima</Label>
                                                        <Input
                                                            type="number"
                                                            value={localConfig.minScanLength}
                                                            onChange={(e) => updateLocalConfig('minScanLength', parseInt(e.target.value) || 3)}
                                                            min={1} max={20}
                                                        />
                                                        <p className="text-[11px] text-muted-foreground">Mínimo de caracteres (3 default)</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg">
                                        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-blue-700 dark:text-blue-300">
                                            <strong>Tip:</strong> Si tu pistola envía <code className="bg-blue-200/50 dark:bg-blue-800/50 px-1 rounded text-xs">Enter</code> después del escaneo, puedes desactivar la detección automática.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ==================== SONIDOS ==================== */}
                        {activeSection === "sounds" && (
                            <Card className="border-0 shadow-md">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-lg bg-green-500/10">
                                                <Volume2 className="h-5 w-5 text-green-500" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">Sonidos de Feedback</CardTitle>
                                                <CardDescription>Retroalimentación auditiva del sistema</CardDescription>
                                            </div>
                                        </div>
                                        <ScopeBadge scope="local" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-medium">Sonidos habilitados</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Reproduce sonidos al escanear, confirmar acciones y en errores
                                            </p>
                                        </div>
                                        <Switch
                                            checked={localConfig.soundEnabled}
                                            onCheckedChange={(checked) => updateLocalConfig('soundEnabled', checked)}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ==================== PAQUETES ==================== */}
                        {activeSection === "packages" && (
                            <BottlePackageRules />
                        )}

                        {/* ==================== PROMOCIONES ==================== */}
                        {activeSection === "promotions" && (
                            <ProductPromotions />
                        )}

                        {/* ==================== HISTORIAL ==================== */}
                        {activeSection === "history" && canEditShared && (
                            <Card className="border-0 shadow-md">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-lg bg-gray-500/10">
                                            <History className="h-5 w-5 text-gray-500" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">Historial de Cambios</CardTitle>
                                            <CardDescription>Última modificación a la configuración compartida</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {meta.updatedAt ? (
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border/50">
                                                <div className="p-2 rounded-full bg-primary/10">
                                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-sm font-medium">Configuración actualizada</p>
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {new Date(meta.updatedAt).toLocaleDateString('es-MX', {
                                                                day: 'numeric', month: 'long', year: 'numeric',
                                                                hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </span>
                                                        {meta.updatedBy && (
                                                            <span className="flex items-center gap-1">
                                                                <User className="h-3 w-3" />
                                                                {meta.updatedBy}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-3 rounded-lg bg-slate-500/5 border border-border/30">
                                                <p className="text-xs text-muted-foreground">
                                                    <strong>Valores actuales:</strong>
                                                </p>
                                                <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Fondo de caja</p>
                                                        <p className="font-mono font-medium">${systemConfig.initialCashFund.toLocaleString()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Adelanto cochero</p>
                                                        <p className="font-mono font-medium">${systemConfig.valetAdvanceAmount.toLocaleString()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Ventas globales</p>
                                                        <p className="font-medium">{systemConfig.includeGlobalSalesInShift ? "Sí" : "No"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Límites (R/C/A)</p>
                                                        <p className="font-mono font-medium">{systemConfig.maxShiftsReceptionist} / {systemConfig.maxShiftsValet} / {systemConfig.maxShiftsAdmin}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">No hay registro de cambios aún</p>
                                            <p className="text-xs">Aparecerá aquí cuando se modifique la configuración</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* ==================== MANTENIMIENTO ==================== */}
                        {activeSection === "maintenance" && canEditShared && (<>
                            <Card className="border-0 shadow-md border-t-4 border-t-red-500">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 rounded-lg bg-red-500/10">
                                                <Zap className="h-5 w-5 text-red-500" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-lg">Mantenimiento y Purga de Datos</CardTitle>
                                                <CardDescription>Herramientas de limpieza para entorno de pruebas</CardDescription>
                                            </div>
                                        </div>
                                        <Badge variant="destructive" className="gap-1 animate-pulse">
                                            Acción Destructiva
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20 space-y-4">
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Reinicio Nuclear del Sistema</h4>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Esta acción borrará permanentemente:
                                            </p>
                                            <ul className="text-xs text-muted-foreground list-disc list-inside ml-2 mt-1 space-y-0.5">
                                                <li>Todas las estancias y habitaciones ocupadas</li>
                                                <li>Órdenes de venta y consumos</li>
                                                <li>Pagos, recibos y cortes de caja</li>
                                                <li>Logs de auditoría y notificaciones</li>
                                                <li>Turnos abiertos (Shift Sessions)</li>
                                            </ul>
                                            <p className="text-xs font-bold text-red-600 dark:text-red-500 mt-2">
                                                ESTA ACCIÓN NO SE PUEDE DESHACER. TODAS LAS HABITACIONES VOLVERÁN A ESTADO 'LIBRE'.
                                            </p>
                                        </div>

                                        <div className="pt-2">
                                            <NuclearResetButton />
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg">
                                        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            <strong>Nota:</strong> Esta herramienta está diseñada exclusivamente para limpiar el ruido generado durante pruebas intensivas.
                                            Los datos maestros (productos, empleados, tipos de habitación) NO serán borrados.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <AuditLogsViewer />
                        </>)}
                    </div>
                </div>
            </div>

            {/* --- Floating Save Bar --- */}
            {hasChanges && (
                <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
                    <div className="mx-auto px-4 lg:px-8 pb-4">
                        <div className="pointer-events-auto bg-background/80 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl p-4 flex items-center justify-between animate-in slide-in-from-bottom-4 duration-300">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                Tienes cambios sin guardar
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setLocalConfig(null);
                                    }}
                                    className="text-muted-foreground"
                                >
                                    Descartar
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={systemSaving}
                                    className="gap-2 min-w-[140px]"
                                >
                                    {systemSaving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    {systemSaving ? "Guardando..." : "Guardar cambios"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
