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
  signIn: (email: string, password: string, role?: string) => Promise<{ error: Error | null }>;  // Add role parameter
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
    if (profile?.gym_id) await fetchGym(profile.gym_id);
  };

  // initial session load - RUNS ONLY ONCE ON MOUNT
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth event:", event);

        // Handle token refresh failures
        if (event === "SIGNED_OUT" || (event as string) === "TOKEN_REFRESH_FAILED") {
          console.warn("Auth session ended, logging out");
          await supabase.auth.signOut();
        }

        setSession(session);
      }
    );
    
    (async () => {
      try {
        // Set timeout fallback to ensure loading always resolves
        timeoutId = setTimeout(() => {
          if (mounted) {
            console.log("⏱️ Auth loading timeout - forcing completion");
            setIsLoading(false);
          }
        }, 3000) as ReturnType<typeof setTimeout>; // 3 second max timeout

        const {
          data: { session },
        } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch profile with timeout protection
        if (session?.user) {
          try {
            await Promise.race([
              fetchProfile(session.user.id),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile fetch timeout')), 2000)
              )
            ]).catch((err) => {
              console.log("Profile fetch timeout or error:", err);
              // Continue even if profile fetch fails
            });
          } catch (err) {
            console.log("Profile fetch error:", err);
          }
        }
      } catch (e) {
        console.log("getSession error", e);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (mounted) setIsLoading(false);
      }
    })();

    const { data: listener2 } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth event:", event);

        // Handle token refresh failures
        if (event === "SIGNED_OUT" || (event as string) === "TOKEN_REFRESH_FAILED") {
          console.warn("Auth session ended, logging out");
          await supabase.auth.signOut();
        }

        setSession(session);
      }
    );

    

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
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
      } catch (e) {console.log(e);
      }
    };
  }, []); // Empty array - only runs once

// const signIn = async (email: string, password: string, role?: string) => {
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