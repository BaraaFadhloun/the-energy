"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseBrowserClient } from "@/lib/supabase-browser";

type SignInArgs = {
  email: string;
  password: string;
};

type SignUpArgs = {
  email: string;
  password: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (credentials: SignInArgs) => Promise<{ error?: string }>;
  signUp: (credentials: SignUpArgs) => Promise<{ error?: string; confirmationEmailSent?: boolean }>;
  signOut: () => Promise<void>;
  accessToken: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const { data, error: sessionError } = await supabaseBrowserClient.auth.getSession();
        if (!isMounted) return;
        if (sessionError) {
          setError(sessionError.message);
        }
        setSession(data.session ?? null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabaseBrowserClient.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setLoading(false);
      setError(null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async ({ email, password }: SignInArgs) => {
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabaseBrowserClient.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return { error: signInError.message };
    }

    const { data: sessionData } = await supabaseBrowserClient.auth.getSession();
    setSession(sessionData.session ?? null);
    setLoading(false);
    return {};
  };

  const signUp = async ({ email, password }: SignUpArgs) => {
    setLoading(true);
    setError(null);
    const { data, error: signUpError } = await supabaseBrowserClient.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return { error: signUpError.message };
    }

    const confirmationEmailSent = !data.session;
    if (data.session) {
      setSession(data.session);
    }
    setLoading(false);
    return { confirmationEmailSent };
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    const { error: signOutError } = await supabaseBrowserClient.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
    }
    setSession(null);
    setLoading(false);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      error,
      signIn,
      signUp,
      accessToken: session?.access_token ?? null,
      signOut,
    }),
    [session, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
