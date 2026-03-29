"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTraining } from "@/contexts/training-context";

interface RoomStatusNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (note: string) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    loading?: boolean;
    initialNote?: string;
}

export function RoomStatusNoteModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirmar",
    loading = false,
    initialNote = "",
}: RoomStatusNoteModalProps) {
    const { isTrainingActive, currentMode } = useTraining();
    const [note, setNote] = useState(initialNote);
    const isTourBlocking = isTrainingActive && currentMode === 'interactive';

    useEffect(() => {
        if (isOpen) {
            setNote(initialNote);
        }
    }, [isOpen, initialNote]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(note);
    };

    return (
        <Dialog open={isOpen} modal={false} onOpenChange={(open) => !open && !loading && onClose()}>
            <DialogContent
                id="tour-room-status-note-modal"
                className={`sm:max-w-md bg-slate-900 border-slate-800 text-white z-[9999] ${isTourBlocking ? 'pointer-events-none' : ''}`}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="note">Notas (Opcional)</Label>
                        <Textarea
                            id="note"
                            placeholder="Ingresa un motivo o nota relevante..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="bg-slate-950 border-slate-800 focus:ring-blue-500 min-h-[100px]"
                            autoFocus={!isTourBlocking}
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                            className="bg-transparent border-slate-700 hover:bg-slate-800 text-slate-300"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {loading ? "Procesando..." : confirmLabel}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
