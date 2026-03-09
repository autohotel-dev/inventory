"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, BedDouble, Users, FileText, Settings, LogIn, Bell, Menu, ChevronLeft, ChevronRight, Package, AlertTriangle, CheckCircle2 } from "lucide-react";

interface PracticeIntroProps {
    completedSteps: string[];
    onCompleteStep: (stepId: string) => void;
    moduleId?: string; // Para detectar qué módulo se está practicando
}

export function PracticeIntro({ completedSteps, onCompleteStep, moduleId }: PracticeIntroProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [activeTab, setActiveTab] = useState("step1");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);

    // Detectar si es el módulo de navegación e interfaz
    const isInterfazModule = moduleId === 'intro-interfaz';

    const handleLogin = () => {
        if (email && password) {
            onCompleteStep('login');
            setActiveTab("step2");
        }
    };

    // Para módulo intro-interfaz
    if (isInterfazModule) {
        return (
            <div className="space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="step1">1. Menú Lateral</TabsTrigger>
                        <TabsTrigger value="step2" disabled={!completedSteps.includes('sidebar')}>2. Notificaciones</TabsTrigger>
                    </TabsList>

                    {/* Paso 1: Menú Lateral (sidebar) */}
                    <TabsContent value="step1">
                        <Card>
                            <CardHeader>
                                <CardTitle>Paso 1: Menú Lateral</CardTitle>
                                <CardDescription>Aprende a usar la barra de navegación. Prueba a colapsar y expandir el menú.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden h-80 border">
                                    {/* Mock Sidebar Colapsable */}
                                    <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-slate-800 border-r p-4 flex flex-col gap-2 transition-all duration-300`}>
                                        <div className="flex items-center justify-between mb-4">
                                            {!sidebarCollapsed && <span className="text-xs font-bold text-muted-foreground">MENÚ</span>}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => {
                                                    setSidebarCollapsed(!sidebarCollapsed);
                                                    if (!completedSteps.includes('sidebar')) {
                                                        onCompleteStep('sidebar');
                                                        setTimeout(() => setActiveTab('step2'), 500);
                                                    }
                                                }}
                                            >
                                                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                                            </Button>
                                        </div>

                                        <Button variant="ghost" className={`justify-${sidebarCollapsed ? 'center' : 'start'}`}>
                                            <LayoutDashboard className={`h-4 w-4 ${!sidebarCollapsed && 'mr-2'}`} />
                                            {!sidebarCollapsed && 'Dashboard'}
                                        </Button>
                                        <Button variant="ghost" className={`justify-${sidebarCollapsed ? 'center' : 'start'}`}>
                                            <BedDouble className={`h-4 w-4 ${!sidebarCollapsed && 'mr-2'}`} />
                                            {!sidebarCollapsed && 'Habitaciones'}
                                        </Button>
                                        <Button variant="ghost" className={`justify-${sidebarCollapsed ? 'center' : 'start'}`}>
                                            <Package className={`h-4 w-4 ${!sidebarCollapsed && 'mr-2'}`} />
                                            {!sidebarCollapsed && 'Inventario'}
                                        </Button>
                                        <Button variant="ghost" className={`justify-${sidebarCollapsed ? 'center' : 'start'}`}>
                                            <FileText className={`h-4 w-4 ${!sidebarCollapsed && 'mr-2'}`} />
                                            {!sidebarCollapsed && 'Reportes'}
                                        </Button>
                                        <div className="mt-auto">
                                            <Button variant="ghost" className={`justify-${sidebarCollapsed ? 'center' : 'start'} text-muted-foreground`}>
                                                <Settings className={`h-4 w-4 ${!sidebarCollapsed && 'mr-2'}`} />
                                                {!sidebarCollapsed && 'Configuración'}
                                            </Button>
                                        </div>
                                    </div>
                                    {/* Mock Content Area */}
                                    <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                                        <Menu className="h-12 w-12 text-muted-foreground mb-4" />
                                        <p className="text-muted-foreground mb-2">
                                            {sidebarCollapsed
                                                ? "¡Bien! El menú está colapsado. Puedes expandirlo de nuevo."
                                                : "Haz clic en la flecha (←) para colapsar el menú"
                                            }
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Tip: Colapsar el menú te da más espacio de trabajo
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Paso 2: Centro de Notificaciones */}
                    <TabsContent value="step2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Paso 2: Centro de Notificaciones</CardTitle>
                                <CardDescription>Revisa las alertas del sistema. Haz clic en la campana para ver las notificaciones.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden border">
                                    {/* Mock Header con campana */}
                                    <div className="bg-white dark:bg-slate-800 border-b p-4 flex items-center justify-between">
                                        <span className="font-bold">Sistema de Gestión</span>
                                        <div className="relative">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="relative"
                                                onClick={() => {
                                                    setNotificationsOpen(!notificationsOpen);
                                                    if (!completedSteps.includes('notifications')) {
                                                        onCompleteStep('notifications');
                                                    }
                                                }}
                                            >
                                                <Bell className="h-5 w-5" />
                                                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                                                    3
                                                </span>
                                            </Button>

                                            {/* Dropdown de notificaciones */}
                                            {notificationsOpen && (
                                                <div className="absolute right-0 top-10 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border z-10">
                                                    <div className="p-3 border-b font-medium">Notificaciones</div>
                                                    <div className="max-h-60 overflow-y-auto">
                                                        <div className="p-3 border-b hover:bg-muted/50 flex items-start gap-3">
                                                            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                                                            <div>
                                                                <p className="text-sm font-medium">Stock Bajo</p>
                                                                <p className="text-xs text-muted-foreground">Cerveza Corona - Solo quedan 5 unidades</p>
                                                            </div>
                                                        </div>
                                                        <div className="p-3 border-b hover:bg-muted/50 flex items-start gap-3">
                                                            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                                                            <div>
                                                                <p className="text-sm font-medium">Tiempo Excedido</p>
                                                                <p className="text-xs text-muted-foreground">Habitación 105 - 30 min extra</p>
                                                            </div>
                                                        </div>
                                                        <div className="p-3 hover:bg-muted/50 flex items-start gap-3">
                                                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                                                            <div>
                                                                <p className="text-sm font-medium">Turno Iniciado</p>
                                                                <p className="text-xs text-muted-foreground">Tu turno comenzó correctamente</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Content area */}
                                    <div className="p-8 h-48 flex flex-col items-center justify-center text-center">
                                        <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                                        <p className="text-muted-foreground">
                                            {notificationsOpen
                                                ? "¡Excelente! Así puedes ver todas las alertas del sistema"
                                                : "Haz clic en la campana (🔔) para ver las notificaciones"
                                            }
                                        </p>
                                        {completedSteps.includes('notifications') && (
                                            <Badge className="mt-4 bg-green-600">✅ Módulo Completado</Badge>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        );
    }

    // Para módulo intro-basica (comportamiento original)
    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="step1" disabled={!completedSteps.includes('login') && activeTab !== 'step1'}>1. Login</TabsTrigger>
                    <TabsTrigger value="step2" disabled={!completedSteps.includes('login')}>2. Navegación</TabsTrigger>
                    <TabsTrigger value="step3" disabled={!completedSteps.includes('navigation')}>3. Dashboard</TabsTrigger>
                </TabsList>

                {/* Paso 1: Login */}
                <TabsContent value="step1">
                    <Card>
                        <CardHeader>
                            <CardTitle>Paso 1: Iniciar Sesión</CardTitle>
                            <CardDescription>Simula tu entrada al sistema. Ingresa cualquier correo y contraseña.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Correo Electrónico</Label>
                                <Input
                                    placeholder="usuario@hotel.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Contraseña</Label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <Button onClick={handleLogin} className="w-full">
                                <LogIn className="mr-2 h-4 w-4" /> Iniciar Sesión
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Paso 2: Navegación */}
                <TabsContent value="step2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Paso 2: Conoce el Menú</CardTitle>
                            <CardDescription>Selecciona la opción &quot;Habitaciones&quot; en el menú simulado para continuar.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden h-64 border">
                                {/* Mock Sidebar */}
                                <div className="w-64 bg-white dark:bg-slate-800 border-r p-4 flex flex-col gap-2">
                                    <div className="text-xs font-bold text-muted-foreground mb-2">MENÚ PRINCIPAL</div>
                                    <Button variant="ghost" className="justify-start"><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</Button>
                                    <Button
                                        variant="default"
                                        className="justify-start bg-blue-600 hover:bg-blue-700"
                                        onClick={() => {
                                            onCompleteStep('navigation');
                                            setActiveTab("step3");
                                        }}
                                    >
                                        <BedDouble className="mr-2 h-4 w-4" /> Habitaciones (Clic aquí)
                                    </Button>
                                    <Button variant="ghost" className="justify-start"><Users className="mr-2 h-4 w-4" /> Usuarios</Button>
                                    <Button variant="ghost" className="justify-start"><FileText className="mr-2 h-4 w-4" /> Reportes</Button>
                                    <div className="mt-auto">
                                        <Button variant="ghost" className="justify-start text-red-500"><Settings className="mr-2 h-4 w-4" /> Configuración</Button>
                                    </div>
                                </div>
                                {/* Mock Content Area */}
                                <div className="flex-1 p-8 flex items-center justify-center text-muted-foreground bg-slate-50 dark:bg-slate-950">
                                    Vista de contenido simulada
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Paso 3: Dashboard */}
                <TabsContent value="step3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Paso 3: Dashboard Principal</CardTitle>
                            <CardDescription>Explora los indicadores clave. Haz clic en &quot;Ocupación&quot; para finalizar.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                <Card
                                    className="cursor-pointer hover:border-blue-500 transition-colors"
                                    onClick={() => onCompleteStep('dashboard')}
                                >
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Ocupación</p>
                                            <h2 className="text-2xl font-bold">85%</h2>
                                        </div>
                                        <BedDouble className="h-8 w-8 text-blue-500" />
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Ingresos Hoy</p>
                                            <h2 className="text-2xl font-bold">$12,450</h2>
                                        </div>
                                        <LayoutDashboard className="h-8 w-8 text-green-500" />
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Huéspedes</p>
                                            <h2 className="text-2xl font-bold">42</h2>
                                        </div>
                                        <Users className="h-8 w-8 text-purple-500" />
                                    </CardContent>
                                </Card>
                            </div>
                            <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-900 rounded-lg h-32 flex items-center justify-center text-muted-foreground">
                                Gráfico de Rendimiento (Simulado)
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
