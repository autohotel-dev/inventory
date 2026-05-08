"use client";

import { useState, useEffect, useMemo } from "react";
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
import { UserCog, Loader2, User, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
    const [showChangeMode, setShowChangeMode] = useState(false);

    // Cargar cocheros disponibles
    useEffect(() => {
        const loadValets = async () => {
            setLoadingValets(true);
            const supabase = createClient();
            const { data } = await supabase
                .from("employees")
                .select("id, first_name, last_name")
                .eq("role", "cochero")
                .eq("is_active", true)
                .order("first_name");

            if (data) {
                setValets(data);
            }
            setLoadingValets(false);
        };

        if (isOpen) {
            loadValets();
            setSelectedValetId(currentValetId || "none");
            setShowChangeMode(false); // Reset on open
        }
    }, [isOpen, currentValetId]);

    // Determine if a valet is currently assigned
    const currentValet = useMemo(() => {
        if (!currentValetId || currentValetId === "none") return null;
        return valets.find(v => v.id === currentValetId) || null;
    }, [currentValetId, valets]);

    const hasAssignedValet = !!currentValet;

    const handleSave = async () => {
        setLoading(true);
        const supabase = createClient();

        try {
            const { error } = await supabase
                .from("room_stays")
                .update({
                    valet_employee_id: selectedValetId === "none" ? null : selectedValetId,
                })
                .eq("id", stayId);

            if (error) throw error;

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
                    {loadingValets ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : hasAssignedValet && !showChangeMode ? (
                        /* ──── Vista de cochero asignado ──── */
                        <div className="space-y-4">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Cochero Asignado</Label>
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-500/20 border border-emerald-500/40">
                                    <User className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-foreground">
                                        {currentValet.first_name} {currentValet.last_name}
                                    </p>
                                    <p className="text-xs text-emerald-400">Cochero activo</p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full gap-2 border-dashed"
                                onClick={() => setShowChangeMode(true)}
                            >
                                <RefreshCw className="h-4 w-4" />
                                Cambiar Cochero
                            </Button>
                        </div>
                    ) : (
                        /* ──── Vista de selección (sin cochero o modo cambio) ──── */
                        <div className="space-y-3">
                            {showChangeMode && hasAssignedValet && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                                    <RefreshCw className="h-3 w-3" />
                                    Cambiando desde: <span className="font-medium text-foreground">{currentValet?.first_name} {currentValet?.last_name}</span>
                                </div>
                            )}
                            <Label htmlFor="valet">Cochero</Label>
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
                            {valets.length === 0 && !loadingValets && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    No hay empleados con rol &quot;Cochero&quot; activos. Crea uno primero en
                                    gestión de empleados.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    {/* Only show save when in selection mode or no valet assigned */}
                    {(!hasAssignedValet || showChangeMode) && (
                        <Button onClick={handleSave} disabled={loading || loadingValets}>
                            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Guardar
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
