"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, PlayCircle, BookCheck } from 'lucide-react';
import { TrainingModule } from '@/lib/training/training-types';
import { useTraining } from '@/contexts/training-context';
import { useRouter } from 'next/navigation';
import * as Icons from 'lucide-react';

interface ModuleCardProps {
    module: TrainingModule;
}

const difficultyColors = {
    beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
};

const difficultyLabels = {
    beginner: 'Principiante',
    intermediate: 'Intermedio',
    advanced: 'Avanzado'
};

export function ModuleCard({ module }: ModuleCardProps) {
    const { startModule, getModuleProgress } = useTraining();
    const router = useRouter();
    const progress = getModuleProgress(module.id);

    // Get icon component dynamically
    const IconComponent = (Icons as any)[module.icon] || Icons.BookOpen;

    const handleStartInteractive = () => {
        if (module.route) {
            // Navigate with query param to indicate tour should start
            const url = `${module.route}?startTour=${module.id}`;
            router.push(url);
        } else {
            startModule(module.id, 'interactive');
            router.push('/training/practice');
        }
    };

    const handleStartPractice = () => {
        startModule(module.id, 'practice');
        router.push('/training/practice');
    };

    return (
        <Card className="hover:shadow-lg transition-all duration-300 h-full flex flex-col border-muted-foreground/10 hover:border-primary/50 group">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 w-full">
                        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                            <IconComponent className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg leading-tight mb-1 break-words">{module.title}</CardTitle>
                            <CardDescription className="text-sm line-clamp-3 break-words">
                                {module.description}
                            </CardDescription>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                    <Badge variant="outline" className={difficultyColors[module.difficulty]}>
                        {difficultyLabels[module.difficulty]}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {module.duration} min
                    </Badge>
                    {progress?.completed && (
                        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <BookCheck className="h-3 w-3 mr-1" />
                            Completado
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-4 mt-auto pt-0">
                <div className="flex flex-col gap-2 w-full">
                    <Button
                        onClick={handleStartInteractive}
                        className="flex-1"
                        variant="default"
                    >
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Tutorial Interactivo
                    </Button>
                    <Button
                        onClick={handleStartPractice}
                        className="flex-1"
                        variant="outline"
                    >
                        🎮 Modo Práctica
                    </Button>
                </div>

                {module.videoDuration && (
                    <p className="text-xs text-muted-foreground text-center">
                        📹 Video tutorial disponible ({module.videoDuration})
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
