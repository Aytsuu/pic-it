import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Session, User } from '@supabase/supabase-js';

import { validateStoredSession } from '@/lib/auth-session';
import { isOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const nextSession = await validateStoredSession();
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    }

    void loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      void isOnline().then((online) => {
        if (online) void loadSession();
      });
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);

  return { session, user, isLoading, signOut: () => supabase.auth.signOut() };
}
