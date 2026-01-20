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
    Wallet
} from "lucide-react";
import { usePOSConfig, type POSConfig } from "@/hooks/use-pos-config";
import { usePrinterSettings } from "@/hooks/use-printer-settings";

export default function SettingsPage() {
    const { config, isLoaded, saveConfig, resetConfig } = usePOSConfig();
    const { size: printerSize, saveSize: savePrinterSize } = usePrinterSettings();
    const [localConfig, setLocalConfig] = useState<POSConfig | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Sincronizar configuración local con la del hook
    useEffect(() => {
        if (isLoaded && !localConfig) {
            setLocalConfig(config);
        }
    }, [isLoaded, config, localConfig]);

    // Detectar cambios
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

    const handleSave = () => {
        if (localConfig) {
            saveConfig(localConfig);
            toast.success("Configuración guardada", {
                description: "Los cambios se aplicarán inmediatamente"
            });
            setHasChanges(false);
        }
    };

    const handleReset = () => {
        resetConfig();
        setLocalConfig(null);
        toast.info("Configuración restablecida", {
            description: "Se han restaurado los valores por defecto"
        });
        // Forzar recarga para sincronizar
        setTimeout(() => window.location.reload(), 500);
    };

    if (!isLoaded || !localConfig) {
        return (
            <div className="container mx-auto py-8 px-4">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-pulse text-muted-foreground">Cargando configuración...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-lg">
                        <Settings className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Configuración del Sistema</h1>
                        <p className="text-muted-foreground">Personaliza el comportamiento del sistema</p>
                    </div>
                </div>

                {hasChanges && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500">
                        Cambios sin guardar
                    </Badge>
                )}
            </div>

            <div className="space-y-6">
                {/* Sección: Escáner de Código de Barras */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Barcode className="h-5 w-5 text-blue-500" />
                            <CardTitle>Escáner de Código de Barras</CardTitle>
                        </div>
                        <CardDescription>
                            Configura el comportamiento del escáner/pistola de código de barras
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Auto detección de escaneo */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base font-medium">Detección automática de escaneo</Label>
                                <p className="text-sm text-muted-foreground">
                                    Detecta automáticamente cuando se usa la pistola y agrega el producto sin necesidad de presionar Enter.
                                    Útil cuando la pistola no está configurada para enviar Enter.
                                </p>
                            </div>
                            <Switch
                                checked={localConfig.autoScanDetection}
                                onCheckedChange={(checked) => updateLocalConfig('autoScanDetection', checked)}
                            />
                        </div>

                        <Separator />

                        {/* Configuración avanzada de escaneo */}
                        {localConfig.autoScanDetection && (
                            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap className="h-4 w-4 text-amber-500" />
                                    <span className="text-sm font-medium">Configuración avanzada</span>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label>Velocidad de escaneo (ms)</Label>
                                        <Input
                                            type="number"
                                            value={localConfig.scanSpeedThreshold}
                                            onChange={(e) => updateLocalConfig('scanSpeedThreshold', parseInt(e.target.value) || 50)}
                                            min={10}
                                            max={200}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Tiempo máximo entre caracteres para detectar escaneo (default: 50ms)
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Delay de completado (ms)</Label>
                                        <Input
                                            type="number"
                                            value={localConfig.scanCompleteDelay}
                                            onChange={(e) => updateLocalConfig('scanCompleteDelay', parseInt(e.target.value) || 150)}
                                            min={50}
                                            max={500}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Tiempo de espera para considerar el escaneo completo (default: 150ms)
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Longitud mínima</Label>
                                        <Input
                                            type="number"
                                            value={localConfig.minScanLength}
                                            onChange={(e) => updateLocalConfig('minScanLength', parseInt(e.target.value) || 3)}
                                            min={1}
                                            max={20}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Mínimo de caracteres para procesar (default: 3)
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg">
                            <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                <strong>Tip:</strong> Si tu pistola envía <code className="bg-blue-200/50 dark:bg-blue-800/50 px-1 rounded">Enter</code> después del escaneo, puedes desactivar la detección automática para un funcionamiento más predecible.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Sección: Sonidos */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Volume2 className="h-5 w-5 text-green-500" />
                            <CardTitle>Sonidos de Feedback</CardTitle>
                        </div>
                        <CardDescription>
                            Configura los sonidos de retroalimentación del sistema
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base font-medium">Sonidos habilitados</Label>
                                <p className="text-sm text-muted-foreground">
                                    Reproduce sonidos al escanear productos, confirmar acciones y en caso de errores
                                </p>
                            </div>
                            <Switch
                                checked={localConfig.soundEnabled}
                                onCheckedChange={(checked) => updateLocalConfig('soundEnabled', checked)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Sección: Configuración de Caja */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-emerald-500" />
                            <CardTitle>Configuración de Caja</CardTitle>
                        </div>
                        <CardDescription>
                            Configura los parámetros de caja para los turnos
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-base font-medium">Fondo de Caja Inicial</Label>
                            <p className="text-sm text-muted-foreground">
                                Monto de efectivo disponible al iniciar cada turno. Los gastos del turno se descontarán de este fondo más el efectivo cobrado.
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
                                />
                                <span className="text-sm text-muted-foreground">MXN</span>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label className="text-base font-medium">Adelanto por Cochero</Label>
                            <p className="text-sm text-muted-foreground">
                                Monto en efectivo que recepción entrega a cada cochero al inicio de turno. Se descuenta automáticamente del efectivo disponible.
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
                                />
                                <span className="text-sm text-muted-foreground">MXN c/u</span>
                            </div>
                        </div>

                        <div className="flex items-start gap-2 p-3 bg-emerald-500/10 rounded-lg">
                            <Info className="h-4 w-4 text-emerald-500 mt-0.5" />
                            <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                <strong>Fórmula:</strong> Efectivo disponible = Fondo inicial + Cobros - Gastos - (Cocheros en turno × Adelanto)
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Sección: Impresión */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Printer className="h-5 w-5 text-purple-500" />
                            <CardTitle>Impresión de Tickets</CardTitle>
                        </div>
                        <CardDescription>
                            Configura las opciones de impresión automática
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base font-medium">Impresión automática</Label>
                                <p className="text-sm text-muted-foreground">
                                    Imprimir tickets automáticamente al registrar consumos
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
                                    <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
                                        <Button
                                            variant={printerSize === '90mm' ? 'default' : 'ghost'}
                                            size="sm"
                                            onClick={() => savePrinterSize('90mm')}
                                            className="h-7 text-xs"
                                        >
                                            90mm (Estándar)
                                        </Button>
                                        <Button
                                            variant={printerSize === '58mm' ? 'default' : 'ghost'}
                                            size="sm"
                                            onClick={() => savePrinterSize('58mm')}
                                            className="h-7 text-xs"
                                        >
                                            58mm (Estrecho)
                                        </Button>
                                    </div>
                                </div>

                                <Separator />

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base font-medium">Ticket de cliente</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Imprimir ticket para entregar al cliente
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
                                            Imprimir comanda para el área de recepción/cocina
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

                {/* Botones de acción */}
                <div className="flex items-center justify-between pt-4">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                        className="text-destructive hover:bg-destructive/10"
                    >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restablecer valores por defecto
                    </Button>

                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges}
                        className="min-w-[150px]"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        Guardar cambios
                    </Button>
                </div>
            </div>
        </div>
    );
}
