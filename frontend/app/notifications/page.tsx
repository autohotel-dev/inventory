"use client";

import { useState } from "react";
import { Package, DollarSign, AlertTriangle, Info, Check, CheckCheck, Trash2, Archive, Search } from "lucide-react";
import { useNotifications, type Notification } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";


const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
        case 'stock_low':
        case 'stock_critical':
            return <AlertTriangle className="h-5 w-5 text-orange-600" />;
        case 'order_pending':
            return <Package className="h-5 w-5 text-blue-600" />;
        case 'payment_due':
            return <DollarSign className="h-5 w-5 text-green-600" />;
        default:
            return <Info className="h-5 w-5 text-blue-600" />;
    }
};

const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
        case 'stock_critical':
            return 'bg-red-50 dark:bg-red-950/20 border-red-200';
        case 'stock_low':
            return 'bg-orange-50 dark:bg-orange-950/20 border-orange-200';
        case 'order_pending':
            return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200';
        case 'payment_due':
            return 'bg-green-50 dark:bg-green-950/20 border-green-200';
        default:
            return 'bg-muted/40 border-border';
    }
};

const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Justo ahora';
    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function NotificationsPage() {
    const router = useRouter();
    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        archiveNotification
    } = useNotifications();

    const [activeTab, setActiveTab] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredNotifications = notifications.filter(notification => {
        const matchesTab = activeTab === "all" || (activeTab === "unread" && !notification.is_read);
        const matchesSearch = notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            notification.message.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesSearch;
    });

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }

        if (notification.action_url) {
            router.push(notification.action_url);
        }
    };

    return (
        <div className="container mx-auto py-6 max-w-4xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Notificaciones</h1>
                    <p className="text-muted-foreground mt-1">
                        Gestiona tus alertas y recordatorios del sistema.
                    </p>
                </div>

                {unreadCount > 0 && (
                    <Button onClick={markAllAsRead} variant="outline" size="sm" className="whitespace-nowrap">
                        <CheckCheck className="mr-2 h-4 w-4" />
                        Marcar todo como leído
                    </Button>
                )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
                <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
                    <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:flex">
                        <TabsTrigger value="all" className="flex-1 sm:flex-none">Todas</TabsTrigger>
                        <TabsTrigger value="unread" className="flex-1 sm:flex-none">
                            No leídas
                            {unreadCount > 0 && (
                                <Badge variant="secondary" className="ml-2 h-5 min-w-[1.25rem] px-1">
                                    {unreadCount}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar notificaciones..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                            <p>Cargando notificaciones...</p>
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                            <div className="bg-muted/50 p-4 rounded-full mb-4">
                                <Archive className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold">No hay notificaciones</h3>
                            <p className="text-muted-foreground max-w-sm mt-1">
                                {searchQuery
                                    ? "No se encontraron resultados para tu búsqueda."
                                    : activeTab === "unread"
                                        ? "¡Estás al día! No tienes notificaciones sin leer."
                                        : "No tienes notificaciones en este momento."}
                            </p>
                            {searchQuery && (
                                <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2">
                                    Limpiar búsqueda
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filteredNotifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={cn(
                                        "group relative flex gap-4 p-4 transition-colors hover:bg-muted/40",
                                        !notification.is_read ? "bg-muted/20" : ""
                                    )}
                                >
                                    {/* Status Indicator Bar */}
                                    {!notification.is_read && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                                    )}

                                    {/* Icon */}
                                    <div className={cn(
                                        "flex-shrink-0 mt-1 h-10 w-10 rounded-full flex items-center justify-center border",
                                        getNotificationColor(notification.type)
                                    )}>
                                        {getNotificationIcon(notification.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleNotificationClick(notification)}>
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h4 className={cn("text-base font-semibold leading-none", !notification.is_read && "text-foreground")}>
                                                {notification.title}
                                            </h4>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                                {formatTimeAgo(notification.created_at)}
                                            </span>
                                        </div>

                                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2 group-hover:line-clamp-none transition-all">
                                            {notification.message}
                                        </p>

                                        {notification.action_url && (
                                            <div className="flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 mt-1">
                                                Ver detalles <span className="ml-1">→</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-1 self-start opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                                        {!notification.is_read && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                title="Marcar como leída"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    markAsRead(notification.id);
                                                }}
                                            >
                                                <Check className="h-4 w-4" />
                                                <span className="sr-only">Marcar como leída</span>
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                                            title="Eliminar"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Assuming archive behave as delete/hide from view based on the hook usage in notification-center
                                                archiveNotification(notification.id);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Eliminar</span>
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
