"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function AuthDebug() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-card border rounded-lg p-4 text-xs max-w-sm">
      <h4 className="font-semibold mb-2">Auth Debug</h4>
      <div className="space-y-1">
        <div>Session: {session ? '✅ Active' : '❌ None'}</div>
        <div>User: {user?.email || 'Not logged in'}</div>
        <div>Provider: {user?.app_metadata?.provider || 'N/A'}</div>
      </div>
    </div>
  );
}
