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
import { MockBlockRoomModal } from '@/components/training/modals/mock-block-room-modal';
import { MockShiftClosingModal } from '@/components/training/modals/mock-shift-closing-modal';
import {
    MockInventoryPanel,
    MockSensorsPanel,
    MockAdminPanel,
    MockShiftPanel,
    MockReportPanel,
    MockConfigPanel,
    MockPurchasesPanel
} from '@/components/training/mock-panels';
import { TutorialOverlay } from '@/components/training/tutorial-overlay';
import { BookOpen } from 'lucide-react';

const ROOM_STATUS_BG: Record<string, string> = {
    FREE: 'bg-green-900/80',
    LIBRE: 'bg-green-900/80',
    OCCUPIED: 'bg-red-900/80',
    OCUPADA: 'bg-red-900/80',
    RESERVED: 'bg-yellow-900/80',
    RESERVADA: 'bg-yellow-900/80',
};

// Mocks Visuales importados de @/components/training/mock-panels

// Componente para módulos genéricos (sin grid de habitaciones)
function PracticeGenericModule({ module, onCompleteStep, completedSteps, onOpenExpense, mockExpense }: any) {
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

const ROOM_STATUS_ACCENT: Record<string, string> = {
    FREE: 'border-l-4 border-green-400',
    LIBRE: 'border-l-4 border-green-400',
    OCCUPIED: 'border-l-4 border-red-400',
    OCUPADA: 'border-l-4 border-red-400',
    RESERVED: 'border-l-4 border-yellow-400',
    RESERVADA: 'border-l-4 border-yellow-400',
};

// Mapping of Step IDs to DOM Element IDs for Tutorial Overlay
const stepTargetIds: Record<string, string> = {
    // Inventory
    'register-movement': 'tutorial-btn-new-movement',
    'kardex-check': 'tutorial-tab-kardex',
    // Purchases
    'suppliers': 'tutorial-tab-suppliers',
    'new-purchase': 'tutorial-btn-new-purchase',
    // Sensors
    'sensor-states': 'tutorial-btn-sensor-detail',
    'discrepancies': 'tutorial-btn-verify-alert',
    // Financial
    'sales-analysis': 'tutorial-btn-analyze-sales',
    'profitability': 'tutorial-btn-view-margins',
    // Customer
    'register-customer': 'tutorial-btn-new-customer',
    'billing-data': 'tutorial-tab-customers',
};

export default function PracticePage() {
    const { activeModule, stopTraining, currentMode } = useTraining();
    const router = useRouter();
    const [completedExercises, setCompletedExercises] = useState<string[]>([]);
    const [practiceRooms, setPracticeRooms] = useState(mockRooms);
    const [isTutorialOpen, setIsTutorialOpen] = useState(currentMode === 'interactive');

    // Estados de Modales
    const [isWheelOpen, setIsWheelOpen] = useState(false);
    const [isWheelVisible, setIsWheelVisible] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
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
    const [isBlockRoomOpen, setIsBlockRoomOpen] = useState(false);
    const [mockExpense, setMockExpense] = useState<any>(null);

    // Inicializar escenario según módulo
    useEffect(() => {
        if (['manage-payments', 'sales-order', 'manage-credit', 'customer-management'].includes(activeModule?.id || '')) {
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
            if (!completedExercises.includes('pay-cash')) setCompletedExercises(prev => [...prev, 'pay-cash']);
        }
        if (methods.includes('TARJETA')) {
            if (!completedExercises.includes('pay-card')) setCompletedExercises(prev => [...prev, 'pay-card']);
        }
        if (methods.length > 1) {
            if (!completedExercises.includes('pay-mixed')) setCompletedExercises(prev => [...prev, 'pay-mixed']);
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

        checkPaymentExercises(payments);

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

    const confirmQuickCheckin = async (data: { initialPeople: number; actualEntryTime: Date }) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 1500));

        mockOperations.checkIn(selectedRoom.id, 'Cliente Rápido', data.initialPeople, 'PENDIENTE');
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
            vehicle_plate: 'PENDIENTE',
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

    const confirmCheckout = async (data: { payments: any[]; checkoutValetId?: string | null }) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 2000)); // Checkout tarda más por impresión

        checkPaymentExercises(data.payments);

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

    const confirmConsumption = (products: any[], methods?: { usedSearch: boolean; usedScan: boolean; usedEditQty: boolean; usedRemoveItem: boolean }) => {
        // Marcamos consumo
        const newCompleted = [...completedExercises];
        if (!newCompleted.includes('add-consumption')) newCompleted.push('add-consumption');

        // Marcamos métodos de entrada usados
        if (methods?.usedSearch && !newCompleted.includes('search-product')) {
            newCompleted.push('search-product');
            toast.success("✓ Objetivo: Búsqueda de productos completado");
        }
        if (methods?.usedScan && !newCompleted.includes('scan-product')) {
            newCompleted.push('scan-product');
            toast.success("✓ Objetivo: Escaneo de código completado");
        }

        // Marcamos gestión del carrito
        if (methods?.usedEditQty && !newCompleted.includes('edit-qty')) {
            newCompleted.push('edit-qty');
            toast.success("✓ Objetivo: Ajustar cantidades completado");
        }
        if (methods?.usedRemoveItem && !newCompleted.includes('remove-item')) {
            newCompleted.push('remove-item');
            toast.success("✓ Objetivo: Eliminar del carrito completado");
        }

        // Marcamos ticket (automático, como indica el tutorial)
        if (!newCompleted.includes('print-ticket')) {
            newCompleted.push('print-ticket');
            toast.info("🖨️ Tickets de Cocina y cliente generados automáticamente");
        }

        if (newCompleted.length > completedExercises.length) {
            setCompletedExercises(newCompleted);
        }

        // --- FIX: Actualizar deuda de la habitación para permitir más prácticas de pago ---
        const totalAmount = products.reduce((acc, item) => acc + (item.product.price * item.qty), 0);

        // Objetivo: Dejar Pendiente (Cargar a la cuenta)
        if (!completedExercises.includes('leave-pending')) {
            setCompletedExercises(prev => [...prev, 'leave-pending']);
            toast.success("✓ Objetivo: Dejar Pendiente completado (Cargo a cuenta)");
        }

        setPracticeRooms(rooms => rooms.map(r => {
            if (r.id === selectedRoom.id && r.room_stays?.[0]) {
                const currentDebt = r.room_stays[0].sales_orders?.remaining_amount || 0;
                const currentItems = (r.room_stays[0] as any).mockItems || [];

                // Crear nuevos items para el mock de pago granular
                const newItems = products.map((p, idx) => ({
                    id: `mock-item-${Date.now()}-${idx}`,
                    description: p.product.name,
                    amount: p.product.price * p.qty,
                    is_paid: false
                }));

                return {
                    ...r,
                    room_stays: [{
                        ...r.room_stays[0],
                        sales_orders: {
                            remaining_amount: currentDebt + totalAmount
                        },
                        // Extendemos el objeto stay con los items simulados
                        ...({ mockItems: [...currentItems, ...newItems] } as any)
                    }]
                };
            }
            return r;
        }));

        setIsConsumptionOpen(false);
    };

    const confirmAddHours = async (hours: number, payments: any[], isCourtesy?: boolean, courtesyReason?: string) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 1000));

        const result = mockOperations.addHours(selectedRoom.id, hours);

        if (isCourtesy) {
            toast.success(`${hours} hora(s) de cortesía añadida(s)${courtesyReason ? `: ${courtesyReason}` : ''}`);
            if (!completedExercises.includes('courtesy-hour')) {
                setCompletedExercises(prev => [...prev, 'courtesy-hour']);
            }
        } else {
            toast.success(result.message);
            checkPaymentExercises(payments);
            if (!completedExercises.includes('add-hours')) {
                setCompletedExercises(prev => [...prev, 'add-hours']);
            }

            // Objetivo: Dejar Pendiente
            if (!completedExercises.includes('leave-pending')) {
                setCompletedExercises(prev => [...prev, 'leave-pending']);
                toast.success("✓ Objetivo: Dejar Pendiente completado (Cargo a cuenta)");
            }

            // --- FIX: Actualizar deuda por horas extra ---
            setPracticeRooms(rooms => rooms.map(r => {
                if (r.id === selectedRoom.id && r.room_stays?.[0]) {
                    const currentDebt = r.room_stays[0].sales_orders?.remaining_amount || 0;
                    const currentItems = (r.room_stays[0] as any).mockItems || [];
                    const charge = result.charge || (hours * 80); // Fallback mock price

                    // Añadir item de horas
                    const newItem = {
                        id: `mock-hour-${Date.now()}`,
                        description: `Horas Extra (${hours}h)`,
                        amount: charge,
                        is_paid: false
                    };

                    return {
                        ...r,
                        room_stays: [{
                            ...r.room_stays[0],
                            sales_orders: {
                                remaining_amount: currentDebt + charge
                            },
                            ...({ mockItems: [...currentItems, newItem] } as any)
                        }]
                    };
                }
                return r;
            }));
        }

        setActionLoading(false);
        setIsHourManagementOpen(false);
    };

    const confirmRenewShift = async (payments: any[]) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 1000));

        toast.success("Turno renovado exitosamente");
        checkPaymentExercises(payments);

        if (!completedExercises.includes('renew-shift')) {
            setCompletedExercises(prev => [...prev, 'renew-shift']);
        }

        setActionLoading(false);
        setIsHourManagementOpen(false);
    };

    const confirmPromo4H = async (payments: any[]) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 1000));

        toast.success("Promoción 4 Horas aplicada");
        checkPaymentExercises(payments);

        if (!completedExercises.includes('promos')) {
            setCompletedExercises(prev => [...prev, 'promos']);
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
        } else {
            // Objetivo: Abono Parcial
            if (!completedExercises.includes('partial-payment')) {
                setCompletedExercises(prev => [...prev, 'partial-payment']);
                toast.success("✓ Objetivo: Abono Parcial completado");
            }
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


    const confirmEditValet = (_valetId: string | null) => {
        toast.success("Cochero actualizado correctamente");
        if (!completedExercises.includes('edit-valet')) setCompletedExercises(prev => [...prev, 'edit-valet']);
        // No necesitamos actualizar state profundo para el mock visual, basta confirmar
        setIsEditValetOpen(false);
    };

    // Funciones para Manage People
    const handleAddPersonNew = async () => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 500));

        const extraPrice = selectedRoom.room_types.extra_person_price || 0;
        const currentPeople = selectedRoom.room_stays?.[0]?.current_people || 0;
        const totalPeople = selectedRoom.room_stays?.[0]?.total_people || 0;
        const shouldCharge = currentPeople >= 2 || totalPeople >= 2;

        setPracticeRooms(rooms => rooms.map(r => {
            if (r.id === selectedRoom.id && r.room_stays?.[0]) {
                const newCurrent = (r.room_stays[0].current_people || 0) + 1;
                const newTotal = Math.max(newCurrent, (r.room_stays[0].total_people || 0) + 1);
                const currentDebt = r.room_stays[0].sales_orders?.remaining_amount || 0;
                return {
                    ...r,
                    room_stays: [{
                        ...r.room_stays[0],
                        current_people: newCurrent,
                        total_people: newTotal,
                        sales_orders: {
                            remaining_amount: shouldCharge ? currentDebt + extraPrice : currentDebt
                        }
                    }]
                };
            }
            return r;
        }));

        if (shouldCharge && extraPrice > 0) {
            toast.success(`Persona NUEVA añadida (+$${extraPrice} cargo extra)`);
        } else {
            toast.success("Persona NUEVA añadida (sin cargo adicional)");
        }
        if (!completedExercises.includes('add-person-new')) setCompletedExercises(prev => [...prev, 'add-person-new']);
        setActionLoading(false);
        setIsManagePeopleOpen(false);
    };

    const handleAddPersonReturning = async () => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 500));

        setPracticeRooms(rooms => rooms.map(r => {
            if (r.id === selectedRoom.id && r.room_stays?.[0]) {
                return {
                    ...r,
                    room_stays: [{
                        ...r.room_stays[0],
                        current_people: (r.room_stays[0].current_people || 0) + 1,
                        // No incrementamos total_people porque ya estaba contada
                        hasActiveTolerance: false // Cancela la tolerancia
                    }]
                };
            }
            return r;
        }));

        toast.success("Persona REGRESÓ (tolerancia cancelada, sin cargo extra)");
        if (!completedExercises.includes('add-person-returning')) setCompletedExercises(prev => [...prev, 'add-person-returning']);
        setActionLoading(false);
        setIsManagePeopleOpen(false);
    };

    const handleRemovePerson = async (willReturn: boolean) => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 500));

        setPracticeRooms(rooms => rooms.map(r => {
            if (r.id === selectedRoom.id && r.room_stays?.[0]) {
                const current = r.room_stays[0].current_people || 0;
                return {
                    ...r,
                    room_stays: [{
                        ...r.room_stays[0],
                        current_people: Math.max(0, current - 1),
                        hasActiveTolerance: willReturn, // Activa tolerancia si va a regresar
                        toleranceMinutesLeft: willReturn ? 60 : undefined
                    }]
                };
            }
            return r;
        }));

        if (willReturn) {
            toast.success("Persona SALIÓ temporalmente (tolerancia 1 hora activa)");
            if (!completedExercises.includes('remove-person-temp')) setCompletedExercises(prev => [...prev, 'remove-person-temp']);
        } else {
            toast.success("Persona SALIÓ definitivamente");
            if (!completedExercises.includes('remove-person-definitive')) setCompletedExercises(prev => [...prev, 'remove-person-definitive']);
        }
        setActionLoading(false);
        setIsManagePeopleOpen(false);
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
        setIsBlockRoomOpen(true);
        closeWheel();
    };

    const confirmBlockRoom = (reason: string) => {
        if (!selectedRoom) return;
        setActionLoading(true);

        const result = mockOperations.blockRoom(selectedRoom.id, reason);
        toast.success(`Habitación bloqueada: ${reason}`);

        if (!completedExercises.includes('block-room')) {
            setCompletedExercises(prev => [...prev, 'block-room']);
        }

        setPracticeRooms(rooms => rooms.map(r =>
            r.id === selectedRoom.id ? { ...r, status: 'BLOQUEADA' as any, notes: reason } : r
        ));

        setActionLoading(false);
        setIsBlockRoomOpen(false);
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

        // Objetivo: Abono Parcial (Si queda deuda)
        // El estado se actualizó arriba, pero podemos checar payments vs remaining anterior o recalcular
        // update simple: si no cubrió todo el saldo, es parcial.
        // Pero el handlePayExtra no tiene acceso fácil al saldo nuevo aquí. 
        // Asumiremos que si se paga extras y no es 0, es parcial?
        // Mejor chequeamos si la deuda remanente > 0 logicamente.
        // Para simplificar: si el usuario hace "Pagar Extras" suele ser abono.
        // Pero para ser estrictos, deberíamos ver si liquida. 
        // En este mock, confirmPayExtra actualiza el estado. 
        // Vamos a marcarlo siempre como partial-payment si no liquida (complicado de saber aquí sin leer state).
        // Simplificación: Marcar partial-payment si se usa este modal, ya que suele ser para eso.
        if (!completedExercises.includes('partial-payment')) {
            setCompletedExercises(prev => [...prev, 'partial-payment']);
            toast.success("✓ Objetivo: Abono Parcial completado");
        }

        setActionLoading(false);
        setIsPayExtraOpen(false);
    };

    const handleNoOp = () => {
        closeWheel();
    };

    const handleConfirmClosing = () => {
        setCompletedExercises(prev => {
            if (!prev.includes('close-shift')) {
                toast.success("Turno cerrado exitosamente (Arqueo realizado)");
                return [...prev, 'close-shift'];
            }
            return prev;
        });
        setIsClosingModalOpen(false);
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
                        <div className="flex items-center gap-2">
                            <Button
                                variant={isTutorialOpen ? "default" : "outline"}
                                size="sm"
                                className="gap-2"
                                onClick={() => setIsTutorialOpen(!isTutorialOpen)}
                            >
                                <BookOpen className="h-4 w-4" />
                                {isTutorialOpen ? "Ocultar Guía" : "Tutorial Interactivo"}
                            </Button>
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
                {['intro-basica', 'intro-interfaz'].includes(activeModule.id) ? (
                    <PracticeIntro
                        completedSteps={completedExercises}
                        onCompleteStep={(stepId) => {
                            if (!completedExercises.includes(stepId)) {
                                setCompletedExercises(prev => [...prev, stepId]);
                                toast.success(`Lección completada: ${stepId}`);
                            }
                        }}
                        moduleId={activeModule.id}
                    />
                ) : ['shift-control', 'reports-basic', 'inventory-stock', 'inventory-movements', 'inventory-purchases', 'sensors-monitoring', 'customer-management', 'analytics-financial'].includes(activeModule.id) ? (
                    <PracticeGenericModule
                        module={activeModule}
                        completedSteps={completedExercises}
                        onCompleteStep={(stepId: string) => {
                            if (stepId === 'close-shift') {
                                setIsClosingModalOpen(true);
                                return;
                            }
                            if (!completedExercises.includes(stepId)) {
                                setCompletedExercises(prev => [...prev, stepId]);
                                toast.success("Paso completado");
                            }
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
                    onRequestVehicle={handleNoOp}
                    onAddDamageCharge={handleNoOp}
                    onNotifyCheckout={handleNoOp}
                    onViewServices={handleNoOp}
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
                            onConfirmRenew={confirmRenewShift}
                            onConfirmPromo4H={confirmPromo4H}
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
                            salesOrderId={`mock-order-${selectedRoom.id}`}
                            roomNumber={selectedRoom.number}
                            roomTypeName={selectedRoom.room_types.name}
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
                            hasActiveTolerance={(selectedRoom.room_stays?.[0] as any)?.hasActiveTolerance || false}
                            toleranceMinutesLeft={(selectedRoom.room_stays?.[0] as any)?.toleranceMinutesLeft}
                            extraPersonPrice={selectedRoom.room_types.extra_person_price || 0}
                            isHotelRoom={false}
                            actionLoading={actionLoading}
                            onClose={() => setIsManagePeopleOpen(false)}
                            onAddPersonNew={handleAddPersonNew}
                            onAddPersonReturning={handleAddPersonReturning}
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



                        <MockBlockRoomModal
                            isOpen={isBlockRoomOpen}
                            roomNumber={selectedRoom.number}
                            actionLoading={actionLoading}
                            onClose={() => setIsBlockRoomOpen(false)}
                            onConfirm={confirmBlockRoom}
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
            {/* Mock Shift Closing Modal - Needs to be outside selectedRoom check */}
            <MockShiftClosingModal
                open={isClosingModalOpen}
                onClose={() => setIsClosingModalOpen(false)}
                onConfirm={handleConfirmClosing}
                // Mock values
                initialFund={2000}
                totalSalesCash={5450}
                totalExpenses={mockExpense?.amount || 0}
            />

            <TutorialOverlay
                currentStepId={activeModule.steps.find(s => !completedExercises.includes(s.id))?.id || null}
                steps={activeModule.steps}
                targetIds={stepTargetIds}
                isEnabled={isTutorialOpen}
                onClose={() => setIsTutorialOpen(false)}
            />
        </div>
    );
}
