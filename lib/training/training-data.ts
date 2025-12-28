import { TrainingModule } from './training-types';

// Catálogo completo de módulos de capacitación en español
export const trainingModules: TrainingModule[] = [
    {
        id: 'intro-sistema',
        title: 'Introducción al Sistema',
        description: 'Aprende a navegar por el sistema POS del hotel, iniciar sesión y entender los roles de usuario.',
        icon: 'BookOpen',
        duration: 30,
        difficulty: 'beginner',
        category: 'intro',
        videoUrl: '/videos/intro-sistema.mp4',
        videoDuration: '5:30',
        steps: [
            {
                id: 'login',
                title: 'Iniciar Sesión',
                description: 'Aprende a ingresar al sistema con tus credenciales.',
                targetSelector: '[data-tutorial="login-form"]',
                tips: ['Usa tu correo electrónico y contraseña proporcionados', 'Si olvidas tu contraseña, contacta al administrador']
            },
            {
                id: 'navigation',
                title: 'Navegación por el Menú',
                description: 'Conoce las diferentes secciones del sistema y cómo acceder a ellas.',
                targetSelector: '[data-tutorial="sidebar"]',
                tips: ['Usa el menú lateral para navegar', 'Los iconos te ayudan a identificar cada sección rápidamente']
            },
            {
                id: 'dashboard',
                title: 'Panel Principal',
                description: 'Entiende la información principal del dashboard.',
                targetSelector: '[data-tutorial="dashboard"]',
                tips: ['El dashboard muestra un resumen de las operaciones del día']
            }
        ]
    },

    {
        id: 'gestion-habitaciones',
        title: 'Gestión de Habitaciones',
        description: 'Domina el proceso completo de check-in, check-out y gestión de habitaciones.',
        icon: 'Hotel',
        duration: 45,
        difficulty: 'beginner',
        category: 'rooms',
        videoUrl: '/videos/gestion-habitaciones.mp4',
        videoDuration: '8:15',
        prerequisites: ['intro-sistema'],
        steps: [
            {
                id: 'check-in-normal',
                title: 'Check-in Normal',
                description: 'Registra el ingreso de un huésped con flujo completo.',
                targetSelector: '[data-tutorial="room-card"]',
                tips: [
                    '1. Abre la Rueda de Acciones en una habitación LIBRE.',
                    '2. Selecciona el botón "Play" (Iniciar Estancia).',
                    '3. Ajusta el número de personas y opcionalmente añade datos del vehículo.',
                    '4. Confirma el pago inicial para completar el check-in.'
                ]
            },
            {
                id: 'check-in-rapido',
                title: 'Check-in Rápido',
                description: 'Registra una entrada sin pago inmediato (ideal para horas pico).',
                targetSelector: '[data-tutorial="quick-checkin"]',
                tips: [
                    '1. Abre la Rueda de Acciones y selecciona el "Rayo".',
                    '2. Si el valet está presente, selecciónalo de la lista.',
                    '3. El sistema marcará la habitación ocupada con saldo Pendiente.'
                ]
            },
            {
                id: 'manage-people',
                title: 'Gestionar Personas',
                description: 'Controla quién entra y sale de la habitación.',
                targetSelector: '[data-tutorial="add-person"]',
                tips: [
                    '1. Selecciona el icono de "Personas" (Usuarios).',
                    '2. Usa "Entra una persona" para nuevos ingresos (aplica cargo extra).',
                    '3. Usa "Sale una persona" si alguien se retira.',
                    '4. El sistema gestiona automáticamente la tolerancia para reingresos.'
                ]
            },
            {
                id: 'add-hours',
                title: 'Gestionar Horas',
                description: 'Añade horas extra, renueva o aplica promociones.',
                targetSelector: '[data-tutorial="manage-hours"]',
                tips: [
                    '1. Selecciona el "Reloj" en una habitación ocupada.',
                    '2. Elige entre: Horas Personalizadas, Renovar Turno o Promo 4H.',
                    '3. Procesa el pago en el modal y confirma.'
                ]
            },
            {
                id: 'change-room',
                title: 'Cambiar Habitación',
                description: 'Mueve una estancia activa a otra habitación.',
                targetSelector: '[data-tutorial="change-room"]',
                tips: [
                    '1. Selecciona el icono de "Intercambio" (Flechas).',
                    '2. Elige una habitación LIBRE de la lista.',
                    '3. Decide si mantener el tiempo transcurrido o reiniciar.',
                    '4. Confirma el cambio (se calculará diferencia de precio si aplica).'
                ]
            },
            {
                id: 'edit-valet',
                title: 'Asignar Cochero',
                description: 'Asigna o cambia el empleado responsable (Valet).',
                targetSelector: '[data-tutorial="edit-valet"]',
                tips: [
                    '1. Selecciona el icono de "Cochero" (Usuario con gorra/engranaje).',
                    '2. Elige un empleado de la lista simulada.',
                    '3. Guarda para actualizar el registro.'
                ]
            },
            {
                id: 'view-details',
                title: 'Ver Detalles',
                description: 'Consulta el estado financiero y desglose de la cuenta.',
                targetSelector: '[data-tutorial="view-details"]',
                tips: [
                    '1. Selecciona el icono de "Ojo" (Ver Detalles).',
                    '2. Revisa las pestañas de Pagos y Consumos.',
                    '3. Verifica el saldo pendiente y total pagado.'
                ]
            },
            {
                id: 'mark-dirty',
                title: 'Marcar Sucia',
                description: 'Cambia el estado a Sucia para limpieza.',
                targetSelector: '[data-tutorial="mark-dirty"]',
                tips: [
                    '1. Usa el icono de "Escoba/Polvo" para marcar suciedad.',
                    '2. Útil si el cliente sale pero la habitación requiere atención.'
                ]
            },
            {
                id: 'mark-clean',
                title: 'Marcar Limpia',
                description: 'Habilita una habitación sucia para su uso.',
                targetSelector: '[data-tutorial="mark-clean"]',
                tips: [
                    '1. En una habitación SUCIA, selecciona "Limpiar" (Brillo).',
                    '2. La habitación pasará a estado LIBRE inmediatamente.'
                ]
            },
            {
                id: 'block-room',
                title: 'Bloquear Habitación',
                description: 'Inhabilita una habitación por mantenimiento.',
                targetSelector: '[data-tutorial="block-room"]',
                tips: [
                    '1. Selecciona el icono de "Candado" o "Prohibido".',
                    '2. La habitación quedará en estado BLOQUEADA e impedirá rentas.',
                    '3. Usa "Desbloquear" para revertirlo.'
                ]
            },
            {
                id: 'checkout',
                title: 'Check-out',
                description: 'Finaliza la estancia y cobra la cuenta.',
                targetSelector: '[data-tutorial="checkout"]',
                tips: [
                    '1. Selecciona el botón de "Check-out" (Bandera/Stop).',
                    '2. Revisa el resumen final y procesa el pago pendiente.',
                    '3. Confirma la salida para liberar la habitación.'
                ]
            }
        ]
    },

    {
        id: 'procesamiento-pagos',
        title: 'Procesamiento de Pagos',
        description: 'Aprende a procesar pagos en efectivo, tarjeta y multi-pago.',
        icon: 'CreditCard',
        duration: 30,
        difficulty: 'beginner',
        category: 'payments',
        videoUrl: '/videos/procesamiento-pagos.mp4',
        videoDuration: '6:20',
        steps: [
            {
                id: 'pago-efectivo',
                title: 'Pago en Efectivo',
                description: 'Procesa un pago en efectivo.',
                tips: ['Ingresa el monto exacto', 'Verifica el cambio si aplica']
            },
            {
                id: 'pago-tarjeta',
                title: 'Pago con Tarjeta',
                description: 'Procesa un pago con tarjeta y captura los últimos 4 dígitos.',
                tips: [
                    'Selecciona el tipo de tarjeta (Crédito/Débito)',
                    'Ingresa los últimos 4 dígitos',
                    'Elige la terminal (BBVA/GETNET)'
                ]
            },
            {
                id: 'multi-pago',
                title: 'Multi-pago',
                description: 'Divide un pago en múltiples métodos.',
                tips: [
                    'Útil cuando el cliente paga parte en efectivo y parte con tarjeta',
                    'Haz clic en "Agregar" para añadir otro método',
                    'El sistema valida que la suma sea correcta'
                ]
            }
        ]
    },

    {
        id: 'consumos-ventas',
        title: 'Consumos y Ventas',
        description: 'Registra consumos de bar/restaurante y gestiona el inventario.',
        icon: 'ShoppingCart',
        duration: 25,
        difficulty: 'intermediate',
        category: 'sales',
        videoUrl: '/videos/consumos-ventas.mp4',
        videoDuration: '5:45',
        steps: [
            {
                id: 'add-consumption',
                title: 'Añadir Consumo',
                description: 'Registra productos consumidos en una habitación.',
                tips: [
                    '1. En una habitación OCUPADA, selecciona el icono de "Bolsa de Compras".',
                    '2. Busca el producto por nombre en el buscador del modal.',
                    '3. Ajusta las cantidades con (+) y (-).',
                    '4. Haz clic en "Agregar Consumo" para confirmar y generar tickets.'
                ]
            },
            {
                id: 'pay-extras',
                title: 'Pagar Extras (Parcial)',
                description: 'Realiza un abono a la cuenta sin cerrar la estancia.',
                targetSelector: '[data-tutorial="pay-extra"]',
                tips: [
                    '1. Selecciona el icono de "Tarjeta/Billete" (Pagar Extras).',
                    '2. Ingresa el monto a abonar (puedes pagar solo consumos o abonos parciales).',
                    '3. Confirma el pago para reducir la deuda de la habitación.'
                ]
            },
            {
                id: 'print-ticket',
                title: 'Imprimir Ticket',
                description: 'Imprime tickets para cocina/bar y para el cliente.',
                tips: ['Se imprimen 2 tickets automáticamente al confirmar un consumo']
            },

        ]
    },

    {
        id: 'gestion-avanzada',
        title: 'Gestión Avanzada',
        description: 'Domina cambios de habitación, cancelaciones y edición de datos.',
        icon: 'Settings',
        duration: 20,
        difficulty: 'intermediate',
        category: 'rooms',
        videoUrl: '/videos/gestion-avanzada.mp4',
        videoDuration: '4:00',
        steps: [
            {
                id: 'edit-vehicle',
                title: 'Editar Vehículo',
                description: 'Actualiza las placas del vehículo.',
                tips: ['Usa el icono de Auto']
            },
            {
                id: 'edit-valet',
                title: 'Cambiar Cochero',
                description: 'Reasigna el cochero responsable.',
                tips: ['Usa el icono de Cochero']
            },
            {
                id: 'change-room',
                title: 'Cambio de Habitación',
                description: 'Mueve una estancia a otra habitación.',
                tips: ['Selecciona Intercambio']
            },
            {
                id: 'cancel-stay',
                title: 'Cancelar Estancia',
                description: 'Cancela una entrada activa.',
                tips: ['Usa el icono X roja']
            }
        ]
    },

    {
        id: 'gestion-turnos',
        title: 'Gestión de Turnos',
        description: 'Inicia, monitorea y cierra tu turno correctamente.',
        icon: 'Clock',
        duration: 35,
        difficulty: 'intermediate',
        category: 'shifts',
        videoUrl: '/videos/gestion-turnos.mp4',
        videoDuration: '7:30',
        steps: [
            {
                id: 'start-shift',
                title: 'Iniciar Turno',
                description: 'Abre tu turno de trabajo.',
                targetSelector: '[data-tutorial="start-shift"]',
                tips: ['Debes iniciar turno antes de hacer operaciones']
            },
            {
                id: 'register-expense',
                title: 'Registrar Gastos',
                description: 'Anota gastos operativos del turno.',
                tips: ['Registra todos los gastos con comprobante']
            },
            {
                id: 'close-shift',
                title: 'Cierre de Caja',
                description: 'Finaliza tu turno y reconcilia el efectivo.',
                tips: [
                    'Cuenta el efectivo físicamente',
                    'Ingresa los billetes y monedas',
                    'El sistema calculará automáticamente el total'
                ]
            }
        ]
    },

    {
        id: 'reportes-informes',
        title: 'Reportes e Informes',
        description: 'Genera y entiende los reportes del sistema.',
        icon: 'FileText',
        duration: 20,
        difficulty: 'beginner',
        category: 'reports',
        videoUrl: '/videos/reportes-informes.mp4',
        videoDuration: '4:50',
        steps: [
            {
                id: 'income-report',
                title: 'Reporte de Ingresos',
                description: 'Consulta los ingresos por turno o fecha.',
                targetSelector: '[data-tutorial="income-report"]',
                tips: [
                    'Filtra por turno para ver tu turno actual',
                    'Usa rango de fechas para reportes históricos'
                ]
            },
            {
                id: 'filters',
                title: 'Aplicar Filtros',
                description: 'Filtra reportes por método de pago y habitación.',
                tips: ['Combina filtros para análisis detallados']
            },
            {
                id: 'print-report',
                title: 'Imprimir Reporte',
                description: 'Imprime el reporte para archivo físico.',
                tips: ['El reporte se imprime automáticamente al cerrar turno']
            }
        ]
    },

    {
        id: 'configuracion-sistema',
        title: 'Configuración del Sistema',
        description: 'Administra empleados, productos y configuraciones avanzadas.',
        icon: 'Settings',
        duration: 15,
        difficulty: 'advanced',
        category: 'config',
        videoUrl: '/videos/configuracion-sistema.mp4',
        videoDuration: '6:10',
        prerequisites: ['intro-sistema'],
        steps: [
            {
                id: 'manage-employees',
                title: 'Gestión de Empleados',
                description: 'Crea y edita usuarios del sistema.',
                tips: ['Solo administradores pueden gestionar empleados']
            },
            {
                id: 'manage-products',
                title: 'Gestión de Productos',
                description: 'Administra el catálogo de productos.',
                tips: ['Mantén precios actualizados']
            },
            {
                id: 'printer-config',
                title: 'Configurar Impresoras',
                description: 'Configura impresoras térmicas.',
                tips: ['Verifica la conexión IP de las impresoras']
            }
        ]
    }
];

// Helper para obtener un módulo por ID
export function getModuleById(id: string): TrainingModule | undefined {
    return trainingModules.find(m => m.id === id);
}

// Helper para obtener módulos por categoría
export function getModulesByCategory(category: TrainingModule['category']): TrainingModule[] {
    return trainingModules.filter(m => m.category === category);
}
