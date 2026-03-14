"use client";

import { Button } from "@/components/ui/button";
import { Car, Loader2 } from "lucide-react";

interface WaitingForValetViewProps {
  onClose: () => void;
}

export function WaitingForValetView({ onClose }: WaitingForValetViewProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-[400px] space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full animate-pulse"></div>
        <div className="relative bg-zinc-900 border-2 border-orange-500/30 p-8 rounded-full shadow-2xl">
          <Car className="h-16 w-16 text-orange-500 animate-bounce" />
        </div>
      </div>
      
      <div className="max-w-md space-y-2">
        <h3 className="text-2xl font-black uppercase tracking-tighter text-white">
          Esperando Información del Cochero
        </h3>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Esta habitación fue registrada mediante <span className="text-orange-400 font-bold italic">Entrada Rápida</span>. 
          Recepción no puede realizar cobros ni modificaciones hasta que el cochero complete el registro del vehículo y el pago inicial.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        <div className="flex items-center gap-2 justify-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
          <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
          <span className="text-[10px] uppercase font-black text-orange-500 tracking-widest">Sincronizando flujo...</span>
        </div>
        <Button 
          variant="outline" 
          className="border-zinc-800 hover:bg-zinc-800 text-zinc-400"
          onClick={onClose}
        >
          Cerrar y esperar
        </Button>
      </div>
    </div>
  );
}
