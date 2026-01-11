"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { ArrowLeft, ArrowRight, X, Lightbulb } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTraining } from '@/contexts/training-context';
import { useSoundFeedback } from '@/hooks/use-sound-feedback';

export function InteractiveOverlay() {
    const { activeModule, currentStepIndex, currentMode, nextStep, prevStep, stopTraining, completeModule } = useTraining();
    const { playVictory } = useSoundFeedback();
    const router = useRouter();
    const highlightRef = useRef<HTMLDivElement>(null);
    const [showVictory, setShowVictory] = useState(false);

    const currentStep = activeModule?.steps[currentStepIndex];
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = activeModule ? currentStepIndex === activeModule.steps.length - 1 : false;

    // Block user scroll and interactions when tour is active
    useEffect(() => {
        if (!activeModule || currentMode !== 'interactive') {
            return;
        }

        // Save current scroll position
        const scrollY = window.scrollY;

        // Prevent user scroll while allowing programmatic scroll
        const preventScroll = (e: Event) => {
            // Only prevent if it's a user-initiated scroll
            if (e.cancelable) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // Add event listeners to block user scroll
        document.addEventListener('wheel', preventScroll, { passive: false });
        document.addEventListener('touchmove', preventScroll, { passive: false });
        document.addEventListener('keydown', (e) => {
            // Block arrow keys, page up/down, space, home, end
            if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
                e.preventDefault();
            }
        });

        return () => {
            // Remove event listeners when tour ends
            document.removeEventListener('wheel', preventScroll);
            document.removeEventListener('touchmove', preventScroll);
        };
    }, [activeModule, currentMode]);

    // Highlight and auto-scroll to target element
    useEffect(() => {
        // Only run if we have an active module and current step
        if (!activeModule || !currentStep || currentMode !== 'interactive') {
            return;
        }

        // Find and highlight the target element
        if (currentStep.targetSelector) {
            const selector = currentStep.targetSelector;
            if (!selector) return;

            let attempts = 0;
            const maxAttempts = 20; // Try for up to 2 seconds

            const findAndHighlight = () => {
                const targetElement = document.querySelector(selector) as HTMLElement;

                if (targetElement) {
                    // Found it! Scroll into view
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'center'
                    });

                    // Start tracking position
                    const updatePosition = () => {
                        if (!targetElement || !highlightRef.current) return;

                        const rect = targetElement.getBoundingClientRect();

                        // Check if element is still visible/connected
                        if (rect.width === 0 && rect.height === 0) {
                            if (highlightRef.current) highlightRef.current.style.display = 'none';
                            return;
                        }

                        highlightRef.current.style.top = `${rect.top - 8}px`;
                        highlightRef.current.style.left = `${rect.left - 8}px`;
                        highlightRef.current.style.width = `${rect.width + 16}px`;
                        highlightRef.current.style.height = `${rect.height + 16}px`;
                        highlightRef.current.style.display = 'block';

                        // Continue tracking
                        requestAnimationFrame(updatePosition);
                    };

                    // Initial wait for delay if specified, otherwise start immediately
                    if (currentStep.highlightDelay) {
                        if (highlightRef.current) highlightRef.current.style.display = 'none';
                        setTimeout(() => {
                            requestAnimationFrame(updatePosition);
                        }, currentStep.highlightDelay);
                    } else {
                        requestAnimationFrame(updatePosition);
                    }
                } else if (attempts < maxAttempts) {
                    // Element not found yet, try again
                    attempts++;
                    setTimeout(findAndHighlight, 100);
                }
            };

            // Start trying to find the element
            setTimeout(findAndHighlight, 100);
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
        // Navigate back to training menu
        router.push('/training');
    }

    const handleCloseDismiss = () => {
        setShowVictory(false);
        stopTraining();
        // Navigate back to training menu
        router.push('/training');
    }

    return (
        <>
            {/* Invisible overlay to block all user interactions */}
            <div
                className="fixed inset-0 z-[9998]"
                style={{
                    pointerEvents: 'all',
                    userSelect: 'none',
                    touchAction: 'none',
                    cursor: 'default'
                }}
                onClick={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
            />

            {/* Highlight box with cutout effect */}
            <div
                ref={highlightRef}
                className="fixed z-[9999] border-4 border-red-500 rounded-lg pointer-events-none transition-all duration-300"
                style={{
                    display: 'none',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 20px rgba(246, 59, 59, 1)'
                }}
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

            {/* Instruction card (Hide if Victory) - Compact version */}
            {!showVictory && (
                <Card className="fixed bottom-4 right-4 w-80 z-[10000] shadow-2xl">
                    <CardContent className="p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-base truncate">{activeModule.title}</h3>
                                <p className="text-xs text-muted-foreground">
                                    Paso {currentStepIndex + 1} de {activeModule.steps.length}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleCloseDismiss}
                                className="h-6 w-6 flex-shrink-0"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-red-500 transition-all duration-300"
                                style={{ width: `${((currentStepIndex + 1) / activeModule.steps.length) * 100}%` }}
                            />
                        </div>

                        {/* Current step */}
                        <div className="space-y-1">
                            <h4 className="font-semibold text-sm">{currentStep.title}</h4>
                            <p className="text-xs text-muted-foreground leading-tight">{currentStep.description}</p>
                        </div>

                        {/* Tips - Collapsed by default */}
                        {currentStep.tips && currentStep.tips.length > 0 && (
                            <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded-md">
                                <div className="flex items-start gap-1.5 text-red-700 dark:text-red-300">
                                    <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-medium block mb-1">Consejo:</span>
                                        <p className="text-xs leading-tight">{currentStep.tips[0]}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex items-center justify-between pt-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={prevStep}
                                disabled={isFirstStep}
                                className="h-8 text-xs"
                            >
                                <ArrowLeft className="h-3 w-3 mr-1" />
                                Anterior
                            </Button>

                            {isLastStep ? (
                                <Button
                                    size="sm"
                                    onClick={handleComplete}
                                    className="h-8 text-xs bg-red-600 hover:bg-red-700"
                                >
                                    Finalizar
                                    <ArrowRight className="h-3 w-3 ml-1" />
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={nextStep}
                                    className="h-8 text-xs bg-red-600 hover:bg-red-700"
                                >
                                    Siguiente
                                    <ArrowRight className="h-3 w-3 ml-1" />
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </>
    );
}
