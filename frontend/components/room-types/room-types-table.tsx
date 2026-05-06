"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Plus, RefreshCw, Clock, Users, DollarSign } from "lucide-react";
import { RoomType } from "@/components/sales/room-types";
import { EditRoomTypeModal } from "./edit-room-type-modal";
import { useToast } from "@/hooks/use-toast";

export function RoomTypesTable() {
    const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { success, error: toastError } = useToast();

    const fetchRoomTypes = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get("/system/crud/room_types");
            setRoomTypes(data || []);
        } catch (error) {
            console.error("Error fetching room types:", error);
            toastError("Error", "No se pudieron cargar los tipos de habitación.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoomTypes();
    }, []);

    const handleEdit = (roomType: RoomType) => {
        setSelectedRoomType(roomType);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setSelectedRoomType(null); // Null means new
        setIsModalOpen(true);
    };

    const handleSave = async (data: Partial<RoomType>) => {
        setIsSaving(true);
        try {
            if (selectedRoomType) {
                // Update
                await apiClient.patch(`/system/crud/room_types/${selectedRoomType.id}`, data);
                success("Actualizado", "Tipo de habitación actualizado correctamente.");
            } else {
                // Create
                await apiClient.post("/system/crud/room_types", data);
                success("Creado", "Nuevo tipo de habitación creado correctamente.");
            }
            setIsModalOpen(false);
            fetchRoomTypes();
        } catch (error) {
            console.error("Error saving room type:", error);
            toastError("Error", "No se pudo guardar la información.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Cargando tipos de habitación...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={fetchRoomTypes}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Actualizar
                </Button>
                <Button size="sm" onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Tipo
                </Button>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Precio Base</TableHead>
                            <TableHead>Capacidad</TableHead>
                            <TableHead>Duración</TableHead>
                            <TableHead>Extras</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {roomTypes.map((type) => (
                            <TableRow key={type.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        {type.name}
                                        {type.is_hotel && <Badge variant="secondary" className="text-xs">Hotel</Badge>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1 font-medium text-emerald-600">
                                        <DollarSign className="h-3 w-3" />
                                        {type.base_price?.toFixed(2)}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                        <Users className="h-3 w-3" />
                                        {type.max_people} pers.
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3 w-3 text-blue-500" />
                                            <span className="text-muted-foreground">Lun-Jue:</span>
                                            <span className="font-medium">{type.weekday_hours}h</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3 w-3 text-purple-500" />
                                            <span className="text-muted-foreground">Fin Sem:</span>
                                            <span className="font-medium">{type.weekend_hours}h</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="text-xs space-y-1 text-muted-foreground">
                                        <div>Persona extra: +${type.extra_person_price?.toFixed(2)}</div>
                                        <div>Hora extra: +${type.extra_hour_price?.toFixed(2)}</div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(type)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {roomTypes.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No hay tipos de habitación registrados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <EditRoomTypeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                roomType={selectedRoomType}
                isLoading={isSaving}
            />
        </div>
    );
}
