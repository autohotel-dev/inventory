"use client";

import * as React from "react";

interface PermissionToggleProps {
    id: string;
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

export function PermissionToggle({
    id,
    label,
    description,
    checked,
    onChange,
    disabled = false,
}: PermissionToggleProps) {
    return (
        <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
            <input
                type="checkbox"
                id={id}
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
            />
            <label
                htmlFor={id}
                className={`flex-1 cursor-pointer ${disabled ? "opacity-50" : ""}`}
            >
                <div className="font-medium text-sm">{label}</div>
                {description && (
                    <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                )}
            </label>
        </div>
    );
}
