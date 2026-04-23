"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Users, Tv, Key, Wind } from "lucide-react";
import { Room } from "@/components/sales/room-types";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface AssignAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  assetType?: string;
  onSuccess?: () => void;
}

export function AssignAssetModal({ isOpen, onClose, room, assetType = 'TV_REMOTE', onSuccess }: AssignAssetModalProps) {
  const [cocheros, setCocheros] = useState<Employee[]>([]);
  const [selectedCochero, setSelectedCochero] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCocheros, setLoadingCocheros] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchActiveCocheros();
    }
  }, [isOpen]);

  const fetchActiveCocheros = async () => {
    setLoadingCocheros(true);
    const supabase = createClient();
    try {
      // In a real system, you might only want to fetch active shift sessions.
      // For now, let's fetch employees with role 'cochero'
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, role')
        .eq('is_active', true)
        .ilike('role', '%cochero%');

      if (error) throw error;
      setCocheros(data || []);
    } catch (error) {
      console.error("Error fetching cocheros:", error);
      toast.error("Error al obtener cocheros");
    } finally {
      setLoadingCocheros(false);
    }
  };

  const handleAssign = async () => {
    if (!room || !selectedCochero) return;
    setLoading(true);
    const supabase = createClient();

    try {
      // Usar session actual para saber quién hace la acción
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.rpc('assign_asset_to_employee', {
        p_room_id: room.id,
        p_asset_type: assetType,
        p_employee_id: selectedCochero,
        p_action_by_employee_id: session?.user?.id || null
      });

      if (error) throw error;
      
      toast.success("Control asignado al cochero correctamente.");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error assigning asset:", error);
      toast.error("Hubo un error al asignar el control.");
    } finally {
      setLoading(false);
    }
  };

  const getAssetIcon = () => {
    switch (assetType) {
      case 'TV_REMOTE': return <Tv className="h-10 w-10 text-primary" />;
      case 'AC_REMOTE': return <Wind className="h-10 w-10 text-sky-400" />;
      case 'KEY': return <Key className="h-10 w-10 text-amber-400" />;
      default: return <Tv className="h-10 w-10 text-primary" />;
    }
  };

  const getAssetName = () => {
    switch (assetType) {
      case 'TV_REMOTE': return 'Control de TV';
      case 'AC_REMOTE': return 'Control de A/C';
      case 'KEY': return 'Llave';
      default: return 'Activo';
    }
  };

  if (!room) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border border-white/10 text-white rounded-3xl">
        <DialogHeader>
          <div className="mx-auto bg-primary/20 p-4 rounded-full border border-primary/30 shadow-[0_0_20px_-5px_var(--primary)] mb-4">
            {getAssetIcon()}
          </div>
          <DialogTitle className="text-2xl font-black text-center italic tracking-tight">
            Asignar {getAssetName()}
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-400">
            Habitación {room.number}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-zinc-400 font-bold mb-3 uppercase tracking-widest text-center">Selecciona al Cochero en turno:</p>
          
          {loadingCocheros ? (
            <div className="flex justify-center p-4">
              <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
            </div>
          ) : cocheros.length === 0 ? (
            <div className="text-center p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              No hay cocheros activos.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {cocheros.map((cochero) => (
                <button
                  key={cochero.id}
                  onClick={() => setSelectedCochero(cochero.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
                    selectedCochero === cochero.id 
                      ? 'bg-primary/20 border-primary text-white shadow-lg shadow-primary/10' 
                      : 'bg-zinc-900 border-white/5 text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${selectedCochero === cochero.id ? 'bg-primary text-black' : 'bg-zinc-800'}`}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-bold">{cochero.first_name} {cochero.last_name}</div>
                    <div className="text-xs uppercase tracking-widest opacity-70">Cochero</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-stretch">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1 bg-zinc-900 border-white/10 hover:bg-zinc-800 hover:text-white"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={!selectedCochero || loading}
            className="flex-1 bg-primary text-black hover:bg-primary/90 font-black tracking-widest uppercase"
          >
            {loading ? "Asignando..." : "Asignar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
