import { TrainingModule } from './training-types';

// Catálogo completo de módulos de capacitación en español (Granularidad Aumentada)
export const trainingModules: TrainingModule[] = [
    // --- INTRODUCCIÓN ---
    {
        id: 'intro-basica',
        title: 'Conceptos Básicos',
        description: 'Primeros pasos: Login, Dashboard y Roles de Usuario.',
        icon: 'BookOpen',
        duration: 15,
        difficulty: 'beginner',
        category: 'intro',
        videoUrl: '/videos/intro-sistema.mp4',
        steps: [
            {
                id: 'login',
                title: 'Iniciar Sesión',
                description: 'Acceso seguro con credenciales.',
                tips: ['Verifica estar en el turno correcto', 'Nunca compartas tu contraseña']
            },
            {
                id: 'dashboard',
                title: 'Lectura del Dashboard',
                description: 'Interpretación de indicadores clave (KPIs).',
                tips: ['Revisa ocupación % al iniciar', 'Identifica alertas de limpieza urgente']
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
        steps: [
            {
                id: 'sidebar',
                title: 'Menú Lateral',
                description: 'Acceso a módulos principales.',
                tips: ['Puedes colapsar el menú para tener más espacio']
            },
            {
                id: 'notifications',
                title: 'Centro de Notificaciones',
                description: 'Alertas de stock y mensajes del sistema.',
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
        prerequisites: ['intro-basica'],
        steps: [
            {
                id: 'check-in-normal',
                title: 'Check-in Estándar',
                description: 'Entrada con pago inmediato y registro completo.',
                tips: ['Ideal para clientes que pagan al llegar', 'Registra placas si es posible']
            },
            {
                id: 'check-in-rapido',
                title: 'Check-in Rápido',
                description: 'Entrada express sin cobro inicial.',
                tips: ['Usar en horas pico para no detener el flujo', 'La cuenta queda pendiente de pago']
            }
        ]
    },
    {
        id: 'room-guests',
        title: 'Control de Huéspedes',
        description: 'Gestión de personas extra y visitas.',
        icon: 'Users',
        duration: 20,
        difficulty: 'intermediate',
        category: 'rooms',
        steps: [
            {
                id: 'add-person',
                title: 'Persona Extra',
                description: 'Registrar ingreso adicional a habitación ocupada.',
                tips: ['Genera cargo automático a la cuenta', 'Verifica límite de personas por habitación']
            },
            {
                id: 'remove-person',
                title: 'Salida de Persona',
                description: 'Registrar salida parcial de un grupo.',
                tips: ['Importante para control de seguridad']
            }
        ]
    },
    {
        id: 'room-time',
        title: 'Gestión de Tiempos',
        description: 'Extensiones de tiempo, renovaciones y promociones.',
        icon: 'Clock',
        duration: 20,
        difficulty: 'intermediate',
        category: 'rooms',
        steps: [
            {
                id: 'renew-shift',
                title: 'Renovar Turno',
                description: 'Extender la estancia por un turno completo.',
                tips: ['Se cobra tarifa completa de nuevo turno']
            },
            {
                id: 'add-hours',
                title: 'Horas Extra',
                description: 'Agregar horas específicas a la estancia.',
                tips: ['Útil para clientes que se quedan "un rato más"']
            },
            {
                id: 'promos',
                title: 'Aplicar Promociones',
                description: 'Uso de promos (ej. 4 Horas).',
                tips: ['Verificar horarios válidos para promociones']
            }
        ]
    },
    {
        id: 'room-status',
        title: 'Estado y Mantenimiento',
        description: 'Ciclo de limpieza y bloqueos.',
        icon: 'Sparkles',
        duration: 15,
        difficulty: 'beginner',
        category: 'rooms',
        steps: [
            {
                id: 'mark-dirty',
                title: 'Marcar Sucia',
                description: 'Solicitar limpieza tras salida.',
                tips: ['Indispensable para rotación de habitaciones']
            },
            {
                id: 'mark-clean',
                title: 'Liberar (Limpieza)',
                description: 'Habilitar habitación para venta.',
                tips: ['Solo marcar cuando camatista confirme']
            },
            {
                id: 'block-room',
                title: 'Bloqueo / Mantenimiento',
                description: 'Inhabilitar habitación por reparaciones.',
                tips: ['Agregar nota con motivo del bloqueo']
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
        steps: [
            {
                id: 'change-room',
                title: 'Cambio de Habitación',
                description: 'Mover cuenta activa a otra habitación.',
                tips: ['El saldo se transfiere automáticamente', 'Confirmar si hay diferencia de tarifa']
            },
            {
                id: 'cancel-stay',
                title: 'Cancelar Estancia',
                description: 'Anulación de entrada (Error o Salida inmediata).',
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
        steps: [
            {
                id: 'search-product',
                title: 'Búsqueda de Productos',
                description: 'Encontrar items por nombre o código.',
                tips: ['Usa palabras clave cortas']
            },
            {
                id: 'scan-product',
                title: 'Escaneo (Código de Barras)',
                description: 'Venta rápida con pistola escáner.',
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
        steps: [
            {
                id: 'edit-qty',
                title: 'Ajustar Cantidades',
                description: 'Cambiar número de items.',
                tips: ['Usa botones +/- para ajustes rápidos']
            },
            {
                id: 'remove-item',
                title: 'Eliminar del Carrito',
                description: 'Quitar productos antes de confirmar.',
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
        steps: [
            {
                id: 'pay-cash',
                title: 'Efectivo',
                description: 'Cobro con billetes/monedas.',
                tips: ['Verifica billetes falsos', 'Entrega ticket de cambio']
            },
            {
                id: 'pay-card',
                title: 'Tarjeta (Terminal)',
                description: 'Cobro con TPV bancaria.',
                tips: ['Verifica conexión de terminal', 'Selecciona banco correcto (BBVA/GetNet)']
            },
            {
                id: 'pay-mixed',
                title: 'Pago Mixto',
                description: 'Dividir cuenta (Parte Efectivo / Parte Tarjeta).',
                tips: ['Registra primero el efectivo, luego el saldo en tarjeta']
            }
        ]
    },
    {
        id: 'manage-credit',
        title: 'Créditos y Abonos',
        description: 'Manejo de cuentas por cobrar.',
        icon: 'FileText',
        duration: 20,
        difficulty: 'advanced',
        category: 'payments',
        steps: [
            {
                id: 'leave-pending',
                title: 'Dejar Pendiente',
                description: 'Cargar a la cuenta de la habitación.',
                tips: ['El huésped pagará al salir (Checkout)']
            },
            {
                id: 'partial-payment',
                title: 'Abono Parcial',
                description: 'Recibir pago a cuenta de deuda.',
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
        steps: [
            {
                id: 'start-shift',
                title: 'Apertura de Turno',
                description: 'Inicio de operaciones y fondo fijo.',
                tips: ['Verifica fondo inicial de caja']
            },
            {
                id: 'expenses',
                title: 'Gastos de Caja',
                description: 'Registro de salidas de dinero (Vale).',
                tips: ['Todo retiro requiere comprobante físico']
            },
            {
                id: 'close-shift',
                title: 'Cierre y Arqueo',
                description: 'Conteo final y entrega de turno.',
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
        steps: [
            {
                id: 'income-report',
                title: 'Reporte de Ingresos',
                description: 'Auditoría de cobros del turno.',
                tips: ['Usa filtros para ver desglose por tarjeta/efectivo']
            },
            {
                id: 'occupancy',
                title: 'Ocupación',
                description: 'Revisar historial de rentas.',
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
        steps: [
            {
                id: 'check-stock',
                title: 'Ver Existencias',
                description: 'Consultar cantidad disponible por almacén.',
                tips: ['Filtra por categoría (Bebidas, Snacks)', 'Identifica productos con stock bajo (alerta roja)']
            },
            {
                id: 'kardex',
                title: 'Lectura de Kardex',
                description: 'Historial de movimientos de un producto.',
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
        steps: [
            {
                id: 'transfer',
                title: 'Traspasos entre Almacenes',
                description: 'Mover mercancía (Ej: Bodega -> Recepción).',
                tips: ['Requiere autorización', 'Verifica que el origen tenga stock suficiente']
            },
            {
                id: 'adjustments',
                title: 'Ajustes de Inventario',
                description: 'Correcciones por merma, robo o consumo interno.',
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
        steps: [
            {
                id: 'new-purchase',
                title: 'Registrar Compra',
                description: 'Ingresar factura de proveedor.',
                tips: ['Verifica costos unitarios', 'Actualiza el precio de venta si subió el costo']
            },
            {
                id: 'suppliers',
                title: 'Directorio de Proveedores',
                description: 'Gestión de contactos de abastecimiento.',
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
        steps: [
            {
                id: 'sensor-states',
                title: 'Estados del Sensor',
                description: 'Puerta Abierta, Presencia, Cochera.',
                tips: ['Icono verde = Todo ok', 'Icono rojo = Alerta de seguridad']
            },
            {
                id: 'discrepancies',
                title: 'Manejo de Discrepancias',
                description: 'Falsos positivos (Ocupado físico vs Libre sistema).',
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
        steps: [
            {
                id: 'register-customer',
                title: 'Registrar Cliente',
                description: 'Guardar datos para futuras visitas.',
                tips: ['Solicita correo para facturación', 'Identifica clientes VIP']
            },
            {
                id: 'billing-data',
                title: 'Datos de Facturación',
                description: 'RFC y Razón Social.',
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
        steps: [
            {
                id: 'sales-analysis',
                title: 'Tendencias de Venta',
                description: 'Gráficas de ocupación semanal/mensual.',
                tips: ['Compara desempeño vs mes anterior']
            },
            {
                id: 'profitability',
                title: 'Rentabilidad',
                description: 'Productos más vendidos y márgenes.',
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
