"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Hub } from "aws-amplify/utils";
import { configureAmplify } from "@/lib/amplify";

// Configure Amplify globally
configureAmplify();

export function AuthListener() {
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = Hub.listen('auth', ({ payload }) => {
            switch (payload.event) {
                case 'signedIn':
                    console.log('User signed in successfully');
                    // Add any global signed-in logic here
                    break;
                case 'signedOut':
                    console.log('User signed out, redirecting to login');
                    router.push('/auth/login');
                    break;
                case 'tokenRefresh_failure':
                    console.error('Token refresh failed, redirecting to login');
                    router.push('/auth/login');
                    break;
            }
        });

        return () => {
            unsubscribe();
        };
    }, [router]);

    return null;
}
