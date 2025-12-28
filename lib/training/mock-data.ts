// Mock data for training practice mode
// This data simulates a realistic hotel environment for safe practice

import { Room } from '@/components/sales/room-types';

// Habitaciones ficticias
// Habitaciones ficticias
export const mockRooms: Room[] = [
    {
        id: 'mock-room-1',
        number: '101',
        status: 'LIBRE',
        notes: null,
        room_types: {
            id: 'mock-type-1',
            name: 'Estándar',
            base_price: 250,
            extra_hour_price: 80,
            extra_person_price: 50,
            weekday_hours: 24,
            weekend_hours: 24,
            is_hotel: true
        },
        room_stays: []
    },
    {
        id: 'mock-room-2',
        number: '102',
        status: 'OCUPADA',
        notes: null,
        room_types: {
            id: 'mock-type-2',
            name: 'Deluxe',
            base_price: 350,
            extra_hour_price: 100,
            extra_person_price: 75,
            weekday_hours: 12,
            weekend_hours: 12,
            is_hotel: false
        },
        room_stays: [
            {
                id: 'mock-stay-1',
                sales_order_id: 'mock-order-1',
                status: 'ACTIVE',
                check_in_at: new Date().toISOString(),
                expected_check_out_at: null,
                current_people: 2,
                total_people: 2,
                vehicle_plate: 'ABC-123',
                sales_orders: {
                    remaining_amount: 0
                }
            }
        ]
    },
    {
        id: 'mock-room-3',
        number: '103',
        status: 'LIBRE',
        notes: null,
        room_types: {
            id: 'mock-type-3',
            name: 'Suite',
            base_price: 500,
            extra_hour_price: 150,
            extra_person_price: 100,
            weekday_hours: 24,
            weekend_hours: 24,
            is_hotel: true
        },
        room_stays: []
    },
    {
        id: 'mock-room-4',
        number: '104',
        status: 'LIBRE',
        notes: null,
        room_types: {
            id: 'mock-type-1',
            name: 'Estándar',
            base_price: 250,
            extra_hour_price: 80,
            extra_person_price: 50,
            weekday_hours: 24,
            weekend_hours: 24,
            is_hotel: true
        },
        room_stays: []
    }
];

// Clientes ficticios
export const mockCustomers = [
    { id: 'cust-1', name: 'María García', plates: 'XYZ-789' },
    { id: 'cust-2', name: 'Carlos López', plates: 'DEF-456' },
    { id: 'cust-3', name: 'Ana Martínez', plates: 'GHI-321' }
];

// Cocheros ficticios
export const mockValets = [
    { id: 'emp-1', first_name: 'Pedro', last_name: 'Ramírez' },
    { id: 'emp-2', first_name: 'Juan', last_name: 'Sánchez' },
    { id: 'emp-3', first_name: 'Luis', last_name: 'González' }
];

// Productos de muestra
export const mockProducts = [
    { id: 'prod-1', name: 'Cerveza Corona', price: 35, category: 'Bebidas' },
    { id: 'prod-2', name: 'Refresco Coca-Cola', price: 25, category: 'Bebidas' },
    { id: 'prod-3', name: 'Agua Natural', price: 15, category: 'Bebidas' },
    { id: 'prod-4', name: 'Papas Fritas', price: 40, category: 'Snacks' },
    { id: 'prod-5', name: 'Hamburguesa', price: 85, category: 'Comida' },
    { id: 'prod-6', name: 'Pizza Personal', price: 120, category: 'Comida' }
];

// Turno de ejemplo
export const mockShift = {
    id: 'shift-1',
    employee_id: 'emp-1',
    employee_name: 'Yuribeth García Solís',
    clock_in_at: new Date().toISOString(),
    status: 'active'
};

// Métodos de pago
export const mockPaymentMethods = [
    { id: 'cash', name: 'Efectivo', type: 'CASH' },
    { id: 'card-bbva', name: 'Tarjeta BBVA', type: 'CARD', terminal: 'BBVA' },
    { id: 'card-getnet', name: 'Tarjeta GETNET', type: 'CARD', terminal: 'GETNET' }
];

