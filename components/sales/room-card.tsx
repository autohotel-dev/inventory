"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Info, MoreVertical } from "lucide-react";

export type RoomCardStatus = "LIBRE" | "OCUPADA" | "SUCIA" | "BLOQUEADA" | string;

export interface RoomCardProps {
  id: string;
  number: string;
  status: RoomCardStatus;
  bgClass: string;
  accentClass?: string;
  statusBadge: ReactNode;
  onInfo: () => void;
  onActions: () => void;
}

export function RoomCard({
  number,
  status,
  bgClass,
  accentClass,
  statusBadge,
  onInfo,
  onActions,
}: RoomCardProps) {
  return (
    <div
      className={`border border-white/5 rounded-lg px-3 py-2 text-sm flex flex-col justify-between h-20 cursor-pointer shadow-sm hover:shadow-md hover:border-white/20 backdrop-blur-sm transition-colors ${
        bgClass || "bg-slate-900/80"
      } ${accentClass || ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-base leading-none">{number}</span>
        {statusBadge}
      </div>
      <div className="flex items-center justify-end gap-1 mt-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 rounded-full bg-transparent hover:bg-white/10 text-white/80 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onInfo();
          }}
          aria-label={`Información habitación ${number}`}
        >
          <Info className="h-3 w-3 text-white" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 rounded-full bg-transparent hover:bg-white/10 text-white/80 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onActions();
          }}
          aria-label={`Acciones habitación ${number}`}
        >
          <MoreVertical className="h-3 w-3 text-white" />
        </Button>
      </div>
    </div>
  );
}
