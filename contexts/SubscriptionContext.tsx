import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';
import { getSubscriptionState, isInTrialPeriod } from '@/lib/subscriptionUtils';

interface SubscriptionInfo {
  subscription_id: string;
  plan_name: string;
  plan_price: number;
  status: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  is_active: boolean;
  is_trial?: boolean;
  trial_end_date?: string;
}

interface SubscriptionContextType {
  hasActiveSubscription: boolean;
  subscriptionInfo: SubscriptionInfo | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
  canAccessFeature: (feature: string) => boolean;
  daysRemaining: number | null;
  isTrial: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  hasActiveSubscription: false,
  subscriptionInfo: null,
  loading: true,
  refreshSubscription: async () => {},
  canAccessFeature: () => false,
  daysRemaining: null,
  isTrial: false,
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, profile } = useAuth();
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTrial, setIsTrial] = useState(false);

  const refreshSubscription = async () => {
    if (!user || !profile) {
      setHasActiveSubscription(false);
      setSubscriptionInfo(null);
      setIsTrial(false);
      setLoading(false);
      return;
    }

    try {
      // Admin always has access (no trial check needed)
      if (profile.role === 'admin') {
        setHasActiveSubscription(true);
        setSubscriptionInfo(null);
        setIsTrial(false);
        setLoading(false);
        return;
      }

      // For gym_owner, check owner_subscriptions table
      if (profile.role === 'gym_owner') {
        // Check if gym owner has active subscription or is in trial
        const gymId = profile.gym_id;
        if (!gymId) {
          // No gym yet, check trial
          const inTrial = isInTrialPeriod(profile.created_at);
          setHasActiveSubscription(inTrial);
          setIsTrial(inTrial);
          setSubscriptionInfo(null);
          setLoading(false);
          return;
        }

        // Check owner subscription
        const { data: ownerSub, error: ownerSubError } = await supabase
          .from('owner_subscriptions')
          .select(`
            *,
            plan:owner_subscription_plans(name, price)
          `)
          .eq('owner_id', user.id)
          .eq('gym_id', gymId)
          .in('status', ['active', 'trial'])
          .gte('end_date', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ownerSubError || !ownerSub) {
          // No subscription, check trial
          const inTrial = isInTrialPeriod(profile.created_at);
          const state = getSubscriptionState(profile.created_at, null);
          setHasActiveSubscription(state.hasAccess);
          setIsTrial(state.isTrial);
          setSubscriptionInfo(state.isTrial ? {
            subscription_id: '',
            plan_name: 'Free Trial',
            plan_price: 0,
            status: 'trial',
            start_date: profile.created_at || '',
            end_date: state.trialEndDate?.toISOString() || '',
            days_remaining: state.daysRemaining,
            is_active: true,
            is_trial: true,
            trial_end_date: state.trialEndDate?.toISOString(),
          } : null);
          setLoading(false);
          return;
        }

        // Has active owner subscription
        const endDate = new Date(ownerSub.end_date);
        const now = new Date();
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        setHasActiveSubscription(true);
        setIsTrial(ownerSub.status === 'trial');
        setSubscriptionInfo({
          subscription_id: ownerSub.id,
          plan_name: ownerSub.plan?.name || 'Pro Plan',
          plan_price: ownerSub.plan?.price || 0,
          status: ownerSub.status,
          start_date: ownerSub.start_date,
          end_date: ownerSub.end_date,
          days_remaining: daysRemaining,
          is_active: true,
          is_trial: ownerSub.status === 'trial',
          trial_end_date: ownerSub.trial_end_date || undefined,
        });
        setLoading(false);
        return;
      }

      // For members, check razorpay_subscriptions table AND trial
      const subscriptionState = getSubscriptionState(profile.created_at, null);

      // Check for active paid subscription
      const { data: razorpaySub, error: razorpayError } = await supabase
        .from('razorpay_subscriptions')
        .select(`
          *,
          plans:plan_id(name, price, duration_days)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (razorpaySub && !razorpayError) {
        // Active paid subscription found
        const endDate = new Date(razorpaySub.end_date);
        const now = new Date();
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        setHasActiveSubscription(true);
        setIsTrial(false);
        setSubscriptionInfo({
          subscription_id: razorpaySub.id,
          plan_name: razorpaySub.plans?.name || 'Premium Plan',
          plan_price: razorpaySub.plans?.price || 0,
          status: razorpaySub.status,
          start_date: razorpaySub.start_date,
          end_date: razorpaySub.end_date,
          days_remaining: daysRemaining,
          is_active: true,
          is_trial: false,
        });
        setLoading(false);
        return;
      }

      // No paid subscription - check trial
      if (subscriptionState.hasAccess && subscriptionState.isTrial) {
        setHasActiveSubscription(true);
        setIsTrial(true);
        setSubscriptionInfo({
          subscription_id: '',
          plan_name: 'Free Trial',
          plan_price: 0,
          status: 'trial',
          start_date: profile.created_at || '',
          end_date: subscriptionState.trialEndDate?.toISOString() || '',
          days_remaining: subscriptionState.daysRemaining,
          is_active: true,
          is_trial: true,
          trial_end_date: subscriptionState.trialEndDate?.toISOString(),
        });
        setLoading(false);
        return;
      }

      // No access (trial expired, no subscription)
      setHasActiveSubscription(false);
      setIsTrial(false);
      setSubscriptionInfo(null);
      setLoading(false);

    } catch (error) {
      console.error('❌ Error refreshing subscription:', error);
      setHasActiveSubscription(false);
      setSubscriptionInfo(null);
      setIsTrial(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && profile) {
      refreshSubscription();
    } else {
      setLoading(false);
    }
  }, [user?.id, profile?.id, profile?.role, profile?.created_at, profile?.gym_id]);

  const canAccessFeature = (feature: string): boolean => {
    // Admin always has access
    if (profile?.role === 'admin') {
      return true;
    }

    // Gym owners - check subscription/trial (Dashboard and Profile always available)
    if (profile?.role === 'gym_owner') {
      const freeFeatures = ['dashboard', 'profile'];
      if (freeFeatures.includes(feature.toLowerCase())) {
        return true;
      }
      return hasActiveSubscription; // Other tabs require subscription/trial
    }

    // Members - check subscription/trial
    const freeFeatures = ['dashboard', 'profile', 'plans'];
    if (freeFeatures.includes(feature.toLowerCase())) {
      return true;
    }

    // Premium features require active subscription or trial
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
        isTrial,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

