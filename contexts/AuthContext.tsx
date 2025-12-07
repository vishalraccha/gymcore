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
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: string
  ) => Promise<{ error: any }>;
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
        if ((data as any)?.gym_id) {
          await fetchGym((data as any).gym_id);
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
    if (profile?.gym_id) await fetchGym(profile.gym_id);
  };

  // initial session load - RUNS ONLY ONCE ON MOUNT
  useEffect(() => {
    let mounted = true;
    
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) await fetchProfile(session.user.id);
      } catch (e) {
        console.log("getSession error", e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array - only runs once

  // auth listener - RUNS ONLY ONCE ON MOUNT
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
          setGym(null);
        }
      }
    );

    return () => {
      try {
        listener.subscription.unsubscribe();
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
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