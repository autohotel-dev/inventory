"use client";

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

// Configuración compartida del negocio (almacenada en Supabase)
export interface SystemConfig {
    initialCashFund: number;          // Fondo de caja inicial para cada turno
    valetAdvanceAmount: number;       // Adelanto en efectivo por cada cochero en turno
    includeGlobalSalesInShift: boolean; // Si incluye ventas globales en el reporte de turno
    maxPendingQuickCheckins: number;  // Máximo de habitaciones con pago pendiente (entrada rápida)
    maxShiftsReceptionist: number;    // Máximo de recepcionistas activos
    maxShiftsValet: number;           // Máximo de cocheros activos
    maxShiftsAdmin: number;           // Máximo de administradores activos
    autoChargeExtraHours: boolean;    // Activar/desactivar el cobro automático de hora extra
    // Printer configuration
    thermalPrinterIP: string;         // IP de la impresora de tickets
    thermalPrinterPort: number;       // Puerto de la impresora de tickets
    hpPrinterIP: string;              // IP de la impresora HP
    hpPrinterPort: number;            // Puerto de la impresora HP
}

// Metadata de auditoría
export interface SystemConfigMeta {
    updatedAt: string | null;
    updatedBy: string | null;
}

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
    initialCashFund: 500,
    valetAdvanceAmount: 300,
    includeGlobalSalesInShift: true,
    maxPendingQuickCheckins: 4,
    maxShiftsReceptionist: 1,
    maxShiftsValet: 4,
    maxShiftsAdmin: 2,
    autoChargeExtraHours: true,
    thermalPrinterIP: '192.168.0.106',
    thermalPrinterPort: 9100,
    hpPrinterIP: '192.168.0.108',
    hpPrinterPort: 9100,
};

const DEFAULT_META: SystemConfigMeta = { updatedAt: null, updatedBy: null };

// Caché en memoria para evitar múltiples fetches en la misma sesión
let cachedConfig: SystemConfig | null = null;
let cachedMeta: SystemConfigMeta = DEFAULT_META;
let configPromise: Promise<{ config: SystemConfig; meta: SystemConfigMeta }> | null = null;

async function fetchSystemConfig(): Promise<{ config: SystemConfig; meta: SystemConfigMeta }> {
    try {
        const { data: configs } = await apiClient.get('/system/crud/system_config') as any;
        const rawConfig = Array.isArray(configs) ? configs[0] : configs;
        
        if (!rawConfig) {
            return { config: DEFAULT_SYSTEM_CONFIG, meta: DEFAULT_META };
        }

        const config: SystemConfig = {
            initialCashFund: rawConfig.initial_cash_fund ?? DEFAULT_SYSTEM_CONFIG.initialCashFund,
            valetAdvanceAmount: rawConfig.valet_advance_amount ?? DEFAULT_SYSTEM_CONFIG.valetAdvanceAmount,
            includeGlobalSalesInShift: rawConfig.include_global_sales_in_shift ?? DEFAULT_SYSTEM_CONFIG.includeGlobalSalesInShift,
            maxPendingQuickCheckins: rawConfig.max_pending_quick_checkins ?? DEFAULT_SYSTEM_CONFIG.maxPendingQuickCheckins,
            maxShiftsReceptionist: rawConfig.max_shifts_receptionist ?? DEFAULT_SYSTEM_CONFIG.maxShiftsReceptionist,
            maxShiftsValet: rawConfig.max_shifts_valet ?? DEFAULT_SYSTEM_CONFIG.maxShiftsValet,
            maxShiftsAdmin: rawConfig.max_shifts_admin ?? DEFAULT_SYSTEM_CONFIG.maxShiftsAdmin,
            autoChargeExtraHours: rawConfig.auto_charge_extra_hours ?? DEFAULT_SYSTEM_CONFIG.autoChargeExtraHours,
            thermalPrinterIP: rawConfig.thermal_printer_ip ?? DEFAULT_SYSTEM_CONFIG.thermalPrinterIP,
            thermalPrinterPort: rawConfig.thermal_printer_port ?? DEFAULT_SYSTEM_CONFIG.thermalPrinterPort,
            hpPrinterIP: rawConfig.hp_printer_ip ?? DEFAULT_SYSTEM_CONFIG.hpPrinterIP,
            hpPrinterPort: rawConfig.hp_printer_port ?? DEFAULT_SYSTEM_CONFIG.hpPrinterPort,
        };

        const meta: SystemConfigMeta = {
            updatedAt: rawConfig.updated_at ?? null,
            updatedBy: rawConfig.updated_by ?? null,
        };

        return { config, meta };
    } catch (err) {
        console.error('Error fetching system config via API:', err);
        return { config: DEFAULT_SYSTEM_CONFIG, meta: DEFAULT_META };
    }
}

