import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTraining } from '@/contexts/training-context';
import { mockRooms, mockOperations } from '@/lib/training/mock-data';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { MockOrderItem } from '@/components/training/modals/mock-granular-payment-modal';

export function useTrainingSimulator() {
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

    const confirmAddHours = async (hours: number, isCourtesy?: boolean, courtesyReason?: string) => {
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
            // checkPaymentExercises(payments); // Removed payments from here as modal handles core logic
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

    const confirmRenewShift = async () => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 1000));

        toast.success("Turno renovado exitosamente");
        // checkPaymentExercises(payments);

        if (!completedExercises.includes('renew-shift')) {
            setCompletedExercises(prev => [...prev, 'renew-shift']);
        }

        setActionLoading(false);
        setIsHourManagementOpen(false);
    };

    const confirmPromo4H = async () => {
        setActionLoading(true);
        await new Promise(r => setTimeout(r, 1000));

        toast.success("Promoción 4 Horas aplicada");
        // checkPaymentExercises(payments);

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

    // Pagar extra removido
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


    return {
        completedExercises, setCompletedExercises,
        practiceRooms, setPracticeRooms,
        isTutorialOpen, setIsTutorialOpen,
        isWheelOpen, setIsWheelOpen,
        isWheelVisible, setIsWheelVisible,
        selectedRoom, setSelectedRoom,
        actionLoading, setActionLoading,
        isClosingModalOpen, setIsClosingModalOpen,
        isStartStayOpen, setIsStartStayOpen,
        isQuickCheckinOpen, setIsQuickCheckinOpen,
        isCheckoutOpen, setIsCheckoutOpen,
        isConsumptionOpen, setIsConsumptionOpen,
        isHourManagementOpen, setIsHourManagementOpen,
        isEditVehicleOpen, setIsEditVehicleOpen,
        isCancelStayOpen, setIsCancelStayOpen,
        isChangeRoomOpen, setIsChangeRoomOpen,
        isManagePeopleOpen, setIsManagePeopleOpen,
        isEditValetOpen, setIsEditValetOpen,
        isDetailsOpen, setIsDetailsOpen,
        isGranularPaymentOpen, setIsGranularPaymentOpen,
        isExpenseModalOpen, setIsExpenseModalOpen,
        isBlockRoomOpen, setIsBlockRoomOpen,
        mockExpense, setMockExpense,
        
        handleExit,
        openActionsWheel, closeWheel,
        handleStartStay, handleQuickCheckin, handlePracticeCheckout,
        handleGranularPayment, handleAddConsumption, handleAddHours,
        handleEditVehicle, handleCancelStay, handleManagePeople,
        handleEditValet, handleChangeRoom, handleViewDetails,
        handleMarkClean, handleMarkDirty, handleBlockRoom,
        handleUnblockRoom, handleNoOp, handleConfirmClosing,
        
        confirmStartStay, confirmQuickCheckin, confirmCheckout,
        confirmConsumption, confirmAddHours, confirmRenewShift,
        confirmPromo4H, confirmCancelStay, confirmGranularPayment,
        confirmEditVehicle, confirmRegisterExpense, confirmChangeRoom,
        confirmEditValet, handleAddPersonNew, handleAddPersonReturning,
        handleRemovePerson, confirmBlockRoom,
        renderStatusBadge
    };
}
