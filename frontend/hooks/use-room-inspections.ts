import { createClient } from '@/lib/supabase/client';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface RoomInspection {
  id: string;
  room_stay_id: string;
  room_id: string;
  inspection_type: 'TV_CHECK' | 'DAMAGE_CHECK' | 'GENERAL';
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  notes: string | null;
  result: 'OK' | 'ISSUE_FOUND' | null;
  issue_description: string | null;
  created_at: string;
  // Joined data
  rooms?: { number: string };
  assigned_employee?: { first_name: string; last_name: string };
  assigner_employee?: { first_name: string; last_name: string };
}

export function useRoomInspections() {
  const [loading, setLoading] = useState(false);

  // Assign a TV check to a cochero after checkout
  const assignInspection = useCallback(async (params: {
    roomStayId: string;
    roomId: string;
    inspectionType: 'TV_CHECK' | 'DAMAGE_CHECK' | 'GENERAL';
    assignedTo: string; // cochero employee ID
    assignedBy: string; // receptionist employee ID
    notes?: string;
  }) => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('room_inspections')
        .insert({
          room_stay_id: params.roomStayId,
          room_id: params.roomId,
          inspection_type: params.inspectionType,
          assigned_to: params.assignedTo,
          assigned_by: params.assignedBy,
          notes: params.notes || null,
          status: 'PENDING',
        })
        .select('id')
        .single();

      if (error) throw error;
      toast.success('Inspección asignada ✅');
      return data?.id;
    } catch (error) {
      console.error('Error assigning inspection:', error);
      toast.error('Error al asignar inspección');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Accept an inspection (cochero)
  const acceptInspection = useCallback(async (inspectionId: string) => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('room_inspections')
        .update({
          status: 'ACCEPTED',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', inspectionId);

      if (error) throw error;
      toast.success('Inspección aceptada');
      return true;
    } catch (error) {
      console.error('Error accepting inspection:', error);
      toast.error('Error al aceptar inspección');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Complete an inspection (cochero)
  const completeInspection = useCallback(async (
    inspectionId: string,
    result: 'OK' | 'ISSUE_FOUND',
    issueDescription?: string
  ) => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('room_inspections')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          result,
          issue_description: issueDescription || null,
        })
        .eq('id', inspectionId);

      if (error) throw error;
      toast.success(result === 'OK' ? 'Inspección completada ✅' : 'Problema reportado ⚠️');
      return true;
    } catch (error) {
      console.error('Error completing inspection:', error);
      toast.error('Error al completar inspección');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Cancel an inspection (receptionist)
  const cancelInspection = useCallback(async (inspectionId: string) => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('room_inspections')
        .update({ status: 'CANCELLED' })
        .eq('id', inspectionId);

      if (error) throw error;
      toast.success('Inspección cancelada');
      return true;
    } catch (error) {
      console.error('Error cancelling inspection:', error);
      toast.error('Error al cancelar inspección');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch pending inspections for a cochero
  const fetchMyInspections = useCallback(async (valetId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('room_inspections')
      .select('*, rooms(number)')
      .eq('assigned_to', valetId)
      .in('status', ['PENDING', 'ACCEPTED'])
      .order('assigned_at', { ascending: true });

    if (error) {
      console.error('Error fetching inspections:', error);
      return [];
    }
    return (data || []) as RoomInspection[];
  }, []);

  // Fetch all pending inspections (for receptionist view)
  const fetchAllPendingInspections = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('room_inspections')
      .select('*, rooms(number), assigned_employee:employees!room_inspections_assigned_to_fkey(first_name, last_name)')
      .in('status', ['PENDING', 'ACCEPTED'])
      .order('assigned_at', { ascending: true });

    if (error) {
      console.error('Error fetching inspections:', error);
      return [];
    }
    return (data || []) as RoomInspection[];
  }, []);

  // Fetch cocheros available for assignment
  const fetchAvailableCocheros = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('employees')
      .select('id, first_name, last_name, role, role_id, roles:role_id(name)')
      .is('deleted_at', null)
      .or('role.ilike.%valet%,role.ilike.%cochero%');
    
    if (error) {
      // fallback with roles table
      const { data: data2 } = await supabase
        .from('employees')
        .select('id, first_name, last_name, role')
        .is('deleted_at', null)
        .or('role.ilike.%valet%,role.ilike.%cochero%');
      return data2 || [];
    }
    return data || [];
  }, []);

  return {
    loading,
    assignInspection,
    acceptInspection,
    completeInspection,
    cancelInspection,
    fetchMyInspections,
    fetchAllPendingInspections,
    fetchAvailableCocheros,
  };
}
