"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Room } from "@/components/sales/room-types";
import { useValetActions } from "@/hooks/use-valet-actions";
import { useSoundNotifications } from "@/hooks/use-sound-notifications";
import { ValetCheckInModal } from "./valet-checkin-modal";
import { ValetCheckoutModal } from "./valet-checkout-modal";
import { ValetDeliveryConfirmModal } from "./valet-delivery-confirm-modal";
import { usePushRegistration } from "@/hooks/use-push-registration";
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
    Receipt,
    ShoppingBag,
    Zap,
    LayoutGrid,
    X,
    Loader2,
    Bell,
    BellOff,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ValetDashboardProps {
    employeeId: string;
}

export function ValetDashboard({ employeeId }: ValetDashboardProps) {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [pendingConsumptions, setPendingConsumptions] = useState<any[]>([]);
    const [myConsumptions, setMyConsumptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [selectedConsumption, setSelectedConsumption] = useState<any | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [expandedServiceCards, setExpandedServiceCards] = useState<Set<string>>(new Set());
    const [bulkConfirmItems, setBulkConfirmItems] = useState<{ items: any[], roomNumber: string } | null>(null);
    const [bulkConfirmLoading, setBulkConfirmLoading] = useState(false);

    const { isSupported, isSubscribed, subscribe, unsubscribe, loading: pushLoading } = usePushRegistration(employeeId);

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

    // Cargar consumos pendientes de entrega
    const fetchPendingConsumptions = useCallback(async () => {
        const supabase = createClient();
        try {
            const { data, error } = await supabase
                .from('sales_order_items')
                .select(`
                    *,
                    products(name, sku),
                    sales_orders!inner(
                        id,
                        room_stays!inner(
                            room_id,
                            rooms(number)
                        )
                    )
                `)
                .eq('concept_type', 'CONSUMPTION')
                .is('delivery_accepted_by', null)
                .eq('is_paid', false)
                .not('delivery_status', 'in', '("CANCELLED","COMPLETED","DELIVERED")') // Exclude finished/cancelled items
                .order('id', { ascending: false });

            if (error) throw error;
            setPendingConsumptions(data || []);
        } catch (error) {
            console.error('Error fetching pending consumptions:', error);
            setPendingConsumptions([]);
        }
    }, []);

    // Cargar MIS consumos en progreso (aceptados por mí)
    const fetchMyConsumptions = useCallback(async () => {
        if (!employeeId) return;
        const supabase = createClient();
        try {
            const { data, error } = await supabase
                .from('sales_order_items')
                .select(`
                    *,
                    products(name, sku),
                    sales_orders!inner(
                        id,
                        room_stays!inner(
                            room_id,
                            rooms(number)
                        )
                    )
                `)
                .eq('concept_type', 'CONSUMPTION')
                .eq('delivery_accepted_by', employeeId)
                .in('delivery_status', ['ACCEPTED', 'IN_TRANSIT'])
                .not('delivery_status', 'in', '("CANCELLED","COMPLETED","DELIVERED")') // Exclude finished/cancelled items
                .order('id', { ascending: false });

            if (error) throw error;
            setMyConsumptions(data || []);
        } catch (error) {
            console.error('Error fetching my consumptions:', error);
            setMyConsumptions([]);
        }
    }, [employeeId]);



    // ... (keep existing audio hook)
    const { isAudioReady, unlockAudio } = useSoundNotifications('valet', rooms.map(r => ({ id: r.id, number: r.number })));

    const {
        loading: actionLoading,
        handleRegisterVehicleAndPayment,
        handleConfirmCheckout,
        handleProposeCheckout,
        handleAcceptEntry,
        handleAcceptConsumption,
        handleAcceptAllConsumptions,
        handleConfirmDelivery,
        handleConfirmAllDeliveries,
        handleCancelConsumption
    } = useValetActions(async () => {
        await fetchRooms(true);
        await fetchPendingConsumptions();
        await fetchMyConsumptions();
    });

    // ... (keep existing subscription effect)
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_order_items' },
                () => {
                    fetchPendingConsumptions();
                    fetchMyConsumptions();
                })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchRooms, fetchPendingConsumptions, fetchMyConsumptions]);

    // ... (keep existing handlers: handleAcceptEntry, handleAcceptConsumption, useEffect for intervals, filters)
    const handleAcceptEntryWrapper = async (room: Room) => {
        const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
        if (!stay || !employeeId) return;
        await handleAcceptEntry(stay.id, room.number, employeeId);
    };

    // Aceptar consumo para entregar
    const handleAcceptConsumptionWrapper = async (consumptionId: string, roomNumber: string) => {
        if (!employeeId) return;
        await handleAcceptConsumption(consumptionId, roomNumber, employeeId);
    };

    // Aceptar TODOS los consumos de una habitación
    const handleAcceptAllConsumptionsWrapper = async (items: any[], roomNumber: string) => {
        if (!employeeId || items.length === 0) return;
        await handleAcceptAllConsumptions(items, roomNumber, employeeId);
    };

    // Abrir modal de confirmación para TODOS los consumos de una habitación (que estén IN_TRANSIT)
    const openBulkConfirmModal = (items: any[], roomNumber: string) => {
        const inTransitItems = items.filter(item => item.delivery_status === 'IN_TRANSIT');
        if (inTransitItems.length === 0) {
            toast.error("No hay entregas listas para confirmar");
            return;
        }
        setBulkConfirmItems({ items: inTransitItems, roomNumber });
    };

    // Ejecutar confirmación de todas las entregas
    const handleConfirmAllDeliveriesWrapper = async () => {
        if (!bulkConfirmItems || !employeeId) return;
        setBulkConfirmLoading(true);
        // Por ahora bulk use payment EFECTIVO por el total, 
        // idealmente abriría un mini modal de cobro igual que el individual
        const totalAmount = bulkConfirmItems.items.reduce((sum, item) => sum + Number(item.total), 0);
        const payments = [{ amount: totalAmount, method: 'EFECTIVO' as const }];

        await handleConfirmAllDeliveries(
            bulkConfirmItems.items,
            bulkConfirmItems.roomNumber,
            payments,
            undefined,
            employeeId
        );
        setBulkConfirmItems(null);
        setBulkConfirmLoading(false);
    };

    const handleCancelConsumptionWrapper = async (consumptionId: string) => {
        setCancellingId(consumptionId);
        await handleCancelConsumption(consumptionId);
        setCancellingId(null);
    };

    useEffect(() => {
        fetchRooms(false);
        fetchPendingConsumptions();
        fetchMyConsumptions();

        // Auto-refresh cada 30 segundos (silencioso)
        const interval = setInterval(() => {
            // No refrescar si hay un modal abierto para evitar perder foco o datos
            if (!showCheckInModal && !showCheckoutModal && !showDeliveryModal) {
                fetchRooms(true);
                fetchPendingConsumptions();
                fetchMyConsumptions();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [employeeId, showCheckInModal, showCheckoutModal, showDeliveryModal, fetchPendingConsumptions, fetchMyConsumptions]);

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

    const handleCheckIn = async (vehicleData: any, paymentData: any, personCount: number): Promise<void> => {
        if (!selectedRoom) return;
        const success = await handleRegisterVehicleAndPayment(selectedRoom, vehicleData, paymentData, employeeId, personCount);
        if (success) {
            setShowCheckInModal(false);
            setSelectedRoom(null);
            // Forzar actualización inmediata del dashboard
            await fetchRooms(true);
        }
    };

    const handleCheckout = async (personCount: number) => {
        if (!selectedRoom) return;
        const success = await handleConfirmCheckout(selectedRoom, employeeId, personCount);
        if (success) {
            setShowCheckoutModal(false);
            setSelectedRoom(null);
            // Forzar actualización inmediata del dashboard
            await fetchRooms(true);
        }
    };

    const handlePropose = async (room: Room) => {
        await handleProposeCheckout(room, employeeId);
        // Forzar actualización inmediata del dashboard
        await fetchRooms(true);
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

    const urgentCheckouts = roomsPendingCheckout.filter(r => {
        const stay = r.room_stays?.find(s => s.status === 'ACTIVA');
        return stay?.vehicle_requested_at || stay?.valet_checkout_requested_at;
    });

    const parkedVehicles = roomsPendingCheckout; // Todos, incluyendo urgentes, pero en la otra tab se ven todos.

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header - Static on mobile/desktop to allow scrolling away */}
            <div className="bg-background border-b pt-4 px-4 pb-0 space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Dashboard Cochero</h1>
                        <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isSupported && (
                            <Button
                                variant={isSubscribed ? "secondary" : "default"}
                                size="sm"
                                onClick={isSubscribed ? unsubscribe : subscribe}
                                disabled={pushLoading}
                                className={!isSubscribed ? "animate-pulse" : ""}
                            >
                                {isSubscribed ? (
                                    <>
                                        <BellOff className="h-4 w-4 mr-1" />
                                        Alertas ON
                                    </>
                                ) : (
                                    <>
                                        <Bell className="h-4 w-4 mr-1" />
                                        Activar Alertas
                                    </>
                                )}
                            </Button>
                        )}
                        {!isAudioReady && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    const ok = await unlockAudio(true);
                                    if (!ok) toast.error("No se pudo activar el sonido");
                                    else toast.success("Sonido activado");
                                }}
                            >
                                🔊 Activar Sonido
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => fetchRooms()}
                            disabled={loading}
                        >
                            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pb-2">
                    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400">
                        <Car className="h-4 w-4 mb-1" />
                        <span className="text-xs font-medium text-center leading-none">Entradas</span>
                        <span className="text-lg font-bold leading-none mt-1">{entriesToAccept.length + myPendingEntries.length}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4 mb-1" />
                        <span className="text-xs font-medium text-center leading-none">En Estancia</span>
                        <span className="text-lg font-bold leading-none mt-1">{roomsPendingCheckout.length}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400">
                        <LogOut className="h-4 w-4 mb-1" />
                        <span className="text-xs font-medium text-center leading-none">Salidas</span>
                        <span className="text-lg font-bold leading-none mt-1">{urgentCheckouts.length}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                        <ShoppingBag className="h-4 w-4 mb-1" />
                        <span className="text-xs font-medium text-center leading-none">Servicios</span>
                        <span className="text-lg font-bold leading-none mt-1">{pendingConsumptions.length + myConsumptions.length}</span>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="tasks" className="w-full">
                <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3 shadow-sm border-b overflow-x-auto md:overflow-visible">
                    <TabsList className="flex md:grid md:grid-cols-2 w-max md:w-full h-14 p-1.5 bg-muted/40 rounded-full border border-border/50 whitespace-nowrap md:whitespace-normal">
                        <TabsTrigger
                            value="tasks"
                            className="relative text-base h-full rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300"
                        >
                            <Zap className="h-4 w-4 mr-2" />
                            <span className="font-medium">Tareas</span>
                            {(entriesToAccept.length > 0 || urgentCheckouts.length > 0 || pendingConsumptions.length > 0) && (
                                <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1 flex items-center justify-center text-[10px] rounded-full border-none shadow-sm">
                                    {entriesToAccept.length + urgentCheckouts.length + pendingConsumptions.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger
                            value="parking"
                            className="text-base h-full rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300"
                        >
                            <LayoutGrid className="h-4 w-4 mr-2" />
                            <span className="font-medium">Estacionamiento</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="p-4">
                    <TabsContent value="tasks" className="space-y-6 mt-0 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-6 duration-500 ease-out">
                        {/* 1. Salidas Urgentes (PRIORIDAD ZERO) */}
                        {urgentCheckouts.length > 0 && (
                            <section>
                                <div className="flex items-center gap-2 mb-3 text-red-600">
                                    <LogOut className="h-5 w-5" />
                                    <h2 className="text-lg font-bold">Salidas Solicitadas</h2>
                                    <Badge variant="destructive" className="animate-pulse">{urgentCheckouts.length}</Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {urgentCheckouts.map(room => (
                                        <Card key={room.id} className="p-4 border-red-500 bg-red-50 dark:bg-red-950/30 shadow-md">
                                            {renderCheckoutCardContent(room)}
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* 2. Entradas (Nueva + Mías) */}
                        {(entriesToAccept.length > 0 || myPendingEntries.length > 0) && (
                            <section>
                                <div className="flex items-center gap-2 mb-3 text-blue-600">
                                    <Car className="h-5 w-5" />
                                    <h2 className="text-lg font-bold">Entradas</h2>
                                    <Badge className="bg-blue-600">{entriesToAccept.length + myPendingEntries.length}</Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {entriesToAccept.map(room => (
                                        <Card key={room.id} className="p-4 border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-xl font-bold">Hab. {room.number}</span>
                                                <Badge variant="outline">Entrada</Badge>
                                            </div>
                                            <Button onClick={() => handleAcceptEntryWrapper(room)} className="w-full bg-blue-600 hover:bg-blue-700">
                                                <CheckCircle2 className="h-4 w-4 mr-2" /> Aceptar
                                            </Button>
                                        </Card>
                                    ))}
                                    {myPendingEntries.map(room => (
                                        <Card key={room.id} className="p-4 border-purple-200 bg-purple-50/50 dark:bg-purple-900/10">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-xl font-bold">Hab. {room.number}</span>
                                                <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/30">Mis Registros</Badge>
                                            </div>
                                            <Button onClick={() => handleOpenCheckIn(room)} className="w-full bg-purple-600 hover:bg-purple-700">
                                                <Car className="h-4 w-4 mr-2" /> Registrar Auto
                                            </Button>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* 3. Servicios (Mis Entregas + Pendientes) */}
                        {(pendingConsumptions.length > 0 || myConsumptions.length > 0) && (
                            <section>
                                <div className="flex items-center gap-2 mb-3 text-amber-600">
                                    <ShoppingBag className="h-5 w-5" />
                                    <h2 className="text-lg font-bold">Servicios</h2>
                                    <Badge className="bg-amber-600">{pendingConsumptions.length + myConsumptions.length}</Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Mis Entregas - Agrupar por habitación */}
                                    {Object.entries(
                                        myConsumptions.reduce((acc: Record<string, any[]>, item) => {
                                            const roomNumber = item.sales_orders?.room_stays[0]?.rooms?.number || '??';
                                            if (!acc[roomNumber]) acc[roomNumber] = [];
                                            acc[roomNumber].push(item);
                                            return acc;
                                        }, {})
                                    ).map(([roomNumber, items]) => {
                                        const cardKey = `my-${roomNumber}`;
                                        const isExpanded = expandedServiceCards.has(cardKey);
                                        const toggleExpand = () => {
                                            setExpandedServiceCards(prev => {
                                                const next = new Set(prev);
                                                if (next.has(cardKey)) {
                                                    next.delete(cardKey);
                                                } else {
                                                    next.add(cardKey);
                                                }
                                                return next;
                                            });
                                        };

                                        return (
                                            <Card key={cardKey} className="p-4 border-orange-400 bg-orange-50/50 dark:bg-orange-900/10">
                                                <div
                                                    className="flex justify-between items-center cursor-pointer"
                                                    onClick={toggleExpand}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xl font-bold">Hab. {roomNumber}</span>
                                                        <Badge className="bg-orange-500 text-white">{items.length} a entregar</Badge>
                                                    </div>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    </Button>
                                                </div>

                                                {isExpanded && (
                                                    <div className="space-y-2 mt-3 animate-in slide-in-from-top-2 fade-in duration-200">
                                                        {/* Botón Confirmar Todos si hay items listos */}
                                                        {items.filter((i: any) => i.delivery_status === 'IN_TRANSIT').length > 1 && (
                                                            <Button
                                                                className="w-full mb-2 bg-green-600 hover:bg-green-700"
                                                                onClick={(e) => { e.stopPropagation(); openBulkConfirmModal(items, roomNumber); }}
                                                            >
                                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                                                Confirmar Todos ({items.filter((i: any) => i.delivery_status === 'IN_TRANSIT').length})
                                                            </Button>
                                                        )}
                                                        {items.map((item: any) => {
                                                            const isInTransit = item.delivery_status === 'IN_TRANSIT';
                                                            return (
                                                                <div key={item.id} className="flex justify-between items-center text-sm bg-background/50 p-2 rounded">
                                                                    <div className="flex-1">
                                                                        <span>{item.qty}x {item.products?.name}</span>
                                                                        <span className="ml-2 text-green-600 font-medium">{formatCurrency(item.total)}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        {isInTransit ? (
                                                                            <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-700" onClick={(e) => { e.stopPropagation(); setSelectedConsumption(item); setShowDeliveryModal(true); }}>
                                                                                Confirmar
                                                                            </Button>
                                                                        ) : (
                                                                            <span className="text-xs text-slate-500">Esperando...</span>
                                                                        )}
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-6 w-6 text-muted-foreground hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                                                            onClick={(e) => { e.stopPropagation(); handleCancelConsumptionWrapper(item.id); }}
                                                                            disabled={cancellingId === item.id}
                                                                        >
                                                                            {cancellingId === item.id ? (
                                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                            ) : (
                                                                                <X className="h-3 w-3" />
                                                                            )}
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </Card>
                                        );
                                    })}
                                    {/* Pendientes Generales */}
                                    {/* Agrupar por habitación para consistencia visual */}
                                    {Object.entries(
                                        pendingConsumptions.reduce((acc: Record<string, any[]>, item) => {
                                            const roomNumber = item.sales_orders?.room_stays[0]?.rooms?.number || '??';
                                            if (!acc[roomNumber]) acc[roomNumber] = [];
                                            acc[roomNumber].push(item);
                                            return acc;
                                        }, {})
                                    ).map(([roomNumber, items]) => (
                                        <Card key={roomNumber} className="p-4 border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xl font-bold">Hab. {roomNumber}</span>
                                                <Badge variant="outline" className="bg-amber-100 text-amber-800">{items.length} items</Badge>
                                            </div>

                                            {/* Botón Aceptar Todos si hay más de 1 item */}
                                            {items.length > 1 && (
                                                <Button
                                                    className="w-full mb-3 bg-amber-600 hover:bg-amber-700"
                                                    onClick={() => handleAcceptAllConsumptionsWrapper(items, roomNumber)}
                                                >
                                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                                    Aceptar Todos ({items.length})
                                                </Button>
                                            )}

                                            <div className="space-y-2">
                                                {items.map((item: any) => (
                                                    <div key={item.id} className="flex justify-between items-center text-sm bg-background/50 p-2 rounded">
                                                        <span className="flex-1">{item.qty}x {item.products?.name}</span>
                                                        <div className="flex items-center gap-1">
                                                            <Button size="sm" variant="outline" className="h-6 text-xs border-amber-500 text-amber-600" onClick={() => handleAcceptConsumptionWrapper(item.id, roomNumber)}>
                                                                Aceptar
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-6 w-6 text-muted-foreground hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                                                onClick={() => handleCancelConsumptionWrapper(item.id)}
                                                                disabled={cancellingId === item.id}
                                                            >
                                                                {cancellingId === item.id ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <X className="h-3 w-3" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Empty State Tareas */}
                        {entriesToAccept.length === 0 && myPendingEntries.length === 0 && urgentCheckouts.length === 0 && pendingConsumptions.length === 0 && myConsumptions.length === 0 && (
                            <div className="text-center py-12 flex flex-col items-center justify-center opacity-50">
                                <CheckCircle2 className="h-16 w-16 mb-4 text-green-500" />
                                <h3 className="text-xl font-medium">Todo al día</h3>
                                <p>No hay tareas urgentes pendientes</p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="parking" className="mt-0 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-6 duration-500 ease-out">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Car className="h-5 w-5" /> Vehículos en Custodia
                            </h2>
                            <Badge variant="secondary">{parkedVehicles.length}</Badge>
                        </div>

                        {parkedVehicles.length === 0 ? (
                            <div className="text-center py-12 opacity-50">
                                <p>El estacionamiento está vacío</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {parkedVehicles.map(room => (
                                    <Card key={room.id} className="p-4 relative hover:shadow-md transition-shadow">
                                        {renderCheckoutCardContent(room)}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </div>
            </Tabs>

            {/* Modals remain the same */}
            <ValetCheckInModal
                room={selectedRoom}
                isOpen={showCheckInModal}
                onClose={() => { setShowCheckInModal(false); setSelectedRoom(null); }}
                onConfirm={handleCheckIn}
                loading={actionLoading}
            />
            <ValetCheckoutModal
                room={selectedRoom}
                isOpen={showCheckoutModal}
                onClose={() => { setShowCheckoutModal(false); setSelectedRoom(null); }}
                onConfirm={handleCheckout}
                loading={actionLoading}
            />
            <ValetDeliveryConfirmModal
                isOpen={showDeliveryModal}
                onClose={() => {
                    setShowDeliveryModal(false);
                    setSelectedConsumption(null);
                }}
                consumption={selectedConsumption}
                employeeId={employeeId}
                onConfirmed={() => {
                    // El modal ya llama a handleConfirmDelivery que refresca todo
                }}
                onConfirmDelivery={handleConfirmDelivery}
            />

            {/* Modal de confirmación para entregas masivas */}
            <AlertDialog open={!!bulkConfirmItems} onOpenChange={(open) => !open && setBulkConfirmItems(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            Confirmar Todas las Entregas
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Vas a confirmar la entrega de todos los productos para la Habitación {bulkConfirmItems?.roomNumber}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {bulkConfirmItems && (
                        <div className="py-4">
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 space-y-2 max-h-48 overflow-auto">
                                {bulkConfirmItems.items.map((item: any) => (
                                    <div key={item.id} className="flex justify-between text-sm">
                                        <span>{item.qty}x {item.products?.name}</span>
                                        <span className="text-green-600 font-medium">{formatCurrency(item.total)}</span>
                                    </div>
                                ))}
                                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                                    <span>Total ({bulkConfirmItems.items.length} productos):</span>
                                    <span className="text-green-600">
                                        {formatCurrency(bulkConfirmItems.items.reduce((sum: number, i: any) => sum + Number(i.total), 0))}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3">
                                ⚠️ Esta acción marcará todos los productos como entregados. Debes entregar el dinero en recepción.
                            </p>
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={bulkConfirmLoading}>Cancelar</AlertDialogCancel>                        <Button
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={handleConfirmAllDeliveriesWrapper}
                            disabled={bulkConfirmLoading}
                        >
                            {bulkConfirmLoading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            Confirmar Entregas
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );

    // Helper para renderizar contenido de tarjetas de salida para evitar duplicidad
    function renderCheckoutCardContent(room: Room) {
        const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
        const checkinTime = stay?.check_in_at ? new Date(stay.check_in_at) : new Date();
        const durationH = Math.floor((new Date().getTime() - checkinTime.getTime()) / 3600000);
        const isRequested = !!stay?.vehicle_requested_at;
        const isValetRequested = !!stay?.valet_checkout_requested_at;

        return (
            <>
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold">Hab. {room.number}</span>
                            {stay?.vehicle_plate && (
                                <Badge variant="secondary" className="font-mono">{stay.vehicle_plate}</Badge>
                            )}
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground mt-1 gap-2">
                            <Clock className="h-3 w-3" />
                            <span>{durationH}h</span>
                        </div>
                    </div>
                    {isRequested && <Badge className="bg-red-500 hover:bg-red-600 animate-pulse">Solicitado</Badge>}
                    {isValetRequested && <Badge className="bg-amber-500 hover:bg-amber-600">Aviso Enviado</Badge>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    {isRequested ? (
                        <Button onClick={() => handleOpenCheckout(room)} className="col-span-2 bg-red-600 hover:bg-red-700 text-white h-10 text-lg">
                            <LogOut className="h-4 w-4 mr-2" /> Entregar
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" size="sm" onClick={() => handlePropose(room)} disabled={isValetRequested || actionLoading} className="h-10 text-sm" >
                                {isValetRequested ? "Avisado" : "Avisar Salida"}
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => handleOpenCheckout(room)} className="h-10 text-sm" >
                                <LogOut className="h-4 w-4 mr-2" /> Entregar
                            </Button>
                        </>
                    )}
                </div>
            </>
        );
    }

    function renderConsumptionCardContent(item: any, isMine: boolean) {
        const roomNumber = item.sales_orders?.room_stays[0]?.rooms?.number || '??';
        const isInTransit = item.delivery_status === 'IN_TRANSIT';

        return (
            <>
                <div className="flex justify-between mb-2">
                    <span className="font-bold">Hab. {roomNumber}</span>
                    <span className="font-bold text-green-600">{formatCurrency(item.total)}</span>
                </div>
                <div className="text-sm mb-3">
                    {item.qty}x {item.products?.name}
                </div>
                {isInTransit ? (
                    <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => { setSelectedConsumption(item); setShowDeliveryModal(true); }}>
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar Entrega
                    </Button>
                ) : (
                    <div className="flex items-center gap-2 w-full">
                        <div className="text-center text-xs bg-slate-100 dark:bg-slate-800 py-2 rounded flex-1 text-slate-500 font-medium">
                            Esperando servicio...
                        </div>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors shrink-0"
                            onClick={() => handleCancelConsumption(item.id)}
                            title="Cancelar servicio"
                            disabled={cancellingId === item.id}
                        >
                            {cancellingId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <X className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                )}
            </>
        );
    }
}
