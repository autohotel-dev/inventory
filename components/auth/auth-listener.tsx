"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { type AuthChangeEvent } from "@supabase/supabase-js";

export function AuthListener() {
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
            if (event === "PASSWORD_RECOVERY") {
                console.log("Password recovery event detected, redirecting to update password");
                router.push("/auth/update-password");
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [router, supabase]);

    return null;
}
