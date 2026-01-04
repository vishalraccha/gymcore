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
  owner_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface OwnerSubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billing_cycle: 'monthly' | 'quarterly' | 'yearly';
  duration_days: number;
  member_limit?: number;
  trainer_limit?: number;
  features: string[];
  trial_days: number;
  is_active: boolean;
}

interface OwnerSubscription {
  id: string;
  owner_id: string;
  gym_id: string;
  plan_id: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled' | 'suspended' | 'trial';
  start_date: string;
  end_date: string;
  payment_status: 'pending' | 'success' | 'failed' | 'refunded';
  amount_paid: number;
  auto_renew: boolean;
  razorpay_subscription_id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  plan?: OwnerSubscriptionPlan;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  gym: Gym | null;
  ownerSubscription: OwnerSubscription | null;
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
  refreshOwnerSubscription: () => Promise<void>;
  isCreatingMember: boolean;
  setIsCreatingMember: (value: boolean) => void;
  forceRefresh: () => Promise<void>;
  setProfile: (profile: Profile | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);
  const [ownerSubscription, setOwnerSubscription] = useState<OwnerSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch gym by id with security validation
  const fetchGym = useCallback(async (gymId: string, userId: string) => {
    try {
      const { data: gymData, error } = await supabase
        .from("gyms")
        .select(`
          *,
          owner_id
        `)
        .eq("id", gymId)
        .single();

      if (error) {
        console.log("fetchGym error:", error);
        setGym(null);
        return;
      }

      // Security check: Only allow access if user is owner or member of this gym
      const isOwner = gymData.owner_id === userId;
      
      // Also check if user is a member of this gym
      const { data: memberCheck } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .eq("gym_id", gymId)
        .single();
      
      const isMember = !!memberCheck;
      
      if (!isOwner && !isMember) {
        console.warn("🚨 Security: User trying to access unauthorized gym");
        setGym(null);
        return;
      }

      setGym(gymData as Gym);
    } catch (e) {
      console.log("fetchGym exception:", e);
      setGym(null);
    }
  }, []);

  // Fetch owner's subscription (only for gym_owner role)
  const fetchOwnerSubscription = useCallback(async (ownerId: string, gymId: string) => {
    try {
      const { data, error } = await supabase
        .from("owner_subscriptions")
        .select(`
          *,
          plan:plan_id(*)
        `)
        .eq("owner_id", ownerId)
        .eq("gym_id", gymId)
        .in("status", ["active", "trial", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.log("fetchOwnerSubscription error:", error);
        setOwnerSubscription(null);
        return;
      }

      if (!data) {
        setOwnerSubscription(null);
        return;
      }

      // Security: Verify this is actually the owner
      if (data.owner_id !== ownerId) {
        console.warn("🚨 Security: Owner subscription mismatch");
        setOwnerSubscription(null);
        return;
      }

      setOwnerSubscription(data as OwnerSubscription);
    } catch (e) {
      console.log("fetchOwnerSubscription exception:", e);
      setOwnerSubscription(null);
    }
  }, []);

  // Fetch profile with role-based security
  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        console.log('🔄 Fetching profile for user:', userId);
        
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          console.log("❌ fetchProfile error:", error);
          setProfile(null);
          return;
        }

        const profileData = data as Profile;
        console.log('✅ Profile loaded:', profileData.role);
        
        // Security: Validate gym ownership for gym_owner role
        if (profileData.role === 'gym_owner' && profileData.gym_id) {
          const { data: gymData } = await supabase
            .from("gyms")
            .select("owner_id")
            .eq("id", profileData.gym_id)
            .single();
            
          if (gymData?.owner_id !== userId) {
            console.warn("🚨 Security: gym_owner role mismatch with gym ownership");
            setProfile({ ...profileData, gym_id: null });
            setGym(null);
            setOwnerSubscription(null);
            return;
          }
        }

        setProfile(profileData);

