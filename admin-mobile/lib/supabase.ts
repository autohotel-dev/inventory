import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// AsyncStorage is only available on native platforms.
// For the web export (used by EAS Update bundling), we provide a no-op fallback
// to prevent "window is not defined" crashes during static export.
const getStorage = () => {
  if (Platform.OS === 'web') {
    // Minimal in-memory fallback so the export doesn't crash.
    // The app is never actually used on web.
    const memoryStore: Record<string, string> = {};
    return {
      getItem: (key: string) => Promise.resolve(memoryStore[key] ?? null),
      setItem: (key: string, value: string) => { memoryStore[key] = value; return Promise.resolve(); },
      removeItem: (key: string) => { delete memoryStore[key]; return Promise.resolve(); },
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('@react-native-async-storage/async-storage').default;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
