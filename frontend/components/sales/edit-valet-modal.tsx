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

interface EditValetModalProps {
    isOpen: boolean;
    roomNumber: string;
    currentValetId: string | null;
    stayId: string;
    onClose: () => void;
    onSuccess: () => void;
}

interface Valet {
    id: string;
    first_name: string;
    last_name: string;
}

export function EditValetModal({
    isOpen,
    roomNumber,
    currentValetId,
    stayId,
    onClose,
    onSuccess,
}: EditValetModalProps) {
    const [valets, setValets] = useState<Valet[]>([]);
    const [selectedValetId, setSelectedValetId] = useState<string>("none");
    const [loading, setLoading] = useState(false);
    const [loadingValets, setLoadingValets] = useState(true);

    // Cargar cocheros disponibles
    useEffect(() => {
        const loadValets = async () => {
            setLoadingValets(true);
            try {
                const { apiClient } = await import("@/lib/api/client");
                const { data } = await apiClient.get("/hr/employees/list");
                if (data) {
                    setValets(data);
                }
            } catch (error) {
                console.error("Error loading valets:", error);
            }
            setLoadingValets(false);
        };

        if (isOpen) {
            loadValets();
            setSelectedValetId(currentValetId || "none");
        }
    }, [isOpen, currentValetId]);

    const handleSave = async () => {
        setLoading(true);

        try {
            const { apiClient } = await import("@/lib/api/client");
            await apiClient.patch(`/system/crud/room_stays/${stayId}`, {
                valet_employee_id: selectedValetId === "none" ? null : selectedValetId,
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error updating valet:", error);
            alert("Error al actualizar el cochero");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:w-full max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCog className="h-5 w-5" />
                        Asignar Cochero
                    </DialogTitle>
                    <DialogDescription>
                        Habitación {roomNumber} - Asigna o cambia el cochero responsable
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <Label htmlFor="valet">Cochero</Label>
                    {loadingValets ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Select
                            value={selectedValetId}
                            onValueChange={setSelectedValetId}
                            disabled={loading || valets.length === 0}
                        >
                            <SelectTrigger className="mt-2">
                                <SelectValue
                                    placeholder={
                                        valets.length === 0
                                            ? "No hay cocheros registrados"
                                            : "Selecciona un cochero"
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sin asignar</SelectItem>
                                {valets.map((valet) => (
                                    <SelectItem key={valet.id} value={valet.id}>
                                        {valet.first_name} {valet.last_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {valets.length === 0 && !loadingValets && (
                        <p className="text-xs text-muted-foreground mt-2">
                            No hay empleados con rol &quot;Cochero&quot; activos. Crea uno primero en
                            gestión de empleados.
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={loading || loadingValets}>
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
