import { supabase } from './supabase';

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
): Promise => {
  try {
    console.log('Creating REAL Razorpay order:', params);
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Not authenticated. Please login again.');
    }

    // Verify plan exists
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', params.planId)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found or inactive');
    }

    // Call Edge Function to create REAL order
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
      console.error('Edge Function error:', functionError);
      throw new Error(functionError.message || 'Failed to create order');
    }

    if (!orderData || !orderData.id) {
      console.error('Invalid order data:', orderData);
      throw new Error('Invalid order response from server');
    }

    console.log('✅ Real Razorpay order created:', orderData.id);
    return orderData;
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create payment order';
    console.error('Error creating Razorpay order:', error);
    throw new Error(errorMessage);
  }
};

/**
 * Verify payment and activate subscription
 */
export const verifyAndActivateSubscription = async (
  params: VerifyPaymentParams
): Promise => {
  try {
    console.log('Activating subscription:', params);
    
    const { data, error } = await supabase.rpc('activate_razorpay_subscription', {
      p_user_id: params.user_id,
      p_plan_id: params.plan_id,
      p_razorpay_payment_id: params.razorpay_payment_id,
      p_razorpay_order_id: params.razorpay_order_id,
      p_razorpay_signature: params.razorpay_signature,
    });

    if (error) {
      console.error('Subscription activation error:', error);
      throw error;
    }

    console.log('Subscription activated:', data);
    return data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to activate subscription';
    console.error('Error activating subscription:', error);
    throw new Error(errorMessage);
  }
};

/**
 * Check if user has active subscription
 */
export const checkActiveSubscription = async (
  userId: string
): Promise => {
  try {
    const { data, error } = await supabase.rpc('has_active_razorpay_subscription', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error checking subscription:', error);
      return false;
    }

    return data as boolean;
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
};

/**
 * Get user subscription info
 */
export const getUserSubscriptionInfo = async (
  userId: string
): Promise => {
  try {
    const { data, error } = await supabase.rpc('get_razorpay_subscription_info', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error getting subscription info:', error);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error getting subscription info:', error);
    return null;
  }
};

/**
 * Get all active plans
 */
export const getAllPlans = async (): Promise => {
  try {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      console.error('Error fetching plans:', error);
      throw error;
    }

    return data || [];
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
): Promise => {
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
export const getAllSubscriptions = async (): Promise => {
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