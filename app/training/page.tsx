"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModuleCard } from '@/components/training/module-card';
import { trainingModules } from '@/lib/training/training-data';
import { Search, GraduationCap, Trophy, Target, Sparkles, BookOpen } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useTraining } from '@/contexts/training-context';

export default function TrainingPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const { progress } = useTraining();

    // Calcular estadísticas de progreso
    const stats = useMemo(() => {
        const totalModules = trainingModules.length;
        const completedModules = trainingModules.filter(m => {
            const modProgress = progress.get(m.id);
            return modProgress?.completed;
        }).length;

        const percentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

        let level = "Novato";
        let nextLevel = "Aprendiz";
        if (percentage >= 100) { level = "Maestro"; nextLevel = "Maestro"; }
        else if (percentage >= 75) { level = "Experto"; nextLevel = "Maestro"; }
        else if (percentage >= 50) { level = "Profesional"; nextLevel = "Experto"; }
        else if (percentage >= 25) { level = "Aprendiz"; nextLevel = "Profesional"; }

        return { totalModules, completedModules, percentage, level, nextLevel };
    }, [progress]);

    const categories = [
        { id: 'all', label: 'Todos', icon: '📚' },
        { id: 'intro', label: 'Introducción', icon: '👋' },
        { id: 'sales', label: 'Ventas', icon: '🛒' },
        { id: 'payments', label: 'Pagos', icon: '💳' },
        { id: 'rooms', label: 'Habitaciones', icon: '🏨' },
        { id: 'inventory', label: 'Inventario', icon: '📦' },
        { id: 'shifts', label: 'Turnos', icon: '⏰' },
        { id: 'reports', label: 'Reportes', icon: '📊' },
        { id: 'sensors', label: 'Sensores', icon: '📡' },
        { id: 'admin', label: 'Admin', icon: '💼' },
        { id: 'config', label: 'Config', icon: '⚙️' }
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
        <div className="container mx-auto py-6 space-y-8 animate-in fade-in duration-500">
            {/* Header Gamificado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                    <div>
                        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-primary to-amber-600 bg-clip-text text-transparent inline-flex items-center gap-3">
                            <GraduationCap className="h-10 w-10 text-primary" />
                            Centro de Capacitación
                        </h1>
                        <p className="text-lg text-muted-foreground mt-2">
                            Sube de nivel dominando cada aspecto del sistema Inventory Pro.
                        </p>
                    </div>

                    {/* Barra de Progreso Principal */}
                    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 dark:border-amber-900 shadow-md">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-lg font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                    <Trophy className="h-5 w-5 text-amber-500" />
                                    Nivel Actual: {stats.level}
                                </CardTitle>
                                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                                    {stats.percentage}% Completado
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Progress value={stats.percentage} className="h-3 bg-amber-200 dark:bg-amber-900/50" />
                            <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-2 text-right">
                                {stats.completedModules} de {stats.totalModules} módulos dominados
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Stats Rápidos */}
                <div className="bg-card rounded-xl border shadow-sm p-6 flex flex-col justify-center space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                            <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Siguiente Objetivo</p>
                            <p className="font-bold">Alcanzar nivel {stats.nextLevel}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                            <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Modo Práctica</p>
                            <p className="font-bold">Sin riesgos ni errores reales</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Buscador */}
            <div className="relative max-w-xl mx-auto">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    placeholder="¿Qué quieres aprender hoy? (ej: Ventas, Pagos...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-12 text-lg shadow-sm rounded-full border-muted-foreground/20 focus-visible:ring-primary"
                />
            </div>

            {/* Navegación de Categorías y Módulos */}
            <Tabs defaultValue="all" className="w-full">
                <TabsList className="w-full h-auto flex flex-wrap justify-center gap-2 bg-transparent p-0 mb-8">
                    {categories.map(cat => (
                        <TabsTrigger
                            key={cat.id}
                            value={cat.id}
                            className="text-sm px-4 py-2 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-transparent data-[state=active]:shadow-md transition-all"
                        >
                            <span className="mr-2 text-lg">{cat.icon}</span>
                            {cat.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {categories.map(cat => (
                    <TabsContent key={cat.id} value={cat.id} className="mt-0 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {getModulesByCategory(cat.id).map(module => (
                                <ModuleCard key={module.id} module={module} />
                            ))}
                        </div>

                        {getModulesByCategory(cat.id).length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                                <BookOpen className="h-12 w-12 mb-4 opacity-20" />
                                <p className="text-lg font-medium">No se encontraron módulos</p>
                                <p>Prueba buscando en otra categoría</p>
                            </div>
                        )}
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
