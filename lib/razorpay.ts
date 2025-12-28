import { supabase } from './supabase';
import { createSubscriptionInvoice } from './invoice';

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration_days: number;
  features: string[];
  is_active: boolean;
}

export interface SubscriptionInfo {
  subscription_id: string;
  plan_name: string;
  plan_price: number;
  status: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  is_active: boolean;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  [key: string]: string | number | boolean | object | null;
}

export interface Payment {
  id: string;
  user_id: string;
  razorpay_subscription_id: string;
  plan_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  status: string;
  payment_date: string;
  created_at: string;
  plan: {
    name: string;
    price: number;
    duration_days: number;
  };
  razorpay_subscription: {
    start_date: string;
    end_date: string;
    status: string;
  };
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
  user?: {
    full_name: string;
    email: string;
  };
  plan?: {
    name: string;
    price: number;
    duration_days: number;
  };
}

export interface CreateOrderParams {
  amount: number;
  currency?: string;
  planId: string;
  userId: string;
}

export interface VerifyPaymentParams {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  plan_id: string;
  user_id: string;
}

/**
 * Create REAL Razorpay order via Supabase Edge Function
 */
export const createRazorpayOrder = async (
  params: CreateOrderParams
): Promise<RazorpayOrder> => {
  try {
    console.log('🔵 Creating Razorpay order with params:', {
      amount: params.amount,
      currency: params.currency,
      planId: params.planId,
      userId: params.userId
    });
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      throw new Error('Authentication error. Please login again.');
    }

    if (!session) {
      console.error('❌ No session found');
      throw new Error('Not authenticated. Please login again.');
    }

    console.log('✅ Session valid, user:', session.user.id);

    // Verify plan exists and is active
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', params.planId)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found or inactive');
    }

    console.log('✅ Plan found:', plan.name);

    // Verify amount matches plan price
    const expectedAmount = Math.round(plan.price * 100);
    if (Math.abs(params.amount - expectedAmount) > 1) {
      throw new Error(`Amount mismatch. Expected ₹${plan.price}`);
    }

    // Call Supabase Edge Function
    const { data: orderData, error: functionError } = await supabase.functions.invoke(
      'create-razorpay-order',
      {
        body: {
          amount: params.amount,
          currency: params.currency || 'INR',
          planId: params.planId,
          userId: params.userId
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      }
    );

    if (functionError) {
      throw new Error(functionError.message || 'Failed to create order');
    }

    if (orderData?.error) {
      throw new Error(orderData.error);
    }

    if (!orderData?.id) {
      throw new Error('Invalid order response from server');
    }

    console.log('✅ Order created:', orderData.id);
    return orderData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create payment order';
    console.error('❌ Error creating order:', errorMessage);
    throw new Error(errorMessage);
  }
};

/**
 * Verify payment and activate subscription
 */
export const verifyAndActivateSubscription = async (
  params: VerifyPaymentParams
): Promise<string> => {
  try {
    console.log('🔵 Verifying payment and activating subscription...');
    
    if (!params.razorpay_payment_id || !params.razorpay_order_id || !params.razorpay_signature) {
      throw new Error('Missing required payment parameters');
    }

    if (!params.plan_id || !params.user_id) {
      throw new Error('Missing plan or user information');
    }

    const { data, error } = await supabase.rpc('activate_razorpay_subscription', {
      p_user_id: params.user_id,
      p_plan_id: params.plan_id,
      p_razorpay_payment_id: params.razorpay_payment_id,
      p_razorpay_order_id: params.razorpay_order_id,
      p_razorpay_signature: params.razorpay_signature,
    });

    if (error) {
      throw new Error(error.message || 'Failed to activate subscription');
    }

    if (!data) {
      throw new Error('No subscription ID returned');
    }

    console.log('✅ Subscription activated:', data);

    // Create invoice for the payment
    try {
      // Get subscription details to calculate amount
      const { data: planData } = await supabase
        .from('subscriptions')
        .select('price')
        .eq('id', params.plan_id)
        .single();

      if (planData) {
        await createSubscriptionInvoice(
          params.user_id,
          params.plan_id,
          planData.price,
          'razorpay',
          params.razorpay_payment_id,
          undefined // gym_id will be fetched from user profile if needed
        );
        console.log('✅ Invoice created for payment');
      }
    } catch (invoiceError) {
      console.error('⚠️ Error creating invoice (non-critical):', invoiceError);
      // Don't fail the subscription activation if invoice creation fails
    }

    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to activate subscription';
    console.error('❌ Error activating subscription:', error);
    throw new Error(errorMessage);
  }
};

/**
 * Check if user has active subscription - CORRECTED FOR YOUR DATABASE
 */
