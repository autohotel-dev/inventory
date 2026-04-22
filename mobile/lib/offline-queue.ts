import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const OFFLINE_QUEUE_KEY = '@autohotel:offline_queue';

export interface OfflineAction {
  id: string;
  type: 'UPDATE_ROOM_STATUS';
  payload: {
    roomId: string;
    newStatus: string;
    notes?: string | null;
  };
  timestamp: number;
}

export const getOfflineQueue = async (): Promise<OfflineAction[]> => {
  try {
    const queueData = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queueData) return [];
    return JSON.parse(queueData);
  } catch (error) {
    console.error('[OfflineQueue] Error getting queue:', error);
    return [];
  }
};

export const addOfflineAction = async (action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
  try {
    const queue = await getOfflineQueue();
    const newAction: OfflineAction = {
      ...action,
      id: Math.random().toString(36).substring(2, 15),
      timestamp: Date.now(),
    };
    
    // Si ya existe una acción para la misma habitación, la actualizamos/sobreescribimos
    // para evitar que se aplique un estado intermedio viejo cuando vuelva la red.
    const filteredQueue = queue.filter(a => 
      !(a.type === 'UPDATE_ROOM_STATUS' && action.type === 'UPDATE_ROOM_STATUS' && a.payload.roomId === action.payload.roomId)
    );
    
    filteredQueue.push(newAction);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filteredQueue));
    console.log('[OfflineQueue] Action added:', newAction);
  } catch (error) {
    console.error('[OfflineQueue] Error adding action:', error);
  }
};

export const clearOfflineQueue = async () => {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (error) {
    console.error('[OfflineQueue] Error clearing queue:', error);
  }
};

export const syncOfflineQueue = async (): Promise<number> => {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return 0;

  console.log(`[OfflineQueue] Sincronizando ${queue.length} acciones pendientes...`);
  
  let successCount = 0;
  
  for (const action of queue) {
    try {
      if (action.type === 'UPDATE_ROOM_STATUS') {
        const updatePayload: any = { status: action.payload.newStatus };
        if (action.payload.notes !== undefined) {
          updatePayload.notes = action.payload.notes;
        }

        const { error } = await supabase
          .from('rooms')
          .update(updatePayload)
          .eq('id', action.payload.roomId);

        if (error) {
          console.error(`[OfflineQueue] Falló sync de acción ${action.id}:`, error);
          // Opcional: Podríamos dejar la acción en la cola si falla por razones no relacionadas con red,
          // pero si falla por validación (RLS, estado inválido), es mejor descartarla para no bloquear la cola.
        } else {
          successCount++;
        }
      }
    } catch (e) {
      console.error(`[OfflineQueue] Excepción en sync de acción ${action.id}:`, e);
    }
  }

  // Una vez procesada, limpiamos la cola. En una implementación más robusta,
  // solo removeríamos las acciones exitosas, pero para este caso de uso priorizamos limpiar.
  await clearOfflineQueue();
  console.log(`[OfflineQueue] Sincronización completa. Exitosas: ${successCount}/${queue.length}`);
  
  return successCount;
};
