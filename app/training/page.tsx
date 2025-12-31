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

        <div className="container mx-auto py-8 space-y-10 animate-in fade-in duration-500 max-w-7xl">
            {/* Header Centrado Simplificado */}
            <div className="text-center space-y-4 max-w-3xl mx-auto">
                <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2 ring-1 ring-primary/20">
                    <GraduationCap className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-5xl font-extrabold tracking-tight">
                    Academia <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">Luxor Manager</span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    Sube de nivel tus habilidades y conviértete en un experto del sistema.
                </p>

                {/* Buscador Integrado en Header */}
                <div className="relative max-w-xl mx-auto mt-8 group">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="¿Qué quieres aprender hoy?"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-14 text-lg shadow-lg rounded-full border-muted/50 bg-background/50 backdrop-blur-sm focus-visible:ring-primary/50 focus-visible:border-primary transition-all group-hover:shadow-xl"
                    />
                </div>
            </div>

            {/* Stats Grid Simétrico (3 Columnas) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Columna 1: Nivel Actual */}
                <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/10 dark:to-orange-950/10 shadow-lg hover:shadow-xl transition-all duration-300 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity transform group-hover:scale-110 duration-500">
                        <Trophy className="w-40 h-40" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription className="font-semibold uppercase text-xs tracking-wider text-amber-600/80 dark:text-amber-400">Nivel Actual</CardDescription>
                        <CardTitle className="text-3xl font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                            {stats.level}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <span className="text-4xl font-extrabold text-amber-600 dark:text-amber-400">{stats.percentage}%</span>
                                <span className="text-sm font-medium text-muted-foreground mb-1">{stats.completedModules}/{stats.totalModules} Módulos</span>
                            </div>
                            <Progress value={stats.percentage} className="h-3 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/30 [&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-orange-500" />
                        </div>
                    </CardContent>
                </Card>

                {/* Columna 2: Logros / Badges */}
                <Card className="border-blue-200/50 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/10 dark:to-cyan-950/10 shadow-lg hover:shadow-xl transition-all duration-300">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-semibold uppercase text-xs tracking-wider text-blue-600/80 dark:text-blue-400">Logros Recientes</CardDescription>
                        <CardTitle className="text-xl font-bold text-blue-800 dark:text-blue-200">
                            Colección de Badges
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2 min-h-[60px] items-center">
                            {stats.completedModules > 0 ? (
                                <>
                                    {[...Array(Math.min(5, stats.completedModules))].map((_, i) => (
                                        <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 ring-2 ring-white dark:ring-blue-950 shadow-md flex items-center justify-center transform hover:scale-110 transition-transform cursor-help" title="Módulo Completado">
                                            <Trophy className="w-5 h-5 text-white" />
                                        </div>
                                    ))}
                                    {stats.completedModules > 5 && (
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-300 ring-2 ring-white dark:ring-blue-950">
                                            +{stats.completedModules - 5}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground italic flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" /> Completa módulos para ganar badges
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Columna 3: Stats Combinados */}
                <div className="grid grid-rows-2 gap-4">
                    <Card className="border-purple-200/50 bg-purple-50/50 dark:bg-purple-950/20 shadow-sm hover:shadow-md transition-all flex items-center px-6">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-full mr-4">
                            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-xs text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wide">Racha Actual</p>
                            <p className="font-bold text-2xl">{stats.completedModules} <span className="text-lg">🔥</span></p>
                        </div>
                    </Card>

                    <Card className="border-emerald-200/50 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm hover:shadow-md transition-all flex items-center px-6">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-full mr-4">
                            <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wide">Siguiente Nivel</p>
                            <p className="font-bold text-lg leading-tight">{stats.nextLevel}</p>
                        </div>
                    </Card>
                </div>
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
