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

// --- MOCK CONFIG PANEL (Simple, reusing generic structure but can be expanded) ---
export function MockConfigPanel({ completed }: { completed: string[] }) {
    // Keeping simple for now, but exporting it here to centralize
    return (
        <div className="border rounded-lg overflow-hidden bg-card">
            <div className="bg-muted p-2 text-xs font-semibold text-foreground">Configuración del Sistema</div>
            <div className="divide-y">
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-8 w-8 text-blue-500 bg-blue-100 p-1 rounded-full dark:bg-blue-900" />
                        <div className="text-sm">
                            <div className="font-medium">Usuarios y Permisos</div>
                            <div className="text-xs text-muted-foreground">3 Operadores activos</div>
                        </div>
                    </div>
                </div>
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Radio className="h-8 w-8 text-orange-500 bg-orange-100 p-1 rounded-full dark:bg-orange-900" />
                        <div className="text-sm">
                            <div className="font-medium">Impresoras</div>
                            <div className="text-xs text-muted-foreground">XP-80C (Red) - Online</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}