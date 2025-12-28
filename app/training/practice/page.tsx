"use client";

import { useState, useEffect } from 'react';
import { useTraining } from '@/contexts/training-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { mockRooms, mockOperations } from '@/lib/training/mock-data';
import { toast } from 'sonner';
import { RoomCard } from '@/components/sales/room-card';
import { RoomActionsWheel } from '@/components/sales/room-actions-wheel';

// Modal imports
import { RoomStartStayModal } from '@/components/sales/room-start-stay-modal';
import { RoomHourManagementModal } from '@/components/sales/room-hour-management-modal';
import { RoomCheckoutModal } from '@/components/sales/room-checkout-modal';
import { EditVehicleModal } from '@/components/sales/edit-vehicle-modal';
import { CancelStayModal } from '@/components/sales/cancel-stay-modal';
import { MockAddConsumptionModal } from '@/components/training/modals/mock-add-consumption-modal';
import { MockQuickCheckinModal } from '@/components/training/modals/mock-quick-checkin-modal';
import { MockEditValetModal } from '@/components/training/modals/mock-edit-valet-modal';
import { MockRoomDetailsModal } from '@/components/training/modals/mock-room-details-modal';
import { ChangeRoomModal } from '@/components/sales/change-room-modal';
import { ManagePeopleModal } from '@/components/sales/manage-people-modal';
import { RoomPayExtraModal } from '@/components/sales/room-pay-extra-modal';
import { PracticeIntro } from '@/components/training/practice-intro';
import { MockGranularPaymentModal, MockOrderItem } from '@/components/training/modals/mock-granular-payment-modal';
import { MockExpenseModal } from '@/components/training/modals/mock-expense-modal';

const ROOM_STATUS_BG: Record<string, string> = {
    FREE: 'bg-green-900/80',
    LIBRE: 'bg-green-900/80',
    OCCUPIED: 'bg-red-900/80',
    OCUPADA: 'bg-red-900/80',
    RESERVED: 'bg-yellow-900/80',
    RESERVADA: 'bg-yellow-900/80',
};

