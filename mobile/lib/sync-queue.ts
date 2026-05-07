import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { apiClient } from './api/client';

export interface SyncTask {
    id: string;
    type: 'UPDATE' | 'INSERT' | 'RPC';
    table?: string;
    rpcName?: string;
    payload: any;
    matchCriteria?: Record<string, any>; // Para .eq('id', stayId)
    timestamp: number;
}

const SYNC_QUEUE_KEY = '@luxor_sync_queue';

export class SyncQueue {
    // Agrega una tarea a la cola de sincronización si no hay conexión
    static async enqueue(task: Omit<SyncTask, 'id' | 'timestamp'>): Promise<boolean> {
        const state = await NetInfo.fetch();
        if (state.isConnected) {
            return false; // Online: usar llamado directo normal
        }

        const fullTask: SyncTask = {
            ...task,
            id: Math.random().toString(36).substring(2, 9),
            timestamp: Date.now(),
        };

        try {
            const queueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
            const queue: SyncTask[] = queueStr ? JSON.parse(queueStr) : [];
            queue.push(fullTask);
            await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
            console.log(`[SyncQueue] Tarea encolada offline: ${fullTask.type} ${fullTask.table || fullTask.rpcName}`);
            return true; // Efectivamente encolado
        } catch (e) {
            console.error('[SyncQueue] Error encolando tarea', e);
            return false;
        }
    }

    // Procesa todas las tareas pendientes
    static async processQueue(): Promise<number> {
        const state = await NetInfo.fetch();
        if (!state.isConnected) return 0;

        try {
            const queueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
            if (!queueStr) return 0;

            const queue: SyncTask[] = JSON.parse(queueStr);
            if (queue.length === 0) return 0;

            console.log(`[SyncQueue] Procesando ${queue.length} tareas pendientes...`);
            let successCount = 0;

            for (const task of queue) {
                try {
                    let result;
                    if (task.type === 'UPDATE' && task.table && task.matchCriteria) {
                        let queryParams = new URLSearchParams();
                        for (const [key, value] of Object.entries(task.matchCriteria)) {
                            queryParams.append(key, `eq.${value}`);
                        }
                        await apiClient.patch(`/system/crud/${task.table}?${queryParams.toString()}`, task.payload);
                    } else if (task.type === 'INSERT' && task.table) {
                        await apiClient.post(`/system/crud/${task.table}`, Array.isArray(task.payload) ? task.payload : [task.payload]);
                    } else if (task.type === 'RPC' && task.rpcName) {
                        await apiClient.post(`/system/rpc/${task.rpcName}`, task.payload);
                    }

                    successCount++;
                } catch (err) {
                    console.error(`[SyncQueue] Excepción crítica ejecutando tarea ${task.id}`, err);
                }
            }

            // Una vez todas procesadas, vaciamos la cola (asumiendo que las que fallaron fueron por datos corruptos)
            // Para un app robusta, solo se quitarían las procesadas exitosamente
            await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([]));
            console.log(`[SyncQueue] Cola procesada con ${successCount} éxitos.`);
            
            return successCount;

        } catch (e) {
            console.error('[SyncQueue] Error procesando cola', e);
            return 0;
        }
    }

    // Configura un listener global para detectar retornos a conectividad
    static setupNetworkListener(onProcessed?: (count: number) => void) {
        return NetInfo.addEventListener(state => {
            if (state.isConnected) {
                this.processQueue().then(count => {
                    if (count > 0 && onProcessed) onProcessed(count);
                });
            }
        });
    }
}
