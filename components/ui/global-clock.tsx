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
        <div className="w-full flex justify-center md:justify-end mb-4">
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl shadow-sm px-6 py-3">
                <div className="flex flex-col items-center md:items-end gap-0.5">
                    <div className="text-3xl md:text-2xl font-bold tabular-nums tracking-tight text-foreground">
                        {formatTime(time)}
                    </div>
                    <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                        {formatDate(time)}
                    </div>
                </div>
            </div>
        </div>
    );
}
