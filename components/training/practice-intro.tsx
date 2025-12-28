"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, BedDouble, Users, FileText, Settings, LogIn } from "lucide-react";

interface PracticeIntroProps {
    completedSteps: string[];
    onCompleteStep: (stepId: string) => void;
}

export function PracticeIntro({ completedSteps, onCompleteStep }: PracticeIntroProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [activeTab, setActiveTab] = useState("login");

    const handleLogin = () => {
        if (email && password) {
            onCompleteStep('login');
            setActiveTab("navigation");
        }
    };

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="login" disabled={!completedSteps.includes('login') && activeTab !== 'login'}>1. Login</TabsTrigger>
                    <TabsTrigger value="navigation" disabled={!completedSteps.includes('login')}>2. Navegación</TabsTrigger>
                    <TabsTrigger value="dashboard" disabled={!completedSteps.includes('navigation')}>3. Dashboard</TabsTrigger>
                </TabsList>

                {/* Paso 1: Login */}
                <TabsContent value="login">
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
                <TabsContent value="navigation">
                    <Card>
                        <CardHeader>
                            <CardTitle>Paso 2: Conoce el Menú</CardTitle>
                            <CardDescription>Selecciona la opción "Habitaciones" en el menú simulado para continuar.</CardDescription>
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
                                            setActiveTab("dashboard");
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
                <TabsContent value="dashboard">
                    <Card>
                        <CardHeader>
                            <CardTitle>Paso 3: Dashboard Principal</CardTitle>
                            <CardDescription>Explora los indicadores clave. Haz clic en "Ocupación" para finalizar.</CardDescription>
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