// Helper para simular operaciones
export const mockOperations = {
    checkIn: (roomId: string, customerName: string, numPeople: number, plates: string) => {
        console.log('[PRÁCTICA] Check-in simulado:', { roomId, customerName, numPeople, plates });
        return {
            success: true,
            message: '✅ Check-in realizado correctamente (simulación)',
            stayId: `mock-stay-${Date.now()}`
        };
    },

    checkout: (roomId: string) => {
        console.log('[PRÁCTICA] Check-out simulado:', { roomId });
        return {
            success: true,
            message: '✅ Check-out realizado correctamente (simulación)',
            total: 350
        };
    },

    addPerson: (roomId: string) => {
        console.log('[PRÁCTICA] Añadir persona simulado:', { roomId });
        return {
            success: true,
            message: '✅ Persona añadida correctamente (simulación)',
            extraCharge: 50
        };
    },

    addHours: (roomId: string, hours: number) => {
        console.log('[PRÁCTICA] Añadir horas simulado:', { roomId, hours });
        return {
            success: true,
            message: `✅ ${hours} hora(s) añadida(s) correctamente (simulación)`,
            charge: hours * 80
        };
    },

    processPayment: (amount: number, method: string) => {
        console.log('[PRÁCTICA] Pago simulado:', { amount, method });
        return {
            success: true,
            message: '✅ Pago procesado correctamente (simulación)',
            paymentId: `mock-payment-${Date.now()}`
        };
    },

    addConsumption: (roomId: string, productId: string, quantity: number) => {
        console.log('[PRÁCTICA] Consumo simulado:', { roomId, productId, quantity });
        return {
            success: true,
            message: '✅ Consumo registrado correctamente (simulación)'
        };
    },

    // Nuevas operaciones para soporte completo de la rueda
    markClean: (roomId: string) => {
        console.log('[PRÁCTICA] Limpieza simulada:', { roomId });
        return { success: true, message: '✅ Habitación marcada como limpia' };
    },

    markDirty: (roomId: string) => {
        console.log('[PRÁCTICA] Sucia simulada:', { roomId });
        return { success: true, message: '✅ Habitación marcada para limpieza' };
    },

    blockRoom: (roomId: string, reason: string) => {
        console.log('[PRÁCTICA] Bloqueo simulado:', { roomId, reason });
        return { success: true, message: '✅ Habitación bloqueada por mantenimiento' };
    },

    unblockRoom: (roomId: string) => {
        console.log('[PRÁCTICA] Desbloqueo simulado:', { roomId });
        return { success: true, message: '✅ Habitación liberada y lista' };
    },

    editVehicle: (roomId: string) => {
        console.log('[PRÁCTICA] Editar vehículo simulado:', { roomId });
        return { success: true, message: '✅ Datos del vehículo actualizados' };
    },

    editValet: (roomId: string) => {
        console.log('[PRÁCTICA] Editar cochero simulado:', { roomId });
        return { success: true, message: '✅ Cochero asignado correctamente' };
    },

    changeRoom: (roomId: string) => {
        console.log('[PRÁCTICA] Cambio habitación simulado:', { roomId });
        return { success: true, message: '✅ Solicitud de cambio de habitación procesada' };
    },

    cancelStay: (roomId: string) => {
        console.log('[PRÁCTICA] Cancelar estadía simulado:', { roomId });
        return { success: true, message: '✅ Estadía cancelada correctamente' };
    },

    payExtra: (roomId: string) => {
        console.log('[PRÁCTICA] Pagar extras simulado:', { roomId });
        return { success: true, message: '✅ Pago de extras registrado' };
    },

    viewDetails: (roomId: string) => {
        console.log('[PRÁCTICA] Ver detalles simulado:', { roomId });
        return { success: true, message: '✅ Detalles cargados (simulación)' };
    }
};

// Estado inicial para el modo práctica
export const mockInitialState = {
    rooms: mockRooms,
    customers: mockCustomers,
    products: mockProducts,
    shift: mockShift,
    paymentMethods: mockPaymentMethods
};
