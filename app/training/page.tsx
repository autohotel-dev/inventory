"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModuleCard } from '@/components/training/module-card';
import { trainingModules } from '@/lib/training/training-data';
import { Search, GraduationCap } from 'lucide-react';

export default function TrainingPage() {
    const [searchQuery, setSearchQuery] = useState('');

    const categories = [
        { id: 'all', label: 'Todos', icon: '📚' },
        { id: 'intro', label: 'Introducción', icon: '👋' },
        { id: 'rooms', label: 'Habitaciones', icon: '🏨' },
        { id: 'payments', label: 'Pagos', icon: '💳' },
        { id: 'sales', label: 'Ventas', icon: '🛒' },
        { id: 'shifts', label: 'Turnos', icon: '⏰' },
        { id: 'reports', label: 'Reportes', icon: '📊' },
        { id: 'config', label: 'Configuración', icon: '⚙️' }
    ];

    const filteredModules = trainingModules.filter(module =>
        module.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        module.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getModulesByCategory = (categoryId: string) => {
        if (categoryId === 'all') return filteredModules;
        return filteredModules.filter(m => m.category === categoryId);
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <GraduationCap className="h-8 w-8 text-primary" />
                    <h1 className="text-3xl font-bold">Centro de Capacitación</h1>
                </div>
                <p className="text-muted-foreground">
                    Aprende a usar el sistema con tutoriales interactivos y práctica guiada
                </p>
            </div>

            {/* Info card */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
                <CardHeader>
                    <CardTitle className="text-blue-900 dark:text-blue-100">
                        ¿Cómo funciona?
                    </CardTitle>
                    <CardDescription className="text-blue-700 dark:text-blue-300">
                        Elige tu método de aprendizaje preferido
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                        <span className="text-lg">🎯</span>
                        <div>
                            <strong>Tutorial Interactivo:</strong> Guía paso a paso sobre la interfaz real del sistema
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-lg">🎮</span>
                        <div>
                            <strong>Modo Práctica:</strong> Ambiente seguro con datos de prueba para practicar sin riesgos
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-lg">📹</span>
                        <div>
                            <strong>Videos:</strong> Cada módulo incluye videotutoriales explicativos
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar módulos de capacitación..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Modules by category */}
            <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
                    {categories.map(cat => (
                        <TabsTrigger key={cat.id} value={cat.id} className="text-xs">
                            <span className="mr-1">{cat.icon}</span>
                            {cat.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {categories.map(cat => (
                    <TabsContent key={cat.id} value={cat.id} className="mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {getModulesByCategory(cat.id).map(module => (
                                <ModuleCard key={module.id} module={module} />
                            ))}
                        </div>

                        {getModulesByCategory(cat.id).length === 0 && (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    No se encontraron módulos en esta categoría
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
