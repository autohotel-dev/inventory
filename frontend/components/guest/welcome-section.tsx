/**
 * Welcome Section Component
 * Displays guest information and check-in/check-out details
 */

'use client';

import { Clock, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Define types that match the polymorphic response from Supabase (Array or Object)
type Polymorphic<T> = T | T[];

interface WelcomeSectionProps {
    roomStay: {
        check_in_at?: string | null;
        expected_check_out_at?: string | null;
        current_people?: number;
        total_people?: number;
        rooms?: Polymorphic<{
            number: string;
            room_types?: Polymorphic<{
                name: string;
                is_hotel?: boolean;
            }> | null;
        }> | null;
        sales_orders?: any;
    };
}

export function WelcomeSection({ roomStay }: WelcomeSectionProps) {
    // Generic helper to safely get first item or object
    const getFirst = <T,>(item: Polymorphic<T> | null | undefined): T | null => {
        if (!item) return null;
        if (Array.isArray(item)) {
            return item.length > 0 ? item[0] : null;
        }
        return item as T;
    };

    const room = getFirst(roomStay.rooms);
    const roomType = getFirst(room?.room_types);
    const salesOrder = getFirst(roomStay.sales_orders);
    const customer = getFirst(salesOrder?.customers);

    // Check for nested customer object first, then fallback
    const customerName = customer?.name || salesOrder?.customer_name;

    const checkInTime = roomStay.check_in_at
        ? format(new Date(roomStay.check_in_at), 'PPp', { locale: es })
        : 'No disponible';

    const checkOutTime = roomStay.expected_check_out_at
        ? format(new Date(roomStay.expected_check_out_at), 'PPp', { locale: es })
        : 'No disponible';

    return (
        <div className="relative overflow-hidden bg-neutral-900/40 backdrop-blur-xl rounded-3xl p-8 border border-white/5 shadow-2xl">
            {/* Pattern Overlay */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>

            <div className="relative z-10 flex items-start justify-between mb-10">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-red/10 border border-brand-red/20 mb-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-red"></span>
                        <span className="text-xs font-medium text-brand-red uppercase tracking-wider">Estancia Actual</span>
                    </div>
                    <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">
                        {customerName ? (
                            <>Hola, <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">{customerName}</span></>
                        ) : 'Bienvenido'}
                    </h2>
                    <p className="text-neutral-400 text-lg font-light">
                        Disfruta de tu estancia en la <span className="text-white font-medium">{roomType?.name || 'habitación'}</span>
                    </p>
                </div>
            </div>

            {/* Info Cards */}
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Check-in */}
                <div className="group bg-black/20 rounded-2xl p-5 border border-white/5 hover:border-brand-red/20 transition-all duration-300">
                    <div className="flex items-start justify-between mb-8">
                        <div className="p-2.5 rounded-xl bg-neutral-800/50 group-hover:bg-brand-red/10 transition-colors">
                            <Calendar className="w-5 h-5 text-neutral-400 group-hover:text-brand-red transition-colors" />
                        </div>
                        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Inicio</span>
                    </div>
                    <div>
                        <p className="text-xl font-semibold text-white mb-1">{checkInTime}</p>
                        <p className="text-neutral-500 text-xs">Hora de registro</p>
                    </div>
                </div>

                {/* Check-out */}
                <div className="group bg-black/20 rounded-2xl p-5 border border-white/5 hover:border-brand-red/20 transition-all duration-300">
                    <div className="flex items-start justify-between mb-8">
                        <div className="p-2.5 rounded-xl bg-neutral-800/50 group-hover:bg-brand-red/10 transition-colors">
                            <Clock className="w-5 h-5 text-neutral-400 group-hover:text-brand-red transition-colors" />
                        </div>
                        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Salida</span>
                    </div>
                    <div>
                        <p className="text-xl font-semibold text-white mb-1">{checkOutTime}</p>
                        <p className="text-neutral-500 text-xs">Hora límite</p>
                    </div>
                </div>

                {/* Occupancy */}
                <div className="group bg-black/20 rounded-2xl p-5 border border-white/5 hover:border-brand-red/20 transition-all duration-300">
                    <div className="flex items-start justify-between mb-8">
                        <div className="p-2.5 rounded-xl bg-neutral-800/50 group-hover:bg-brand-red/10 transition-colors">
                            <Users className="w-5 h-5 text-neutral-400 group-hover:text-brand-red transition-colors" />
                        </div>
                        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Huéspedes</span>
                    </div>
                    <div>
                        <p className="text-xl font-semibold text-white mb-1">
                            {roomStay.current_people || roomStay.total_people || 1} <span className="text-sm font-normal text-neutral-500">Personas</span>
                        </p>
                        <p className="text-neutral-500 text-xs">Ocupación actual</p>
                    </div>
                </div>
            </div>

            {/* Contact Info */}
            <div className="relative z-10 mt-6 pt-6 border-t border-white/5">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-neutral-400">Recepción disponible</span>
                    </div>
                    <span className="text-white font-mono bg-white/5 px-2 py-1 rounded text-xs">24/7</span>
                </div>
            </div>
        </div>
    );
}
