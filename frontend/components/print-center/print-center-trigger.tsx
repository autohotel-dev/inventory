"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrintCenter } from "@/contexts/print-center-context";

export function PrintCenterTrigger() {
  const { openPrintCenter } = usePrintCenter();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => openPrintCenter()}
      className="relative h-9 w-9 rounded-xl hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-100 transition-colors"
      title="Centro de Impresión (Ctrl+P)"
    >
      <Printer className="h-[1.1rem] w-[1.1rem]" />
      <span className="sr-only">Abrir Centro de Impresión</span>
    </Button>
  );
}
