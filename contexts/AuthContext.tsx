// /contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabase";
import { Session, User } from "@supabase/supabase-js";
import { router } from "expo-router";
import { Profile } from "@/types/database";

interface Gym {
  id: string;
  name?: string;
  location?: string;
  phone?: string;
  email?: string;
  description?: string;
  logo_url?: string;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  gym: Gym | null;
  isLoading: boolean;
  signIn: (email: string, password: string, role?: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshGym: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // fetch gym by id
  const fetchGym = useCallback(async (gymId: string) => {
    try {
      const { data, error } = await supabase
        .from("gyms")
        .select("*")
        .eq("id", gymId)
        .single();

      if (error) {
        console.log("fetchGym error:", error);
        setGym(null);
        return;
      }
      setGym(data as Gym);
    } catch (e) {
      console.log("fetchGym exception:", e);
      setGym(null);
    }
  }, []);

  // fetch profile (and gym if linked)
  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          console.log("fetchProfile error:", error);
          setProfile(null);
          return;
        }
        setProfile(data as Profile);

        // if profile has gym_id fetch gym
        const profileData = data as Profile;
        if (profileData?.gym_id) {
          await fetchGym(profileData.gym_id);
        } else {
          setGym(null);
        }
      } catch (err) {
        console.log("fetchProfile exception:", err);
        setProfile(null);
        setGym(null);
      }
    },
    [fetchGym]
  );

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const refreshGym = async () => {
    if (profile?.gym_id) {
      await fetchGym(profile.gym_id);
    }
  };

  // Single unified auth initialization and listener
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;

    (async () => {
      try {
        // Set timeout fallback to ensure loading always resolves quickly
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.log("⏱️ Auth loading timeout - forcing completion");
            setIsLoading(false);
          }
        }, 2000) as ReturnType<typeof setTimeout>; // 2 second max timeout for faster loading

        // Get initial session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        // Handle refresh token errors gracefully
        if (sessionError) {
          console.log("Session error (may be expired):", sessionError.message);
          // If refresh token is invalid, clear session but don't crash
          if (sessionError.message?.includes('refresh') || sessionError.message?.includes('token')) {
            try {
              await supabase.auth.signOut();
            } catch (e) {
              console.log("Sign out error:", e);
            }
            setSession(null);
            setUser(null);
            setProfile(null);
            setGym(null);
            setIsLoading(false);
            return;
          }
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch profile BEFORE setting isLoading to false
        // This ensures profile is available for routing decisions
        if (session?.user) {
          try {
            await fetchProfile(session.user.id);
          } catch (err) {
            console.log("Profile fetch error:", err);
          }
        }
        
        setIsLoading(false);
      } catch (e) {
        console.log("getSession error", e);
        if (mounted) setIsLoading(false);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    })();

    // Single auth state change listener
    const { data: authListenerData } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        
        console.log("Auth event:", event);

        // Handle token refresh failures gracefully
        if (event === "SIGNED_OUT" || (event as string) === "TOKEN_REFRESH_FAILED") {
          console.warn("Auth session ended");
          setSession(null);
          setUser(null);
          setProfile(null);
          setGym(null);
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          // Fetch profile when session changes (e.g., after login)
          fetchProfile(newSession.user.id).catch((err) => {
            console.log("Profile fetch error:", err);
          });
        } else {
          setProfile(null);
          setGym(null);
        }
      }
    );
    authListener = authListenerData;

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (authListener?.subscription) {
        try {
          authListener.subscription.unsubscribe();
        } catch (e) {
          console.log("Unsubscribe error:", e);
        }
      }
    };
  }, []); // Empty array - only runs once

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: string
  ) => {
    if (!email || !password) {
      return { error: new Error("Email and password required") };
    }

    if (password.length < 6) {
      return { error: new Error("Password must be at least 6 characters") };
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName?.trim() || null,
          role: role?.trim().toLowerCase() || "user",
        },
      },
    });

    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      setGym(null);
      // redirect to auth route
      router.replace("/(auth)/login");
    } catch (err) {
      console.log("signOut error:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        gym,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        refreshGym,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
