import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../services/supabaseClient';
import { hashPin, verifyPin } from '../services/securityService';

export interface AuthUser {
  id: string;
  email: string;
  provider: 'supabase' | 'local';
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_AUTH_STORAGE_KEY = 'clientvault_local_auth_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session on mount
  const checkSession = useCallback(async () => {
    setIsLoading(true);
    const supabase = getSupabaseClient();

    // 1. Check Supabase session first
    if (supabase) {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || 'user@supabase.cloud',
            provider: 'supabase',
          });
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Supabase session check error:', err);
      }
    }

    // 2. Check local fallback session
    try {
      const localSession = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
      if (localSession) {
        const parsed = JSON.parse(localSession);
        if (parsed.email) {
          setUser({
            id: parsed.id || 'local-admin',
            email: parsed.email,
            provider: 'local',
          });
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Local session parse error:', err);
    }

    setUser(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    checkSession();

    // Listen to Supabase auth state changes
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || 'user@supabase.cloud',
            provider: 'supabase',
          });
        } else {
          // If Supabase signed out, also clear local session
          const localSession = localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
          if (!localSession) {
            setUser(null);
          }
        }
        setIsLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [checkSession]);

  // Sign In
  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      return { success: false, error: 'Please enter both email and password.' };
    }

    const supabase = getSupabaseClient();

    // 1. Try Supabase Auth if connected
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (error) {
          console.warn('Supabase signInWithPassword returned error:', error.message);
          // If Supabase credentials failed, we can still fall back to local credentials below
        } else if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email || cleanEmail,
            provider: 'supabase',
          });
          localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
          return { success: true };
        }
      } catch (err: any) {
        console.warn('Supabase auth network error:', err);
      }
    }

    // 2. Local Fallback Authentication
    // Allows logging in locally as administrator
    try {
      const storedLocalCreds = localStorage.getItem('clientvault_local_admin_creds');
      if (storedLocalCreds) {
        const { email: storedEmail, passwordHash } = JSON.parse(storedLocalCreds);
        if (storedEmail === cleanEmail) {
          const isValid = await verifyPin(cleanPassword, passwordHash);
          if (isValid) {
            const localUser: AuthUser = {
              id: 'local-admin',
              email: cleanEmail,
              provider: 'local',
            };
            setUser(localUser);
            localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(localUser));
            return { success: true };
          }
        }
      }
    } catch (err) {
      console.warn('Local admin auth check error:', err);
    }

    return {
      success: false,
      error: 'Invalid email or password. Please check your credentials or create an account.',
    };
  };

  // Sign Up
  const signUp = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      return { success: false, error: 'Please enter both email and password.' };
    }

    if (cleanPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const supabase = getSupabaseClient();

    // 1. Try Supabase Auth
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (!error && data.session && data.user) {
          // Immediately logged in (Email confirmation disabled or auto-confirmed)
          setUser({
            id: data.user.id,
            email: data.user.email || cleanEmail,
            provider: 'supabase',
          });
          return { success: true };
        } else if (!error && data.user) {
          // If Supabase requires email confirmation, also save local fallback so user can use app immediately
          const passwordHash = await hashPin(cleanPassword);
          localStorage.setItem(
            'clientvault_local_admin_creds',
            JSON.stringify({ email: cleanEmail, passwordHash })
          );
          const localUser: AuthUser = {
            id: data.user.id,
            email: cleanEmail,
            provider: 'supabase',
          };
          setUser(localUser);
          localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(localUser));
          return { success: true };
        } else if (error) {
          console.warn('Supabase signup returned warning, falling through to local account:', error.message);
        }
      } catch (err: any) {
        console.warn('Supabase auth network error, falling back:', err);
      }
    }

    // 2. Local Fallback Account Creation (Never locked out)
    try {
      const passwordHash = await hashPin(cleanPassword);
      localStorage.setItem(
        'clientvault_local_admin_creds',
        JSON.stringify({ email: cleanEmail, passwordHash })
      );
      const localUser: AuthUser = {
        id: 'local-admin',
        email: cleanEmail,
        provider: 'local',
      };
      setUser(localUser);
      localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(localUser));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create local account.' };
    }
  };

  // Sign Out
  const signOut = async (): Promise<void> => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut error:', err);
      }
    }
    localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
