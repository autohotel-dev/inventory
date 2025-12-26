"use client";

import { useEffect, useState } from "react";

export function GlobalClock() {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString("es-MX", {
            weekday: "short",
            day: "numeric",
            month: "short",
        });
    };

    return (
        <div className="fixed top-4 right-4 z-50 pointer-events-none">
            <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-4 py-2">
                <div className="flex flex-col items-end gap-0.5">
                    <div className="text-2xl font-bold tabular-nums tracking-tight">
                        {formatTime(time)}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                        {formatDate(time)}
                    </div>
                </div>
            </div>
        </div>
    );
}
