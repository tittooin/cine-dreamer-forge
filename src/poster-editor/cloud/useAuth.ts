import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

export type AuthState = {
  user: { id: string; email?: string | null } | null;
  loading: boolean;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setState({ user: session?.user ? { id: session.user.id, email: session.user.email } : null, loading: false });
    })();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ? { id: session.user.id, email: session.user.email } : null, loading: false });
    });
    return () => { mounted = false; subscription?.subscription.unsubscribe(); };
  }, []);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const loginWithGoogle = useCallback(async () => {
  await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/youtube-thumbnail' } });
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { ...state, loginWithPassword, loginWithGoogle, logout };
}