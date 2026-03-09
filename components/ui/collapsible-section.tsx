"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
    /** ID único para persistir estado en localStorage */
    storageKey: string;
    /** Título de la sección */
    title: string;
    /** Icono opcional */
    icon?: React.ReactNode;
    /** Estado inicial (default: expandido) */
    defaultOpen?: boolean;
    /** Contenido de la sección */
    children: React.ReactNode;
    /** Clases adicionales para el contenedor */
    className?: string;
    /** Clases adicionales para el contenido */
    contentClassName?: string;
    /** Variante visual */
    variant?: "default" | "minimal" | "card";
    /** Contador o badge opcional */
    badge?: string | number;
}

export function CollapsibleSection({
    storageKey,
    title,
    icon,
    defaultOpen = true,
    children,
    className,
    contentClassName,
    variant = "default",
    badge,
}: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = React.useState(defaultOpen);
    const [isLoaded, setIsLoaded] = React.useState(false);

    // Cargar estado de localStorage al montar
    React.useEffect(() => {
        try {
            const stored = localStorage.getItem(`collapsible-${storageKey}`);
            if (stored !== null) {
                setIsOpen(stored === "true");
            }
        } catch (error) {
            console.error("Error loading collapsible state:", error);
        }
        setIsLoaded(true);
    }, [storageKey]);

    // Guardar estado en localStorage
    const toggle = React.useCallback(() => {
        const newState = !isOpen;
        setIsOpen(newState);
        try {
            localStorage.setItem(`collapsible-${storageKey}`, String(newState));
        } catch (error) {
            console.error("Error saving collapsible state:", error);
        }
    }, [isOpen, storageKey]);

    // Evitar flash antes de cargar preferencia
    if (!isLoaded) {
        return null;
    }

    const variantStyles = {
        default: {
            container: "bg-muted/30 rounded-lg border border-border",
            header: "px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors",
            content: "px-4 pb-4",
        },
        minimal: {
            container: "",
            header: "py-2 flex items-center justify-between cursor-pointer group",
            content: "pt-3",
        },
        card: {
            container: "bg-card rounded-xl border border-border shadow-sm",
            header: "px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors border-b border-transparent",
            content: "p-5",
        },
    };

    const styles = variantStyles[variant];

    return (
        <div className={cn(styles.container, className)}>
            <button
                type="button"
                onClick={toggle}
                className={cn(
                    styles.header,
                    "w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    isOpen && variant === "card" && "border-border"
                )}
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2.5">
                    {icon && (
                        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                            {icon}
                        </span>
                    )}
                    <span className="font-medium text-sm">{title}</span>
                    {badge !== undefined && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                            {badge}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {!isOpen && (
                        <span className="text-xs text-muted-foreground">
                            Click para expandir
                        </span>
                    )}
                    {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </div>
            </button>

            {/* Contenido con animación */}
            <div
                className={cn(
                    "overflow-hidden transition-all duration-200 ease-in-out",
                    isOpen ? "opacity-100" : "opacity-0 h-0"
                )}
            >
                {isOpen && (
                    <div className={cn(styles.content, contentClassName)}>
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Hook para gestionar preferencias de visibilidad de secciones
 */
export function useCollapsiblePreferences() {
    const [preferences, setPreferences] = React.useState<Record<string, boolean>>({});
    const [isLoaded, setIsLoaded] = React.useState(false);

    React.useEffect(() => {
        try {
            const stored = localStorage.getItem("collapsible-preferences");
            if (stored) {
                setPreferences(JSON.parse(stored));
            }
        } catch (error) {
            console.error("Error loading collapsible preferences:", error);
        }
        setIsLoaded(true);
    }, []);

    const setPreference = React.useCallback((key: string, value: boolean) => {
        setPreferences(prev => {
            const updated = { ...prev, [key]: value };
            try {
                localStorage.setItem("collapsible-preferences", JSON.stringify(updated));
            } catch (error) {
                console.error("Error saving collapsible preferences:", error);
            }
            return updated;
        });
    }, []);

    const getPreference = React.useCallback((key: string, defaultValue: boolean = true) => {
        return preferences[key] ?? defaultValue;
    }, [preferences]);

    return { preferences, setPreference, getPreference, isLoaded };
}
