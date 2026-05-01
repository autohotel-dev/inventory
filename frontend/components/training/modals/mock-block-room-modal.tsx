"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, X } from "lucide-react";

interface MockBlockRoomModalProps {
    isOpen: boolean;
    roomNumber: string;
    actionLoading: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}

export function MockBlockRoomModal({
    isOpen,
    roomNumber,
    actionLoading,
    onClose,
    onConfirm,
}: MockBlockRoomModalProps) {
    const [reason, setReason] = useState("");

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (reason.trim()) {
            onConfirm(reason.trim());
            setReason("");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-background border rounded-lg shadow-lg w-[95vw] sm:w-full sm:max-w-md mx-4 p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                            <Lock className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">
                                Bloquear Habitación
                            </h2>
                            <p className="text-sm text-muted-foreground">Habitación {roomNumber}</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Contenido */}
                <div className="space-y-4">
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                        <p className="text-sm text-amber-400">
                            La habitación quedará inhabilitada hasta que se libere manualmente.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="block-reason">Razón del bloqueo *</Label>
                        <Input
                            id="block-reason"
                            placeholder="Ej: Reparación de aire acondicionado..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="text-xs text-muted-foreground">
                        <p>Ejemplos comunes:</p>
                        <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
                            <li>Mantenimiento general</li>
                            <li>Reparación de plomería</li>
                            <li>Fumigación</li>
                            <li>Pintura / Remodelación</li>
                        </ul>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1"
                        disabled={actionLoading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={actionLoading || !reason.trim()}
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                        {actionLoading ? "Bloqueando..." : "Bloquear Habitación"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
