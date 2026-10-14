import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const OFFLINE_QUEUE_KEY = '@autohotel:offline_queue';

export interface OfflineAction {
  id: string;
  type: 'UPDATE_ROOM_STATUS';
  payload: {
    roomId: string;
    roomNumber?: string;
    /** Estado que la camarista vio al hacer la acción; si cambió mientras no había señal, no se aplica */
    expectedStatus?: string;
    newStatus: string;
    notes?: string | null;
    maintenanceImageUrl?: string | null;
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

export const syncOfflineQueue = async (): Promise<{ synced: number; conflicts: string[] }> => {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return { synced: 0, conflicts: [] };

  console.log(`[OfflineQueue] Sincronizando ${queue.length} acciones pendientes...`);

  const failedActions: OfflineAction[] = [];
  const conflicts: string[] = [];
  let successCount = 0;

  for (const action of queue) {
    try {
      if (action.type === 'UPDATE_ROOM_STATUS') {
        const { roomId, roomNumber, expectedStatus, newStatus, notes, maintenanceImageUrl } = action.payload;
        if (!expectedStatus) {
          // Acción guardada por una versión anterior de la app: sin estado esperado no es seguro aplicarla
          conflicts.push(`Hab. ${roomNumber || '?'}`);
          continue;
        }
        const { data, error } = await supabase.rpc('housekeeping_set_room_status', {
          p_room_id: roomId,
          p_expected_status: expectedStatus,
          p_new_status: newStatus,
          p_notes: notes ?? null,
          p_image_url: maintenanceImageUrl ?? null,
        });

        if (error) {
          console.error(`[OfflineQueue] Falló sync de acción ${action.id}:`, error);
          failedActions.push(action);
        } else if (!data?.success) {
          // La habitación cambió (recepción la ocupó, otra camarista la tomó…): se descarta, no se reintenta
          console.warn(`[OfflineQueue] Acción ${action.id} descartada:`, data?.error);
          conflicts.push(`Hab. ${roomNumber || '?'}`);
        } else {
          successCount++;
        }
      }
    } catch (e) {
      console.error(`[OfflineQueue] Excepción en sync de acción ${action.id}:`, e);
      failedActions.push(action);
    }
  }

  // Solo mantener las acciones que fallaron por red/servidor (para reintento futuro)
  if (failedActions.length > 0) {
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failedActions));
  } else {
    await clearOfflineQueue();
  }
  console.log(`[OfflineQueue] Sincronización: ${successCount} aplicadas, ${conflicts.length} descartadas, ${failedActions.length} pendientes.`);

  return { synced: successCount, conflicts };
};