        // Fetch gym with security validation
        if (profileData?.gym_id) {
          await fetchGym(profileData.gym_id, userId);
          
          // Fetch owner subscription if gym owner
          if (profileData.role === 'gym_owner') {
            await fetchOwnerSubscription(userId, profileData.gym_id);
          }
        } else {
          setGym(null);
          setOwnerSubscription(null);
        }
      } catch (err) {
        console.log("❌ fetchProfile exception:", err);
        setProfile(null);
        setGym(null);
        setOwnerSubscription(null);
      }
    },
    [fetchGym, fetchOwnerSubscription]
  );

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const refreshGym = async () => {
    if (!user?.id) return;
    
    try {
      const { data: gymData } = await supabase
        .from('gyms')
        .select('*')
        .eq('owner_id', user.id)
        .single();
      
      if (gymData) {
        setGym(gymData);
      }
    } catch (error) {
      console.log('refreshGym error:', error);
    }
  };

  const refreshOwnerSubscription = async () => {
    if (user?.id && profile?.gym_id && profile?.role === 'gym_owner') {
      await fetchOwnerSubscription(user.id, profile.gym_id);
    }
  };

  // Force complete data refresh
  const forceRefresh = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  // Initialize auth on mount
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing auth...');
        
        // Get session from storage
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (sessionError) {
          console.error('❌ Session error:', sessionError.message);
          
          // If token is invalid/expired, sign out
          if (sessionError.message?.includes('refresh') || sessionError.message?.includes('token')) {
            try {
              await supabase.auth.signOut();
            } catch (e) {
              console.error('Sign out error:', e);
            }
          }
          
          setSession(null);
          setUser(null);
          setProfile(null);
          setGym(null);
          setOwnerSubscription(null);
          setIsLoading(false);
          setIsInitialized(true);
          return;
        }

        if (currentSession) {
          console.log('✅ Session found:', currentSession.user.id);
          setSession(currentSession);
          setUser(currentSession.user);

          // Fetch profile data
          await fetchProfile(currentSession.user.id);
        } else {
          console.log('ℹ️ No active session found');
          setSession(null);
          setUser(null);
          setProfile(null);
          setGym(null);
          setOwnerSubscription(null);
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []); // Run once on mount

  // Listen for auth state changes
 // Listen for auth state changes
// Listen for auth state changes
useEffect(() => {
  if (!isInitialized) return;

  console.log('🔔 Setting up auth state listener...');
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event: string, newSession: Session | null) => {
      console.log('🔔 Auth state changed:', event);

      // ⭐ Skip INITIAL_SESSION event (already handled in initialization)
      if (event === "INITIAL_SESSION") {
        console.log('⏭️ Skipping INITIAL_SESSION (already initialized)');
        return;
      }

      // Skip if creating member
      if (isCreatingMember) {
        console.log('⏭️ Skipping auth state change (creating member)');
        return;
      }

      // Handle sign out
      if (event === "SIGNED_OUT" || event === "USER_DELETED") {
        console.log('👋 User signed out');
        setSession(null);
        setUser(null);
        setProfile(null);
        setGym(null);
        setOwnerSubscription(null);
        return;
      }

      // Handle sign in / token refresh
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (newSession) {
          const currentUserId = user?.id;
          const newUserId = newSession.user.id;

          // Different user or initial sign in
          if (newUserId !== currentUserId) {
            console.log('👤 New user session:', newUserId);
            setSession(newSession);
            setUser(newSession.user);
            setProfile(null);
            setGym(null);
            setOwnerSubscription(null);
            
            // Fetch new user's profile
            await fetchProfile(newUserId);
          } else {
            // Same user, just update session (token refresh)
            console.log('🔄 Token refreshed for same user');
            setSession(newSession);
            setUser(newSession.user);
          }
        }
      }
    }
  );

  return () => {
    console.log('🔕 Removing auth state listener');
    subscription.unsubscribe();
  };
}, [isInitialized, isCreatingMember, user?.id, fetchProfile]);
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
      console.log('👋 Signing out...');
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      setGym(null);
      setOwnerSubscription(null);
      router.replace("/(auth)/login");
    } catch (err) {
      console.error("❌ signOut error:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        gym,
        ownerSubscription,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        refreshGym,
        refreshOwnerSubscription,
        isCreatingMember,
        setIsCreatingMember,
        forceRefresh,
        setProfile,
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