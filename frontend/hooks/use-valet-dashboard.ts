import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { luxorRealtimeClient } from "@/lib/api/websocket";
import { Room } from "@/components/sales/room-types";
import { toast } from "sonner";
import { useValetActions } from "@/hooks/use-valet-actions";
import { usePushRegistration } from "@/hooks/use-push-registration";
import { useSoundNotifications } from "@/hooks/use-sound-notifications";

export function useValetDashboard(employeeId: string) {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [pendingConsumptions, setPendingConsumptions] = useState<any[]>([]);
    const [myConsumptions, setMyConsumptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [showCheckInModal, setShowCheckInModal] = useState(false);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [showExtraChargeModal, setShowExtraChargeModal] = useState(false);
    const [extraChargeType, setExtraChargeType] = useState<'EXTRA_HOUR' | 'EXTRA_PERSON'>('EXTRA_HOUR');
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
                .not('delivery_status', 'in', '("CANCELLED","COMPLETED","DELIVERED")')
                .order('id', { ascending: false });

            if (error) throw error;
            setPendingConsumptions(data || []);
        } catch (error) {
            console.error('Error fetching pending consumptions:', error);
            setPendingConsumptions([]);
        }
    }, []);

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
                .not('delivery_status', 'in', '("CANCELLED","COMPLETED","DELIVERED")')
                .order('id', { ascending: false });

            if (error) throw error;
            setMyConsumptions(data || []);
        } catch (error) {
            console.error('Error fetching my consumptions:', error);
            setMyConsumptions([]);
        }
    }, [employeeId]);

    const { isAudioReady, unlockAudio } = useSoundNotifications('valet', rooms.map(r => ({ id: r.id, number: r.number })));

    const {
        loading: actionLoading,
        handleRegisterVehicleAndPayment,
        handleRegisterExtraHour,
        handleRegisterExtraPerson,
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

    useEffect(() => {
        console.log("Setting up realtime subscription for ValetDashboard");
        const unsubRooms = luxorRealtimeClient.subscribe('rooms', () => fetchRooms(true));
        const unsubRoomStays = luxorRealtimeClient.subscribe('room_stays', () => fetchRooms(true));
        const unsubPayments = luxorRealtimeClient.subscribe('payments', () => fetchRooms(true));
        const unsubSales = luxorRealtimeClient.subscribe('sales_order_items', () => {
            fetchPendingConsumptions();
            fetchMyConsumptions();
        });

        return () => {
            unsubRooms();
            unsubRoomStays();
            unsubPayments();
            unsubSales();
        };
    }, [fetchRooms, fetchPendingConsumptions, fetchMyConsumptions]);

    useEffect(() => {
        fetchRooms(false);
        fetchPendingConsumptions();
        fetchMyConsumptions();

        const interval = setInterval(() => {
            if (!showCheckInModal && !showCheckoutModal && !showDeliveryModal) {
                fetchRooms(true);
                fetchPendingConsumptions();
                fetchMyConsumptions();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [employeeId, showCheckInModal, showCheckoutModal, showDeliveryModal, fetchRooms, fetchPendingConsumptions, fetchMyConsumptions]);

    // Computed Properties
    const roomsWithoutVehicle = useMemo(() => rooms.filter(r => {
        const stay = r.room_stays?.find(s => s.status === 'ACTIVA');
        return stay && !stay.vehicle_plate;
    }), [rooms]);

    const roomsPendingCheckout = useMemo(() => rooms.filter(r => {
        const stay = r.room_stays?.find(s => s.status === 'ACTIVA');
        return stay && stay.vehicle_plate && !stay.checkout_valet_employee_id;
    }).sort((a, b) => {
        const stayA = a.room_stays?.find(s => s.status === 'ACTIVA');
        const stayB = b.room_stays?.find(s => s.status === 'ACTIVA');
        const reqA = stayA?.vehicle_requested_at ? 1 : 0;
        const reqB = stayB?.vehicle_requested_at ? 1 : 0;
        if (reqA !== reqB) return reqB - reqA;
        return 0;
    }), [rooms]);

    const entriesToAccept = useMemo(() => roomsWithoutVehicle.filter(r => {
        const stay = r.room_stays?.find(s => s.status === 'ACTIVA');
        return !stay?.valet_employee_id;
    }), [roomsWithoutVehicle]);

    const myPendingEntries = useMemo(() => roomsWithoutVehicle.filter(r => {
        const stay = r.room_stays?.find(s => s.status === 'ACTIVA');
        return stay?.valet_employee_id === employeeId;
    }), [roomsWithoutVehicle, employeeId]);

    const urgentCheckouts = useMemo(() => roomsPendingCheckout.filter(r => {
        const stay = r.room_stays?.find(s => s.status === 'ACTIVA');
        return stay?.vehicle_requested_at || stay?.valet_checkout_requested_at;
    }), [roomsPendingCheckout]);

    const parkedVehicles = roomsPendingCheckout;

    // Handlers
    const handleAcceptEntryWrapper = async (room: Room) => {
        const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
        if (!stay || !employeeId) return;
        await handleAcceptEntry(stay.id, room.number, employeeId);
    };

    const handleAcceptConsumptionWrapper = async (consumptionId: string, roomNumber: string) => {
        if (!employeeId) return;
        await handleAcceptConsumption(consumptionId, roomNumber, employeeId);
    };

    const handleAcceptAllConsumptionsWrapper = async (items: any[], roomNumber: string) => {
        if (!employeeId || items.length === 0) return;
        await handleAcceptAllConsumptions(items, roomNumber, employeeId);
    };

    const openBulkConfirmModal = (items: any[], roomNumber: string) => {
        const inTransitItems = items.filter(item => item.delivery_status === 'IN_TRANSIT');
        if (inTransitItems.length === 0) {
            toast.error("No hay entregas listas para confirmar");
            return;
        }
        setBulkConfirmItems({ items: inTransitItems, roomNumber });
    };

    const handleConfirmAllDeliveriesWrapper = async () => {
        if (!bulkConfirmItems || !employeeId) return;
        setBulkConfirmLoading(true);
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
            await fetchRooms(true);
        }
    };

    const handleCheckout = async (personCount: number) => {
        if (!selectedRoom) return;
        const success = await handleConfirmCheckout(selectedRoom, employeeId, personCount);
        if (success) {
            setShowCheckoutModal(false);
            setSelectedRoom(null);
            await fetchRooms(true);
        }
    };

    const handlePropose = async (room: Room) => {
        await handleProposeCheckout(room, employeeId);
        await fetchRooms(true);
    };

    return {
        // State
        rooms,
        pendingConsumptions,
        myConsumptions,
        loading,
        selectedRoom,
        showCheckInModal,
        showCheckoutModal,
        showExtraChargeModal,
        extraChargeType,
        showDeliveryModal,
        selectedConsumption,
        cancellingId,
        expandedServiceCards,
        bulkConfirmItems,
        bulkConfirmLoading,
        
        // Push & Audio
        isSupported,
        isSubscribed,
        subscribe,
        unsubscribe,
        pushLoading,
        isAudioReady,
        unlockAudio,
        actionLoading,

        // Computed
        entriesToAccept,
        myPendingEntries,
        urgentCheckouts,
        parkedVehicles,

        // Setters
        setSelectedRoom,
        setShowCheckInModal,
        setShowCheckoutModal,
        setShowExtraChargeModal,
        setExtraChargeType,
        setShowDeliveryModal,
        setSelectedConsumption,
        setExpandedServiceCards,
        setBulkConfirmItems,
        fetchRooms,

        // Handlers
        handleAcceptEntryWrapper,
        handleAcceptConsumptionWrapper,
        handleAcceptAllConsumptionsWrapper,
        openBulkConfirmModal,
        handleConfirmAllDeliveriesWrapper,
        handleCancelConsumptionWrapper,
        handleOpenCheckIn,
        handleOpenCheckout,
        handleCheckIn,
        handleCheckout,
        handlePropose,
        handleRegisterExtraHour,
        handleRegisterExtraPerson,
        handleConfirmDelivery,
    };
}
