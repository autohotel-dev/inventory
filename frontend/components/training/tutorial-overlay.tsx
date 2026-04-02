"use client";

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowUp, ArrowRight, ArrowDown, X, Info } from 'lucide-react';

interface GuideStep {
    id: string;
    title: string;
    description: string;
    tips?: string[];
}

interface TutorialOverlayProps {
    currentStepId: string | null;
    steps: GuideStep[];
    targetIds: Record<string, string>; // stepId -> elementId
    isEnabled: boolean;
    onClose?: () => void;
}

export function TutorialOverlay({ currentStepId, steps, targetIds, isEnabled, onClose }: TutorialOverlayProps) {
    const [position, setPosition] = useState<{ top: number, left: number, placement: 'top' | 'bottom' | 'left' | 'right' } | null>(null);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const observerRef = useRef<MutationObserver | null>(null);

    const step = steps.find(s => s.id === currentStepId);

    useEffect(() => {
        if (!isEnabled || !currentStepId || !step) {
            setPosition(null);
            return;
        }

        const targetId = targetIds[currentStepId];
        if (!targetId) return;

        const updatePosition = () => {
            const element = document.getElementById(targetId);
            if (element) {
                const rect = element.getBoundingClientRect();
                setTargetRect(rect);

                // Calculate optimal position (default to bottom)
                // Assuming overlay width ~300px, height ~150px
                const overlayHeight = 180;
                const overlayWidth = 320;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                const spaceBelow = viewportHeight - rect.bottom;
                const spaceAbove = rect.top;
                const spaceRight = viewportWidth - rect.right;

                let placement: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
                let top = rect.bottom + 12;
                let left = rect.left + rect.width / 2 - overlayWidth / 2;

                if (spaceBelow < overlayHeight && spaceAbove > overlayHeight) {
                    placement = 'top';
                    top = rect.top - overlayHeight - 12;
                } else if (spaceRight > overlayWidth && spaceBelow < overlayHeight) {
                    placement = 'right';
                    left = rect.right + 12;
                    top = rect.top + rect.height / 2 - overlayHeight / 2;
                }

                // Adjust left to prevent overflow
                if (left < 10) left = 10;
                if (left + overlayWidth > viewportWidth - 10) left = viewportWidth - overlayWidth - 10;

                setPosition({ top, left, placement });
            } else {
                // Element not found (maybe tab is closed)
                setPosition(null);
            }
        };

        updatePosition();

        // Use MutationObserver for DOM changes and resize listener
        const resizeObserver = new ResizeObserver(updatePosition);
        resizeObserver.observe(document.body);

        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [currentStepId, isEnabled, targetIds, step]);

    if (!isEnabled || !step || !currentStepId) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
            {/* Spotlight Effect (Optional - can be jarring, using highlight box instead) */}

            {/* Highlight Box around Target */}
            {targetRect && (
                <div
                    className="absolute border-4 border-blue-500 rounded-md box-content transition-all duration-300 animate-pulse"
                    style={{
                        top: targetRect.top + window.scrollY - 4, // Adjust for border width
                        left: targetRect.left + window.scrollX - 4,
                        width: targetRect.width,
                        height: targetRect.height,
                        zIndex: 100
                    }}
                />
            )}

            {/* Guide Card */}
            {position ? (
                <Card
                    className="absolute shadow-2xl w-[320px] pointer-events-auto bg-blue-600 text-white border-blue-500 animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: position.top + window.scrollY,
                        left: position.left + window.scrollX,
                    }}
                >
                    <CardContent className="p-4 relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1 h-6 w-6 text-white/50 hover:text-white hover:bg-white/20"
                            onClick={onClose}
                        >
                            <X className="h-4 w-4" />
                        </Button>

                        <div className="flex items-start gap-3">
                            <div className="bg-white/20 p-2 rounded-full mt-1">
                                <Info className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h4 className="font-bold text-base mb-1">{step.title}</h4>
                                <p className="text-sm text-blue-50 mb-2 leading-relaxed">
                                    {step.description}
                                </p>
                                {step.tips && step.tips.length > 0 && (
                                    <div className="bg-blue-700/50 p-2 rounded text-xs text-blue-100 flex gap-2 items-start mt-2">
                                        <div className="mt-0.5">•</div>
                                        <span>{step.tips[0]}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pointer Arrow */}
                        <div
                            className="absolute w-4 h-4 bg-blue-600 rotate-45 transform border-l border-t border-blue-400"
                            style={{
                                bottom: position.placement === 'top' ? -8 : undefined,
                                top: position.placement === 'bottom' ? -8 : undefined,
                                left: '50%',
                                marginLeft: -8,
                                display: position.placement === 'right' || position.placement === 'left' ? 'none' : 'block'
                            }}
                        />
                    </CardContent>
                </Card>
            ) : (
                // Fallback when element is not visible (e.g. inside a tab not selected)
                <div className="fixed bottom-6 right-6 pointer-events-auto animate-in slide-in-from-right">
                    <Card className="w-[320px] shadow-2xl bg-slate-900 text-white border-slate-700">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold bg-blue-600 px-2 py-0.5 rounded uppercase tracking-wider">Siguiente Paso</span>
                                <Button variant="ghost" size="icon" className="h-4 w-4 text-white/50 hover:text-white" onClick={onClose}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                            <h4 className="font-bold text-base text-blue-300">{step.title}</h4>
                            <p className="text-sm text-slate-300 mt-1">{step.description}</p>
                            <div className="text-xs text-slate-400 mt-2 italic border-t border-slate-700 pt-2">
                                💡 Tip: Si no ves el botón, intenta cambiar de pestaña en el simulador.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
