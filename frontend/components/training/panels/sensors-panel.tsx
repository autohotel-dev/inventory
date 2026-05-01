"use client";

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Package, AlertTriangle, ArrowRightLeft, Radio, Users, TrendingUp, DollarSign, Wallet, FileText, Calendar, Search, Filter, BarChart3, RefreshCw, Warehouse, Eye, TrendingDown, RotateCcw, Plus, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

// --- MOCK SENSORS PANEL (High Fidelity) ---
// --- MOCK SENSORS PANEL (High Fidelity) ---
export function MockSensorsPanel({ completed, onComplete }: { completed: string[], onComplete?: (stepId: string) => void }) {
    const discrepancySolved = completed.includes('discrepancies');
    const checkedStates = completed.includes('sensor-states');

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <Card className={`bg-card ${checkedStates ? "border-green-500/50" : ""}`}>
                    <CardContent className="p-4 flex flex-col items-center gap-2">
                        <div className="font-bold">Hab. 101</div>
                        <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center border-2 border-green-500">
                            <Radio className="h-6 w-6 text-green-500" />
                        </div>
                        <div className="text-xs font-semibold text-green-500">LIBRE / VACÍO</div>

                        {!checkedStates && (
                            <Button
                                size="sm"
                                variant="secondary"
                                className="w-full text-xs mt-2 h-7"
                                onClick={() => {
                                    if (onComplete) onComplete('sensor-states');
                                    toast.success("Has verificado los estados del sensor");
                                }}
                            >
                                Monitor Detallado
                            </Button>
                        )}
                        {checkedStates && <div className="text-[10px] text-green-600 font-medium mt-2">✔️ Monitoreado</div>}
                    </CardContent>
                </Card>
                <Card className={`bg-card ${discrepancySolved ? "" : "border-red-500 shadow-sm"}`}>
                    <CardContent className="p-4 flex flex-col items-center gap-2">
                        <div className="font-bold text-foreground">Hab. 104</div>
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center border-2 ${discrepancySolved ? 'bg-green-500/10 border-green-500' : 'bg-red-500/10 border-red-500 animate-pulse'}`}>
                            <Radio className={`h-6 w-6 ${discrepancySolved ? 'text-green-500' : 'text-red-500'}`} />
                        </div>
                        <div className="text-xs font-semibold text-center mt-1">
                            {discrepancySolved ? (
                                <span className="text-green-500">VERIFICADO<br />(Limpieza)</span>
                            ) : (
                                <span className="text-red-500">ALERTA:<br />PRESENCIA SIN RENTA</span>
                            )}
                        </div>

                        {!discrepancySolved && (
                            <Button
                                size="sm"
                                variant="destructive"
                                className="w-full text-xs mt-2 h-7"
                                id="tutorial-btn-verify-alert"
                                onClick={() => {
                                    if (onComplete) onComplete('discrepancies');
                                    toast.success("Discrepancia resuelta: Era personal de limpieza");
                                }}
                            >
                                Verificar Alerta
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
            <div className="bg-muted p-3 rounded text-xs text-muted-foreground border">
                <p><strong className="text-foreground">Leyenda:</strong></p>
                <ul className="list-disc ml-4 space-y-1 mt-1">
                    <li><span className="text-green-500 font-medium">Verde:</span> Sensor coincide con estado del sistema.</li>
                    <li><span className="text-red-500 font-medium">Rojo:</span> Sensor detecta presencia pero habitación está Libre.</li>
                </ul>
            </div>
        </div>
    );
}