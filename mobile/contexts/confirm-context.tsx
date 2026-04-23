import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ConfirmModal, ConfirmType } from '../components/ConfirmModal';

interface ConfirmConfig {
    visible: boolean;
    title: string;
    message: string;
    type: ConfirmType;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

interface ConfirmContextType {
    showConfirm: (
        title: string, 
        message: string, 
        onConfirm: () => void, 
        options?: {
            type?: ConfirmType;
            confirmText?: string;
            cancelText?: string;
            onCancel?: () => void;
        }
    ) => void;
    hideConfirm: () => void;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<ConfirmConfig>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        onConfirm: () => {},
    });

    const showConfirm = (
        title: string, 
        message: string, 
        onConfirm: () => void, 
        options?: {
            type?: ConfirmType;
            confirmText?: string;
            cancelText?: string;
            onCancel?: () => void;
        }
    ) => {
        setConfig({
            visible: true,
            title,
            message,
            type: options?.type || 'info',
            confirmText: options?.confirmText || 'Confirmar',
            cancelText: options?.cancelText || 'Cancelar',
            onConfirm,
            onCancel: options?.onCancel,
        });
    };

    const hideConfirm = () => {
        setConfig(prev => ({ ...prev, visible: false }));
    };

    const handleConfirm = () => {
        hideConfirm();
        config.onConfirm();
    };

    const handleCancel = () => {
        hideConfirm();
        if (config.onCancel) {
            config.onCancel();
        }
    };

    return (
        <ConfirmContext.Provider value={{ showConfirm, hideConfirm }}>
            {children}
            <ConfirmModal
                visible={config.visible}
                title={config.title}
                message={config.message}
                type={config.type}
                confirmText={config.confirmText}
                cancelText={config.cancelText}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (context === undefined) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
}
