import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

const CACHE_PREFIX = '@luxor_cache:';

export class Cache {
    static async get<T>(key: string): Promise<T | null> {
        try {
            const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
            if (!raw) return null;

            const entry: CacheEntry<T> = JSON.parse(raw);
            const now = Date.now();

            if (now - entry.timestamp > entry.ttl) {
                await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
                return null;
            }

            return entry.data;
        } catch {
            return null;
        }
    }

    static async set<T>(key: string, data: T, ttlMs: number = 30000): Promise<void> {
        try {
            const entry: CacheEntry<T> = {
                data,
                timestamp: Date.now(),
                ttl: ttlMs,
            };
            await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
        } catch (error) {
            console.error('Cache set error:', error);
        }
    }

    static async invalidate(key: string): Promise<void> {
        try {
            await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
        } catch {}
    }

    static async invalidatePattern(pattern: string): Promise<void> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(k => k.startsWith(`${CACHE_PREFIX}${pattern}`));
            await AsyncStorage.multiRemove(cacheKeys);
        } catch {}
    }

    static async clearAll(): Promise<void> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
            await AsyncStorage.multiRemove(cacheKeys);
        } catch {}
    }
}
