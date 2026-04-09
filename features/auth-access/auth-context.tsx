'use client';

import React, { createContext, useCallback, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize Supabase client only when env vars are available
  useEffect(() => {
    try {
      const client = createClient();
      setSupabase(client);
    } catch (error) {
      console.error('[v0] Failed to initialize Supabase client:', error);
      setLoading(false);
    }
  }, []);

  // Initialize auth state from session
  useEffect(() => {
    if (!supabase) return;

    const initAuth = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (error) {
        console.error('[v0] Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_OUT') {
        // Clear any cached data on sign out
        setUser(null);
        setSession(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const logout = useCallback(async () => {
    if (!supabase) throw new Error('Supabase client not initialized');
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('[v0] Error during logout:', error);
      throw error;
    }
  }, [supabase]);

  const refreshUser = useCallback(async () => {
    if (!supabase) throw new Error('Supabase client not initialized');
    try {
      const {
        data: { user: freshUser },
      } = await supabase.auth.getUser();
      setUser(freshUser);
    } catch (error) {
      console.error('[v0] Error refreshing user:', error);
      throw error;
    }
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
