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
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl shadow-sm px-4 py-2">
            <div className="flex flex-col items-end gap-0.5">
                <div className="text-xl font-bold tabular-nums tracking-tight text-foreground leading-none">
                    {formatTime(time)}
                </div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider leading-none">
                    {formatDate(time)}
                </div>
            </div>
        </div>
    );
}
