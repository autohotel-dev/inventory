"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Users, Tv, Key, Wind, User, RefreshCw, CheckCircle2 } from "lucide-react";
import { Room } from "@/components/sales/room-types";
import { createAdminNotificationForEmployee } from "@/lib/services/valet-notification-service";

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
  const [currentAssignedId, setCurrentAssignedId] = useState<string | null>(null);
  const [showChangeMode, setShowChangeMode] = useState(false);

  useEffect(() => {
    if (isOpen && room) {
      fetchActiveCocheros();
      fetchCurrentAssignment();
      setShowChangeMode(false);
    }
  }, [isOpen, room]);

  const fetchActiveCocheros = async () => {
    setLoadingCocheros(true);
    const supabase = createClient();
    try {
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

  const fetchCurrentAssignment = async () => {
    if (!room) return;
    const supabase = createClient();
    try {
      const { data } = await supabase
        .from('room_assets')
        .select('assigned_employee_id, status')
        .eq('room_id', room.id)
        .eq('asset_type', assetType)
        .maybeSingle();

      const assignedId = data?.assigned_employee_id || null;
      setCurrentAssignedId(assignedId);
      setSelectedCochero(assignedId);
    } catch {
      // Non-critical, just proceed without assignment info
    }
  };

  const fetchAssetStatus = async () => {
    if (!room) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('room_assets')
      .select('status')
      .eq('room_id', room.id)
      .eq('asset_type', assetType)
      .maybeSingle();
      
    return data?.status;
  };

  // Find the currently assigned cochero's full data
  const assignedCochero = useMemo(() => {
    if (!currentAssignedId) return null;
    return cocheros.find(c => c.id === currentAssignedId) || null;
  }, [currentAssignedId, cocheros]);

  const hasAssigned = !!assignedCochero;

  const handleReturnToReception = async () => {
    if (!room) return;
    setLoading(true);
    const supabase = createClient();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let actionByEmployeeId = null;
      if (session?.user?.id) {
        const { data: empData } = await supabase.from('employees').select('id').eq('user_id', session.user.id).single();
        if (empData) actionByEmployeeId = empData.id;
      }
      
      const currentStatus = await fetchAssetStatus() || 'NO_EXISTIA';
      
      const { error } = await supabase
        .from('room_assets')
        .upsert({
          room_id: room.id,
          asset_type: assetType,
          status: 'EN_RECEPCION',
          assigned_employee_id: null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'room_id, asset_type' })
        .select()
        .single();

      if (error) throw error;

      // Log the action
      await supabase.from('room_asset_logs').insert({
        asset_id: (await supabase.from('room_assets').select('id').eq('room_id', room.id).eq('asset_type', assetType).single()).data?.id,
        previous_status: currentStatus,
        new_status: 'EN_RECEPCION',
        employee_id: actionByEmployeeId,
        action_type: 'RETURNED_TO_RECEPTION'
      });

      toast.success("Control devuelto a recepción.");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error returning to reception:", error);
      toast.error("Hubo un error al actualizar.");
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!room || !selectedCochero) return;
    setLoading(true);
    const supabase = createClient();

    try {
      // Usar session actual para saber quién hace la acción
      const { data: { session } } = await supabase.auth.getSession();
      
      let actionByEmployeeId = null;
      if (session?.user?.id) {
        const { data: empData } = await supabase.from('employees').select('id').eq('user_id', session.user.id).single();
        if (empData) actionByEmployeeId = empData.id;
      }
      
      const { data, error } = await supabase.rpc('assign_asset_to_employee', {
        p_room_id: room.id,
        p_asset_type: assetType,
        p_employee_id: selectedCochero,
        p_action_by_employee_id: actionByEmployeeId
      });

      if (error) throw error;
      
      // Enviar notificación push al cochero asignado (no bloquea la operación)
      if (assetType === 'TV_REMOTE') {
        createAdminNotificationForEmployee(
          supabase,
          selectedCochero,
          '📺 Encender TV',
          `Ve a la Habitación ${room.number} y enciende la televisión para el cliente.`,
          { type: 'TV_TASK', roomNumber: room.number, roomId: room.id }
        ).catch(() => { /* push notification is best-effort */ });
        toast.success("Cochero asignado para encender TV.");
      } else {
        toast.success("Control asignado al cochero correctamente.");
      }
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
      case 'TV_REMOTE': return 'Cochero para TV';
      case 'AC_REMOTE': return 'Control de A/C';
      case 'KEY': return 'Llave';
      default: return 'Activo';
    }
  };

  if (!room) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-md bg-zinc-950 border border-white/10 text-white rounded-3xl">
        <DialogHeader>
          <div className="mx-auto bg-primary/20 p-4 rounded-full border border-primary/30 shadow-[0_0_20px_-5px_var(--primary)] mb-4">
            {getAssetIcon()}
          </div>
          <DialogTitle className="text-2xl font-black text-center italic tracking-tight">
            {hasAssigned && !showChangeMode ? getAssetName() : `Asignar ${getAssetName()}`}
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-400">
            {hasAssigned && !showChangeMode
              ? `Habitación ${room.number} — cochero ya asignado`
              : `${assetType === 'TV_REMOTE' ? 'Selecciona al cochero que irá a encender la TV en la' : 'Habitación'} ${room.number}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loadingCocheros ? (
            <div className="flex justify-center p-4">
              <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
            </div>
          ) : hasAssigned && !showChangeMode ? (
            /* ──── Vista de cochero asignado ──── */
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.1)]">
                <div className="flex items-center justify-center h-14 w-14 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 shadow-lg">
                  <User className="h-7 w-7 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-lg text-white tracking-tight">
                    {assignedCochero!.first_name} {assignedCochero!.last_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest">Cochero Asignado</p>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2 border-dashed border-white/20 text-zinc-300 hover:bg-white/5 hover:text-white"
                onClick={() => setShowChangeMode(true)}
              >
                <RefreshCw className="h-4 w-4" />
                Cambiar Cochero
              </Button>
            </div>
          ) : (
            /* ──── Vista de selección ──── */
            <>
              {showChangeMode && assignedCochero && (
                <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900 px-3 py-2 rounded-lg mb-3 border border-white/5">
                  <RefreshCw className="h-3 w-3 shrink-0" />
                  Cambiando desde: <span className="font-bold text-white">{assignedCochero.first_name} {assignedCochero.last_name}</span>
                </div>
              )}
              <p className="text-sm text-zinc-400 font-bold mb-3 uppercase tracking-widest text-center">Selecciona al Cochero en turno:</p>
              
              {cocheros.length === 0 ? (
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
            </>
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
          {assetType !== 'TV_REMOTE' && (
            <Button 
              variant="outline"
              onClick={handleReturnToReception}
              disabled={loading}
              className="flex-1 bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 font-bold"
            >
              En Recepción
            </Button>
          )}
          {/* Only show Asignar button when in selection mode */}
          {(!hasAssigned || showChangeMode) && (
            <Button 
              onClick={handleAssign} 
              disabled={!selectedCochero || loading}
              className="flex-2 bg-primary text-black hover:bg-primary/90 font-black tracking-widest uppercase"
            >
              {loading ? "..." : "Asignar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
