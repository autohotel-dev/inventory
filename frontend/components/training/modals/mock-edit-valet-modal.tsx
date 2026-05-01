"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { UserCog, Loader2 } from "lucide-react";
import { mockValets } from "@/lib/training/mock-data";

interface MockEditValetModalProps {
    isOpen: boolean;
    roomNumber: string;
    currentValetId: string | null;
    onClose: () => void;
    onSuccess: (valetId: string | null) => void;
}

export function MockEditValetModal({
    isOpen,
    roomNumber,
    currentValetId,
    onClose,
    onSuccess,
}: MockEditValetModalProps) {
    const [selectedValetId, setSelectedValetId] = useState<string>("none");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedValetId(currentValetId || "none");
        }
    }, [isOpen, currentValetId]);

    const handleSave = async () => {
        setLoading(true);
        // Simular retraso de red
        await new Promise(resolve => setTimeout(resolve, 800));

        onSuccess(selectedValetId === "none" ? null : selectedValetId);
        onClose();
        setLoading(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:w-full max-w-md bg-background">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCog className="h-5 w-5" />
                        Asignar Cochero (Simulado)
                    </DialogTitle>
                    <DialogDescription>
                        Habitación {roomNumber} - Asigna o cambia el cochero responsable
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <Label htmlFor="valet">Cochero</Label>
                    <Select
                        value={selectedValetId}
                        onValueChange={setSelectedValetId}
                        disabled={loading}
                    >
                        <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Selecciona un cochero" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {mockValets.map((valet) => (
                                <SelectItem key={valet.id} value={valet.id}>
                                    {valet.first_name} {valet.last_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
