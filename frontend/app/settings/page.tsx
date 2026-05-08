"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
    Sparkles,
    Building2,
    Cpu,
    ShoppingBag,
    Wrench,
    Wifi,
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

// ─── Consolidated Section Definitions ──────────────────────────────
type SectionId = "operations" | "devices" | "catalog" | "history" | "maintenance";

interface SectionDef {
    id: SectionId;
    label: string;
    description: string;
    icon: React.ReactNode;
    gradient: string;
    adminOnly?: boolean;
}

const SECTIONS: SectionDef[] = [
    { id: "operations", label: "Operación", description: "Caja, habitaciones y reportes", icon: <Building2 className="h-4 w-4" />, gradient: "from-white/10 to-white/[0.03]" },
    { id: "devices", label: "Dispositivos", description: "Impresión, escáner y sonidos", icon: <Cpu className="h-4 w-4" />, gradient: "from-white/10 to-white/[0.03]" },
    { id: "catalog", label: "Catálogo", description: "Paquetes y promociones", icon: <ShoppingBag className="h-4 w-4" />, gradient: "from-white/10 to-white/[0.03]" },
    { id: "history", label: "Historial", description: "Registro de cambios", icon: <History className="h-4 w-4" />, gradient: "from-white/10 to-white/[0.03]", adminOnly: true },
    { id: "maintenance", label: "Mantenimiento", description: "Purga y auditoría", icon: <Wrench className="h-4 w-4" />, gradient: "from-white/10 to-white/[0.03]", adminOnly: true },
];

// ─── Premium UI Primitives ─────────────────────────────────────────

function ScopeBadge({ scope }: { scope: "shared" | "local" }) {
    return scope === "shared" ? (
        <Badge variant="outline" className="text-[10px] gap-1.5 bg-white/[0.04] text-muted-foreground/60 border-white/[0.08] backdrop-blur-sm font-medium tracking-wide uppercase shrink-0">
            <Globe className="h-3 w-3" /> Compartido
        </Badge>
    ) : (
        <Badge variant="outline" className="text-[10px] gap-1.5 bg-white/[0.03] text-muted-foreground/50 border-white/[0.06] backdrop-blur-sm font-medium tracking-wide uppercase shrink-0">
            <Monitor className="h-3 w-3" /> Este dispositivo
        </Badge>
    );
}

function InfoCallout({ color, children }: { color: string; children: React.ReactNode }) {
    const styles: Record<string, { bg: string; icon: string }> = {
        emerald: { bg: "bg-white/[0.03] border-white/[0.08] text-muted-foreground/70", icon: "text-foreground/50" },
        orange: { bg: "bg-white/[0.03] border-white/[0.08] text-muted-foreground/70", icon: "text-foreground/50" },
        blue: { bg: "bg-white/[0.03] border-white/[0.08] text-muted-foreground/70", icon: "text-foreground/50" },
        indigo: { bg: "bg-white/[0.03] border-white/[0.08] text-muted-foreground/70", icon: "text-foreground/50" },
        red: { bg: "bg-red-500/[0.04] border-red-500/15 text-red-300/80", icon: "text-red-400/70" },
    };
    const s = styles[color] || styles.blue;
    return (
        <div className={cn("flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm", s.bg)}>
            <Info className={cn("h-4 w-4 mt-0.5 shrink-0", s.icon)} />
            <div className="text-sm leading-relaxed">{children}</div>
        </div>
    );
}

function ReadOnlyNotice() {
    return (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
            <div className="p-2 rounded-lg bg-white/[0.05]">
                <Shield className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            </div>
            <p className="text-sm text-muted-foreground/60">
                Solo los administradores pueden modificar esta sección. Los cambios se aplican a todos los dispositivos.
            </p>
        </div>
    );
}

/** A visual subsection divider inside a card — displays an icon, title, and scope badge. */
function SubsectionHeader({ icon, title, gradient, scope }: {
    icon: React.ReactNode;
    title: string;
    gradient: string;
    scope?: "shared" | "local";
}) {
    return (
        <div className="flex items-center justify-between pt-2 pb-1">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.06]">
                    {icon}
                </div>
                <h3 className="text-[15px] font-bold text-foreground/90">{title}</h3>
            </div>
            {scope && <ScopeBadge scope={scope} />}
        </div>
    );
}

function SettingRow({ title, description, children, disabled }: {
    title: string;
    description: string;
    children: React.ReactNode;
    disabled?: boolean;
}) {
    return (
        <div className={cn(
            "flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-3 sm:gap-0 group transition-all duration-200",
            disabled && "opacity-60"
        )}>
            <div className="space-y-0.5 flex-1 sm:mr-4">
                <Label className="text-[14px] font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
                    {title}
                </Label>
                <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
                    {description}
                </p>
            </div>
            {children}
        </div>
    );
}

