/**
 * Services Showcase Component
 * Displays available hotel services in an attractive layout
 */

'use client';

import { Utensils, Wifi, Car, Coffee, Droplets, Clock } from 'lucide-react';

const services = [
    {
        icon: Utensils,
        title: 'Restaurante',
        description: 'Disfruta de nuestra deliciosa cocina',
        hours: '7:00 AM - 10:00 PM',
        color: 'from-orange-500 to-red-500',
    },
    {
        icon: Wifi,
        title: 'WiFi Gratis',
        description: 'Internet de alta velocidad',
        hours: 'Ilimitado',
        color: 'from-blue-500 to-cyan-500',
    },
    {
        icon: Car,
        title: 'Estacionamiento',
        description: 'Amplio y seguro',
        hours: '24 horas',
        color: 'from-purple-500 to-pink-500',
    },
    {
        icon: Coffee,
        title: 'Room Service',
        description: 'Servicio a la habitación',
        hours: '24 horas',
        color: 'from-amber-500 to-yellow-500',
    },
    {
        icon: Droplets,
        title: 'Agua Caliente',
        description: 'Disponible todo el día',
        hours: '24 horas',
        color: 'from-teal-500 to-emerald-500',
    },
    {
        icon: Clock,
        title: 'Recepción',
        description: 'Atención personalizada',
        hours: '24 horas',
        color: 'from-indigo-500 to-violet-500',
    },
];

export function ServicesShowcase() {
    return (
        <div>
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-2">Nuestros Servicios</h2>
                <p className="text-blue-300">Todo lo que necesitas durante tu estancia</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((service, index) => {
                    const Icon = service.icon;
                    return (
                        <div
                            key={index}
                            className="group bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-white/30 transition-all hover:scale-105 hover:shadow-2xl"
                        >
                            <div className="flex items-start gap-4">
                                <div
                                    className={`bg-gradient-to-br ${service.color} rounded-xl p-3 group-hover:scale-110 transition-transform`}
                                >
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-white mb-1">{service.title}</h3>
                                    <p className="text-white/60 text-sm mb-2">{service.description}</p>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                        <span className="text-green-400 text-xs font-semibold">
                                            {service.hours}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Call to Action */}
            <div className="mt-8 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl p-6 border border-blue-500/30 backdrop-blur-sm">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1">
                            ¿Necesitas algo más?
                        </h3>
                        <p className="text-white/70 text-sm">
                            Estamos aquí para hacer tu estancia perfecta
                        </p>
                    </div>
                    <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all hover:scale-105">
                        Contactar Recepción
                    </button>
                </div>
            </div>
        </div>
    );
}