// Mocks Visuales para Módulos Genéricos
function MockShiftPanel({ completed, mockExpense }: { completed: string[], mockExpense?: any }) {
    const isStarted = completed.includes('start-shift');
    const isClosed = completed.includes('close-shift');
    const hasExpense = completed.includes('register-expense');

    return (
        <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${isClosed ? 'bg-red-50 border-red-200 dark:bg-red-900/20' : isStarted ? 'bg-green-50 border-green-200 dark:bg-green-900/20' : 'bg-gray-50 border-gray-200 dark:bg-gray-800'}`}>
                <div className="font-bold mb-1">Estado del Turno</div>
                <div className="text-2xl font-mono">{isClosed ? '🔴 CERRADO' : isStarted ? '🟢 ABIERTO' : '⚪ NO INICIADO'}</div>
                {isStarted && <div className="text-xs mt-2 text-muted-foreground">Iniciado: {new Date().toLocaleTimeString()}</div>}
            </div>

            <div className="border rounded-lg overflow-hidden bg-card">
                <div className="bg-muted p-2 text-xs font-semibold uppercase tracking-wider">Movimientos Recientes</div>
                <div className="p-3 space-y-2 text-sm">
                    {hasExpense && (
                        <div className="flex justify-between text-red-600 font-medium">
                            <span>{mockExpense ? `Gasto: ${mockExpense.description}` : 'Gasto: Limpieza General'}</span>
                            <span>{mockExpense ? `-$${mockExpense.amount.toFixed(2)}` : '-$150.00'}</span>
                        </div>
                    )}
                    {isStarted ? (
                        <div className="flex justify-between text-muted-foreground italic text-xs">
                            <span>-- Esperando más movimientos --</span>
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground py-4 text-xs">Inicia turno para ver registros</div>
                    )}
                    {isClosed && (
                        <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                            <span>Balance Final:</span>
                            <span>{hasExpense ? '-$150.00' : '$0.00'}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function MockReportPanel({ completed }: { completed: string[] }) {
    const hasReport = completed.includes('income-report');
    const hasFilters = completed.includes('filters');
    const isPrinted = completed.includes('print-report');

    if (!hasReport) return (
        <div className="h-full flex items-center justify-center border-2 border-dashed rounded-lg p-8 text-muted-foreground bg-muted/20">
            <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <div>Genera un reporte para visualizar datos</div>
            </div>
        </div>
    );

    return (
        <div className="space-y-4 border p-4 rounded-lg bg-card shadow-sm">
            <div className="flex justify-between items-center border-b pb-2">
                <div className="font-bold">Reporte de Ingresos</div>
                {isPrinted && <Badge variant="secondary">Impreso 🖨️</Badge>}
            </div>
            {hasFilters && (
                <div className="flex gap-2 text-xs">
                    <Badge variant="outline">Filtro: Hoy</Badge>
                    <Badge variant="outline">Método: Todos</Badge>
                </div>
            )}
            <div className="space-y-2">
                <div className="flex items-end gap-2 h-32 pt-4 justify-between px-4 bg-muted/20 rounded">
                    <div className="w-8 bg-blue-300 h-3/4 rounded-t" title="Efectivo"></div>
                    <div className="w-8 bg-green-300 h-1/2 rounded-t" title="Tarjeta"></div>
                    <div className="w-8 bg-purple-300 h-1/4 rounded-t" title="Transferencia"></div>
                    <div className="w-8 bg-yellow-300 h-2/3 rounded-t" title="Otros"></div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground px-4">
                    <span>EFE</span><span>TAR</span><span>TRA</span><span>OTR</span>
                </div>
            </div>
            <div className="text-right font-bold text-lg mt-2">$12,450.00</div>
        </div>
    );
}

function MockConfigPanel({ completed }: { completed: string[] }) {
    return (
        <div className="border rounded-lg overflow-hidden bg-card">
            <div className="bg-muted p-2 text-xs font-semibold">Configuración Actual</div>
            <div className="divide-y">
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">👤</div>
                        <div className="text-sm">
                            <div className="font-medium">Empleados</div>
                            <div className="text-xs text-muted-foreground">{completed.includes('manage-employees') ? '3 Activos (Editado)' : '3 Activos'}</div>
                        </div>
                    </div>
                    {completed.includes('manage-employees') && <Badge className="bg-green-500">Actualizado</Badge>}
                </div>
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">📦</div>
                        <div className="text-sm">
                            <div className="font-medium">Productos</div>
                            <div className="text-xs text-muted-foreground">{completed.includes('manage-products') ? '45 Items (Catálogo ok)' : '45 Items'}</div>
                        </div>
                    </div>
                </div>
                <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">🖨️</div>
                        <div className="text-sm">
                            <div className="font-medium">Impresoras</div>
                            <div className="text-xs text-muted-foreground">{completed.includes('printer-config') ? 'Conectada: 192.168.1.50' : 'Sin configurar'}</div>
                        </div>
                    </div>
                    {completed.includes('printer-config') && <Badge variant="outline">Online</Badge>}
                </div>
            </div>
        </div>
    );
}

// Componente para módulos genéricos (sin grid de habitaciones)
function PracticeGenericModule({ module, onCompleteStep, completedSteps, onOpenExpense, mockExpense }: any) {
    const renderVisualMock = () => {
        if (module.id === 'gestion-turnos') return <MockShiftPanel completed={completedSteps} mockExpense={mockExpense} />;
        if (module.id === 'reportes-informes') return <MockReportPanel completed={completedSteps} />;
        if (module.id === 'configuracion-sistema') return <MockConfigPanel completed={completedSteps} />;
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
                                    if (!isCompleted) {
                                        if (step.id === 'register-expense') {
                                            onOpenExpense();
                                            return;
                                        }
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

const ROOM_STATUS_ACCENT: Record<string, string> = {
    FREE: 'border-l-4 border-green-400',
    LIBRE: 'border-l-4 border-green-400',
    OCCUPIED: 'border-l-4 border-red-400',
    OCUPADA: 'border-l-4 border-red-400',
    RESERVED: 'border-l-4 border-yellow-400',
    RESERVADA: 'border-l-4 border-yellow-400',
};

export default function PracticePage() {
    const { activeModule, stopTraining } = useTraining();
    const router = useRouter();
    const [completedExercises, setCompletedExercises] = useState<string[]>([]);
    const [practiceRooms, setPracticeRooms] = useState(mockRooms);

    // Estados de Modales
    const [isWheelOpen, setIsWheelOpen] = useState(false);
    const [isWheelVisible, setIsWheelVisible] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const [isStartStayOpen, setIsStartStayOpen] = useState(false);
    const [isQuickCheckinOpen, setIsQuickCheckinOpen] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isConsumptionOpen, setIsConsumptionOpen] = useState(false);
    const [isHourManagementOpen, setIsHourManagementOpen] = useState(false);
    const [isEditVehicleOpen, setIsEditVehicleOpen] = useState(false);
    const [isCancelStayOpen, setIsCancelStayOpen] = useState(false);

    // Nuevos Modales
    const [isChangeRoomOpen, setIsChangeRoomOpen] = useState(false);
    const [isManagePeopleOpen, setIsManagePeopleOpen] = useState(false);
    const [isEditValetOpen, setIsEditValetOpen] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isPayExtraOpen, setIsPayExtraOpen] = useState(false);
    const [isGranularPaymentOpen, setIsGranularPaymentOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [mockExpense, setMockExpense] = useState<any>(null);

    // Inicializar escenario según módulo
    useEffect(() => {
        if (['procesamiento-pagos', 'consumos-ventas', 'gestion-avanzada'].includes(activeModule?.id || '')) {
            // Pre-llenar habitaciones con deuda para practicar cobro inmediato
            const now = new Date();
            setPracticeRooms(prev => prev.map((r, i) => {
                if (i === 0) { // Habitación 101 ocupada con deuda
                    return {
                        ...r,
                        status: 'OCUPADA' as any,
                        notes: 'Cliente con deuda pendiente',
                        room_stays: [{
                            id: 'mock-stay-debt',
                            sales_order_id: 'mock-so-debt',
                            status: 'ACTIVE',
                            check_in_at: new Date(now.getTime() - 7200000).toISOString(), // 2 horas
                            remaining_amount: 0,
                            current_people: 2,
                            vehicle_plate: 'PAY-TEST',
                            total_people: 2,
                            sales_orders: { remaining_amount: 500 }
                        }]
                    };
                }
                return r;
            }));
        }
    }, [activeModule?.id]);

    // Helper para verificar ejercicios de pago
    const checkPaymentExercises = (payments: any[]) => {
        if (!payments || payments.length === 0) return;
        const methods = payments.map(p => p.method);

        if (methods.includes('EFECTIVO')) {
            if (!completedExercises.includes('pago-efectivo')) setCompletedExercises(prev => [...prev, 'pago-efectivo']);
        }
        if (methods.includes('TARJETA')) {
            if (!completedExercises.includes('pago-tarjeta')) setCompletedExercises(prev => [...prev, 'pago-tarjeta']);
        }
        if (methods.length > 1) {
            if (!completedExercises.includes('multi-pago')) setCompletedExercises(prev => [...prev, 'multi-pago']);
        }
    };

    useEffect(() => {
        if (!activeModule) {
            router.push('/training');
        }
    }, [activeModule, router]);

    const handleExit = () => {
        stopTraining();
        router.push('/training');
    };

    if (!activeModule) {
        return null;
    }

    // Abrir rueda de acciones
    const openActionsWheel = (room: any) => {
        setSelectedRoom(room);
        setIsWheelOpen(true);
        setTimeout(() => setIsWheelVisible(true), 50);
    };

    const closeWheel = () => {
        setIsWheelVisible(false);
        setTimeout(() => {
            setIsWheelOpen(false);
            // No limpiar selectedRoom para mantener modales vivos
            // setSelectedRoom(null); 
        }, 300);
    };

    // HANDLERS DE APERTURA DE MODALES

    const handleStartStay = () => { // Check-in Normal
        if (!selectedRoom) return;
        setIsStartStayOpen(true);
        closeWheel();
    };

    const handleQuickCheckin = () => { // Check-in Rápido
        if (!selectedRoom) return;
        setIsQuickCheckinOpen(true);
        closeWheel();
    };

    const handlePracticeCheckout = () => { // Checkout
        if (!selectedRoom) return;
        setIsCheckoutOpen(true);
        closeWheel();
    };

    const handleGranularPayment = () => { // Cobrar Granular
        if (!selectedRoom) return;

        // Asegurar items simulados
        const roomIndex = practiceRooms.findIndex(r => r.id === selectedRoom.id);
        if (roomIndex === -1) return;

        const room = practiceRooms[roomIndex];
        const stay = room.room_stays?.[0];
        if (!stay) return;

        if (!(stay as any).mockItems) {
            const total = stay.sales_orders?.remaining_amount || 0;
            const items: MockOrderItem[] = [];

            if (total > 0) {
                items.push({
                    id: `item-${Date.now()}-1`,
                    name: `Renta ${room.room_types?.name || 'Habitación'}`,
                    qty: 1,
                    unit_price: total * 0.7,
                    total: total * 0.7,
                    concept_type: 'ROOM_BASE',
                    is_paid: false
                });
                items.push({
                    id: `item-${Date.now()}-2`,
                    name: 'Consumo Bar',
                    qty: 2,
                    unit_price: total * 0.15,
                    total: total * 0.3,
                    concept_type: 'CONSUMPTION',
                    is_paid: false
                });
            }

            const newRooms = [...practiceRooms];
            if (newRooms[roomIndex].room_stays?.[0]) {
                (newRooms[roomIndex].room_stays[0] as any).mockItems = items;
            }
            setPracticeRooms(newRooms);
            setSelectedRoom(newRooms[roomIndex]);
        }

        setIsGranularPaymentOpen(true);
        closeWheel();
    };

    const handleAddConsumption = () => { // Consumo
        if (!selectedRoom) return;
        setIsConsumptionOpen(true);
        closeWheel();
    };

    const handleAddHours = () => { // Gestionar Horas
        if (!selectedRoom) return;
        setIsHourManagementOpen(true);
        closeWheel();
    };

    const handleEditVehicle = () => { // Editar Vehículo
        if (!selectedRoom) return;
        setIsEditVehicleOpen(true);
        closeWheel();
    };

    const handleCancelStay = () => { // Cancelar
        if (!selectedRoom) return;
        setIsCancelStayOpen(true);
        closeWheel();
    };

    // HANDLERS DE CONFIRMACIÓN (Simulación de procesos)

    const confirmStartStay = async (initialPeople: number, payments: any[], vehicle: any) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 1500)); // Simular red

        const result = mockOperations.checkIn(selectedRoom.id, 'Cliente Normal', initialPeople, vehicle.plate || 'SIN-PLACAS');
        toast.success(result.message);

        // Calcular precio inicial simulado
        const basePrice = selectedRoom.room_types.base_price || 0;
        const extraPersonPrice = selectedRoom.room_types.extra_person_price || 0;
        const total = basePrice + Math.max(0, initialPeople - 2) * extraPersonPrice;

        const newStay = {
            id: `mock-stay-${Date.now()}`,
            sales_order_id: `mock-order-${Date.now()}`,
            status: 'ACTIVE',
            check_in_at: new Date().toISOString(),
            expected_check_out_at: null,
            current_people: initialPeople,
            total_people: initialPeople,
            vehicle_plate: vehicle.plate,
            sales_orders: { remaining_amount: Math.max(0, total - payments.reduce((acc: number, p: any) => acc + p.amount, 0)) }
        };

        setPracticeRooms(rooms => rooms.map(r =>
            r.id === selectedRoom.id ? {
                ...r,
                status: 'OCUPADA' as any,
                notes: `Entrada: ${new Date().toLocaleTimeString()}`,
                room_stays: [newStay]
            } : r
        ));

        if (!completedExercises.includes('check-in-normal')) {
            setCompletedExercises(prev => [...prev, 'check-in-normal']);
        }

        setActionLoading(false);
        setIsStartStayOpen(false);
    };

    const confirmQuickCheckin = async (data: any) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 1500));

        const result = mockOperations.checkIn(selectedRoom.id, 'Cliente Rápido', data.initialPeople, data.vehicle?.plate || 'PENDIENTE');
        toast.success('Entrada Rápida registrada con éxito');

        // Precio total queda pendiente
        const basePrice = selectedRoom.room_types.base_price || 0;
        const extraPersonPrice = selectedRoom.room_types.extra_person_price || 0;
        const total = basePrice + Math.max(0, data.initialPeople - 2) * extraPersonPrice;

        const newStay = {
            id: `mock-stay-${Date.now()}`,
            sales_order_id: `mock-order-${Date.now()}`,
            status: 'ACTIVE',
            check_in_at: data.actualEntryTime.toISOString(),
            expected_check_out_at: null,
            current_people: data.initialPeople,
            total_people: data.initialPeople,
            vehicle_plate: data.vehicle?.plate || 'PENDIENTE',
            sales_orders: { remaining_amount: total }
        };

        setPracticeRooms(rooms => rooms.map(r =>
            r.id === selectedRoom.id ? {
                ...r,
                status: 'OCUPADA' as any,
                notes: 'Entrada Rápida',
                room_stays: [newStay]
            } : r
        ));

        if (!completedExercises.includes('check-in-rapido')) {
            setCompletedExercises(prev => [...prev, 'check-in-rapido']);
        }

        setActionLoading(false);
        setIsQuickCheckinOpen(false);
    };

    const confirmCheckout = async (payments: any[]) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 2000)); // Checkout tarda más por impresión

        checkPaymentExercises(payments);

        const result = mockOperations.checkout(selectedRoom.id);
        toast.success(result.message);

        setPracticeRooms(rooms => rooms.map(r =>
            r.id === selectedRoom.id ? {
                ...r,
                status: 'LIBRE' as any,
                notes: null,
                room_stays: []
            } : r
        ));

        if (!completedExercises.includes('checkout')) {
            setCompletedExercises(prev => [...prev, 'checkout']);
        }

        setActionLoading(false);
        setIsCheckoutOpen(false);
    };

    const confirmConsumption = () => {
        // Marcamos consumo
        const newCompleted = [...completedExercises];
        if (!newCompleted.includes('add-consumption')) newCompleted.push('add-consumption');

        // Marcamos ticket (automático, como indica el tutorial)
        if (!newCompleted.includes('print-ticket')) {
            newCompleted.push('print-ticket');
            toast.info("🖨️ Tickets de Cocina y cliente generados automáticamente");
        }

        if (newCompleted.length > completedExercises.length) {
            setCompletedExercises(newCompleted);
        }

        setIsConsumptionOpen(false);
    };

    const confirmAddHours = async (hours: number, payments: any[]) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 1000));

        const result = mockOperations.addHours(selectedRoom.id, hours);
        toast.success(result.message);

        if (!completedExercises.includes('add-hours')) {
            setCompletedExercises(prev => [...prev, 'add-hours']);
        }

        setActionLoading(false);
        setIsHourManagementOpen(false);
    };

    const confirmCancelStay = async (reason: string, notes: string) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 1000));

        const result = mockOperations.cancelStay(selectedRoom.id);
        toast.error('Estadía cancelada');

        setPracticeRooms(rooms => rooms.map(r =>
            r.id === selectedRoom.id ? { ...r, status: 'LIBRE' as any, notes: null } : r
        ));

        if (!completedExercises.includes('cancel-stay')) setCompletedExercises(prev => [...prev, 'cancel-stay']);
        setActionLoading(false);
        setIsCancelStayOpen(false);
    };

    const confirmGranularPayment = async (paidItemIds: string[], payments: any[]) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 1500));

        checkPaymentExercises(payments);

        const roomIndex = practiceRooms.findIndex(r => r.id === selectedRoom.id);
        if (roomIndex === -1) return;

        const room = practiceRooms[roomIndex];
        const stay = room.room_stays?.[0];
        if (!stay || !(stay as any).mockItems) return;

        // Marcar items como pagados
        const newItems = (stay as any).mockItems.map((item: any) =>
            paidItemIds.includes(item.id) ? { ...item, is_paid: true } : item
        );

        // Recalcular deuda
        const totalPaid = payments.reduce((acc: number, p: any) => acc + p.amount, 0);
        const newRemaining = Math.max(0, (stay.sales_orders?.remaining_amount || 0) - totalPaid);

        const newRooms = [...practiceRooms];
        if (newRooms[roomIndex].room_stays?.[0]) {
            (newRooms[roomIndex].room_stays[0] as any).mockItems = newItems;
        }
        if (newRooms[roomIndex].room_stays?.[0]?.sales_orders) {
            newRooms[roomIndex].room_stays[0].sales_orders.remaining_amount = newRemaining;
        }

        if (newRemaining === 0) {
            newRooms[roomIndex].notes = 'Pagado completo';
        }

        setPracticeRooms(newRooms);
        setSelectedRoom(newRooms[roomIndex]);

        toast.success(`Pago registrado: $${totalPaid.toFixed(2)}`);
        setActionLoading(false);
        setIsGranularPaymentOpen(false);
    };

    const confirmEditVehicle = async (vehicle: any) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 800));
        if (!completedExercises.includes('edit-vehicle')) setCompletedExercises(prev => [...prev, 'edit-vehicle']);
        toast.success('Vehículo actualizado');
        setActionLoading(false);
        setIsEditVehicleOpen(false);
    }

    const confirmRegisterExpense = (data: any) => {
        setMockExpense(data);
        if (!completedExercises.includes('register-expense')) setCompletedExercises(prev => [...prev, 'register-expense']);
        setIsExpenseModalOpen(false);
    };

    // Handlers para Modales Avanzados
    const confirmChangeRoom = async (data: any) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 1500));

        // Mover la estancia a la nueva habitación
        const currentStay = selectedRoom.room_stays?.[0];
        const newRoomId = data.newRoomId;

        if (currentStay) {
            setPracticeRooms(rooms => rooms.map(r => {
                if (r.id === selectedRoom.id) {
                    // Liberar habitación actual
                    return { ...r, status: 'LIBRE' as any, room_stays: [], notes: null };
                }
                if (r.id === newRoomId) {
                    // Ocupar nueva habitación
                    return { ...r, status: 'OCUPADA' as any, room_stays: [currentStay], notes: 'Cambio de habitación' };
                }
                return r;
            }));
            toast.success(`Cambio a habitación realizado`);
            if (!completedExercises.includes('change-room')) setCompletedExercises(prev => [...prev, 'change-room']);
        }

        setActionLoading(false);
        setIsChangeRoomOpen(false);
        setSelectedRoom(null); // Cerrar selección para evitar conflictos visuales
    };

    const confirmEditValet = (valetId: string | null) => {
        toast.success("Cochero actualizado correctamente");
        if (!completedExercises.includes('edit-valet')) setCompletedExercises(prev => [...prev, 'edit-valet']);
        // No necesitamos actualizar state profundo para el mock visual, basta confirmar
        setIsEditValetOpen(false);
    };

    // Funciones para Manage People
    const handleAddPersonNew = async () => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 500));

        setPracticeRooms(rooms => rooms.map(r => {
            if (r.id === selectedRoom.id && r.room_stays?.[0]) {
                return { ...r, room_stays: [{ ...r.room_stays[0], current_people: (r.room_stays[0].current_people || 0) + 1 }] };
            }
            return r;
        }));

        toast.success("Persona añadida (Cargo extra aplicado)");
        if (!completedExercises.includes('manage-people')) setCompletedExercises(prev => [...prev, 'manage-people']);
        setActionLoading(false);
        // No cerramos el modal para permitir más ediciones o ver el resultado
    };

    const handleRemovePerson = async (willReturn: boolean) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 500));

        setPracticeRooms(rooms => rooms.map(r => {
            if (r.id === selectedRoom.id && r.room_stays?.[0]) {
                const current = r.room_stays[0].current_people || 0;
                return { ...r, room_stays: [{ ...r.room_stays[0], current_people: Math.max(0, current - 1) }] };
            }
            return r;
        }));

        toast.success(willReturn ? "Persona salió (con tolerancia)" : "Persona salió definitivamente");
        if (!completedExercises.includes('manage-people')) setCompletedExercises(prev => [...prev, 'manage-people']);
        setActionLoading(false);
    };

    // Handlers de Apertura (Openers)
    const handleManagePeople = () => {
        if (!selectedRoom) return;
        setIsManagePeopleOpen(true);
        closeWheel();
    };

    const handleEditValet = () => {
        if (!selectedRoom) return;
        setIsEditValetOpen(true);
        closeWheel();
    };

    const handleChangeRoom = () => {
        if (!selectedRoom) return;
        // Validar que hay habitaciones libres para mostrar warning si vacio? 
        // El modal lo maneja.
        setIsChangeRoomOpen(true);
        closeWheel();
    };

    const handleViewDetails = () => {
        if (!selectedRoom) return;
        setIsDetailsOpen(true);
        if (!completedExercises.includes('view-details')) setCompletedExercises(prev => [...prev, 'view-details']);
        closeWheel();
    };

    // Handlers Simples (Directos)
    const handleMarkClean = () => {
        if (!selectedRoom) return;
        const result = mockOperations.markClean(selectedRoom.id);
        toast.success(result.message);
        if (!completedExercises.includes('mark-clean')) setCompletedExercises(prev => [...prev, 'mark-clean']);
        setPracticeRooms(rooms => rooms.map(r =>
            r.id === selectedRoom.id ? { ...r, status: 'LIBRE' as any } : r
        ));
        closeWheel();
    };

    const handleMarkDirty = () => {
        if (!selectedRoom) return;
        const result = mockOperations.markDirty(selectedRoom.id);
        toast.success(result.message);
        if (!completedExercises.includes('mark-dirty')) setCompletedExercises(prev => [...prev, 'mark-dirty']);
        setPracticeRooms(rooms => rooms.map(r =>
            r.id === selectedRoom.id ? { ...r, status: 'SUCIA' as any } : r
        ));
        closeWheel();
    };

    const handleBlockRoom = () => {
        if (!selectedRoom) return;
        // Podríamos hacer modal de motivo, pero por ahora directo con motivo fijo es aceptable para bloqueo mantenimiento
        const result = mockOperations.blockRoom(selectedRoom.id, 'Mantenimiento');
        toast.success(result.message);
        if (!completedExercises.includes('block-room')) setCompletedExercises(prev => [...prev, 'block-room']);
        setPracticeRooms(rooms => rooms.map(r =>
            r.id === selectedRoom.id ? { ...r, status: 'BLOQUEADA' as any, notes: 'Mantenimiento (Simulado)' } : r
        ));
        closeWheel();
    };

    const handleUnblockRoom = () => {
        if (!selectedRoom) return;
        const result = mockOperations.unblockRoom(selectedRoom.id);
        toast.success(result.message);
        setPracticeRooms(rooms => rooms.map(r =>
            r.id === selectedRoom.id ? { ...r, status: 'LIBRE' as any, notes: null } : r
        ));
        closeWheel();
    };

    const handlePayExtra = () => {
        if (!selectedRoom) return;
        setIsPayExtraOpen(true);
        closeWheel();
    };

    const confirmPayExtra = async (payments: any[]) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 1000));

        checkPaymentExercises(payments);

        const amount = payments.reduce((acc: number, p: any) => acc + p.amount, 0);

        setPracticeRooms(rooms => rooms.map(r => {
            if (r.id === selectedRoom.id && r.room_stays?.[0]) {
                const currentDebt = r.room_stays[0].sales_orders?.remaining_amount || 0;
                return {
                    ...r, room_stays: [{
                        ...r.room_stays[0],
                        sales_orders: { remaining_amount: Math.max(0, currentDebt - amount) }
                    }]
                };
            }
            return r;
        }));

        toast.success(`Pago extra registrado: $${amount.toFixed(2)}`);

        if (!completedExercises.includes('pay-extras')) setCompletedExercises(prev => [...prev, 'pay-extras']);

        setActionLoading(false);
        setIsPayExtraOpen(false);
    };

    const handleNoOp = () => {
        closeWheel();
    };

    const renderStatusBadge = (status: string) => {
        const statusMap: Record<string, { label: string; variant: any }> = {
            LIBRE: { label: 'LIBRE', variant: 'default' },
            FREE: { label: 'LIBRE', variant: 'default' },
            OCUPADA: { label: 'OCUPADA', variant: 'destructive' },
            OCCUPIED: { label: 'OCUPADA', variant: 'destructive' },
            RESERVADA: { label: 'RESERVADA', variant: 'secondary' },
            RESERVED: { label: 'RESERVADA', variant: 'secondary' },
            SUCIA: { label: 'SUCIA', variant: 'destructive' }, // Usamos un color distinto si fuera posible, pero destrucive funciona para alerta
            BLOQUEADA: { label: 'BLOQUEADA', variant: 'outline' },
        };

        const { label, variant } = statusMap[status] || { label: status, variant: 'outline' };
        return <Badge variant={variant}>{label}</Badge>;
    };

    return (
        <div className="min-h-screen">
            {/* Practice mode banner */}
            <div className="bg-orange-100 dark:bg-orange-900 border-b-4 border-orange-500 sticky top-0 z-50">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-orange-700 dark:text-orange-300" />
                            <div>
                                <div className="font-bold text-orange-900 dark:text-orange-100">
                                    🎮 MODO PRÁCTICA - {activeModule.title}
                                </div>
                                <div className="text-sm text-orange-700 dark:text-orange-300">
                                    Ambiente seguro con datos ficticios. ¡Practica sin preocupaciones!
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleExit}
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Salir
                        </Button>
                    </div>
                </div>
            </div>

            {/* Practice content */}
            <div className="container mx-auto py-6 space-y-6">
                {/* Progress */}
                <Card>
                    <CardHeader>
                        <CardTitle>Progreso de Ejercicios</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {activeModule.steps.map((step, idx) => {
                                // FIXED: Use ID check instead of index check
                                const isCompleted = completedExercises.includes(step.id);
                                return (
                                    <Badge
                                        key={step.id}
                                        variant={isCompleted ? "default" : "outline"}
                                        className={isCompleted ? "bg-green-600 hover:bg-green-700" : "bg-secondary/50 text-muted-foreground hover:bg-secondary/70"}
                                    >
                                        {isCompleted ? <CheckCircle2 className="h-3 w-3 mr-1" /> : (idx + 1 + ". ")}
                                        {step.title}
                                    </Badge>
                                );
                            })}
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                            Completa los ejercicios para dominar este módulo
                        </p>
                    </CardContent>
                </Card>

                {/* Instructions */}
                <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                    <CardContent className="p-6">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                            📋 Ejercicios de Práctica:
                        </h3>
                        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                            {activeModule.steps.map((step, idx) => (
                                <li key={step.id} className="flex items-start gap-2">
                                    <span className="font-bold">{idx + 1}.</span>
                                    <span><strong>{step.title}:</strong> {step.description}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Practice Rooms Grid or Intro */}
                {activeModule.id === 'intro-sistema' ? (
                    <PracticeIntro
                        completedSteps={completedExercises}
                        onCompleteStep={(stepId) => {
                            if (!completedExercises.includes(stepId)) {
                                setCompletedExercises(prev => [...prev, stepId]);
                                toast.success(`Lección completada: ${stepId}`);
                            }
                        }}
                    />
                ) : ['gestion-turnos', 'reportes-informes', 'configuracion-sistema'].includes(activeModule.id) ? (
                    <PracticeGenericModule
                        module={activeModule}
                        completedSteps={completedExercises}
                        onCompleteStep={(stepId: string) => {
                            if (!completedExercises.includes(stepId)) setCompletedExercises(prev => [...prev, stepId]);
                        }}
                        onOpenExpense={() => setIsExpenseModalOpen(true)}
                        mockExpense={mockExpense}
                    />
                ) : (
                    <Card>
                        <CardContent className="pt-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                                {practiceRooms.map((room) => {
                                    const status = room.status || 'LIBRE';
                                    // Mapear status a colores del badge
                                    let accentColor = '';
                                    if (status === 'SUCIA') accentColor = 'border-l-4 border-purple-400';
                                    else if (status === 'BLOQUEADA') accentColor = 'border-l-4 border-gray-400';
                                    else accentColor = ROOM_STATUS_ACCENT[status] || '';

                                    return (
                                        <RoomCard
                                            key={room.id}
                                            id={room.id}
                                            number={room.number}
                                            status={status}
                                            bgClass={ROOM_STATUS_BG[status] || (status === 'SUCIA' ? 'bg-purple-900/80' : status === 'BLOQUEADA' ? 'bg-gray-800/80' : 'bg-slate-900/80')}
                                            accentClass={accentColor}
                                            statusBadge={renderStatusBadge(status)}
                                            hasPendingPayment={false}
                                            roomTypeName={room.room_types?.name}
                                            notes={room.notes}
                                            sensorStatus={null}
                                            onInfo={() => {
                                                toast.info(`Habitación ${room.number} - ${room.room_types?.name || 'Práctica'}`);
                                            }}
                                            onActions={() => openActionsWheel(room)}
                                        />
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Rueda de Acciones Circular */}
                <RoomActionsWheel
                    room={selectedRoom}
                    hasExtraCharges={(selectedRoom?.room_stays?.[0]?.sales_orders?.remaining_amount || 0) > 0}
                    isOpen={isWheelOpen}
                    isVisible={isWheelVisible}
                    actionLoading={actionLoading}
                    statusBadge={selectedRoom ? renderStatusBadge(selectedRoom.status) : null}
                    onClose={closeWheel}
                    onStartStay={handleStartStay}
                    onQuickCheckin={handleQuickCheckin}
                    onCheckout={handlePracticeCheckout}
                    onAddProduct={handleAddConsumption}
                    onAddHour={handleAddHours}
                    onAddPerson={handleManagePeople}
                    onMarkClean={handleMarkClean}
                    onMarkDirty={handleMarkDirty}
                    onBlock={handleBlockRoom}
                    onUnblock={handleUnblockRoom}
                    onEditVehicle={handleEditVehicle}
                    onEditValet={handleEditValet}
                    onChangeRoom={handleChangeRoom}
                    onCancelStay={handleCancelStay}
                    onPayExtra={handlePayExtra}
                    onViewDetails={handleViewDetails}
                    onViewSale={handleNoOp}
                    onGranularPayment={handleGranularPayment}
                    onManagePeople={handleManagePeople}
                    onRemovePerson={handleManagePeople}
                    onPersonLeftReturning={handleNoOp}
                    onShowGuestPortal={handleNoOp}
                />

                {/* MODALES DE PRÁCTICA */}
                {selectedRoom && (
                    <>
                        <RoomStartStayModal
                            isOpen={isStartStayOpen}
                            roomNumber={selectedRoom.number}
                            roomType={selectedRoom.room_types}
                            expectedCheckout={new Date(Date.now() + (selectedRoom.room_types.weekday_hours || 4) * 60 * 60 * 1000)}
                            actionLoading={actionLoading}
                            onClose={() => setIsStartStayOpen(false)}
                            onConfirm={confirmStartStay}
                        />

                        <MockQuickCheckinModal
                            isOpen={isQuickCheckinOpen}
                            roomNumber={selectedRoom.number}
                            roomType={selectedRoom.room_types}
                            actionLoading={actionLoading}
                            onClose={() => setIsQuickCheckinOpen(false)}
                            onConfirm={confirmQuickCheckin}
                        />

                        <RoomCheckoutModal
                            isOpen={isCheckoutOpen}
                            roomNumber={selectedRoom.number}
                            roomTypeName={selectedRoom.room_types.name}
                            remainingAmount={selectedRoom.room_stays?.[0]?.sales_orders?.remaining_amount || 0}
                            checkoutAmount={selectedRoom.room_stays?.[0]?.sales_orders?.remaining_amount || 0}
                            actionLoading={actionLoading}
                            onAmountChange={() => { }}
                            onClose={() => setIsCheckoutOpen(false)}
                            onConfirm={confirmCheckout}
                        />

                        <MockAddConsumptionModal
                            isOpen={isConsumptionOpen}
                            roomNumber={selectedRoom.number}
                            onClose={() => setIsConsumptionOpen(false)}
                            onComplete={confirmConsumption}
                        />

                        <RoomHourManagementModal
                            isOpen={isHourManagementOpen}
                            room={{ ...selectedRoom, room_types: selectedRoom.room_types }}
                            actionLoading={actionLoading}
                            onClose={() => setIsHourManagementOpen(false)}
                            onConfirmCustomHours={confirmAddHours}
                            onConfirmRenew={async (pay) => await confirmAddHours(0, pay)}
                            onConfirmPromo4H={async (pay) => await confirmAddHours(4, pay)}
                        />

                        <EditVehicleModal
                            isOpen={isEditVehicleOpen}
                            roomNumber={selectedRoom.number}
                            currentVehicle={{
                                plate: selectedRoom.room_stays?.[0]?.vehicle_plate || '',
                                brand: '',
                                model: ''
                            }}
                            actionLoading={actionLoading}
                            onClose={() => setIsEditVehicleOpen(false)}
                            onSave={confirmEditVehicle}
                        />

                        <CancelStayModal
                            isOpen={isCancelStayOpen}
                            roomNumber={selectedRoom.number}
                            roomTypeName={selectedRoom.room_types.name}
                            totalPaid={0}
                            elapsedMinutes={45} // Simulado
                            actionLoading={actionLoading}
                            onClose={() => setIsCancelStayOpen(false)}
                            onConfirm={(data) => confirmCancelStay(data.reason, 'Cancelación simulada')}
                        />
                        <ManagePeopleModal
                            isOpen={isManagePeopleOpen}
                            roomNumber={selectedRoom.number}
                            currentPeople={selectedRoom.room_stays?.[0]?.current_people || 1}
                            totalPeople={selectedRoom.room_stays?.[0]?.total_people || 1}
                            maxPeople={selectedRoom.room_types.max_people || 4}
                            hasActiveTolerance={false}
                            extraPersonPrice={selectedRoom.room_types.extra_person_price || 0}
                            isHotelRoom={false}
                            actionLoading={actionLoading}
                            onClose={() => setIsManagePeopleOpen(false)}
                            onAddPersonNew={handleAddPersonNew}
                            onAddPersonReturning={handleAddPersonNew}
                            onRemovePerson={handleRemovePerson}
                        />

                        <ChangeRoomModal
                            isOpen={isChangeRoomOpen}
                            currentRoom={selectedRoom}
                            currentStay={selectedRoom.room_stays?.[0]}
                            availableRooms={practiceRooms.filter(r => r.id !== selectedRoom.id && ['LIBRE', 'FREE'].includes(r.status))}
                            actionLoading={actionLoading}
                            onClose={() => setIsChangeRoomOpen(false)}
                            onConfirm={confirmChangeRoom}
                        />

                        <MockEditValetModal
                            isOpen={isEditValetOpen}
                            roomNumber={selectedRoom.number}
                            currentValetId={selectedRoom.room_stays?.[0]?.valet_employee_id || null}
                            onClose={() => setIsEditValetOpen(false)}
                            onSuccess={confirmEditValet}
                        />

                        <MockRoomDetailsModal
                            isOpen={isDetailsOpen}
                            roomNumber={selectedRoom.number}
                            roomType={selectedRoom.room_types.name}
                            status={selectedRoom.status}
                            checkInTime={selectedRoom.room_stays?.[0]?.check_in_at}
                            totalAmount={selectedRoom.room_stays?.[0]?.sales_orders?.remaining_amount || 0}
                            paidAmount={0}
                            remainingAmount={selectedRoom.room_stays?.[0]?.sales_orders?.remaining_amount || 0}
                            onClose={() => setIsDetailsOpen(false)}
                        />

                        <RoomPayExtraModal
                            isOpen={isPayExtraOpen}
                            roomNumber={selectedRoom.number}
                            roomTypeName={selectedRoom.room_types.name}
                            extraAmount={selectedRoom.room_stays?.[0]?.sales_orders?.remaining_amount || 0}
                            payAmount={selectedRoom.room_stays?.[0]?.sales_orders?.remaining_amount || 0}
                            actionLoading={actionLoading}
                            onAmountChange={() => { }}
                            onClose={() => setIsPayExtraOpen(false)}
                            onConfirm={confirmPayExtra}
                        />

                        <MockGranularPaymentModal
                            isOpen={isGranularPaymentOpen}
                            roomNumber={selectedRoom.number}
                            items={(selectedRoom.room_stays?.[0] as any)?.mockItems || []}
                            onClose={() => setIsGranularPaymentOpen(false)}
                            onConfirm={confirmGranularPayment}
                        />
                    </>
                )}

                {/* Tips */}
                <Card className="bg-green-50 dark:bg-green-950 border-green-200">
                    <CardContent className="p-4">
                        <p className="text-sm text-green-800 dark:text-green-200">
                            💡 <strong>Consejo:</strong> Practica cada operación varias veces hasta que te sientas cómodo.
                            Los datos son ficticios, así que no te preocupes por cometer errores. ¡Ese es el objetivo de practicar!
                            <br /><br />
                            <strong>Cómo practicar:</strong> Haz click en el botón de acciones (tres puntos) de cualquier habitación
                            para ver la rueda circular con todas las opciones disponibles.
                        </p>
                    </CardContent>
                </Card>
            </div>
            {/* Mock Expense Modal for Shift Practice */}
            {isExpenseModalOpen && (
                <MockExpenseModal
                    open={isExpenseModalOpen}
                    onClose={() => setIsExpenseModalOpen(false)}
                    availableCash={1500}
                    onConfirm={confirmRegisterExpense}
                />
            )}
        </div>
    );
}
