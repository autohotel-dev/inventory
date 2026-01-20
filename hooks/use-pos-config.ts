"use client";

import { useState, useEffect, useCallback } from 'react';

// Configuración del sistema de consumos/POS
export interface POSConfig {
    // Escaneo
    autoScanDetection: boolean;  // Detectar automáticamente escaneos sin Enter
    scanSpeedThreshold: number;  // ms entre caracteres para detectar escaneo (default: 50)
    scanCompleteDelay: number;   // ms para considerar escaneo completo (default: 150)
    minScanLength: number;       // Mínimo de caracteres para escaneo válido (default: 3)

    // Sonidos
    soundEnabled: boolean;       // Activar sonidos de feedback

    // Impresión
    autoPrintTickets: boolean;   // Imprimir tickets automáticamente
    printClientTicket: boolean;  // Imprimir ticket para cliente
    printReceptionTicket: boolean; // Imprimir comanda para recepción

    // Caja
    initialCashFund: number;     // Fondo de caja inicial para cada turno
    valetAdvanceAmount: number;  // Adelanto en efectivo por cada cochero en turno
}

const DEFAULT_CONFIG: POSConfig = {
    autoScanDetection: true,
    scanSpeedThreshold: 50,
    scanCompleteDelay: 150,
    minScanLength: 3,
    soundEnabled: true,
    autoPrintTickets: true,
    printClientTicket: true,
    printReceptionTicket: true,
    initialCashFund: 500,        // $500 MXN por defecto
    valetAdvanceAmount: 300,     // $300 MXN por cochero
};

const STORAGE_KEY = 'pos-config';

export function usePOSConfig() {
    const [config, setConfig] = useState<POSConfig>(DEFAULT_CONFIG);
    const [isLoaded, setIsLoaded] = useState(false);

    // Cargar configuración de localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setConfig({ ...DEFAULT_CONFIG, ...parsed });
            }
        } catch (error) {
            console.error('Error loading POS config:', error);
        }
        setIsLoaded(true);
    }, []);

    // Guardar configuración
    const saveConfig = useCallback((newConfig: Partial<POSConfig>) => {
        setConfig(prev => {
            const updated = { ...prev, ...newConfig };
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            } catch (error) {
                console.error('Error saving POS config:', error);
            }
            return updated;
        });
    }, []);

    // Resetear a valores por defecto
    const resetConfig = useCallback(() => {
        setConfig(DEFAULT_CONFIG);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
        } catch (error) {
            console.error('Error resetting POS config:', error);
        }
    }, []);

    // Alternar una opción booleana
    const toggleOption = useCallback((key: keyof POSConfig) => {
        if (typeof config[key] === 'boolean') {
            saveConfig({ [key]: !config[key] } as Partial<POSConfig>);
        }
    }, [config, saveConfig]);

    return {
        config,
        isLoaded,
        saveConfig,
        resetConfig,
        toggleOption,
    };
}

// Hook simplificado para usar solo la configuración (sin modificar)
export function usePOSConfigRead(): POSConfig {
    const [config, setConfig] = useState<POSConfig>(DEFAULT_CONFIG);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setConfig({ ...DEFAULT_CONFIG, ...parsed });
            }
        } catch (error) {
            console.error('Error loading POS config:', error);
        }
    }, []);

    return config;
}
