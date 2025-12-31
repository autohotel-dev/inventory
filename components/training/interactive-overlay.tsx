"use client";

import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { ArrowLeft, ArrowRight, X, Lightbulb } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTraining } from '@/contexts/training-context';
import { useSoundFeedback } from '@/hooks/use-sound-feedback';

export function InteractiveOverlay() {
    const { activeModule, currentStepIndex, currentMode, nextStep, prevStep, stopTraining, completeModule } = useTraining();
    const { playVictory } = useSoundFeedback();
    const highlightRef = useRef<HTMLDivElement>(null);
    const [showVictory, setShowVictory] = useState(false);

    const currentStep = activeModule?.steps[currentStepIndex];
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = activeModule ? currentStepIndex === activeModule.steps.length - 1 : false;

    // Hook must be called unconditionally
    useEffect(() => {
        // Only run if we have an active module and current step
        if (!activeModule || !currentStep || currentMode !== 'interactive') {
            return;
        }

        // Find and highlight the target element
        if (currentStep.targetSelector) {
            const targetElement = document.querySelector(currentStep.targetSelector);

            if (targetElement) {
                const rect = targetElement.getBoundingClientRect();

                if (highlightRef.current) {
                    // Position the highlight
                    highlightRef.current.style.top = `${rect.top - 8}px`;
                    highlightRef.current.style.left = `${rect.left - 8}px`;
                    highlightRef.current.style.width = `${rect.width + 16}px`;
                    highlightRef.current.style.height = `${rect.height + 16}px`;
                    highlightRef.current.style.display = 'block';
                }

                // Scroll into view
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            if (highlightRef.current) {
                highlightRef.current.style.display = 'none';
            }
        }
    }, [activeModule, currentStep, currentMode]);

    // Early return AFTER all hooks
    if (!activeModule || currentMode !== 'interactive' || !currentStep) {
        return null;
    }

    const handleComplete = () => {
        // Start Victory Sequence
        setShowVictory(true);
        playVictory();

        // Burst confetti
        const end = Date.now() + 1000;
        const colors = ['#bb0000', '#ffffff'];

        (function frame() {
            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors
            });
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    };

    const handleCloseVictory = () => {
        completeModule();
        setShowVictory(false);
    }

    return (
        <>
            {/* Dark overlay */}
            <div className="fixed inset-0 bg-black/70 z-[9998]" />

            {/* Highlight box */}
            <div
                ref={highlightRef}
                className="fixed z-[9999] border-4 border-blue-500 rounded-lg shadow-2xl shadow-blue-500/50 pointer-events-none transition-all duration-300"
                style={{ display: 'none' }}
            />

            {/* Victory Dialog */}
            {showVictory && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 animate-in zoom-in-50 duration-300">
                    <Card className="w-full max-w-sm border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950 shadow-2xl">
                        <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                            <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center animate-bounce">
                                <span className="text-4xl">🏆</span>
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">¡Felicidades!</h2>
                                <p className="text-muted-foreground">
                                    Has completado el módulo <br />
                                    <span className="font-semibold text-foreground">{activeModule.title}</span>
                                </p>
                            </div>
                            <Button size="lg" className="w-full bg-yellow-600 hover:bg-yellow-700 text-white" onClick={handleCloseVictory}>
                                Continuar
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Instruction card (Hide if Victory) */}
            {!showVictory && (
                <Card className="fixed top-4 right-4 w-96 z-[10000] shadow-2xl">
                    <CardContent className="p-6 space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <h3 className="font-bold text-lg">{activeModule.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                    Paso {currentStepIndex + 1} de {activeModule.steps.length}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={stopTraining}
                                className="h-8 w-8"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${((currentStepIndex + 1) / activeModule.steps.length) * 100}%` }}
                            />
                        </div>

                        {/* Current step */}
                        <div className="space-y-2">
                            <h4 className="font-semibold">{currentStep.title}</h4>
                            <p className="text-sm text-muted-foreground">{currentStep.description}</p>
                        </div>

                        {/* Tips */}
                        {currentStep.tips && currentStep.tips.length > 0 && (
                            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg space-y-2">
                                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                                    <Lightbulb className="h-4 w-4" />
                                    <span className="text-sm font-medium">Consejos:</span>
                                </div>
                                <ul className="text-sm space-y-1 ml-6 list-disc text-blue-700 dark:text-blue-300">
                                    {currentStep.tips.map((tip: string, idx: number) => (
                                        <li key={idx}>{tip}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex items-center justify-between pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={prevStep}
                                disabled={isFirstStep}
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Anterior
                            </Button>

                            {isLastStep ? (
                                <Button
                                    size="sm"
                                    onClick={handleComplete}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    Completar
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={nextStep}
                                >
                                    Siguiente
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </>
    );
}
