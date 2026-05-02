import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

export default function Index() {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<any>(null);
    const isDark = useColorScheme() === 'dark';

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });
    }, []);

    if (loading) {
        return (
            <LinearGradient 
                colors={isDark ? ['#09090b', '#000000'] : ['#f4f4f5', '#ffffff']} 
                className="flex-1 items-center justify-center"
            >
                <Image
                    source={require('../assets/images/luxor-neon.png')}
                    style={{ width: '70%', height: 100, marginBottom: 32 }}
                    contentFit="contain"
                />
                <ActivityIndicator size="small" color="#e11d48" />
            </LinearGradient>
        );
    }

    if (!session) {
        return <Redirect href="/login" />;
    }

    return <Redirect href="/(chat)" />;
}
