"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, RefreshCw, Battery, Radio, Pencil, Search, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SensorWithRoom {
    id: string;
    name: string;
    device_id: string;
    status: 'ONLINE' | 'OFFLINE';
    is_open: boolean;
    battery_level: number;
    last_seen: string;
    room?: {
        id: string;
        number: string;
    } | null;
}

interface Room {
    id: string;
    number: string;
}

export function SensorsTable() {
    const [sensors, setSensors] = useState<SensorWithRoom[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { success, error: showError } = useToast();

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newSensorDeviceID, setNewSensorDeviceID] = useState("");
    const [newSensorName, setNewSensorName] = useState("");
    const [selectedRoomId, setSelectedRoomId] = useState("");

    // Filter & Sort State
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all"); // all, online, offline
    const [assignmentFilter, setAssignmentFilter] = useState("all"); // all, assigned, unassigned
    const [sortBy, setSortBy] = useState("room_asc"); // room_asc, room_desc, name, battery_low, last_seen

    const supabase = createClient();

    const getFilteredAndSortedSensors = () => {
        return sensors
            .filter((sensor) => {
                // Search term match
                const roomNum = sensor.room?.number || "";
                const name = sensor.name || "";
                const deviceId = sensor.device_id || "";
                const searchLower = searchTerm.toLowerCase();
                const matchesSearch = 
                    roomNum.toLowerCase().includes(searchLower) ||
                    name.toLowerCase().includes(searchLower) ||
                    deviceId.toLowerCase().includes(searchLower);

                // Status filter match
                const matchesStatus = 
                    statusFilter === "all" ||
                    (statusFilter === "online" && sensor.status === "ONLINE") ||
                    (statusFilter === "offline" && sensor.status === "OFFLINE");

                // Assignment filter match
                const matchesAssignment = 
                    assignmentFilter === "all" ||
                    (assignmentFilter === "assigned" && !!sensor.room) ||
                    (assignmentFilter === "unassigned" && !sensor.room);

                return matchesSearch && matchesStatus && matchesAssignment;
            })
            .sort((a, b) => {
                if (sortBy === "room_asc" || sortBy === "room_desc") {
                    const numA = parseInt(a.room?.number || "999999");
                    const numB = parseInt(b.room?.number || "999999");
                    return sortBy === "room_asc" ? numA - numB : numB - numA;
                }
                if (sortBy === "name") {
                    return (a.name || "").localeCompare(b.name || "");
                }
                if (sortBy === "battery_low") {
                    return (a.battery_level ?? 100) - (b.battery_level ?? 100);
                }
                if (sortBy === "last_seen") {
                    const timeA = new Date(a.last_seen || 0).getTime();
                    const timeB = new Date(b.last_seen || 0).getTime();
                    return timeB - timeA; // Descending (most recent first)
                }
                return 0;
            });
    };

    const filteredSensors = getFilteredAndSortedSensors();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch Sensors with Room data
            const { data: sensorsData, error: sensorsError } = await supabase
                .from("sensors")
                .select(`
                *,
                room:rooms(id, number)
            `)
                .order("created_at", { ascending: false });

            if (sensorsError) throw sensorsError;
            setSensors(sensorsData || []);

            // Fetch Rooms for the dropdown
            const { data: roomsData, error: roomsError } = await supabase
                .from("rooms")
                .select("id, number")
                .order("number");

            if (roomsError) throw roomsError;
            setRooms(roomsData || []);

        } catch (error: any) {
            console.error("Error fetching data:", error);
            showError("Error", "No se pudieron cargar los sensores");
        } finally {
            setLoading(false);
        }
    }, [showError, supabase]);

    useEffect(() => {
        fetchData();

        const channel = supabase
            .channel('sensors-table-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'sensors'
                },
                (payload: any) => {
                    const newSensor = payload.new as SensorWithRoom;
                    setSensors((prev) =>
                        prev.map((s) => {
                            if (s.id === newSensor.id) {
                                // Preserve the existing room object since the payload doesn't have it
                                return { ...newSensor, room: s.room };
                            }
                            return s;
                        })
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData, supabase]);

    const openForCreate = () => {
        setEditingId(null);
        setNewSensorDeviceID("");
        setNewSensorName("");
        setSelectedRoomId("");
        setIsModalOpen(true);
    };

    const openForEdit = (sensor: SensorWithRoom) => {
        setEditingId(sensor.id);
        setNewSensorDeviceID(sensor.device_id);
        setNewSensorName(sensor.name);
        setSelectedRoomId(sensor.room?.id || "");
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!newSensorDeviceID || !selectedRoomId) {
            showError("Error", "Faltan campos obligatorios");
            return;
        }

        try {
            const sensorData = {
                device_id: newSensorDeviceID.trim(),
                name: newSensorName || "Sensor Puerta",
                room_id: selectedRoomId === "unassigned" ? null : selectedRoomId,
            };

            let error;

            if (editingId) {
                // Update
                const res = await supabase
                    .from("sensors")
                    .update(sensorData)
                    .eq("id", editingId);
                error = res.error;
            } else {
                // Create
                const res = await supabase.from("sensors").insert({
                    ...sensorData,
                    status: 'ONLINE',
                    is_open: false,
                    battery_level: 100
                });
                error = res.error;
            }

            if (error) throw error;

            success("Éxito", editingId ? "Sensor actualizado" : "Sensor registrado correctamente");
            setIsModalOpen(false);
            setEditingId(null);
            setNewSensorDeviceID("");
            setNewSensorName("");
            setSelectedRoomId("");
            fetchData();

        } catch (error: any) {
            console.error("Error saving sensor:", error);
            showError("Error", "Error al guardar sensor (¿ID duplicado?)");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Seguro que deseas eliminar este sensor?")) return;

        try {
            const { error } = await supabase.from("sensors").delete().eq("id", id);
            if (error) throw error;

            success("Eliminado", "Sensor eliminado correctamente");
            fetchData();
        } catch (error) {
            console.error("Error deleting:", error);
            showError("Error", "No se pudo eliminar");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Sensores Registrados ({sensors.length})</h2>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                    <Button size="sm" onClick={openForCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Sensor
                    </Button>
                </div>
            </div>

            {/* Filters and Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-muted/20 p-3 rounded-lg border">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar hab, nombre o ID..."
                        className="pl-8 h-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los Estados</SelectItem>
                            <SelectItem value="online">En Línea</SelectItem>
                            <SelectItem value="offline">Offline</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Asignación" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las Habitaciones</SelectItem>
                            <SelectItem value="assigned">Asignados</SelectItem>
                            <SelectItem value="unassigned">Sin Asignar</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Ordenar por" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="room_asc">Habitación (Menor a Mayor)</SelectItem>
                            <SelectItem value="room_desc">Habitación (Mayor a Menor)</SelectItem>
                            <SelectItem value="name">Nombre</SelectItem>
                            <SelectItem value="battery_low">Batería Más Baja</SelectItem>
                            <SelectItem value="last_seen">Última Conexión</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div id="sensor-grid" className="rounded-md border bg-card">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                        <tr>
                            <th className="p-3 text-left font-medium">Habitación</th>
                            <th className="p-3 text-left font-medium">Nombre / Device ID</th>
                            <th className="p-3 text-center font-medium">Estado</th>
                            <th className="p-3 text-center font-medium">Puerta</th>
                            <th className="p-3 text-center font-medium">Batería</th>
                            <th className="p-3 text-right font-medium">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sensors.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                    No hay sensores registrados.
                                </td>
                            </tr>
                        ) : filteredSensors.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                    No se encontraron sensores que coincidan con la búsqueda.
                                </td>
                            </tr>
                        ) : (
                            filteredSensors.map((sensor) => (
                                <tr key={sensor.id} className="border-b last:border-0 hover:bg-muted/10">
                                    <td className="p-3 font-medium">
                                        {sensor.room ? `Hab. ${sensor.room.number}` : <Badge variant="outline">Sin Asignar</Badge>}
                                    </td>
                                    <td className="p-3">
                                        <div className="font-medium">{sensor.name}</div>
                                        <div className="text-xs text-muted-foreground font-mono">{sensor.device_id}</div>
                                    </td>
                                    <td className="p-3 text-center">
                                        {sensor.status === 'ONLINE' ? (
                                            <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-200">En Línea</Badge>
                                        ) : (
                                            <Badge variant="destructive">Offline</Badge>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {sensor.is_open ? (
                                            <span className="inline-flex items-center text-red-600 font-bold animate-pulse">
                                                ABIERTA 🔴
                                            </span>
                                        ) : (
                                            <span className="text-green-600">Cerrada</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-1 text-xs">
                                            <Battery className="h-3 w-3" />
                                            {sensor.battery_level}%
                                        </div>
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                onClick={() => openForEdit(sensor)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                onClick={() => handleDelete(sensor.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Editar Sensor" : "Registrar Nuevo Sensor"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="room">Habitación</Label>
                            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una habitación" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">-- Sin Asignar --</SelectItem>
                                    {rooms.map(room => (
                                        <SelectItem key={room.id} value={room.id}>
                                            Habitación {room.number}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="title">Nombre (Opcional)</Label>
                            <Input
                                id="title"
                                placeholder="Ej. Sensor Principal"
                                value={newSensorName}
                                onChange={e => setNewSensorName(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="device_id">Device ID (Tuya Virtual ID)</Label>
                            <Input
                                id="device_id"
                                placeholder="Pegar ID aquí..."
                                value={newSensorDeviceID}
                                onChange={e => setNewSensorDeviceID(e.target.value)}
                            // disabled={!!editingId} // Permitimos editar para corregir errores
                            />
                            {/* {editingId && <p className="text-xs text-yellow-600">El ID no se puede cambiar.</p>} */}
                            {!editingId && (
                                <p className="text-xs text-muted-foreground">
                                    Obtenlo en Smart Life App &gt; Sensor &gt; Editar &gt; Info del Equipo.
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave}>{editingId ? "Guardar Cambios" : "Registrar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