export async function checkActiveSubscription(userId: string): Promise<boolean> {
  try {
    console.log('🔍 Checking subscription for user:', userId);
    
    const { data, error } = await supabase
      .from('razorpay_subscriptions')
      .select('id, status, end_date, start_date')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no record exists

    if (error) {
      console.error('❌ Error checking subscription:', error);
      return false;
    }

    if (!data) {
      console.log('ℹ️ No active subscription found for user');
      return false;
    }

    console.log('📊 Found subscription:', {
      id: data.id,
      status: data.status,
      start_date: data.start_date,
      end_date: data.end_date
    });

    // Check if subscription has expired
    const endDate = new Date(data.end_date);
    const now = new Date();
    
    console.log('📅 Date comparison:', {
      endDate: endDate.toISOString(),
      now: now.toISOString(),
      isExpired: endDate < now
    });
    
    if (endDate < now) {
      console.log('⚠️ Subscription expired, updating status...');
      // Subscription has expired, update status
      await supabase
        .from('razorpay_subscriptions')
        .update({ status: 'expired' })
        .eq('id', data.id);
      
      return false;
    }

    console.log('✅ Active subscription confirmed');
    return true;
  } catch (error) {
    console.error('❌ Error in checkActiveSubscription:', error);
    return false;
  }
}

/**
 * Get user subscription info - CORRECTED FOR YOUR DATABASE
 */
export async function getUserSubscriptionInfo(
  userId: string
): Promise<SubscriptionInfo | null> {
  try {
    console.log('🔍 Getting subscription info for user:', userId);
    
    // Get subscription with plan details using JOIN
    const { data, error } = await supabase
      .from('razorpay_subscriptions')
      .select(`
        id,
        user_id,
        plan_id,
        status,
        start_date,
        end_date,
        razorpay_subscription_id,
        plans!inner (
          name,
          price,
          duration_days
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Error getting subscription info:', error);
      return null;
    }

    if (!data) {
      console.log('ℹ️ No subscription info found');
      return null;
    }

    console.log('📊 Subscription data retrieved:', {
      id: data.id,
      status: data.status,
      plan_name: data.plans?.name
    });

    const endDate = new Date(data.end_date);
    const now = new Date();
    const daysRemaining = Math.ceil(
      (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const subscriptionInfo: SubscriptionInfo = {
      subscription_id: data.id,
      plan_name: data.plans?.name || 'Premium Plan',
      plan_price: data.plans?.price || 0,
      status: data.status,
      start_date: data.start_date,
      end_date: data.end_date,
      days_remaining: daysRemaining,
      is_active: daysRemaining > 0,
    };

    console.log('✅ Subscription info:', {
      plan_name: subscriptionInfo.plan_name,
      days_remaining: subscriptionInfo.days_remaining,
      is_active: subscriptionInfo.is_active
    });

    return subscriptionInfo;
  } catch (error) {
    console.error('❌ Error getting subscription info:', error);
    return null;
  }
}

/**
 * Get user subscription history
 */
export async function getUserSubscriptionHistory(userId: string) {
  try {
    const { data, error } = await supabase
      .from('razorpay_subscriptions')
      .select(`
        *,
        plans (
          name,
          price,
          duration_days
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching subscription history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserSubscriptionHistory:', error);
    return [];
  }
}

/**
 * Get all active plans - FIXED to use subscriptions table and filter by gym
 */
export const getAllPlans = async (): Promise<Plan[]> => {
  try {
    // Get current user's profile to find their gym_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from('profiles')
      .select('gym_id')
      .eq('id', user.id)
      .single();

    // Query subscriptions table (not plans table)
    let query = supabase
      .from('subscriptions')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    // Filter by gym_id if user is a member
    if (profile?.gym_id) {
      query = query.eq('gym_id', profile.gym_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching plans:', error);
      throw error;
    }

    // Transform subscriptions to Plan format
    const plans: Plan[] = (data || []).map((sub: any) => ({
      id: sub.id,
      name: sub.name,
      description: sub.description || '',
      price: sub.price,
      currency: sub.currency || 'INR',
      duration_days: sub.duration_days,
      features: sub.features || [],
      is_active: sub.is_active,
    }));

    return plans;
  } catch (error) {
    console.error('Error fetching plans:', error);
    return [];
  }
};

/**
 * Get user payment history
 */
export const getUserPaymentHistory = async (
  userId: string
): Promise<Payment[]> => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        plan:plans(name, price, duration_days),
        razorpay_subscription:razorpay_subscriptions(start_date, end_date, status)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching payment history:', error);
    return [];
  }
};

/**
 * Get all subscriptions (Admin/Gym Owner only)
 */
export const getAllSubscriptions = async (): Promise<Subscription[]> => {
  try {
    const { data, error } = await supabase
      .from('razorpay_subscriptions')
      .select(`
        *,
        user:profiles!razorpay_subscriptions_user_id_fkey(full_name, email),
        plan:plans(name, price, duration_days)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all subscriptions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching all subscriptions:', error);
    return [];
  }
};