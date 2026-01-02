// /lib/ownerSubscriptions.ts
import { supabase } from "./supabase";

export interface OwnerSubscriptionPlan {
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
  razorpay_plan_id?: string;
}

export interface OwnerSubscription {
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

export interface CreateOwnerSubscriptionParams {
  ownerId: string;
  gymId: string;
  planId: string;
}

export interface UpdateOwnerPaymentParams {
  subscriptionId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  paymentStatus: 'success' | 'failed';
}

/**
 * Get all available owner subscription plans
 */
export async function getOwnerSubscriptionPlans() {
  try {
    const { data, error } = await supabase
      .from("owner_subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error("getOwnerSubscriptionPlans error:", error);
    return { data: null, error };
  }
}

/**
 * Get a specific plan by ID
 */
export async function getOwnerSubscriptionPlan(planId: string) {
  try {
    const { data, error } = await supabase
      .from("owner_subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error("getOwnerSubscriptionPlan error:", error);
    return { data: null, error };
  }
}

/**
 * Create a new owner subscription (initial setup)
 */
export async function createOwnerSubscription(params: CreateOwnerSubscriptionParams) {
  try {
    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("owner_subscription_plans")
      .select("*")
      .eq("id", params.planId)
      .single();

    if (planError) throw planError;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration_days);

    let trialEndDate = null;
    let status = 'pending';
    
    if (plan.trial_days > 0) {
      trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + plan.trial_days);
      status = 'trial';
    }

    const { data, error } = await supabase
      .from("owner_subscriptions")
      .insert({
        owner_id: params.ownerId,
        gym_id: params.gymId,
        plan_id: params.planId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        trial_end_date: trialEndDate?.toISOString(),
        status,
        payment_status: 'pending',
        auto_renew: true,
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error("createOwnerSubscription error:", error);
    return { data: null, error };
  }
}

/**
 * Update owner subscription with Razorpay payment details
 */
export async function updateOwnerPayment(
  subscriptionId: string,
  params: UpdateOwnerPaymentParams
) {
  try {
    const updateData: any = {
      razorpay_order_id: params.razorpayOrderId,
      razorpay_payment_id: params.razorpayPaymentId,
      razorpay_signature: params.razorpaySignature,
      payment_status: params.paymentStatus,
      last_payment_date: new Date().toISOString(),
    };

    // If payment successful, activate subscription
    if (params.paymentStatus === 'success') {
      updateData.status = 'active';
      
      // Get subscription to calculate next billing date
      const { data: subscription } = await supabase
        .from("owner_subscriptions")
        .select("end_date, plan_id")
        .eq("id", subscriptionId)
        .single();

      if (subscription) {
        // Get plan details to know billing cycle
        const { data: plan } = await supabase
          .from("owner_subscription_plans")
          .select("duration_days")
          .eq("id", subscription.plan_id)
          .single();

        if (plan) {
          const nextBillingDate = new Date(subscription.end_date);
          updateData.next_billing_date = nextBillingDate.toISOString().split('T')[0];
        }
      }
    }

    const { data, error } = await supabase
      .from("owner_subscriptions")
      .update(updateData)
      .eq("id", subscriptionId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error("updateOwnerPayment error:", error);
    return { data: null, error };
  }
}

/**
 * Get active owner subscription
 */
export async function getActiveOwnerSubscription(ownerId: string, gymId: string) {
  try {
    const { data, error } = await supabase
      .from("owner_subscriptions")
      .select(`
        *,
        plan:plan_id(*)
      `)
      .eq("owner_id", ownerId)
      .eq("gym_id", gymId)
      .in("status", ["active", "trial"])
      .gte("end_date", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return { data, error: null };
  } catch (error) {
    console.error("getActiveOwnerSubscription error:", error);
    return { data: null, error };
  }
}

/**
 * Get all subscriptions for an owner (history)
 */
export async function getOwnerSubscriptionHistory(ownerId: string, gymId: string) {
  try {
    const { data, error } = await supabase
      .from("owner_subscriptions")
      .select(`
        *,
        plan:plan_id(*)
      `)
      .eq("owner_id", ownerId)
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error("getOwnerSubscriptionHistory error:", error);
    return { data: null, error };
  }
}

/**
 * Cancel owner subscription
 */
export async function cancelOwnerSubscription(subscriptionId: string, reason?: string) {
  try {
    const { data, error } = await supabase
      .from("owner_subscriptions")
      .update({
        status: 'cancelled',
        auto_renew: false,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
      })
      .eq("id", subscriptionId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error("cancelOwnerSubscription error:", error);
    return { data: null, error };
  }
}

/**
 * Renew/Extend owner subscription
 */
export async function renewOwnerSubscription(subscriptionId: string) {
  try {
    // Get current subscription
    const { data: currentSub, error: fetchError } = await supabase
      .from("owner_subscriptions")
      .select(`
        *,
        plan:plan_id(*)
      `)
      .eq("id", subscriptionId)
      .single();

    if (fetchError) throw fetchError;

    const plan = currentSub.plan as OwnerSubscriptionPlan;
    
    // Calculate new dates
    const currentEndDate = new Date(currentSub.end_date);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setDate(newEndDate.getDate() + plan.duration_days);

    const { data, error } = await supabase
      .from("owner_subscriptions")
      .update({
        end_date: newEndDate.toISOString(),
        status: 'active',
        payment_status: 'pending',
        next_billing_date: newEndDate.toISOString().split('T')[0],
      })
      .eq("id", subscriptionId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error("renewOwnerSubscription error:", error);
    return { data: null, error };
  }
}

/**
 * Check if owner has active subscription
 */
export async function hasActiveOwnerSubscription(
  ownerId: string, 
  gymId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("owner_subscriptions")
      .select("id, status, end_date")
      .eq("owner_id", ownerId)
      .eq("gym_id", gymId)
      .in("status", ["active", "trial"])
      .gte("end_date", new Date().toISOString())
      .limit(1)
      .single();

    return !!data && !error;
  } catch (error) {
    return false;
  }
}

/**
 * Check if subscription is expiring soon (within 7 days)
 */
export async function isSubscriptionExpiringSoon(
  subscriptionId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("owner_subscriptions")
      .select("end_date, status")
      .eq("id", subscriptionId)
      .single();

    if (error || !data) return false;

    if (data.status !== 'active' && data.status !== 'trial') return false;

    const endDate = new Date(data.end_date);
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    return endDate <= sevenDaysFromNow;
  } catch (error) {
    return false;
  }
}

/**
 * Get subscription limits (member limit, trainer limit, etc.)
 */
export async function getSubscriptionLimits(ownerId: string, gymId: string) {
  try {
    const { data, error } = await supabase
      .from("owner_subscriptions")
      .select(`
        plan:plan_id(
          member_limit,
          trainer_limit,
          storage_limit_mb,
          features
        )
      `)
      .eq("owner_id", ownerId)
      .eq("gym_id", gymId)
      .in("status", ["active", "trial"])
      .gte("end_date", new Date().toISOString())
      .single();

    if (error) throw error;

    const plan = data.plan as OwnerSubscriptionPlan;
    return {
      data: {
        memberLimit: plan.member_limit,
        trainerLimit: plan.trainer_limit,
        storageLimitMb: plan.storage_limit_mb,
        features: plan.features,
      },
      error: null,
    };
  } catch (error) {
    console.error("getSubscriptionLimits error:", error);
    return { data: null, error };
  }
}