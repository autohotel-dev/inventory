"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Room } from "@/components/sales/room-types";
import { useValetActions } from "@/hooks/use-valet-actions";
import { useSoundNotifications } from "@/hooks/use-sound-notifications";
import { ValetCheckInModal } from "./valet-checkin-modal";
import { ValetCheckoutModal } from "./valet-checkout-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/formatters";
import {
    Car,
    CheckCircle2,
    RefreshCw,
    Clock,
    Users,
    LogOut,
    Receipt
} from "lucide-react";
import { toast } from "sonner";

interface ValetDashboardProps {
    employeeId: string;
}

export function ValetDashboard({ employeeId }: ValetDashboardProps) {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);

    const fetchRooms = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        const supabase = createClient();

        try {
            const { data, error } = await supabase
                .from("rooms")
                .select(`
          *,
          room_types(*),
          room_stays!inner(
            *,
            sales_orders(*)
          )
        `)
                .eq("room_stays.status", "ACTIVA")
                .order("number");

            if (error) throw error;

            setRooms(data as Room[] || []);
        } catch (error) {
            console.error("Error fetching rooms:", error);
            toast.error("Error al cargar habitaciones");
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useSoundNotifications('valet', rooms.map(r => ({ id: r.id, number: r.number })));

    const { loading: actionLoading, handleRegisterVehicleAndPayment, handleConfirmCheckout } = useValetActions(fetchRooms);

    // Suscripción en tiempo real
    useEffect(() => {
        const supabase = createClient();
        console.log("Setting up realtime subscription for ValetDashboard");
        const channel = supabase
            .channel('valet-dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'room_stays' },
                () => fetchRooms(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' },
                () => fetchRooms(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },
                () => fetchRooms(true))
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchRooms]);

    const handleAcceptEntry = async (room: Room) => {
        const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
        if (!stay || !employeeId) return;

        try {
            const supabase = createClient();

            // 1. Asignar el valet a la estancia
            const { error } = await supabase
                .from('room_stays')
                .update({ valet_employee_id: employeeId })
                .eq('id', stay.id);

            if (error) throw error;

            toast.success("Entrada aceptada", {
                description: `Te has asignado la Habitación ${room.number}`
            });

            // Refrescar lista
            fetchRooms(true);

        } catch (error) {
            console.error("Error accepting entry:", error);
            toast.error("Error al aceptar la entrada");
        }
    };

    useEffect(() => {
        fetchRooms(false);

        // Auto-refresh cada 30 segundos (silencioso)
        const interval = setInterval(() => {
            // No refrescar si hay un modal abierto para evitar perder foco o datos
            if (!showCheckInModal && !showCheckoutModal) {
                fetchRooms(true);
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [employeeId, showCheckInModal, showCheckoutModal]);

    // Filtrar habitaciones sin vehículo (entradas pendientes)
    const roomsWithoutVehicle = rooms.filter(r => {
        const stay = r.room_stays?.find(s => s.status === 'ACTIVA');
        return stay && !stay.vehicle_plate;
    });

    // Filtrar habitaciones con vehículo pero sin checkout confirmado (salidas pendientes)
    const roomsPendingCheckout = rooms.filter(r => {
        const stay = r.room_stays?.find(s => s.status === 'ACTIVA');
        // Aquí deberías tener una forma de saber si está en proceso de checkout
        // Por ahora, mostrar habitaciones con checkout_valet_employee_id null
        return stay && stay.vehicle_plate && !stay.checkout_valet_employee_id;
    }).sort((a, b) => {
        const stayA = a.room_stays?.find(s => s.status === 'ACTIVA');
        const stayB = b.room_stays?.find(s => s.status === 'ACTIVA');
        // Priorizar vehículos solicitados
        const reqA = stayA?.vehicle_requested_at ? 1 : 0;
        const reqB = stayB?.vehicle_requested_at ? 1 : 0;
        if (reqA !== reqB) return reqB - reqA; // Solicitados primero
        return 0;

    });

    // 1. Entradas SIN valet asignado (Cualquiera puede aceptar)
    const entriesToAccept = roomsWithoutVehicle.filter(r => {
        const stay = r.room_stays?.find(s => s.status === 'ACTIVA');
        return !stay?.valet_employee_id;
    });

    // 2. Mis entradas pendientes (Valet asignado = Yo, pero sin vehículo)
    const myPendingEntries = roomsWithoutVehicle.filter(r => {
        const stay = r.room_stays?.find(s => s.status === 'ACTIVA');
        return stay?.valet_employee_id === employeeId;
    });

    const handleOpenCheckIn = (room: Room) => {
        setSelectedRoom(room);
        setShowCheckInModal(true);
    };

    const handleOpenCheckout = (room: Room) => {
        setSelectedRoom(room);
        setShowCheckoutModal(true);
    };

    const handleCheckIn = async (vehicleData: any, paymentData: any): Promise<void> => {
        if (!selectedRoom) return;
        const success = await handleRegisterVehicleAndPayment(selectedRoom, vehicleData, paymentData, employeeId);
        if (success) {
            setShowCheckInModal(false);
            setSelectedRoom(null);
        }
    };

    const handleCheckout = async () => {
        if (!selectedRoom) return;
        const success = await handleConfirmCheckout(selectedRoom, employeeId);
        if (success) {
            setShowCheckoutModal(false);
            setSelectedRoom(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center space-y-4">
                    <RefreshCw className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">Cargando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background border-b p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Dashboard Cochero</h1>
                        <p className="text-sm text-muted-foreground">Gestión de Entradas y Salidas</p>
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => fetchRooms()}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Por Aceptar</p>
                        <p className="text-2xl font-bold text-blue-500">{entriesToAccept.length}</p>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Mis Registros</p>
                        <p className="text-2xl font-bold text-purple-500">{myPendingEntries.length}</p>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Salidas Pendientes</p>
                        <p className="text-2xl font-bold text-green-500">{roomsPendingCheckout.length}</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
                {/* Sección 1: Entradas por Aceptar */}
                {entriesToAccept.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Users className="h-5 w-5 text-blue-500" />
                            <h2 className="text-lg font-semibold">Entradas Disponibles</h2>
                            <Badge variant="secondary">{entriesToAccept.length}</Badge>
                        </div>

                        <div className="space-y-3">
                            {entriesToAccept.map((room) => {
                                const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
                                const checkin = stay?.check_in_at ? new Date(stay.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

                                return (
                                    <Card key={room.id} className="p-4 space-y-3 border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-2xl font-bold">Hab. {room.number}</span>
                                                    <Badge variant="outline">{room.room_types?.name}</Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">Llegada: {checkin}</p>
                                            </div>
                                        </div>

                                        <Button
                                            onClick={() => handleAcceptEntry(room)}
                                            className="w-full bg-blue-600 hover:bg-blue-700"
                                        >
                                            <CheckCircle2 className="h-5 w-5 mr-2" />
                                            Aceptar Entrada
                                        </Button>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Sección 2: Mis Registros Pendientes */}
                {myPendingEntries.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Car className="h-5 w-5 text-purple-500" />
                            <h2 className="text-lg font-semibold">Mis Registros Pendientes</h2>
                            <Badge variant="secondary">{myPendingEntries.length}</Badge>
                        </div>

                        <div className="space-y-3">
                            {myPendingEntries.map((room) => {
                                const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
                                const people = stay?.current_people ?? 2;
                                const isReminded = stay?.vehicle_requested_at; // Si recepción mandó recordatorio

                                return (
                                    <Card key={room.id} className={`p-4 space-y-3 ${isReminded ? 'border-red-400 bg-red-50 dark:bg-red-900/10' : 'border-purple-200 bg-purple-50/50 dark:bg-purple-900/10'}`}>
                                        {isReminded && (
                                            <div className="text-xs font-bold text-red-600 flex items-center gap-1 mb-1">
                                                <Users className="h-3 w-3" />
                                                RECEPCIÓN SOLICITA REGISTRO
                                            </div>
                                        )}
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-2xl font-bold">Hab. {room.number}</span>
                                                    <Badge variant="outline">{room.room_types?.name}</Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Users className="h-4 w-4" />
                                                        {people} pax
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            onClick={() => handleOpenCheckIn(room)}
                                            className="w-full h-auto min-h-[48px] text-base bg-purple-600 hover:bg-purple-700 whitespace-normal py-2"
                                        >
                                            <Car className="h-5 w-5 mr-2 shrink-0" />
                                            Registrar Vehículo
                                        </Button>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Vehículos bajo custodia */}
                {roomsPendingCheckout.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Car className="h-5 w-5 text-green-500" />
                            <h2 className="text-lg font-semibold">Vehículos Bajo Custodia</h2>
                            <Badge variant="secondary">{roomsPendingCheckout.length}</Badge>
                        </div>

                        <div className="space-y-3">
                            {roomsPendingCheckout.map((room) => {
                                const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
                                const checkinTime = stay?.check_in_at ? new Date(stay.check_in_at) : new Date();
                                const now = new Date();
                                const duration = now.getTime() - checkinTime.getTime();
                                const hours = Math.floor(duration / (1000 * 60 * 60));
                                const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

                                // Solicitado si existe fecha Y es distinta de check_in (por si acaso se copió)
                                const isRequested = !!stay?.vehicle_requested_at;

                                return (
                                    <Card key={room.id} className={`p-4 space-y-3 ${isRequested ? "border-red-500 bg-red-50 dark:bg-red-950/20 shadow-lg scale-[1.02] transition-transform" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/10"}`}>
                                        {isRequested ? (
                                            <div className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 px-3 py-1.5 rounded-md text-sm font-bold flex items-center justify-center gap-2 animate-pulse mb-2 border border-red-200 dark:border-red-800">
                                                🚨 SALIDA SOLICITADA - REVISAR HABITACIÓN 🚨
                                            </div>
                                        ) : (
                                            <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-2 mb-2 border border-green-200 dark:border-green-800">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Cliente en estancia - Vehículo estacionado
                                            </div>
                                        )}
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-2xl font-bold">Hab. {room.number}</span>
                                                    <Badge variant="outline">{room.room_types?.name}</Badge>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Clock className="h-4 w-4" />
                                                    <span>Duración: {hours}h {minutes}m</span>
                                                </div>
                                                {stay?.vehicle_plate && (
                                                    <p className="text-sm text-muted-foreground mt-1 font-mono bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded inline-block">
                                                        🚗 {stay.vehicle_plate}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <Button
                                            onClick={() => handleOpenCheckout(room)}
                                            className={`w-full h-auto min-h-[48px] text-base whitespace-normal py-2 ${isRequested ? "bg-red-600 hover:bg-red-700 text-white" : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"}`}
                                        >
                                            <LogOut className="h-5 w-5 mr-2 shrink-0" />
                                            {isRequested ? "Revisar y Entregar (PRIORIDAD)" : "Revisar / Entregar Auto"}
                                        </Button>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Empty state */}
                {entriesToAccept.length === 0 && myPendingEntries.length === 0 && roomsPendingCheckout.length === 0 && (
                    <div className="text-center py-12">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Sin tareas pendientes</h3>
                        <p className="text-muted-foreground">
                            No hay entradas ni salidas por gestionar en este momento
                        </p>
                    </div>
                )}
            </div>

            {/* Modals */}
            <ValetCheckInModal
                room={selectedRoom}
                isOpen={showCheckInModal}
                onClose={() => {
                    setShowCheckInModal(false);
                    setSelectedRoom(null);
                }}
                onConfirm={handleCheckIn}
                loading={actionLoading}
            />

            <ValetCheckoutModal
                room={selectedRoom}
                isOpen={showCheckoutModal}
                onClose={() => {
                    setShowCheckoutModal(false);
                    setSelectedRoom(null);
                }}
                onConfirm={handleCheckout}
                loading={actionLoading}
            />
        </div>
    );
}
