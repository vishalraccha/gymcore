// lib/marketplace.ts
// API client for marketplace features

import { supabase } from './supabase';

export interface GymOwner {
  id: string;
  user_id: string;
  gym_name: string;
  gym_address: string;
  gym_city: string;
  gym_state: string;
  gym_pincode: string;
  gym_phone: string;
  business_type: string;
  business_name: string;
  gstin?: string;
  razorpay_account_id?: string;
  razorpay_account_status: string;
  onboarding_link?: string;
  onboarding_completed: boolean;
  kyc_status: string;
  commission_percentage: number;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface CreateGymAccountParams {
  gymName: string;
  gymAddress: string;
  gymCity: string;
  gymState: string;
  gymPincode: string;
  gymPhone: string;
  email: string;
  phone: string;
  businessType: 'individual' | 'partnership' | 'llp' | 'private_limited' | 'public_limited' | 'trust' | 'society' | 'ngo';
  businessName?: string;
  gstin?: string;
}

export interface RouteTransaction {
  id: string;
  payment_id: string;
  razorpay_payment_id: string;
  gym_owner_id: string;
  total_amount: number;
  gym_owner_amount: number;
  platform_commission: number;
  transfer_status: string;
  created_at: string;
}

/**
 * Create gym owner Razorpay account
 */
export const createGymAccount = async (
  params: CreateGymAccountParams
): Promise<any> => {
  try {
    console.log('🔵 Creating gym account...');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase.functions.invoke(
      'create-gym-account',
      {
        body: params,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (error) {
      console.error('❌ Error:', error);
      throw new Error(error.message);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    console.log('✅ Account created:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Create gym account error:', error);
    throw error;
  }
};

/**
 * Get gym owner profile
 */
export const getGymOwnerProfile = async (): Promise<GymOwner | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    const { data, error } = await supabase
      .from('gym_owners')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching gym owner profile:', error);
    return null;
  }
};

/**
 * Update gym owner profile
 */
export const updateGymOwnerProfile = async (
  updates: Partial<GymOwner>
): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('gym_owners')
      .update(updates)
      .eq('user_id', user.id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating gym owner:', error);
    throw error;
  }
};

/**
 * Create routed order (for members)
 */
export const createRoutedOrder = async (params: {
  planId: string;
  amount: number;
  currency?: string;
}): Promise<any> => {
  try {
    console.log('🔵 Creating routed order...');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase.functions.invoke(
      'create-routed-order',
      {
        body: {
          planId: params.planId,
          amount: params.amount,
          currency: params.currency || 'INR',
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (error) {
      console.error('❌ Error:', error);
      throw new Error(error.message);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    console.log('✅ Order created:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Create routed order error:', error);
    throw error;
  }
};

/**
 * Verify routed payment
 */
export const verifyRoutedPayment = async (params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  plan_id: string;
  user_id: string;
}): Promise<any> => {
  try {
    console.log('🔵 Verifying routed payment...');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase.functions.invoke(
      'verify-routed-payment',
      {
        body: params,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (error) {
      console.error('❌ Error:', error);
      throw new Error(error.message);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    console.log('✅ Payment verified:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Verify payment error:', error);
    throw error;
  }
};

/**
 * Get gym earnings summary
 */
export const getGymEarnings = async (): Promise<any> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get gym owner ID
    const { data: gymOwner } = await supabase
      .from('gym_owners')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!gymOwner) throw new Error('Gym owner not found');

    // Call function
    const { data, error } = await supabase.rpc('get_gym_earnings_summary', {
      gym_owner_id_param: gymOwner.id,
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching earnings:', error);
    throw error;
  }
};

/**
 * Get gym transactions
 */
export const getGymTransactions = async (): Promise<RouteTransaction[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: gymOwner } = await supabase
      .from('gym_owners')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!gymOwner) return [];

    const { data, error } = await supabase
      .from('route_transactions')
      .select('*')
      .eq('gym_owner_id', gymOwner.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
};

/**
 * Get member's gym info
 */
export const getMemberGymInfo = async (): Promise<any> => {
  try {
    const { data, error } = await supabase.rpc('get_user_gym_info');

    if (error) throw error;

    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error fetching gym info:', error);
    return null;
  }
};