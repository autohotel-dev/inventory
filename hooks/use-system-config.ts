"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// Configuración compartida del negocio (almacenada en Supabase)
export interface SystemConfig {
    initialCashFund: number;          // Fondo de caja inicial para cada turno
    valetAdvanceAmount: number;       // Adelanto en efectivo por cada cochero en turno
    includeGlobalSalesInShift: boolean; // Si incluye ventas globales en el reporte de turno
    maxPendingQuickCheckins: number;  // Máximo de habitaciones con pago pendiente (entrada rápida)
    maxShiftsReceptionist: number;    // Máximo de recepcionistas activos
    maxShiftsValet: number;           // Máximo de cocheros activos
    maxShiftsAdmin: number;           // Máximo de administradores activos
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
};

const DEFAULT_META: SystemConfigMeta = { updatedAt: null, updatedBy: null };

// Caché en memoria para evitar múltiples fetches en la misma sesión
let cachedConfig: SystemConfig | null = null;
let cachedMeta: SystemConfigMeta = DEFAULT_META;
let configPromise: Promise<{ config: SystemConfig; meta: SystemConfigMeta }> | null = null;

async function fetchSystemConfig(): Promise<{ config: SystemConfig; meta: SystemConfigMeta }> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('system_config')
        .select('initial_cash_fund, valet_advance_amount, include_global_sales_in_shift, max_pending_quick_checkins, max_shifts_receptionist, max_shifts_valet, max_shifts_admin, updated_at, updated_by')
        .limit(1)
        .single();

    if (error || !data) {
        console.warn('Could not fetch system_config from Supabase, using defaults:', error?.message);
        return { config: DEFAULT_SYSTEM_CONFIG, meta: DEFAULT_META };
    }

    const config: SystemConfig = {
        initialCashFund: Number(data.initial_cash_fund) || DEFAULT_SYSTEM_CONFIG.initialCashFund,
        valetAdvanceAmount: Number(data.valet_advance_amount) || DEFAULT_SYSTEM_CONFIG.valetAdvanceAmount,
        includeGlobalSalesInShift: data.include_global_sales_in_shift ?? DEFAULT_SYSTEM_CONFIG.includeGlobalSalesInShift,
        maxPendingQuickCheckins: Number(data.max_pending_quick_checkins) || DEFAULT_SYSTEM_CONFIG.maxPendingQuickCheckins,
        maxShiftsReceptionist: Number(data.max_shifts_receptionist) || DEFAULT_SYSTEM_CONFIG.maxShiftsReceptionist,
        maxShiftsValet: Number(data.max_shifts_valet) || DEFAULT_SYSTEM_CONFIG.maxShiftsValet,
        maxShiftsAdmin: Number(data.max_shifts_admin) || DEFAULT_SYSTEM_CONFIG.maxShiftsAdmin,
    };

    const meta: SystemConfigMeta = {
        updatedAt: data.updated_at || null,
        updatedBy: data.updated_by || null,
    };

    return { config, meta };
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
            const supabase = createClient();

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

            // Update the singleton row (there's only one row)
            const { error } = await supabase
                .from('system_config')
                .update(dbUpdate)
                .not('id', 'is', null); // matches all rows (singleton)

            if (error) {
                console.error('Error saving system config:', error);
                throw error;
            }

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
