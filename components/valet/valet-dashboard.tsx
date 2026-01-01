"use client";

import { useState, useEffect } from "react";
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

    useSoundNotifications('valet', rooms.map(r => ({ id: r.id, number: r.number })));

    const { loading: actionLoading, handleRegisterVehicleAndPayment, handleConfirmCheckout } = useValetActions(fetchRooms);

    async function fetchRooms(silent = false) {
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
    }

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
                        <p className="text-xs text-muted-foreground mb-1">Entradas Pendientes</p>
                        <p className="text-2xl font-bold text-blue-500">{roomsWithoutVehicle.length}</p>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Salidas Pendientes</p>
                        <p className="text-2xl font-bold text-green-500">{roomsPendingCheckout.length}</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
                {/* Entradas Pendientes */}
                {roomsWithoutVehicle.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <Car className="h-5 w-5 text-blue-500" />
                            <h2 className="text-lg font-semibold">Entradas Pendientes</h2>
                            <Badge variant="secondary">{roomsWithoutVehicle.length}</Badge>
                        </div>

                        <div className="space-y-3">
                            {roomsWithoutVehicle.map((room) => {
                                const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
                                const basePrice = room.room_types?.base_price ?? 0;
                                const people = stay?.current_people ?? 2;

                                return (
                                    <Card key={room.id} className="p-4 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-2xl font-bold">Hab. {room.number}</span>
                                                    <Badge variant="outline">{room.room_types?.name}</Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Users className="h-4 w-4" />
                                                        {people} {people === 1 ? 'persona' : 'personas'}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Receipt className="h-4 w-4" />
                                                        {formatCurrency(basePrice)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            onClick={() => handleOpenCheckIn(room)}
                                            className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
                                        >
                                            <Car className="h-5 w-5 mr-2" />
                                            Registrar Vehículo y Cobrar
                                        </Button>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Salidas Pendientes */}
                {roomsPendingCheckout.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <LogOut className="h-5 w-5 text-green-500" />
                            <h2 className="text-lg font-semibold">Salidas Pendientes</h2>
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
                                const isRequested = !!stay?.vehicle_requested_at;

                                return (
                                    <Card key={room.id} className={`p-4 space-y-3 ${isRequested ? "border-red-500 bg-red-50 dark:bg-red-950/20 shadow-lg scale-[1.02] transition-transform" : ""}`}>
                                        {isRequested && (
                                            <div className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 px-3 py-1.5 rounded-md text-sm font-bold flex items-center justify-center gap-2 animate-pulse mb-2 border border-red-200 dark:border-red-800">
                                                🚨 CLIENTE SOLICITÓ SU AUTO 🚨
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
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        🚗 {stay.vehicle_plate}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <Button
                                            onClick={() => handleOpenCheckout(room)}
                                            className="w-full h-12 text-base bg-green-600 hover:bg-green-700"
                                        >
                                            <CheckCircle2 className="h-5 w-5 mr-2" />
                                            Revisar y Confirmar Salida
                                        </Button>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Empty state */}
                {roomsWithoutVehicle.length === 0 && roomsPendingCheckout.length === 0 && (
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
