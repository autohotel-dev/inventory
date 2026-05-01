"use client";

import { useValetDashboard } from "@/hooks/use-valet-dashboard";
import { Room } from "@/components/sales/room-types";
import { ValetCheckInModal } from "./valet-checkin-modal";
import { ValetCheckoutModal } from "./valet-checkout-modal";
import { ValetDeliveryConfirmModal } from "./valet-delivery-confirm-modal";
import { ValetExtraChargeModal } from "./valet-extra-charge-modal";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface ValetDashboardProps {
    employeeId: string;
}

export function ValetDashboard({ employeeId }: ValetDashboardProps) {
    const {
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
        
        isSupported,
        isSubscribed,
        subscribe,
        unsubscribe,
        pushLoading,
        isAudioReady,
        unlockAudio,
        actionLoading,

        entriesToAccept,
        myPendingEntries,
        urgentCheckouts,
        parkedVehicles,
        pendingConsumptions,
        myConsumptions,

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
    } = useValetDashboard(employeeId);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-black/95">
                <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Cargando Operaciones...</p>
                </div>
            </div>
        );
    }

    // Helper para renderizar contenido de tarjetas de salida
    function renderCheckoutCardContent(room: Room) {
        const stay = room.room_stays?.find(s => s.status === 'ACTIVA');
        const checkinTime = stay?.check_in_at ? new Date(stay.check_in_at) : new Date();
        const durationH = Math.floor((new Date().getTime() - checkinTime.getTime()) / 3600000);
        const isRequested = !!stay?.vehicle_requested_at;
        const isValetRequested = !!stay?.valet_checkout_requested_at;

        return (
            <>
                <div className="flex justify-between items-start mb-3 relative z-10">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black tracking-tight drop-shadow-sm">{room.number}</span>
                            {stay?.vehicle_plate && (
                                <Badge variant="secondary" className="font-mono bg-white/20 border-white/30 text-white shadow-sm backdrop-blur-md px-2 py-0.5 text-xs">{stay.vehicle_plate}</Badge>
                            )}
                        </div>
                        <div className="flex items-center text-xs text-white/80 font-medium mt-1 gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{durationH}h estacionado</span>
                        </div>
                    </div>
                    {isRequested && <Badge className="bg-red-500/90 border border-red-400 text-white shadow-lg animate-pulse uppercase tracking-wider text-[10px]">Solicitado</Badge>}
                    {isValetRequested && <Badge className="bg-amber-500/90 border border-amber-400 text-white shadow-lg uppercase tracking-wider text-[10px]">Aviso Enviado</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 relative z-10">
                    {isRequested ? (
                        <Button onClick={() => handleOpenCheckout(room)} className="col-span-2 bg-red-600/90 hover:bg-red-500 text-white h-12 text-lg shadow-lg border border-red-500/50 rounded-xl active:scale-95 transition-all">
                            <LogOut className="h-5 w-5 mr-2" /> Entregar Vehículo
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => handlePropose(room)} disabled={isValetRequested || actionLoading} className="h-12 text-sm bg-white/10 hover:bg-white/20 border-white/20 text-white rounded-xl active:scale-95 transition-all shadow-sm" >
                                {isValetRequested ? "Avisado" : "Avisar Salida"}
                            </Button>
                            <Button onClick={() => handleOpenCheckout(room)} className="h-12 text-sm bg-primary/90 hover:bg-primary text-white border border-primary/50 shadow-lg rounded-xl active:scale-95 transition-all" >
                                <LogOut className="h-4 w-4 mr-2" /> Entregar
                            </Button>
                        </>
                    )}
                    
                    <Button 
                        variant="outline" 
                        onClick={() => { setSelectedRoom(room); setExtraChargeType('EXTRA_HOUR'); setShowExtraChargeModal(true); }}
                        className="h-10 text-xs border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 rounded-xl active:scale-95 transition-all" 
                    >
                        <Clock className="h-3.5 w-3.5 mr-1.5" /> Hora Extra
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={() => { setSelectedRoom(room); setExtraChargeType('EXTRA_PERSON'); setShowExtraChargeModal(true); }}
                        className="h-10 text-xs border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-200 rounded-xl active:scale-95 transition-all" 
                    >
                        <Users className="h-3.5 w-3.5 mr-1.5" /> Pers. Extra
                    </Button>
                </div>
            </>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] pb-24 text-slate-100 font-sans selection:bg-primary/30">
            {/* Header Premium Glassmorphism */}
            <div className="sticky top-0 z-40 bg-black/60 backdrop-blur-2xl border-b border-white/10 pt-safe px-4 pb-4 shadow-2xl">
                <div className="flex items-center justify-between pt-4 mb-5">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-sm">Operación Valet</h1>
                        <p className="text-[11px] uppercase tracking-widest text-primary/80 font-bold">{new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isSupported && (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={isSubscribed ? unsubscribe : subscribe}
                                disabled={pushLoading}
                                className={`h-10 w-10 rounded-full border-white/10 shadow-inner transition-all ${!isSubscribed ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse' : 'bg-white/5 text-white'}`}
                            >
                                {isSubscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                            </Button>
                        )}
                        {!isAudioReady && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={async () => {
                                    const ok = await unlockAudio(true);
                                    if (!ok) toast.error("No se pudo activar el sonido");
                                    else toast.success("Sonido activado");
                                }}
                                className="rounded-full shadow-lg bg-primary hover:bg-primary/90 text-white"
                            >
                                🔊 Sonido
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => fetchRooms()}
                            disabled={loading}
                            className="h-10 w-10 rounded-full bg-white/5 border-white/10 hover:bg-white/10 text-white shadow-inner transition-all active:scale-95"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-primary' : ''}`} />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/5 border border-blue-500/30 shadow-[0_4px_20px_rgba(59,130,246,0.15)] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-blue-500/10 blur-xl group-hover:bg-blue-500/20 transition-all"></div>
                        <Car className="h-5 w-5 mb-1.5 text-blue-400 relative z-10" />
                        <span className="text-2xl font-black leading-none text-white relative z-10">{entriesToAccept.length + myPendingEntries.length}</span>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-blue-300/80 mt-1 relative z-10">Entradas</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/30 shadow-[0_4px_20px_rgba(16,185,129,0.15)] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-emerald-500/10 blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
                        <CheckCircle2 className="h-5 w-5 mb-1.5 text-emerald-400 relative z-10" />
                        <span className="text-2xl font-black leading-none text-white relative z-10">{parkedVehicles.length}</span>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-300/80 mt-1 relative z-10">Custodia</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/5 border border-red-500/30 shadow-[0_4px_20px_rgba(239,68,68,0.15)] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-red-500/10 blur-xl group-hover:bg-red-500/20 transition-all"></div>
                        <LogOut className="h-5 w-5 mb-1.5 text-red-400 relative z-10" />
                        <span className="text-2xl font-black leading-none text-white relative z-10">{urgentCheckouts.length}</span>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-red-300/80 mt-1 relative z-10">Salidas</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/5 border border-amber-500/30 shadow-[0_4px_20px_rgba(245,158,11,0.15)] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-amber-500/10 blur-xl group-hover:bg-amber-500/20 transition-all"></div>
                        <ShoppingBag className="h-5 w-5 mb-1.5 text-amber-400 relative z-10" />
                        <span className="text-2xl font-black leading-none text-white relative z-10">{pendingConsumptions.length + myConsumptions.length}</span>
                        <span className="text-[9px] uppercase tracking-wider font-bold text-amber-300/80 mt-1 relative z-10">Servicios</span>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="tasks" className="w-full mt-4">
                <div className="px-4 mb-4">
                    <TabsList className="grid w-full grid-cols-2 h-14 p-1.5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-inner">
                        <TabsTrigger
                            value="tasks"
                            className="relative text-sm h-full rounded-xl data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-primary/50 border border-transparent transition-all duration-300 font-bold tracking-wide"
                        >
                            <Zap className="h-4 w-4 mr-2" />
                            TAREAS
                            {(entriesToAccept.length > 0 || urgentCheckouts.length > 0 || pendingConsumptions.length > 0) && (
                                <Badge className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1.5 flex items-center justify-center text-[10px] rounded-full bg-red-500 text-white border-2 border-[#0a0a0a] shadow-lg animate-pulse">
                                    {entriesToAccept.length + urgentCheckouts.length + pendingConsumptions.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger
                            value="parking"
                            className="text-sm h-full rounded-xl data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:border-white/20 border border-transparent text-muted-foreground transition-all duration-300 font-bold tracking-wide"
                        >
                            <LayoutGrid className="h-4 w-4 mr-2" />
                            GARAJE
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="px-4">
                    <TabsContent value="tasks" className="space-y-6 mt-0 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-4 duration-500 ease-out">
                        
                        {/* 1. Salidas Urgentes (PRIORIDAD ZERO) */}
                        {urgentCheckouts.length > 0 && (
                            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100 fill-mode-both">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="bg-red-500/20 p-1.5 rounded-lg border border-red-500/30">
                                        <LogOut className="h-4 w-4 text-red-400" />
                                    </div>
                                    <h2 className="text-sm uppercase tracking-widest font-black text-white/90">Salidas Urgentes</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {urgentCheckouts.map(room => (
                                        <Card key={room.id} className="relative overflow-hidden p-5 border-red-500/40 bg-gradient-to-br from-red-950/40 to-black backdrop-blur-xl shadow-[0_8px_30px_rgba(239,68,68,0.15)] rounded-2xl group">
                                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/20 rounded-full blur-[50px] pointer-events-none group-hover:bg-red-600/30 transition-colors" />
                                            {renderCheckoutCardContent(room)}
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* 2. Entradas (Nueva + Mías) */}
                        {(entriesToAccept.length > 0 || myPendingEntries.length > 0) && (
                            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-150 fill-mode-both">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="bg-blue-500/20 p-1.5 rounded-lg border border-blue-500/30">
                                        <Car className="h-4 w-4 text-blue-400" />
                                    </div>
                                    <h2 className="text-sm uppercase tracking-widest font-black text-white/90">Entradas Pendientes</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {entriesToAccept.map(room => (
                                        <Card key={room.id} className="relative overflow-hidden p-5 border-blue-500/30 bg-gradient-to-br from-blue-950/40 to-black backdrop-blur-xl shadow-[0_8px_30px_rgba(59,130,246,0.1)] rounded-2xl group">
                                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/20 rounded-full blur-[50px] pointer-events-none group-hover:bg-blue-600/30 transition-colors" />
                                            <div className="flex justify-between items-center mb-5 relative z-10">
                                                <span className="text-3xl font-black tracking-tighter drop-shadow-sm">{room.number}</span>
                                                <Badge variant="outline" className="bg-blue-500/10 text-blue-300 border-blue-500/30 px-3 py-1 rounded-full uppercase tracking-wider text-[10px] font-bold">Nueva</Badge>
                                            </div>
                                            <Button onClick={() => handleAcceptEntryWrapper(room)} className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg border border-blue-400/50 text-lg font-bold active:scale-95 transition-all relative z-10">
                                                <CheckCircle2 className="h-5 w-5 mr-2" /> Aceptar Recepción
                                            </Button>
                                        </Card>
                                    ))}
                                    {myPendingEntries.map(room => (
                                        <Card key={room.id} className="relative overflow-hidden p-5 border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-black backdrop-blur-xl shadow-[0_8px_30px_rgba(168,85,247,0.1)] rounded-2xl group">
                                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-600/20 rounded-full blur-[50px] pointer-events-none group-hover:bg-purple-600/30 transition-colors" />
                                            <div className="flex justify-between items-center mb-5 relative z-10">
                                                <span className="text-3xl font-black tracking-tighter drop-shadow-sm">{room.number}</span>
                                                <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full uppercase tracking-wider text-[10px] font-bold shadow-inner">Mis Asignaciones</Badge>
                                            </div>
                                            <Button onClick={() => handleOpenCheckIn(room)} className="w-full h-14 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-lg border border-purple-400/50 text-lg font-bold active:scale-95 transition-all relative z-10">
                                                <Car className="h-5 w-5 mr-2" /> Registrar Auto
                                            </Button>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* 3. Servicios (Mis Entregas + Pendientes) */}
                        {(pendingConsumptions.length > 0 || myConsumptions.length > 0) && (
                            <section className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-200 fill-mode-both">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="bg-amber-500/20 p-1.5 rounded-lg border border-amber-500/30">
                                        <ShoppingBag className="h-4 w-4 text-amber-400" />
                                    </div>
                                    <h2 className="text-sm uppercase tracking-widest font-black text-white/90">Servicios a Habitación</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Mis Entregas */}
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
                                                if (next.has(cardKey)) next.delete(cardKey);
                                                else next.add(cardKey);
                                                return next;
                                            });
                                        };

                                        return (
                                            <Card key={cardKey} className="relative overflow-hidden p-1 border-orange-500/30 bg-gradient-to-b from-orange-950/40 to-black/80 backdrop-blur-xl shadow-lg rounded-2xl">
                                                <div 
                                                    className="p-4 flex justify-between items-center cursor-pointer select-none"
                                                    onClick={toggleExpand}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-orange-500/20 h-10 w-10 rounded-xl flex items-center justify-center border border-orange-500/30">
                                                            <span className="font-black text-lg text-orange-400">{roomNumber}</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-white/60 uppercase tracking-widest">Entrega Activa</span>
                                                            <span className="text-sm font-bold text-orange-200">{items.length} productos</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-lg">Mis Entregas</div>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-white">
                                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </div>

                                                {isExpanded && (
                                                    <div className="px-4 pb-4 animate-in slide-in-from-top-2 fade-in duration-200">
                                                        {items.filter((i: any) => i.delivery_status === 'IN_TRANSIT').length > 1 && (
                                                            <Button
                                                                className="w-full h-12 mb-3 bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-lg border border-emerald-500/50 rounded-xl font-bold active:scale-95 transition-all"
                                                                onClick={(e) => { e.stopPropagation(); openBulkConfirmModal(items, roomNumber); }}
                                                            >
                                                                <CheckCircle2 className="h-5 w-5 mr-2" />
                                                                Confirmar Todos ({items.filter((i: any) => i.delivery_status === 'IN_TRANSIT').length})
                                                            </Button>
                                                        )}
                                                        <div className="space-y-2">
                                                            {items.map((item: any) => {
                                                                const isInTransit = item.delivery_status === 'IN_TRANSIT';
                                                                return (
                                                                    <div key={item.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white/5 border border-white/5 p-3 rounded-xl">
                                                                        <div className="flex-1">
                                                                            <span className="text-sm font-bold text-white/90">{item.qty}x {item.products?.name}</span>
                                                                            <span className="ml-2 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-xs">{formatCurrency(item.total)}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                                                            {isInTransit ? (
                                                                                <Button size="sm" className="flex-1 sm:flex-none h-10 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 shadow-md font-bold active:scale-95 transition-all" onClick={(e) => { e.stopPropagation(); setSelectedConsumption(item); setShowDeliveryModal(true); }}>
                                                                                    Confirmar
                                                                                </Button>
                                                                            ) : (
                                                                                <span className="text-xs text-white/40 font-medium px-3 flex-1 sm:flex-none text-center">Esperando preparación...</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </Card>
                                        );
                                    })}

                                    {/* Pendientes Generales */}
                                    {Object.entries(
                                        pendingConsumptions.reduce((acc: Record<string, any[]>, item) => {
                                            const roomNumber = item.sales_orders?.room_stays[0]?.rooms?.number || '??';
                                            if (!acc[roomNumber]) acc[roomNumber] = [];
                                            acc[roomNumber].push(item);
                                            return acc;
                                        }, {})
                                    ).map(([roomNumber, items]) => (
                                        <Card key={`gen-${roomNumber}`} className="relative overflow-hidden p-5 border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-black backdrop-blur-xl shadow-lg rounded-2xl">
                                            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-3xl font-black drop-shadow-sm text-white">{roomNumber}</span>
                                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 uppercase tracking-wider text-[10px] font-bold">En Cocina</Badge>
                                                </div>
                                                <span className="text-sm font-bold text-white/60">{items.length} items</span>
                                            </div>

                                            {items.length > 1 && (
                                                <Button
                                                    className="w-full h-12 mb-4 bg-amber-600/90 hover:bg-amber-500 text-white shadow-lg border border-amber-500/50 rounded-xl font-bold active:scale-95 transition-all"
                                                    onClick={() => handleAcceptAllConsumptionsWrapper(items, roomNumber)}
                                                >
                                                    <CheckCircle2 className="h-5 w-5 mr-2" />
                                                    Llevar Todo ({items.length})
                                                </Button>
                                            )}

                                            <div className="space-y-2">
                                                {items.map((item: any) => (
                                                    <div key={item.id} className="flex flex-col justify-between gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
                                                        <span className="text-sm font-medium text-white/90">{item.qty}x {item.products?.name}</span>
                                                        <Button size="sm" variant="outline" className="w-full h-10 rounded-lg border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 active:scale-95 font-bold" onClick={() => handleAcceptConsumptionWrapper(item.id, roomNumber)}>
                                                            Llevar
                                                        </Button>
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
                            <div className="text-center py-20 flex flex-col items-center justify-center opacity-40 animate-in fade-in duration-700">
                                <div className="bg-white/5 p-6 rounded-full mb-6 border border-white/10 shadow-inner">
                                    <CheckCircle2 className="h-16 w-16 text-emerald-500" />
                                </div>
                                <h3 className="text-2xl font-black tracking-tight text-white mb-2">Todo al día</h3>
                                <p className="text-sm uppercase tracking-widest font-bold">No hay tareas pendientes</p>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="parking" className="mt-0 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-4 duration-500 ease-out">
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h2 className="text-sm uppercase tracking-widest font-black text-white/90 flex items-center gap-2">
                                <LayoutGrid className="h-4 w-4 text-emerald-400" /> Estacionamiento
                            </h2>
                            <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg">{parkedVehicles.length} Custodiados</Badge>
                        </div>

                        {parkedVehicles.length === 0 ? (
                            <div className="text-center py-20 flex flex-col items-center justify-center opacity-40">
                                <div className="bg-white/5 p-6 rounded-full mb-6 border border-white/10 shadow-inner">
                                    <Car className="h-16 w-16 text-white/50" />
                                </div>
                                <h3 className="text-2xl font-black tracking-tight text-white mb-2">Garaje Vacío</h3>
                                <p className="text-sm uppercase tracking-widest font-bold">No hay vehículos registrados</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {parkedVehicles.map(room => (
                                    <Card key={room.id} className="relative overflow-hidden p-5 border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-md shadow-lg rounded-2xl hover:border-white/20 transition-all">
                                        {renderCheckoutCardContent(room)}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </div>
            </Tabs>

            {/* Modals remain the same functionally, adapted to dark mode context */}
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
            <ValetExtraChargeModal
                isOpen={showExtraChargeModal}
                onClose={() => setShowExtraChargeModal(false)}
                type={extraChargeType}
                room={selectedRoom as any}
                employeeId={employeeId}
                onConfirm={extraChargeType === 'EXTRA_HOUR' ? handleRegisterExtraHour : handleRegisterExtraPerson}
            />

            <ValetDeliveryConfirmModal
                isOpen={showDeliveryModal}
                onClose={() => {
                    setShowDeliveryModal(false);
                    setSelectedConsumption(null);
                }}
                consumption={selectedConsumption}
                employeeId={employeeId}
                onConfirmed={() => {}}
                onConfirmDelivery={handleConfirmDelivery}
            />

            <AlertDialog open={!!bulkConfirmItems} onOpenChange={(open) => !open && setBulkConfirmItems(null)}>
                <AlertDialogContent className="bg-[#0a0a0a]/95 backdrop-blur-2xl border-white/10 text-white rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-3 text-2xl font-black">
                            <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/30">
                                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                            </div>
                            Confirmar Entrega
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-white/60 font-medium">
                            Se confirmará la entrega masiva a la Habitación {bulkConfirmItems?.roomNumber}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {bulkConfirmItems && (
                        <div className="py-4">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 max-h-48 overflow-auto shadow-inner">
                                {bulkConfirmItems.items.map((item: any) => (
                                    <div key={item.id} className="flex justify-between items-center text-sm">
                                        <span className="font-bold text-white/90">{item.qty}x {item.products?.name}</span>
                                        <span className="text-emerald-400 font-black bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">{formatCurrency(item.total)}</span>
                                    </div>
                                ))}
                                <div className="border-t border-white/10 pt-3 mt-3 flex justify-between font-black text-lg">
                                    <span>Total ({bulkConfirmItems.items.length}):</span>
                                    <span className="text-emerald-400">
                                        {formatCurrency(bulkConfirmItems.items.reduce((sum: number, i: any) => sum + Number(i.total), 0))}
                                    </span>
                                </div>
                            </div>
                            <p className="text-[10px] uppercase tracking-widest text-amber-400/80 font-bold mt-4 text-center">
                                ⚠️ Asegúrate de entregar el efectivo en recepción
                            </p>
                        </div>
                    )}

                    <AlertDialogFooter className="sm:justify-center">
                        <AlertDialogCancel disabled={bulkConfirmLoading} className="rounded-xl border-white/10 hover:bg-white/5 text-white w-full sm:w-auto h-12">
                            Cancelar
                        </AlertDialogCancel>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg h-12 w-full sm:w-auto px-8"
                            onClick={handleConfirmAllDeliveriesWrapper}
                            disabled={bulkConfirmLoading}
                        >
                            {bulkConfirmLoading ? (
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            ) : (
                                <CheckCircle2 className="h-5 w-5 mr-2" />
                            )}
                            Confirmar
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
