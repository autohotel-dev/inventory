/**
 * Welcome Section Component
 * Displays guest information and check-in/check-out details
 */

'use client';

import { Clock, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface WelcomeSectionProps {
    roomStay: {
        check_in_at?: string | null;
        expected_check_out_at?: string | null;
        current_people?: number;
        total_people?: number;
        rooms?: Array<{
            number: string;
            room_types?: Array<{
                name: string;
                is_hotel?: boolean;
            }> | null;
        }> | null;
        sales_orders?: Array<{
            customer_name?: string;
        }> | null;
    };
}

export function WelcomeSection({ roomStay }: WelcomeSectionProps) {
    const room = roomStay.rooms && roomStay.rooms.length > 0 ? roomStay.rooms[0] : null;
    const roomType = room?.room_types && room.room_types.length > 0 ? room.room_types[0] : null;
    const salesOrder = roomStay.sales_orders && roomStay.sales_orders.length > 0 ? roomStay.sales_orders[0] : null;
    const customerName = salesOrder?.customer_name;

    const checkInTime = roomStay.check_in_at
        ? format(new Date(roomStay.check_in_at), 'PPp', { locale: es })
        : 'No disponible';

    const checkOutTime = roomStay.expected_check_out_at
        ? format(new Date(roomStay.expected_check_out_at), 'PPp', { locale: es })
        : 'No disponible';

    return (
        <div className="bg-gradient-to-br from-blue-950/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-8 border border-blue-500/20 shadow-2xl">
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-2">
                        {customerName ? `¡Bienvenido ${customerName}!` : '¡Bienvenido!'}
                    </h2>
                    <p className="text-blue-300 text-lg">
                        Esperamos que disfrute su estancia en nuestra{' '}
                        {roomType?.name || 'habitación'}
                    </p>
                </div>
                <div className="bg-blue-500/20 rounded-xl p-4">
                    <span className="text-4xl">👋</span>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Check-in */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-green-500/20 rounded-lg p-2">
                            <Calendar className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <p className="text-white/60 text-sm">Check-in</p>
                            <p className="text-white font-semibold text-sm">{checkInTime}</p>
                        </div>
                    </div>
                </div>

                {/* Check-out */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-red-500/20 rounded-lg p-2">
                            <Clock className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <p className="text-white/60 text-sm">Check-out esperado</p>
                            <p className="text-white font-semibold text-sm">{checkOutTime}</p>
                        </div>
                    </div>
                </div>

                {/* Occupancy */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-500/20 rounded-lg p-2">
                            <Users className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-white/60 text-sm">Ocupantes</p>
                            <p className="text-white font-semibold text-sm">
                                {roomStay.current_people || roomStay.total_people || 1} persona(s)
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Contact Info */}
            <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-white/80 text-sm">
                    🏨 <span className="font-semibold">Recepción 24 horas</span> - Estamos aquí para ayudarle
                </p>
            </div>
        </div>
    );
}
