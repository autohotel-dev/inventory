"use client";

import * as React from "react";
import { PermissionToggle } from "./permission-toggle";

interface MenuItem {
    id: string;
    label: string;
    href: string;
}

interface PermissionGroupProps {
    title: string;
    description?: string;
    items: MenuItem[];
    selectedItems: Set<string>;
    onToggle: (itemId: string, checked: boolean) => void;
    disabled?: boolean;
}

export function PermissionGroup({
    title,
    description,
    items,
    selectedItems,
    onToggle,
    disabled = false,
}: PermissionGroupProps) {
    const allSelected = items.every((item) => selectedItems.has(item.id));
    const someSelected = items.some((item) => selectedItems.has(item.id)) && !allSelected;

    const handleSelectAll = (checked: boolean) => {
        items.forEach((item) => {
            onToggle(item.id, checked);
        });
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
                <div>
                    <h4 className="font-semibold text-sm">{title}</h4>
                    {description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    )}
                </div>
                <button
                    onClick={() => handleSelectAll(!allSelected)}
                    disabled={disabled}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                    {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
                </button>
            </div>

            <div className="space-y-1">
                {items.map((item) => (
                    <PermissionToggle
                        key={item.id}
                        id={`perm-${item.id}`}
                        label={item.label}
                        description={item.href}
                        checked={selectedItems.has(item.id)}
                        onChange={(checked) => onToggle(item.id, checked)}
                        disabled={disabled}
                    />
                ))}
            </div>
        </div>
    );
}
