"use client";

import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, X, AlertTriangle, Info, DollarSign, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications, type Notification } from "@/hooks/use-notifications";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
            return 'bg-muted border-border';
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

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

export function NotificationCenter() {
    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        archiveNotification,
        deleteNotification
    } = useNotifications();

    const [open, setOpen] = useState(false);

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }

        if (notification.action_url) {
            setOpen(false);
        }
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button id="tour-notifications" variant="ghost" size="icon" className="relative h-10 w-10">
                    <Bell className="h-6 w-6" />
                    {unreadCount > 0 && (
                        <Badge
                            className="absolute -top-1.5 -right-1.5 h-6 w-6 flex items-center justify-center p-0 text-xs font-bold"
                            variant="destructive"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-[480px] max-h-[700px] overflow-hidden flex flex-col">
                {/* Header */}
                <DropdownMenuLabel className="flex items-center justify-between border-b pb-3 pt-2 px-4">
                    <span className="font-bold text-lg">Notificaciones</span>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto py-1.5 px-3 text-sm"
                            onClick={markAllAsRead}
                        >
                            <CheckCheck className="h-4 w-4 mr-1.5" />
                            Marcar todas
                        </Button>
                    )}
                </DropdownMenuLabel>

                {/* Content */}
                <div className="overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 text-center">
                            <Bell className="h-14 w-14 text-muted-foreground mb-4 opacity-50" />
                            <p className="text-muted-foreground text-base">
                                No tienes notificaciones
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1 py-3">
                            {notifications.map((notification) => {
                                const content = (
                                    <div className="flex gap-4">
                                        {/* Icon */}
                                        <div className="flex-shrink-0 mt-0.5">
                                            {getNotificationIcon(notification.type)}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={cn(
                                                    "text-base font-medium",
                                                    !notification.is_read && "font-bold"
                                                )}>
                                                    {notification.title}
                                                </p>
                                                {!notification.is_read && (
                                                    <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                                                )}
                                            </div>

                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                                                {notification.message}
                                            </p>

                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-sm text-muted-foreground">
                                                    {formatTimeAgo(notification.created_at)}
                                                </span>

                                                <div className="flex gap-1">
                                                    {!notification.is_read && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                markAsRead(notification.id);
                                                            }}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            archiveNotification(notification.id);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );

                                return notification.action_url ? (
                                    <Link
                                        key={notification.id}
                                        href={notification.action_url}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={cn(
                                            "block px-4 py-3.5 border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer",
                                            !notification.is_read && "bg-muted/30"
                                        )}
                                    >
                                        {content}
                                    </Link>
                                ) : (
                                    <div
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={cn(
                                            "block px-4 py-3.5 border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer",
                                            !notification.is_read && "bg-muted/30"
                                        )}
                                    >
                                        {content}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <div className="p-2">
                            <Link href="/notifications" onClick={() => setOpen(false)}>
                                <Button variant="ghost" className="w-full text-sm font-medium">
                                    Ver todas las notificaciones
                                </Button>
                            </Link>
                        </div>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
