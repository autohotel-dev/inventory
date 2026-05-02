import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<any>(null);

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
            <View className="flex-1 items-center justify-center bg-zinc-950">
                <ActivityIndicator size="large" color="#10b981" />
            </View>
        );
    }

    if (!session) {
        return <Redirect href="/login" />;
    }

    return <Redirect href="/(chat)" />;
}
