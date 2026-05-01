"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    MockInventoryPanel,
    MockSensorsPanel,
    MockAdminPanel,
    MockShiftPanel,
    MockReportPanel,
    MockConfigPanel,
    MockPurchasesPanel
} from '@/components/training/mock-panels';

export function PracticeGenericModule({ module, onCompleteStep, completedSteps, onOpenExpense, mockExpense }: any) {
    const renderVisualMock = () => {
        if (module.id === 'shift-control') return <MockShiftPanel completed={completedSteps} mockExpense={mockExpense} />;
        if (module.id === 'reports-basic') return <MockReportPanel completed={completedSteps} />;
        if (module.id === 'inventory-purchases') return <MockPurchasesPanel completed={completedSteps} onComplete={onCompleteStep} />;
        // No hay config panel en training-data aún, pero lo dejamos por si acaso
        if (module.id === 'configuracion-sistema') return <MockConfigPanel completed={completedSteps} />;

        // Nuevos mocks visuales por categoría
        if (module.category === 'inventory') return <MockInventoryPanel completed={completedSteps} onComplete={onCompleteStep} />;
        if (module.category === 'sensors') return <MockSensorsPanel completed={completedSteps} onComplete={onCompleteStep} />;
        if (module.category === 'admin') return <MockAdminPanel completed={completedSteps} onComplete={onCompleteStep} />;

        return <div className="text-center text-muted-foreground p-8">Vista previa no disponible</div>;
    };

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Panel de Acciones (Izquierda/Arriba) */}
            <Card className="md:col-span-1 lg:col-span-1 h-fit">
                <CardHeader>
                    <CardTitle className="text-lg">Acciones Requeridas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {module.steps.map((step: any) => {
                        const isCompleted = completedSteps.includes(step.id);
                        return (
                            <Button
                                key={step.id}
                                variant={isCompleted ? "outline" : "default"}
                                className={`w-full justify-between h-auto py-3 px-4 ${isCompleted ? 'border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-900/20' : ''}`}
                                onClick={() => {
                                    // Special cases: Modals can be re-opened for practice
                                    if (step.id === 'register-expense') {
                                        onOpenExpense();
                                        return;
                                    }
                                    if (step.id === 'close-shift') {
                                        onCompleteStep(step.id); // This triggers the modal
                                        return;
                                    }

                                    // One-time actions
                                    if (!isCompleted) {
                                        toast.success(`Acción realizada: ${step.title}`);
                                        onCompleteStep(step.id);
                                    }
                                }}
                            >
                                <span className="font-medium text-left mr-2">{step.title}</span>
                                {isCompleted ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /> : <div className="h-2 w-2 rounded-full bg-primary/50 shrink-0" />}
                            </Button>
                        );
                    })}
                    <div className="text-xs text-muted-foreground text-center pt-2">
                        Haz clic en los botones para simular las acciones
                    </div>
                </CardContent>
            </Card>

            {/* Panel de Visualización (Derecha/Abajo) */}
            <Card className="md:col-span-1 lg:col-span-2">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        🖥️ Simulador de {module.title}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border shadow-inner min-h-[300px] flex flex-col justify-center">
                        {renderVisualMock()}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