/**
 * Hook completo para leer y modificar la configuración compartida del sistema.
 * Usa esto en la página de Settings.
 */
export function useSystemConfig() {
    const [config, setConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
    const [meta, setMeta] = useState<SystemConfigMeta>(DEFAULT_META);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                if (cachedConfig) {
                    if (!cancelled) {
                        setConfig(cachedConfig);
                        setMeta(cachedMeta);
                        setIsLoaded(true);
                    }
                    return;
                }

                if (!configPromise) {
                    configPromise = fetchSystemConfig();
                }

                const result = await configPromise;
                cachedConfig = result.config;
                cachedMeta = result.meta;

                if (!cancelled) {
                    setConfig(result.config);
                    setMeta(result.meta);
                    setIsLoaded(true);
                }
            } catch (err) {
                console.error('Error loading system config:', err);
                if (!cancelled) {
                    setIsLoaded(true); // Use defaults
                }
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    const saveConfig = useCallback(async (newConfig: Partial<SystemConfig>) => {
        setIsSaving(true);
        try {

            // Map camelCase to snake_case for DB
            const dbUpdate: Record<string, unknown> = {};
            if (newConfig.initialCashFund !== undefined) {
                dbUpdate.initial_cash_fund = newConfig.initialCashFund;
            }
            if (newConfig.valetAdvanceAmount !== undefined) {
                dbUpdate.valet_advance_amount = newConfig.valetAdvanceAmount;
            }
            if (newConfig.includeGlobalSalesInShift !== undefined) {
                dbUpdate.include_global_sales_in_shift = newConfig.includeGlobalSalesInShift;
            }
            if (newConfig.maxPendingQuickCheckins !== undefined) {
                dbUpdate.max_pending_quick_checkins = newConfig.maxPendingQuickCheckins;
            }
            if (newConfig.maxShiftsReceptionist !== undefined) {
                dbUpdate.max_shifts_receptionist = newConfig.maxShiftsReceptionist;
            }
            if (newConfig.maxShiftsValet !== undefined) {
                dbUpdate.max_shifts_valet = newConfig.maxShiftsValet;
            }
            if (newConfig.maxShiftsAdmin !== undefined) {
                dbUpdate.max_shifts_admin = newConfig.maxShiftsAdmin;
            }
            if (newConfig.autoChargeExtraHours !== undefined) {
                dbUpdate.auto_charge_extra_hours = newConfig.autoChargeExtraHours;
            }
            if (newConfig.thermalPrinterIP !== undefined) {
                dbUpdate.thermal_printer_ip = newConfig.thermalPrinterIP;
            }
            if (newConfig.thermalPrinterPort !== undefined) {
                dbUpdate.thermal_printer_port = newConfig.thermalPrinterPort;
            }
            if (newConfig.hpPrinterIP !== undefined) {
                dbUpdate.hp_printer_ip = newConfig.hpPrinterIP;
            }
            if (newConfig.hpPrinterPort !== undefined) {
                dbUpdate.hp_printer_port = newConfig.hpPrinterPort;
            }

            const { data: configs } = await apiClient.get('/system/crud/system_config') as any;
            const configId = (Array.isArray(configs) ? configs[0] : configs)?.id;
            
            if (!configId) {
                throw new Error("System config row not found");
            }
            
            await apiClient.patch(`/system/crud/system_config/${configId}`, dbUpdate);

            // Update local state and cache
            const updated = { ...config, ...newConfig };
            setConfig(updated);
            cachedConfig = updated;
        } finally {
            setIsSaving(false);
        }
    }, [config]);

    return {
        config,
        meta,
        isLoaded,
        isSaving,
        saveConfig,
    };
}

/**
 * Hook simplificado para solo leer la configuración compartida (sin modificar).
 * Usa esto en el Dashboard, CashBalanceCard, etc.
 */
export function useSystemConfigRead(): SystemConfig {
    const [config, setConfig] = useState<SystemConfig>(cachedConfig ?? DEFAULT_SYSTEM_CONFIG);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                if (cachedConfig) {
                    if (!cancelled) setConfig(cachedConfig);
                    return;
                }

                if (!configPromise) {
                    configPromise = fetchSystemConfig();
                }

                const result = await configPromise;
                cachedConfig = result.config;
                cachedMeta = result.meta;

                if (!cancelled) setConfig(result.config);
            } catch (err) {
                console.error('Error loading system config:', err);
            }
        }

        load();
        return () => { cancelled = true; };
    }, []);

    return config;
}
