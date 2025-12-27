import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface SubscriptionInfo {
  subscription_id: string;
  plan_name: string;
  plan_price: number;
  status: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  is_active: boolean;
}

interface SubscriptionContextType {
  hasActiveSubscription: boolean;
  subscriptionInfo: SubscriptionInfo | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
  canAccessFeature: (feature: string) => boolean;
  daysRemaining: number | null;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  hasActiveSubscription: false,
  subscriptionInfo: null,
  loading: true,
  refreshSubscription: async () => {},
  canAccessFeature: () => false,
  daysRemaining: null,
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, profile } = useAuth();
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSubscription = async () => {
    if (!user) {
      setHasActiveSubscription(false);
      setSubscriptionInfo(null);
      setLoading(false);
      return;
    }

    try {
      // Admin and gym_owner always have access
      if (profile?.role === 'admin' || profile?.role === 'gym_owner') {
        setHasActiveSubscription(true);
        setSubscriptionInfo(null);
        setLoading(false);
        return;
      }

      // SIMPLE QUERY - Just check if active subscription exists
      const { data, error } = await supabase
        .from('razorpay_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      console.log('🔍 Subscription check:', { 
        userId: user.id, 
        found: !!data, 
        error: error?.message 
      });

      if (error || !data) {
        setHasActiveSubscription(false);
        setSubscriptionInfo(null);
        setLoading(false);
        return;
      }

      // Check if expired
      const endDate = new Date(data.end_date);
      const now = new Date();
      
      if (endDate < now) {
        setHasActiveSubscription(false);
        setSubscriptionInfo(null);
        setLoading(false);
        return;
      }

      // SUCCESS - User has active subscription
      const daysRemaining = Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      console.log('✅ ACTIVE SUBSCRIPTION:', data.id);
      setHasActiveSubscription(true);
      setSubscriptionInfo({
        subscription_id: data.id,
        plan_name: 'Premium',
        plan_price: 0,
        status: data.status,
        start_date: data.start_date,
        end_date: data.end_date,
        days_remaining: daysRemaining,
        is_active: true,
      });
      
    } catch (error) {
      console.error('❌ Error:', error);
      setHasActiveSubscription(false);
      setSubscriptionInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshSubscription();
    } else {
      setLoading(false);
    }
  }, [user?.id, profile?.role]);

  const canAccessFeature = (feature: string): boolean => {
    if (profile?.role === 'admin' || profile?.role === 'gym_owner') {
      return true;
    }
    const freeFeatures = ['dashboard', 'profile', 'plans'];
    if (freeFeatures.includes(feature.toLowerCase())) {
      return true;
    }
    return hasActiveSubscription;
  };

  const daysRemaining = subscriptionInfo?.days_remaining ?? null;

  return (
    <SubscriptionContext.Provider
      value={{
        hasActiveSubscription,
        subscriptionInfo,
        loading,
        refreshSubscription,
        canAccessFeature,
        daysRemaining,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
