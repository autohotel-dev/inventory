"use client";

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { TrainingModule, TrainingMode, TrainingProgress, TrainingContextType } from '@/lib/training/training-types';
import { getModuleById } from '@/lib/training/training-data';

const TrainingContext = createContext<TrainingContextType | undefined>(undefined);

export function TrainingProvider({ children }: { children: ReactNode }) {
    const [activeModule, setActiveModule] = useState<TrainingModule | null>(null);
    const [currentMode, setCurrentMode] = useState<TrainingMode | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [progress, setProgress] = useState<Map<string, TrainingProgress>>(new Map());

    // Cargar progreso de localStorage al iniciar
    useEffect(() => {
        try {
            const stored = localStorage.getItem('training-progress');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    const map = new Map();
                    parsed.forEach(([key, val]: [string, any]) => {
                        map.set(key, {
                            ...val,
                            startedAt: val.startedAt ? new Date(val.startedAt) : undefined,
                            completedAt: val.completedAt ? new Date(val.completedAt) : undefined
                        });
                    });
                    setProgress(map);
                }
            }
        } catch (e) {
            console.error("Error loading training progress", e);
        }
    }, []);

    // Guardar progreso cuando cambie
    useEffect(() => {
        if (progress.size > 0) {
            const entries = Array.from(progress.entries());
            localStorage.setItem('training-progress', JSON.stringify(entries));
        }
    }, [progress]);

    const startModule = useCallback((moduleId: string, mode: TrainingMode) => {
        const mod = getModuleById(moduleId);
        if (!mod) return;

        setActiveModule(mod);
        setCurrentMode(mode);
        setCurrentStepIndex(0);

        // Track user started this module
        const newProgress: TrainingProgress = {
            userId: '', // Will be filled from auth
            moduleId,
            mode,
            currentStepIndex: 0,
            completed: false,
            startedAt: new Date()
        };

        setProgress(prev => new Map(prev).set(moduleId, newProgress));
    }, []);

    const stopTraining = useCallback(() => {
        setActiveModule(null);
        setCurrentMode(null);
        setCurrentStepIndex(0);
    }, []);

    const nextStep = useCallback(() => {
        if (!activeModule) return;

        if (currentStepIndex < activeModule.steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        }
    }, [activeModule, currentStepIndex]);

    const prevStep = useCallback(() => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    }, [currentStepIndex]);

    const goToStep = useCallback((index: number) => {
        if (!activeModule) return;
        if (index >= 0 && index < activeModule.steps.length) {
            setCurrentStepIndex(index);
        }
    }, [activeModule]);

    const completeModule = useCallback(() => {
        if (!activeModule) return;

        setProgress(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(activeModule.id);
            if (current) {
                current.completed = true;
                current.completedAt = new Date();
            }
            return newMap;
        });

        stopTraining();
    }, [activeModule, stopTraining]);

    const getModuleProgress = useCallback((moduleId: string) => {
        return progress.get(moduleId);
    }, [progress]);

    const value: TrainingContextType = {
        activeModule,
        currentMode,
        currentStepIndex,
        isTrainingActive: activeModule !== null,
        startModule,
        stopTraining,
        nextStep,
        prevStep,
        goToStep,
        completeModule,
        progress,
        getModuleProgress
    };

    return (
        <TrainingContext.Provider value={value}>
            {children}
        </TrainingContext.Provider>
    );
}

export function useTraining() {
    const context = useContext(TrainingContext);
    if (context === undefined) {
        throw new Error('useTraining must be used within a TrainingProvider');
    }
    return context;
}