function PremiumNumberInput({ value, onChange, prefix, suffix, disabled, min, max, step, className }: {
    value: number;
    onChange: (val: number) => void;
    prefix?: string;
    suffix?: string;
    disabled?: boolean;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
}) {
    return (
        <div className={cn("flex items-center gap-3", className)}>
            {prefix && <span className="text-lg font-semibold text-muted-foreground/50">{prefix}</span>}
            <Input
                type="number"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                min={min} max={max} step={step}
                className={cn(
                    "text-lg font-mono bg-white/[0.03] border-white/10 transition-all duration-300",
                    "focus:bg-white/[0.06] focus:border-primary/40 focus:shadow-[0_0_20px_rgba(255,255,255,0.05)]",
                    "hover:border-white/20",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
                disabled={disabled}
            />
            {suffix && <span className="text-sm text-muted-foreground/50 whitespace-nowrap">{suffix}</span>}
        </div>
    );
}

function SectionCard({ gradient, children }: { gradient: string; children: React.ReactNode }) {
    return (
        <div className="relative group animate-in fade-in-0 slide-in-from-right-4 duration-400">
            <div className={cn("absolute -inset-px rounded-2xl bg-gradient-to-br opacity-[0.12] blur-sm transition-opacity duration-500 group-hover:opacity-20", gradient)} />
            <Card className="relative border-0 shadow-xl bg-card/60 backdrop-blur-xl rounded-2xl overflow-hidden">
                <div className={cn("absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r", gradient)} />
                {children}
            </Card>
        </div>
    );
}

// ─── Nuclear Reset (unchanged logic) ────────────────────────────────
function NuclearResetButton() {
    const [isConfirming, setIsConfirming] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const supabase = createClient();

    const handleNuclearReset = async () => {
        if (confirmText !== "REINICIAR") { toast.error("Debes escribir REINICIAR exactamente para proceder"); return; }
        setIsLoading(true);
        try {
            const { error } = await supabase.rpc("purgesystem", { confirm: confirmText });
            if (error) {
                console.error("Error in nuclear reset:", JSON.stringify(error, null, 2));
                toast.error("Error al reiniciar el sistema", { description: error.message || error.code || JSON.stringify(error) });
            } else {
                logAudit("PURGE_SYSTEM", { description: "Reinicio nuclear ejecutado desde panel de mantenimiento" });
                toast.success("Sistema reiniciado con éxito", { description: "Todos los datos de prueba han sido purgados." });
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch { toast.error("Error inesperado"); }
        finally { setIsLoading(false); setIsConfirming(false); setConfirmText(""); }
    };

    return (
        <>
            <Button variant="destructive" className="w-full sm:w-auto shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all duration-300 hover:scale-[1.02]" onClick={() => setIsConfirming(true)} disabled={isLoading}>
                {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reiniciando...</>) : (<><Zap className="mr-2 h-4 w-4" />Ejecutar Reinicio Nuclear</>)}
            </Button>
            <ConfirmDialog isOpen={isConfirming} onClose={() => { setIsConfirming(false); setConfirmText(""); }} onConfirm={handleNuclearReset} title="¿ESTÁS TOTALMENTE SEGURO?" description="Esta acción eliminará todas las estancias, pagos, órdenes y logs de forma permanente. Para continuar, escribe REINICIAR abajo y haz clic en confirmar." confirmText="SÍ, BORRAR TODO" variant="destructive">
                <div className="space-y-3">
                    <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-tight">⚠️ Confirma con la palabra clave:</p>
                    <Input placeholder="Escribe REINICIAR" value={confirmText} onChange={(e) => setConfirmText(e.target.value.toUpperCase())} className="font-black text-center text-lg border-2 border-red-500/30 focus-visible:ring-red-500 h-12" autoFocus />
                </div>
            </ConfirmDialog>
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function SettingsPage() {
    const { config, isLoaded, saveConfig, resetConfig } = usePOSConfig();
    const { config: systemConfig, meta, isLoaded: systemLoaded, isSaving: systemSaving, saveConfig: saveSystemConfig } = useSystemConfig();
    const { size: printerSize, saveSize: savePrinterSize } = usePrinterSettings();
    const { role, isAdmin, isManager, isLoading: roleLoading, employeeName } = useUserRole();

    const [localConfig, setLocalConfig] = useState<POSConfig | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [activeSection, setActiveSection] = useState<SectionId>("operations");

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
                    autoChargeExtraHours: systemConfig.autoChargeExtraHours,
                    printQROnCheckin: systemConfig.printQROnCheckin,
                    thermalPrinterIP: systemConfig.thermalPrinterIP,
                    thermalPrinterPort: systemConfig.thermalPrinterPort,
                    hpPrinterIP: systemConfig.hpPrinterIP,
                    hpPrinterPort: systemConfig.hpPrinterPort,
                });
            }
        }
    }, [isLoaded, config, systemLoaded, systemConfig, localConfig]);

    useEffect(() => {
        if (localConfig && isLoaded) {
            setHasChanges(JSON.stringify(localConfig) !== JSON.stringify(config));
        }
    }, [localConfig, config, isLoaded]);

    const updateLocalConfig = (key: keyof POSConfig, value: boolean | number) => {
        if (localConfig) setLocalConfig({ ...localConfig, [key]: value });
    };

    const handleSave = async () => {
        if (!localConfig) return;
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
                autoChargeExtraHours: localConfig.autoChargeExtraHours,
                printQROnCheckin: localConfig.printQROnCheckin,
                thermalPrinterIP: localConfig.thermalPrinterIP,
                thermalPrinterPort: localConfig.thermalPrinterPort,
                hpPrinterIP: localConfig.hpPrinterIP,
                hpPrinterPort: localConfig.hpPrinterPort,
            });

            // Sync printer IPs to the print server
            try {
                const printServerUrl = process.env.NEXT_PUBLIC_PRINT_SERVER_URL || 'http://localhost:3001';
                await fetch(`${printServerUrl}/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        printerIP: localConfig.thermalPrinterIP,
                        printerPort: localConfig.thermalPrinterPort,
                        hpPrinterIP: localConfig.hpPrinterIP,
                        hpPrinterPort: localConfig.hpPrinterPort,
                    }),
                });
            } catch {
                // Print server might not be running — not critical
                console.warn('Could not sync to print server (may not be running)');
            }

            toast.success("Configuración guardada", { description: "Los cambios se aplicarán en todos los dispositivos" });
        } catch (err) {
            console.error('Error saving system config:', err);
            toast.error("Error al guardar", { description: "Los ajustes locales se guardaron, pero no se pudo sincronizar con el servidor." });
        }
        setHasChanges(false);
    };

    const handleReset = () => {
        resetConfig();
        setLocalConfig(null);
        toast.info("Configuración restablecida", { description: "Se han restaurado los valores por defecto" });
        setTimeout(() => window.location.reload(), 500);
    };

    // ─── Loading ────────────────────────────────────────────────────
    if (!isLoaded || !systemLoaded || !localConfig || roleLoading) {
        return (
            <div className="container mx-auto py-8 px-4">
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                        <div className="relative p-4 rounded-full bg-primary/10 backdrop-blur-sm">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    </div>
                    <span className="text-muted-foreground text-sm">Cargando configuración...</span>
                </div>
            </div>
        );
    }

    const visibleSections = SECTIONS.filter(s => !s.adminOnly || canEditShared);
    const currentSection = SECTIONS.find(s => s.id === activeSection)!;

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="mx-auto py-4 sm:py-6 px-3 sm:px-4 lg:px-8">
            {/* ─── Header ──────────────────────────────────────────── */}
            <div className="mb-6 sm:mb-8">
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-6 backdrop-blur-xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent" />

                    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.06] border border-white/[0.06] shrink-0">
                                <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-foreground/70" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground/90">Configuración</h1>
                                <p className="text-xs sm:text-sm text-muted-foreground/50 font-medium truncate">Personaliza el comportamiento del sistema</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            {hasChanges && (
                                <Badge variant="outline" className="bg-white/[0.04] text-foreground/60 border-white/[0.08] backdrop-blur-sm animate-pulse font-medium text-[10px] sm:text-xs">
                                    <div className="h-1.5 w-1.5 rounded-full bg-foreground/50 mr-1.5 sm:mr-2" />
                                    Cambios sin guardar
                                </Badge>
                            )}
                            <Badge variant="outline" className="bg-white/[0.04] text-muted-foreground/60 border-white/[0.06] gap-1.5 sm:gap-2 py-1 sm:py-1.5 px-2 sm:px-3 backdrop-blur-sm font-medium text-[10px] sm:text-xs">
                                <div className="p-0.5 sm:p-1 rounded-md bg-white/[0.06]"><User className="h-3 w-3" /></div>
                                <span className="truncate max-w-[120px] sm:max-w-none">{employeeName || role || "Admin"}</span>
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Main Layout ──────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                {/* ─── Sidebar (Desktop) ─── */}
                <div className="w-60 shrink-0 hidden md:block">
                    <div className="sticky top-20">
                        <div className="relative rounded-2xl border border-white/[0.06] bg-card/40 backdrop-blur-xl p-3 space-y-1">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold px-3 pb-2">Secciones</p>

                            {visibleSections.map((section) => {
                                const isActive = activeSection === section.id;
                                return (
                                    <button key={section.id} onClick={() => setActiveSection(section.id)} className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group text-left relative",
                                        isActive ? "bg-white/[0.08] text-foreground" : "text-muted-foreground/60 hover:bg-white/[0.04] hover:text-foreground"
                                    )}>
                                        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-foreground/50" />}
                                        <span className={cn("transition-all duration-200", isActive ? "text-foreground" : "text-muted-foreground/50 group-hover:text-foreground/70")}>
                                            {section.icon}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <span className="block">{section.label}</span>
                                            {!isActive && <span className="block text-[11px] text-muted-foreground/35 truncate">{section.description}</span>}
                                        </div>
                                        {isActive && <ChevronRight className="h-3.5 w-3.5 text-foreground/30" />}
                                    </button>
                                );
                            })}

                            <div className="px-3 py-2"><Separator className="bg-white/[0.06]" /></div>

                            <Button variant="ghost" size="sm" onClick={handleReset} className="w-full justify-start text-destructive/70 hover:text-destructive hover:bg-destructive/10 text-xs gap-2 rounded-xl transition-all duration-200">
                                <RotateCcw className="h-3.5 w-3.5" />Restablecer valores
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ─── Mobile Section Selector ─── */}
                <div className="md:hidden w-full overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 pb-4 min-w-min">
                        {visibleSections.map((section) => (
                            <button key={section.id} onClick={() => setActiveSection(section.id)} className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-300 border",
                                activeSection === section.id
                                    ? "text-foreground bg-white/[0.10] border-white/[0.12] shadow-lg"
                                    : "bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:bg-white/[0.06]"
                            )}>
                                {section.icon}{section.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ─── Content ─── */}
                <div className="w-full md:flex-1 md:min-w-0">
                    <div className="space-y-6" key={activeSection}>

                        {/* ══════════════════════════════════════════════════════
                            OPERACIÓN — Caja · Habitaciones · Reportes · Turnos
                           ══════════════════════════════════════════════════════ */}
                        {activeSection === "operations" && (
                            <SectionCard gradient={currentSection.gradient}>
                                <CardHeader className="pb-0 pt-5 sm:pt-6 px-4 sm:px-7">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <div className="p-3 rounded-xl bg-white/[0.05] border border-white/[0.06]">
                                            <Building2 className="h-6 w-6 text-foreground/60" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl font-bold">Operación del Negocio</CardTitle>
                                            <CardDescription className="text-muted-foreground/60">Parámetros financieros, límites operativos y reglas del dashboard</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="px-4 sm:px-7 pb-5 sm:pb-7 pt-4">
                                    {!canEditShared && <ReadOnlyNotice />}

                                    {/* ── Sub: Configuración de Caja ── */}
                                    <div className="space-y-5">
                                        <SubsectionHeader
                                            icon={<Wallet className="h-4 w-4 text-foreground/60" />}
                                            title="Configuración de Caja"
                                            gradient=""
                                            scope="shared"
                                        />

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pl-1">
                                            <div className="space-y-2">
                                                <Label className="text-[14px] font-semibold">Fondo de Caja Inicial</Label>
                                                <p className="text-[12px] text-muted-foreground/50">Efectivo disponible al iniciar cada turno.</p>
                                                <PremiumNumberInput value={localConfig.initialCashFund} onChange={(v) => updateLocalConfig('initialCashFund', v)} prefix="$" suffix="MXN" min={0} step={100} disabled={!canEditShared} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[14px] font-semibold">Adelanto por Cochero</Label>
                                                <p className="text-[12px] text-muted-foreground/50">Monto que recepción entrega a cada cochero al inicio del turno.</p>
                                                <PremiumNumberInput value={localConfig.valetAdvanceAmount} onChange={(v) => updateLocalConfig('valetAdvanceAmount', v)} prefix="$" suffix="MXN c/u" min={0} step={50} disabled={!canEditShared} />
                                            </div>
                                        </div>

                                        <InfoCallout color="emerald">
                                            <strong>Fórmula:</strong> Disponible = Fondo + Cobros − Gastos − (Cocheros × Adelanto)
                                        </InfoCallout>
                                    </div>

                                    {/* ── Divider ── */}
                                    <div className="my-7 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                                    {/* ── Sub: Habitaciones ── */}
                                    <div className="space-y-5">
                                        <SubsectionHeader
                                            icon={<DoorOpen className="h-4 w-4 text-foreground/60" />}
                                            title="Habitaciones"
                                            gradient=""
                                            scope="shared"
                                        />

                                        <div className="pl-1 space-y-3">
                                            <div className="space-y-2">
                                                <Label className="text-[14px] font-semibold">Máx. habitaciones con pago pendiente</Label>
                                                <p className="text-[12px] text-muted-foreground/50">
                                                    Número máximo de habitaciones que pueden tener cobro pendiente (Entrada Rápida) antes de bloquear nuevas entradas.
                                                </p>
                                                <PremiumNumberInput
                                                    value={localConfig.maxPendingQuickCheckins}
                                                    onChange={(v) => updateLocalConfig('maxPendingQuickCheckins' as any, v)}
                                                    suffix="habitaciones" min={1} max={20} step={1}
                                                    disabled={!canEditShared} className="max-w-sm"
                                                />
                                            </div>
                                            <InfoCallout color="orange">
                                                <strong>Entrada Rápida:</strong> Permite registrar huéspedes sin cobrar de inmediato.
                                                Este límite previene que se acumulen demasiados cobros pendientes.
                                            </InfoCallout>
                                        </div>
                                        <div className="pl-1 space-y-0 divide-y divide-white/[0.04]">
                                            <SettingRow
                                                title="Autocobro de hora extra"
                                                description="Si está activo, el sistema cobrará automáticamente una hora extra cuando termine el tiempo de la habitación."
                                                disabled={!canEditShared}
                                            >
                                                <Switch
                                                    checked={localConfig.autoChargeExtraHours ?? true}
                                                    onCheckedChange={(c) => updateLocalConfig('autoChargeExtraHours', c)}
                                                    disabled={!canEditShared}
                                                />
                                            </SettingRow>
                                            <SettingRow
                                                title="Imprimir QR al ingreso"
                                                description="Si está activo, se imprimirá automáticamente un ticket con el código QR del portal de huéspedes al registrar una entrada."
                                                disabled={!canEditShared}
                                            >
                                                <Switch
                                                    checked={localConfig.printQROnCheckin ?? false}
                                                    onCheckedChange={(c) => updateLocalConfig('printQROnCheckin' as any, c)}
                                                    disabled={!canEditShared}
                                                />
                                            </SettingRow>
                                        </div>
                                    </div>

                                    {/* ── Divider ── */}
                                    <div className="my-7 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                                    {/* ── Sub: Reportes del Dashboard ── */}
                                    <div className="space-y-4">
                                        <SubsectionHeader
                                            icon={<TrendingUp className="h-4 w-4 text-foreground/60" />}
                                            title="Reportes del Dashboard"
                                            gradient=""
                                            scope="shared"
                                        />

                                        <div className="pl-1">
                                            <SettingRow
                                                title="Incluir ventas globales en turno"
                                                description="Si está activo, el dashboard sumará TODAS las ventas del turno (incluyendo admins). Si se desactiva, solo las del usuario logueado."
                                                disabled={!canEditShared}
                                            >
                                                <Switch
                                                    checked={localConfig.includeGlobalSalesInShift ?? true}
                                                    onCheckedChange={(c) => updateLocalConfig('includeGlobalSalesInShift', c)}
                                                    disabled={!canEditShared}
                                                />
                                            </SettingRow>
                                        </div>
                                    </div>

                                    {/* ── Divider ── */}
                                    <div className="my-7 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                                    {/* ── Sub: Límites de Turnos ── */}
                                    <div className="space-y-5">
                                        <SubsectionHeader
                                            icon={<User className="h-4 w-4 text-foreground/60" />}
                                            title="Límites de Turnos Activos"
                                            gradient=""
                                            scope="shared"
                                        />

                                        <p className="text-[12px] text-muted-foreground/50 pl-1">
                                            Máximo número de empleados por rol que pueden tener turno abierto simultáneamente.
                                        </p>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {([
                                                { label: "Recepcionistas", key: "maxShiftsReceptionist" as const, value: localConfig.maxShiftsReceptionist, max: 10, color: "bg-white/[0.02] border-white/[0.06]" },
                                                { label: "Cocheros", key: "maxShiftsValet" as const, value: localConfig.maxShiftsValet, max: 20, color: "bg-white/[0.02] border-white/[0.06]" },
                                                { label: "Administradores", key: "maxShiftsAdmin" as const, value: localConfig.maxShiftsAdmin, max: 10, color: "bg-white/[0.02] border-white/[0.06]" },
                                            ]).map((item) => (
                                                <div key={item.key} className={cn("p-4 rounded-xl border space-y-3 transition-all duration-300 hover:bg-white/[0.04]", item.color)}>
                                                    <Label className="text-sm font-semibold text-foreground/80">{item.label}</Label>
                                                    <Input type="number" value={item.value} onChange={(e) => updateLocalConfig(item.key, parseInt(e.target.value) || 1)} min={1} max={item.max}
                                                        className="bg-white/[0.04] border-white/10 font-mono text-lg focus:bg-white/[0.08] transition-all" disabled={!canEditShared} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </SectionCard>
                        )}

                        {/* ══════════════════════════════════════════════════════
                            DISPOSITIVOS — Impresión · Escáner · Sonidos
                           ══════════════════════════════════════════════════════ */}
                        {activeSection === "devices" && (
                            <SectionCard gradient={currentSection.gradient}>
                                <CardHeader className="pb-0 pt-5 sm:pt-6 px-4 sm:px-7">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <div className="p-3 rounded-xl bg-white/[0.05] border border-white/[0.06]">
                                            <Cpu className="h-6 w-6 text-foreground/60" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl font-bold">Dispositivos y Periféricos</CardTitle>
                                            <CardDescription className="text-muted-foreground/60">Configuración de hardware conectado a este equipo</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="px-4 sm:px-7 pb-5 sm:pb-7 pt-4">

                                    {/* ── Sub: Impresión ── */}
                                    <div className="space-y-2">
                                        <SubsectionHeader
                                            icon={<Printer className="h-4 w-4 text-foreground/60" />}
                                            title="Impresión de Tickets"
                                            gradient=""
                                            scope="local"
                                        />

                                        <div className="pl-1 space-y-0 divide-y divide-white/[0.04]">
                                            <SettingRow title="Impresión automática" description="Imprimir tickets al registrar consumos">
                                                <Switch checked={localConfig.autoPrintTickets} onCheckedChange={(c) => updateLocalConfig('autoPrintTickets', c)} />
                                            </SettingRow>

                                            {localConfig.autoPrintTickets && (
                                                <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300 divide-y divide-white/[0.04]">
                                                    <SettingRow title="Tamaño de Papel" description="Ancho del papel de la impresora térmica">
                                                        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
                                                            {(["90mm", "58mm"] as const).map((size) => (
                                                                <Button key={size} variant={printerSize === size ? 'default' : 'ghost'} size="sm" onClick={() => savePrinterSize(size)}
                                                                    className={cn("h-8 text-xs rounded-lg transition-all duration-200", printerSize === size && "shadow-md")}>
                                                                    {size}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </SettingRow>
                                                    <SettingRow title="Ticket de cliente" description="Imprimir ticket para el cliente">
                                                        <Switch checked={localConfig.printClientTicket} onCheckedChange={(c) => updateLocalConfig('printClientTicket', c)} />
                                                    </SettingRow>
                                                    <SettingRow title="Comanda de recepción" description="Imprimir comanda para recepción/cocina">
                                                        <Switch checked={localConfig.printReceptionTicket} onCheckedChange={(c) => updateLocalConfig('printReceptionTicket', c)} />
                                                    </SettingRow>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Divider ── */}
                                    <div className="my-7 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                                    {/* ── Sub: Red de Impresoras ── */}
                                    <div className="space-y-4">
                                        <SubsectionHeader
                                            icon={<Wifi className="h-4 w-4 text-foreground/60" />}
                                            title="Red de Impresoras"
                                            gradient=""
                                            scope="shared"
                                        />

                                        {!canEditShared && <ReadOnlyNotice />}

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-1">
                                            {/* Thermal Printer */}
                                            <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 rounded-lg bg-orange-500/10">
                                                        <Printer className="h-3.5 w-3.5 text-orange-400" />
                                                    </div>
                                                    <span className="text-sm font-semibold text-foreground/80">Impresora de Tickets</span>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs text-muted-foreground/60">Dirección IP</Label>
                                                    <Input
                                                        value={localConfig.thermalPrinterIP || ''}
                                                        onChange={(e) => updateLocalConfig('thermalPrinterIP' as any, e.target.value as any)}
                                                        placeholder="192.168.0.106"
                                                        className="bg-white/[0.04] border-white/10 font-mono text-sm focus:bg-white/[0.08]"
                                                        disabled={!canEditShared}
                                                    />
                                                    <Label className="text-xs text-muted-foreground/60">Puerto</Label>
                                                    <Input
                                                        type="number"
                                                        value={localConfig.thermalPrinterPort || 9100}
                                                        onChange={(e) => updateLocalConfig('thermalPrinterPort' as any, parseInt(e.target.value) || 9100)}
                                                        className="bg-white/[0.04] border-white/10 font-mono text-sm focus:bg-white/[0.08]"
                                                        disabled={!canEditShared}
                                                    />
                                                </div>
                                            </div>

                                            {/* HP Printer */}
                                            <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                                                        <Printer className="h-3.5 w-3.5 text-blue-400" />
                                                    </div>
                                                    <span className="text-sm font-semibold text-foreground/80">Impresora HP (Hojas)</span>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs text-muted-foreground/60">Dirección IP</Label>
                                                    <Input
                                                        value={localConfig.hpPrinterIP || ''}
                                                        onChange={(e) => updateLocalConfig('hpPrinterIP' as any, e.target.value as any)}
                                                        placeholder="192.168.0.108"
                                                        className="bg-white/[0.04] border-white/10 font-mono text-sm focus:bg-white/[0.08]"
                                                        disabled={!canEditShared}
                                                    />
                                                    <Label className="text-xs text-muted-foreground/60">Puerto</Label>
                                                    <Input
                                                        type="number"
                                                        value={localConfig.hpPrinterPort || 9100}
                                                        onChange={(e) => updateLocalConfig('hpPrinterPort' as any, parseInt(e.target.value) || 9100)}
                                                        className="bg-white/[0.04] border-white/10 font-mono text-sm focus:bg-white/[0.08]"
                                                        disabled={!canEditShared}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <InfoCallout color="blue">
                                            <strong>Nota:</strong> Al guardar, las IPs se sincronizan automáticamente con el print server.
                                            Para encontrar la IP de una impresora, imprima una hoja de configuración de red desde el panel de la impresora.
                                        </InfoCallout>
                                    </div>

                                    {/* ── Divider ── */}
                                    <div className="my-7 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                                    {/* ── Sub: Escáner ── */}
                                    <div className="space-y-2">
                                        <SubsectionHeader
                                            icon={<Barcode className="h-4 w-4 text-foreground/60" />}
                                            title="Escáner de Código de Barras"
                                            gradient=""
                                            scope="local"
                                        />

                                        <div className="pl-1 space-y-0">
                                            <SettingRow title="Detección automática de escaneo" description="Detecta automáticamente cuando se usa la pistola y agrega el producto sin presionar Enter.">
                                                <Switch checked={localConfig.autoScanDetection} onCheckedChange={(c) => updateLocalConfig('autoScanDetection', c)} />
                                            </SettingRow>

                                            {localConfig.autoScanDetection && (
                                                <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
                                                    <div className="p-5 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-5 mt-2">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="p-1.5 rounded-lg bg-white/[0.06] border border-white/[0.06]">
                                                                <Zap className="h-3.5 w-3.5 text-foreground/60" />
                                                            </div>
                                                            <span className="text-sm font-semibold text-foreground/80">Configuración avanzada</span>
                                                        </div>
                                                        <div className="grid gap-4 sm:grid-cols-3">
                                                            {([
                                                                { label: "Velocidad (ms)", key: "scanSpeedThreshold" as const, value: localConfig.scanSpeedThreshold, min: 10, max: 200, hint: "Tiempo máx entre caracteres (50ms)" },
                                                                { label: "Delay completado (ms)", key: "scanCompleteDelay" as const, value: localConfig.scanCompleteDelay, min: 50, max: 500, hint: "Espera para completar (150ms)" },
                                                                { label: "Longitud mínima", key: "minScanLength" as const, value: localConfig.minScanLength, min: 1, max: 20, hint: "Mínimo caracteres (3)" },
                                                            ]).map((item) => (
                                                                <div key={item.key} className="space-y-2">
                                                                    <Label className="text-sm font-medium">{item.label}</Label>
                                                                    <Input type="number" value={item.value} onChange={(e) => updateLocalConfig(item.key, parseInt(e.target.value) || 0)} min={item.min} max={item.max}
                                                                        className="bg-white/[0.04] border-white/10 font-mono focus:bg-white/[0.08] transition-all" />
                                                                    <p className="text-[11px] text-muted-foreground/50">{item.hint}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="pt-3">
                                                <InfoCallout color="blue">
                                                    <strong>Tip:</strong> Si tu pistola envía <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-xs font-mono">Enter</code> después del escaneo, puedes desactivar la detección automática.
                                                </InfoCallout>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Divider ── */}
                                    <div className="my-7 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                                    {/* ── Sub: Sonidos ── */}
                                    <div className="space-y-2">
                                        <SubsectionHeader
                                            icon={<Volume2 className="h-4 w-4 text-foreground/60" />}
                                            title="Sonidos de Feedback"
                                            gradient=""
                                            scope="local"
                                        />

                                        <div className="pl-1">
                                            <SettingRow title="Sonidos habilitados" description="Reproduce sonidos al escanear, confirmar acciones y en errores">
                                                <Switch checked={localConfig.soundEnabled} onCheckedChange={(c) => updateLocalConfig('soundEnabled', c)} />
                                            </SettingRow>
                                        </div>
                                    </div>
                                </CardContent>
                            </SectionCard>
                        )}

                        {/* ══════════════════════════════════════════════════════
                            CATÁLOGO — Paquetes · Promociones
                           ══════════════════════════════════════════════════════ */}
                        {activeSection === "catalog" && (
                            <div className="space-y-6 animate-in fade-in-0 slide-in-from-right-4 duration-400">
                                <BottlePackageRules />
                                <ProductPromotions />
                            </div>
                        )}

                        {/* ══════════════════════════════════════════════════════
                            HISTORIAL — Últimos cambios a la configuración
                           ══════════════════════════════════════════════════════ */}
                        {activeSection === "history" && canEditShared && (
                            <SectionCard gradient={currentSection.gradient}>
                                <CardHeader className="pb-0 pt-5 sm:pt-6 px-4 sm:px-7">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <div className="p-3 rounded-xl bg-white/[0.05] border border-white/[0.06]">
                                            <History className="h-6 w-6 text-foreground/60" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl font-bold">Historial de Cambios</CardTitle>
                                            <CardDescription className="text-muted-foreground/60">Última modificación a la configuración compartida</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="px-4 sm:px-7 pb-5 sm:pb-7 pt-5">
                                    {meta.updatedAt ? (
                                        <div className="space-y-5">
                                            <div className="flex items-start gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/10">
                                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <p className="text-sm font-semibold">Configuración actualizada</p>
                                                    <div className="flex items-center gap-5 text-xs text-muted-foreground/60">
                                                        <span className="flex items-center gap-1.5">
                                                            <Clock className="h-3 w-3" />
                                                            {new Date(meta.updatedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        {meta.updatedBy && (
                                                            <span className="flex items-center gap-1.5"><User className="h-3 w-3" />{meta.updatedBy}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                                <p className="text-xs text-muted-foreground/50 font-semibold uppercase tracking-wider mb-4">Valores actuales</p>
                                                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                                                    {([
                                                        { label: "Fondo de caja", value: `$${systemConfig.initialCashFund.toLocaleString()}` },
                                                        { label: "Adelanto cochero", value: `$${systemConfig.valetAdvanceAmount.toLocaleString()}` },
                                                        { label: "Ventas globales", value: systemConfig.includeGlobalSalesInShift ? "Sí" : "No" },
                                                        { label: "Autocobro h. extra", value: systemConfig.autoChargeExtraHours ? "Sí" : "No" },
                                                        { label: "Límites (R/C/A)", value: `${systemConfig.maxShiftsReceptionist} / ${systemConfig.maxShiftsValet} / ${systemConfig.maxShiftsAdmin}` },
                                                    ]).map((item) => (
                                                        <div key={item.label} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                                            <p className="text-[11px] text-muted-foreground/40 font-medium mb-1">{item.label}</p>
                                                            <p className="font-mono font-semibold text-sm">{item.value}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <div className="relative inline-block mb-4">
                                                <div className="absolute inset-0 rounded-full bg-muted/30 animate-ping" />
                                                <History className="relative h-10 w-10 opacity-20" />
                                            </div>
                                            <p className="text-sm font-medium">No hay registro de cambios aún</p>
                                            <p className="text-xs text-muted-foreground/50 mt-1">Aparecerá aquí cuando se modifique la configuración</p>
                                        </div>
                                    )}
                                </CardContent>
                            </SectionCard>
                        )}

                        {/* ══════════════════════════════════════════════════════
                            MANTENIMIENTO — Purga · Audit Logs
                           ══════════════════════════════════════════════════════ */}
                        {activeSection === "maintenance" && canEditShared && (
                            <div className="space-y-6 animate-in fade-in-0 slide-in-from-right-4 duration-400">
                                <SectionCard gradient={currentSection.gradient}>
                                    <CardHeader className="pb-0 pt-5 sm:pt-6 px-4 sm:px-7">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/10 border border-red-500/10">
                                                    <Zap className="h-6 w-6 text-red-400" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-xl font-bold">Mantenimiento y Purga de Datos</CardTitle>
                                                    <CardDescription className="text-muted-foreground/60">Herramientas de limpieza para entorno de pruebas</CardDescription>
                                                </div>
                                            </div>
                                            <Badge variant="destructive" className="gap-1.5 animate-pulse shadow-lg shadow-red-500/20">
                                                <div className="h-1.5 w-1.5 rounded-full bg-white" />Acción Destructiva
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="px-4 sm:px-7 pb-5 sm:pb-7 pt-5 space-y-6">
                                        <div className="p-5 rounded-xl bg-red-500/[0.03] border border-red-500/15 space-y-5">
                                            <div className="space-y-2">
                                                <h4 className="text-sm font-bold text-red-400 flex items-center gap-2"><Zap className="h-4 w-4" />Reinicio Nuclear del Sistema</h4>
                                                <p className="text-[13px] text-muted-foreground/60 leading-relaxed">Esta acción borrará permanentemente:</p>
                                                <ul className="text-[13px] text-muted-foreground/60 list-none space-y-1.5">
                                                    {["Todas las estancias y habitaciones ocupadas", "Órdenes de venta y consumos", "Pagos, recibos y cortes de caja", "Logs de auditoría y notificaciones", "Turnos abiertos (Shift Sessions)"].map((item) => (
                                                        <li key={item} className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-red-500/40" />{item}</li>
                                                    ))}
                                                </ul>
                                                <p className="text-xs font-bold text-red-400 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/15">
                                                    ⚠️ ESTA ACCIÓN NO SE PUEDE DESHACER. TODAS LAS HABITACIONES VOLVERÁN A ESTADO &apos;LIBRE&apos;.
                                                </p>
                                            </div>
                                            <NuclearResetButton />
                                        </div>

                                        <InfoCallout color="blue">
                                            <strong>Nota:</strong> Esta herramienta está diseñada exclusivamente para limpiar el ruido generado durante pruebas intensivas.
                                            Los datos maestros (productos, empleados, tipos de habitación) NO serán borrados.
                                        </InfoCallout>
                                    </CardContent>
                                </SectionCard>

                                {/* ── Force Reload All Clients ── */}
                                <SectionCard gradient="from-blue-500/10 to-cyan-500/10">
                                    <CardHeader className="pb-4 sm:pb-5 space-y-1.5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/15">
                                                <Globe className="h-5 w-5 text-blue-400" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-sm sm:text-base font-bold tracking-tight">Recargar Todos los Clientes</CardTitle>
                                                <CardDescription className="text-muted-foreground/60">Fuerza una recarga en todos los navegadores conectados al sistema</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                                            <div className="space-y-1">
                                                <p className="text-sm font-semibold text-foreground/80">Broadcast de Actualización</p>
                                                <p className="text-xs text-muted-foreground/60">
                                                    Envía una señal a todos los dispositivos conectados para que recarguen la página automáticamente en 5 segundos.
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2 border-blue-500/20 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 shrink-0"
                                                onClick={async () => {
                                                    try {
                                                        const sb = createClient();
                                                        const channel = sb.channel('system:deploy');
                                                        await channel.subscribe();
                                                        await channel.send({
                                                            type: 'broadcast',
                                                            event: 'force_reload',
                                                            payload: {
                                                                message: 'Actualización del sistema por administrador',
                                                                delay: 5,
                                                            }
                                                        });
                                                        sb.removeChannel(channel);
                                                        toast.success('Señal enviada', {
                                                            description: 'Todos los clientes se recargarán en 5 segundos.',
                                                            duration: 6000
                                                        });
                                                    } catch (e) {
                                                        console.error('Error broadcasting reload:', e);
                                                        toast.error('Error al enviar señal de recarga');
                                                    }
                                                }}
                                            >
                                                <Wifi className="h-4 w-4" />
                                                Recargar Todos
                                            </Button>
                                        </div>
                                        <InfoCallout color="blue">
                                            <strong>Útil después de un deploy:</strong> Cuando actualices el sistema, usa este botón para que todos los usuarios obtengan la versión más reciente sin necesidad de recargar manualmente.
                                        </InfoCallout>
                                    </CardContent>
                                </SectionCard>

                                <AuditLogsViewer />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Floating Save Bar ──────────────────────────────── */}
            {hasChanges && (
                <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
                    <div className="mx-auto px-3 sm:px-4 lg:px-8 pb-3 sm:pb-5">
                        <div className="pointer-events-auto relative overflow-hidden bg-background/60 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 p-3 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 animate-in slide-in-from-bottom-6 duration-500">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-primary/[0.03]" />
                            <div className="relative flex items-center gap-2.5 sm:gap-3 text-sm text-muted-foreground">
                                <div className="relative shrink-0">
                                    <div className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-30" />
                                    <div className="relative h-2.5 w-2.5 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50" />
                                </div>
                                <span className="font-medium text-xs sm:text-sm">Tienes cambios sin guardar</span>
                            </div>
                            <div className="relative flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                                <Button variant="ghost" size="sm" onClick={() => setLocalConfig(null)} className="text-muted-foreground hover:text-foreground rounded-xl flex-1 sm:flex-none text-xs sm:text-sm">
                                    Descartar
                                </Button>
                                <Button size="sm" onClick={handleSave} disabled={systemSaving} className="gap-2 flex-1 sm:flex-none sm:min-w-[150px] rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 hover:scale-[1.02] text-xs sm:text-sm">
                                    {systemSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
