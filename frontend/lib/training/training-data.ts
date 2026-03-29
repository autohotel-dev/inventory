import { TrainingModule } from './training-types';

// Catálogo completo de módulos de capacitación en español (Granularidad Aumentada)
export const trainingModules: TrainingModule[] = [
    // --- INTRODUCCIÓN ---
    {
        id: 'intro-basica',
        title: 'Conceptos Básicos',
        description: 'Primeros pasos: Dashboard y navegación del sistema.',
        icon: 'BookOpen',
        duration: 15,
        difficulty: 'beginner',
        category: 'intro',
        route: '/dashboard',
        videoUrl: '/videos/intro-sistema.mp4',
        steps: [
            {
                id: 'shift-indicator',
                title: 'Indicador de Turno',
                description: 'Muestra el turno actual, empleado y tiempo restante.',
                targetSelector: '#tour-dashboard-shift-indicator',
                tips: ['Verifica que estés en el turno correcto', 'El tiempo se actualiza automáticamente']
            },
            {
                id: 'dashboard-kpis',
                title: 'Indicadores Clave (KPIs)',
                description: 'Productos activos, stock total, compras y ventas abiertas.',
                targetSelector: '#tour-dashboard-kpis',
                tips: ['Revisa estos números al iniciar tu turno', 'Identifica rápidamente si hay problemas de stock']
            },
            {
                id: 'quick-actions',
                title: 'Acciones Rápidas',
                description: 'Accesos directos para crear productos, compras, ventas y movimientos.',
                targetSelector: '#tour-dashboard-quick-actions',
                tips: ['Usa estos botones para tareas frecuentes', 'Ahorra tiempo en tu flujo de trabajo diario']
            },
            {
                id: 'system-modules',
                title: 'Módulos del Sistema',
                description: 'Acceso a todas las funcionalidades del sistema.',
                targetSelector: '#tour-dashboard-modules',
                tips: ['Explora cada módulo para conocer todas las funciones', 'Cada icono te lleva a una sección diferente']
            }
        ]
    },
    {
        id: 'intro-interfaz',
        title: 'Navegación e Interfaz',
        description: 'Domina la barra lateral y los atajos rápidos.',
        icon: 'Layout',
        duration: 10,
        difficulty: 'beginner',
        category: 'intro',
        route: '/dashboard',
        steps: [
            {
                id: 'sidebar',
                title: 'Menú Lateral',
                description: 'Acceso a módulos principales.',
                targetSelector: '#tour-sidebar',
                tips: ['Puedes colapsar el menú para tener más espacio']
            },
            {
                id: 'notifications',
                title: 'Centro de Notificaciones',
                description: 'Alertas de stock y mensajes del sistema.',
                targetSelector: '#tour-notifications',
                tips: ['Las notificaciones rojas requieren acción inmediata']
            }
        ]
    },

    // --- HABITACIONES (ROOMS) ---
    {
        id: 'room-checkin',
        title: 'Tipos de Entrada (Check-in)',
        description: 'Aprende las diferentes formas de registrar un ingreso.',
        icon: 'LogIn',
        duration: 25,
        difficulty: 'beginner',
        category: 'rooms',
        route: '/sales/pos',
        prerequisites: ['intro-basica'],
        steps: [
            {
                id: 'select-room',
                title: 'Seleccionar Habitación',
                description: 'Primero clickea una habitación libre para ver opciones de entrada.',
                targetSelector: '[data-room-status="LIBRE"]',
                tips: ['Busca habitaciones con estado "Libre"', 'Las habitaciones verdes están disponibles']
            },
            {
                id: 'action-wheel',
                title: 'Rueda de Acciones',
                description: 'Al clickear una habitación, aparece la rueda con las opciones de check-in.',
                targetSelector: '#tour-action-wheel',
                tips: ['Cada opción tiene un icono diferente', 'La rueda aparece automáticamente']
            },
            {
                id: 'check-in-rapido',
                title: 'Check-in Rápido',
                description: 'Entrada express sin cobro inicial (icono de rayo).',
                targetSelector: '#tour-quick-checkin-modal',
                tips: ['Usar en horas pico para no detener el flujo', 'La cuenta queda pendiente de pago']
            }
        ]
    },
    {
        id: 'room-guests',
        title: 'Control de Huéspedes',
        description: 'Gestión de personas extra y visitas.',
        icon: 'Users',
        duration: 25,
        difficulty: 'intermediate',
        category: 'rooms',
        route: '/sales/pos',
        steps: [
            {
                id: 'select-occupied-room',
                title: 'Seleccionar Habitación Ocupada',
                description: 'Clickea una habitación ocupada para gestionar los huéspedes.',
                targetSelector: '[data-room-status="OCUPADA"]',
                tips: ['Busca habitaciones con estado "Ocupada"', 'Las habitaciones rojas están ocupadas']
            },
            {
                id: 'action-wheel-occupied',
                title: 'Rueda de Acciones',
                description: 'Aparece la rueda con opciones para habitaciones ocupadas.',
                targetSelector: '#tour-action-wheel',
                tips: ['Hay más opciones que para habitaciones libres', 'Busca el botón de "Personas"']
            },
            {
                id: 'manage-people',
                title: 'Gestionar Personas',
                description: 'Abre el modal para controlar entradas y salidas de huéspedes.',
                targetSelector: '#tour-manage-people-modal',
                tips: ['Puedes registrar entradas y salidas', 'Controla el número de personas en la habitación']
            },
            {
                id: 'add-person-option',
                title: 'Opción: Entra una Persona',
                description: 'Selecciona esta opción cuando ingresa un nuevo huésped.',
                targetSelector: '#tour-add-person-radio',
                tips: ['Se cobrará extra si hay más de 2 personas', 'Verifica el límite máximo de la habitación']
            },
            {
                id: 'remove-person-option',
                title: 'Opción: Sale una Persona',
                description: 'Selecciona esta opción cuando un huésped se retira.',
                targetSelector: '#tour-remove-person-radio',
                tips: ['Puedes indicar si va a regresar', 'Si es temporal, se activa tolerancia de 1 hora']
            }
        ]
    },
    {
        id: 'room-time',
        title: 'Gestión de Tiempos',
        description: 'Extensiones de tiempo, renovaciones y promociones.',
        icon: 'Clock',
        duration: 25,
        difficulty: 'intermediate',
        category: 'rooms',
        route: '/sales/pos',
        steps: [
            {
                id: 'select-occupied-room-time',
                title: 'Seleccionar Habitación Ocupada',
                description: 'Clickea una habitación ocupada para gestionar el tiempo.',
                targetSelector: '[data-room-status="OCUPADA"]',
                tips: ['Busca habitaciones con estado "Ocupada"', 'Gestiona extensiones o cortesías']
            },
            {
                id: 'action-wheel-time',
                title: 'Rueda de Acciones',
                description: 'Aparece la rueda. Busca el icono de reloj (Gestión).',
                targetSelector: '#tour-action-wheel',
                tips: ['El icono rosa de reloj permite gestionar tiempos', 'Puedes agregar horas o renovar']
            },
            {
                id: 'manage-time-modal',
                title: 'Gestionar Horas',
                description: 'Abre el modal para controlar el tiempo de estancia.',
                targetSelector: '#tour-hour-management-modal',
                tips: ['Opciones para extender, renovar o aplicar promociones', 'Control total sobre la duración']
            },
            {
                id: 'custom-hours-option',
                title: 'Horas Personalizadas',
                description: 'Permite agregar un número específico de horas extra.',
                targetSelector: '#tour-custom-hours-option',
                highlightDelay: 250,
                tips: ['Calcula automáticamente el costo extra', 'Puedes marcarlo como cortesía si es necesario']
            },
            {
                id: 'renew-option',
                title: 'Renovar Habitación',
                description: 'Reinicia el ciclo de alquiler con tarifa base.',
                targetSelector: '#tour-renew-option',
                highlightDelay: 250,
                tips: ['Útil cuando el cliente decide quedarse otro ciclo completo', 'Cobra el precio base nuevamente']
            },
            {
                id: 'promos',
                title: 'Aplicar Promocion de 4 Horas',
                description: 'Uso de promociones (ej. 4 Horas).',
                targetSelector: '#tour-promo4h-option',
                highlightDelay: 250,
                tips: ['Verificar horarios válidos', 'Aplica automáticamente el precio promocional']
            },
            {
                id: 'payment-method',
                title: 'Método de Pago',
                description: 'Selecciona cómo recibirás el pago por las horas extra.',
                targetSelector: '#tour-payment-section',
                highlightDelay: 300,
                tips: ['Puedes dividir el pago entre efectivo y tarjeta', 'El sistema calcula automáticamente el cambio']
            },
            {
                id: 'confirm-payment',
                title: 'Confirmar y Cobrar',
                description: 'Revisa el precio total y confirma la operación.',
                targetSelector: '#tour-confirm-button',
                tips: ['Verifica el monto antes de confirmar', 'El tiempo se agregará automáticamente a la habitación']
            }
        ]
    },
    {
        id: 'room-status',
        title: 'Estado y Mantenimiento',
        description: 'Ciclo de limpieza y bloqueos.',
        icon: 'Sparkles',
        duration: 25,
        difficulty: 'beginner',
        category: 'rooms',
        route: '/sales/pos',
        steps: [
            {
                id: 'select-free-room',
                title: 'Seleccionar Habitación Libre',
                description: 'Clickea una habitación libre para gestionar su estado.',
                targetSelector: '[data-room-status="LIBRE"]',
                tips: ['Busca habitaciones con estado "Libre" en verde', 'Puedes cambiar el estado sin que esté ocupada']
            },
            {
                id: 'action-wheel-status',
                title: 'Rueda de Acciones',
                description: 'Aparece la rueda con las opciones de gestión de estado.',
                targetSelector: '#tour-action-wheel',
                tips: ['Para habitaciones libres verás opciones de mantenimiento', 'Busca los iconos de "Sucia" y "Mantenimiento"']
            },
            {
                id: 'info-dirty',
                title: '¿Cuándo usar "Sucia"?',
                description: 'Úsalo cuando la habitación necesite limpieza o revisión antes de volver a rentarse.',
                targetSelector: '#tour-action-wheel',
                tips: ['Marca "Sucia" después de una salida', 'Evita rentarla sin una limpieza confirmada']
            },
            {
                id: 'info-clean',
                title: '¿Cuándo usar "Limpiar"?',
                description: 'Devuelve la habitación a "Libre" una vez terminada la limpieza.',
                targetSelector: '#tour-action-wheel',
                tips: ['Úsalo solo cuando el personal confirme', 'La habitación queda lista para venta']
            },
            {
                id: 'mark-dirty-option',
                title: 'Marcar como Sucia (con nota)',
                description: 'Se marcará una habitación libre como sucia y se abrirá el modal para registrar la nota.',
                targetSelector: '#tour-room-status-note-modal',
                highlightDelay: 300,
                tips: ['Este flujo no afecta el proceso real', 'Al finalizar se regresará la habitación a libre']
            },
            {
                id: 'mark-clean-option',
                title: 'Marcar como Limpia',
                description: 'Se cerrará el modal y se abrirá la rueda para mostrar la opción de limpiar una habitación sucia.',
                targetSelector: '#tour-mark-clean-action',
                highlightDelay: 300,
                tips: ['Si no hay habitaciones sucias, se mostrará solo el modal', 'La habitación volverá a quedar libre']
            },
            {
                id: 'block-room-option',
                title: 'Bloquear para Mantenimiento (con nota)',
                description: 'Selecciona "Mantenimiento" para inhabilitar la habitación y registrar una nota.',
                targetSelector: '#tour-room-status-note-modal',
                highlightDelay: 250,
                tips: ['Úsalo cuando haya reparaciones', 'Agrega un motivo del bloqueo']
            },
            {
                id: 'unblock-option',
                title: 'Liberar Habitación',
                description: 'Libera la habitación cuando el mantenimiento termine.',
                targetSelector: '#tour-unblock-action',
                highlightDelay: 300,
                tips: ['Confirma que el problema esté resuelto', 'La habitación quedará libre para rentar']
            }
        ]
    },
    {
        id: 'room-movements',
        title: 'Cambios y Cancelaciones',
        description: 'Operaciones delicadas: Mover o cancelar estancias.',
        icon: 'ArrowLeftRight',
        duration: 30,
        difficulty: 'advanced',
        category: 'rooms',
        route: '/',
        steps: [
            {
                id: 'change-room',
                title: 'Cambio de Habitación',
                description: 'Mover cuenta activa a otra habitación.',
                targetSelector: '#tour-action-wheel',
                tips: ['El saldo se transfiere automáticamente', 'Confirmar si hay diferencia de tarifa']
            },
            {
                id: 'cancel-stay',
                title: 'Cancelar Estancia',
                description: 'Anulación de entrada (Error o Salida inmediata).',
                targetSelector: '#tour-action-wheel',
                tips: ['Requiere justificación', 'Queda registrado en auditoría']
            }
        ]
    },

    // --- VENTAS (SALES) ---
    {
        id: 'sales-order',
        title: 'Toma de Comandas',
        description: 'Uso del POS y búsqueda de productos.',
        icon: 'ShoppingCart',
        duration: 30,
        difficulty: 'beginner',
        category: 'sales',
        route: '/sales/new',
        steps: [
            {
                id: 'search-product',
                title: 'Búsqueda de Productos',
                description: 'Encontrar items por nombre o código.',
                targetSelector: '#tour-product-search',
                tips: ['Usa palabras clave cortas']
            },
            {
                id: 'scan-product',
                title: 'Escaneo (Código de Barras)',
                description: 'Venta rápida con pistola escáner.',
                targetSelector: '#tour-product-search',
                tips: ['Mantén el cursor en el campo de búsqueda', 'Configura "Auto-scan" en ajustes']
            }
        ]
    },
    {
        id: 'sales-cart',
        title: 'Gestión del Carrito',
        description: 'Modificar cantidades y corregir errores antes de venta.',
        icon: 'Edit',
        duration: 15,
        difficulty: 'intermediate',
        category: 'sales',
        route: '/sales/new',
        steps: [
            {
                id: 'edit-qty',
                title: 'Ajustar Cantidades',
                description: 'Cambiar número de items.',
                targetSelector: '#tour-cart-items',
                tips: ['Usa botones +/- para ajustes rápidos']
            },
            {
                id: 'remove-item',
                title: 'Eliminar del Carrito',
                description: 'Quitar productos antes de confirmar.',
                targetSelector: '#tour-cart-items',
                tips: ['Verifica el total antes de procesar']
            }
        ]
    },

    // --- PAGOS (PAYMENTS) ---
    {
        id: 'manage-payments',
        title: 'Métodos de Pago',
        description: 'Cobro efectivo, tarjeta y manejo de caja.',
        icon: 'CreditCard',
        duration: 25,
        difficulty: 'beginner',
        category: 'payments',
        route: '/sales/new',
        steps: [
            {
                id: 'pay-cash',
                title: 'Efectivo',
                description: 'Cobro con billetes/monedas.',
                targetSelector: '#tour-payment-methods',
                tips: ['Verifica billetes falsos', 'Entrega ticket de cambio']
            },
            {
                id: 'pay-card',
                title: 'Tarjeta (Terminal)',
                description: 'Cobro con TPV bancaria.',
                targetSelector: '#tour-payment-methods',
                tips: ['Verifica conexión de terminal', 'Selecciona banco correcto (BBVA/GetNet)']
            },
            {
                id: 'pay-mixed',
                title: 'Pago Mixto',
                description: 'Dividir cuenta (Parte Efectivo / Parte Tarjeta).',
                targetSelector: '#tour-payment-methods',
                tips: ['Registra primero el efectivo, luego el saldo en tarjeta']
            }
        ]
    },
    {
        id: 'manage-credit',
        title: 'Cuentas por Cobrar',
        description: 'Manejo de deuda y pagos parciales.',
        icon: 'FileText',
        duration: 20,
        difficulty: 'advanced',
        category: 'payments',
        route: '/sales',
        steps: [
            {
                id: 'leave-pending',
                title: 'Dejar Pendiente',
                description: 'Cargar a la cuenta de la habitación.',
                targetSelector: '#tour-sales-table',
                tips: ['El huésped pagará al salir (Checkout)']
            },
            {
                id: 'partial-payment',
                title: 'Abono Parcial',
                description: 'Recibir pago a cuenta de deuda.',
                targetSelector: '#tour-sales-table',
                tips: ['Reduce el saldo pendiente sin cerrar la cuenta']
            }
        ]
    },

    // --- TURNOS (SHIFTS) ---
    {
        id: 'shift-control',
        title: 'Control de Turno',
        description: 'Ciclo operativo del cajero/recepcionista.',
        icon: 'Briefcase',
        duration: 35,
        difficulty: 'intermediate',
        category: 'shifts',
        route: '/employees/closings',
        steps: [
            {
                id: 'start-shift',
                title: 'Apertura de Turno',
                description: 'Inicio de operaciones y fondo fijo.',
                targetSelector: '#tour-shift-list',
                tips: ['Verifica fondo inicial de caja']
            },
            {
                id: 'register-expense',
                title: 'Gastos de Caja',
                description: 'Registro de salidas de dinero (Vale).',
                targetSelector: '#tour-expense-btn',
                tips: ['Todo retiro requiere comprobante físico']
            },
            {
                id: 'close-shift',
                title: 'Cierre y Arqueo',
                description: 'Conteo final y entrega de turno.',
                targetSelector: '#tour-close-btn',
                tips: ['El sistema te dirá cuánto efectivo debe haber', 'Reporta sobrantes/faltantes']
            }
        ]
    },

    // --- REPORTES (REPORTS) ---
    {
        id: 'reports-basic',
        title: 'Reportes Operativos',
        description: 'Información diaria para toma de decisiones.',
        icon: 'BarChart',
        duration: 20,
        difficulty: 'intermediate',
        category: 'reports',
        route: '/analytics',
        steps: [
            {
                id: 'income-report',
                title: 'Reporte de Ingresos',
                description: 'Auditoría de cobros del turno.',
                targetSelector: '#tour-analytics-tabs',
                tips: ['Usa filtros para ver desglose por tarjeta/efectivo']
            },
            {
                id: 'occupancy',
                title: 'Ocupación',
                description: 'Revisar historial de rentas.',
                targetSelector: '#tour-analytics-tabs',
                tips: ['Detecta horas pico']
            }
        ]
    },
    // --- INVENTARIO Y ALMACÉN (INVENTORY) ---
    {
        id: 'inventory-stock',
        title: 'Consulta de Stock',
        description: 'Revisar existencias en tiempo real.',
        icon: 'Package',
        duration: 15,
        difficulty: 'intermediate',
        category: 'inventory',
        route: '/stock',
        steps: [
            {
                id: 'check-stock',
                title: 'Ver Existencias',
                description: 'Consultar cantidad disponible por almacén.',
                targetSelector: '#tour-stock-table',
                tips: ['Filtra por categoría (Bebidas, Snacks)', 'Identifica productos con stock bajo (alerta roja)']
            },
            {
                id: 'kardex',
                title: 'Lectura de Kardex',
                description: 'Historial de movimientos de un producto.',
                targetSelector: '#tour-kardex-link',
                tips: ['Rastrea cada entrada y salida', 'Útil para investigar faltantes sospechosos']
            }
        ]
    },
    {
        id: 'inventory-movements',
        title: 'Movimientos de Almacén',
        description: 'Traspasos y ajustes de inventario.',
        icon: 'ArrowLeftRight',
        duration: 25,
        difficulty: 'advanced',
        category: 'inventory',
        route: '/movements',
        steps: [
            {
                id: 'transfer',
                title: 'Traspasos entre Almacenes',
                description: 'Mover mercancía (Ej: Bodega -> Recepción).',
                targetSelector: '#btn-new-transfer', // We will add this ID to real page
                tips: ['Requiere autorización', 'Verifica que el origen tenga stock suficiente']
            },
            {
                id: 'adjustments',
                title: 'Ajustes de Inventario',
                description: 'Correcciones por merma, robo o consumo interno.',
                targetSelector: '#tour-movements-table',
                tips: ['Debes especificar el motivo del ajuste', 'Impacta directamente en costos']
            }
        ]
    },
    {
        id: 'inventory-purchases',
        title: 'Compras y Proveedores',
        description: 'Reabastecimiento de mercancía.',
        icon: 'Truck',
        duration: 30,
        difficulty: 'advanced',
        category: 'inventory',
        route: '/purchases',
        steps: [
            {
                id: 'new-purchase',
                title: 'Registrar Compra',
                description: 'Ingresar factura de proveedor.',
                targetSelector: '#btn-new-purchase',
                tips: ['Verifica costos unitarios', 'Actualiza el precio de venta si subió el costo']
            },
            {
                id: 'suppliers',
                title: 'Directorio de Proveedores',
                description: 'Gestión de contactos de abastecimiento.',
                targetSelector: '#tour-suppliers-link',
                tips: ['Registra días de visita y crédito disponible']
            }
        ]
    },

    // --- SENSORES Y DOMÓTICA (SENSORS) ---
    {
        id: 'sensors-monitoring',
        title: 'Monitoreo de Sensores',
        description: 'Interpretación de estados de habitación.',
        icon: 'RadioWrapper', // Usaremos un icono genérico si Radio no existe, o Wifi
        duration: 15,
        difficulty: 'intermediate',
        category: 'sensors',
        route: '/sensors',
        steps: [
            {
                id: 'sensor-states',
                title: 'Estados del Sensor',
                description: 'Puerta Abierta, Presencia, Cochera.',
                targetSelector: '#sensor-grid',
                tips: ['Icono verde = Todo ok', 'Icono rojo = Alerta de seguridad']
            },
            {
                id: 'discrepancies',
                title: 'Manejo de Discrepancias',
                description: 'Falsos positivos (Ocupado físico vs Libre sistema).',
                targetSelector: '#sensor-grid',
                tips: ['Verifica visualmente antes de actuar', 'Podría ser personal de limpieza']
            }
        ]
    },

    // --- CLIENTES (CUSTOMERS) ---
    {
        id: 'customer-management',
        title: 'Directorio de Clientes',
        description: 'Fidelización y datos fiscales.',
        icon: 'Users',
        duration: 20,
        difficulty: 'intermediate',
        category: 'admin',
        route: '/customers',
        steps: [
            {
                id: 'register-customer',
                title: 'Registrar Cliente',
                description: 'Guardar datos para futuras visitas.',
                targetSelector: '#btn-add-customer',
                tips: ['Solicita correo para facturación', 'Identifica clientes VIP']
            },
            {
                id: 'billing-data',
                title: 'Datos de Facturación',
                description: 'RFC y Razón Social.',
                targetSelector: '#tour-customer-form',
                tips: ['Verifica constancia de situación fiscal']
            }
        ]
    },

    // --- ANALYTICS Y GERENCIA (ADMIN) ---
    {
        id: 'analytics-financial',
        title: 'Análisis Financiero',
        description: 'Reportes para gerencia y toma de decisiones.',
        icon: 'PieChart',
        duration: 40,
        difficulty: 'advanced',
        category: 'admin',
        route: '/analytics',
        steps: [
            {
                id: 'sales-analysis',
                title: 'Tendencias de Venta',
                description: 'Gráficas de ocupación semanal/mensual.',
                targetSelector: '#tour-analytics-charts',
                tips: ['Compara desempeño vs mes anterior']
            },
            {
                id: 'profitability',
                title: 'Rentabilidad',
                description: 'Productos más vendidos y márgenes.',
                targetSelector: '#tour-analytics-charts',
                tips: ['Identifica productos "vaca lechera"', 'Decide promociones basadas en datos']
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
