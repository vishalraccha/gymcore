// supabase/functions/create-routed-order/index.ts
// Deploy: supabase functions deploy create-routed-order

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateOrderRequest {
  planId: string;
  amount: number;
  currency?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔵 Creating routed order...');

    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const supabaseClient = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Use service role key
      {
        auth: {
          persistSession: false, // Don't persist in edge functions
        },
      }
    );
    // Verify user
    console.log('🔵 Verifying user...');
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('✅ User authenticated:', user.id);

    // 2. Parse request
    const body: CreateOrderRequest = await req.json();
    const { planId, amount, currency = 'INR' } = body;

    if (!planId || !amount) {
      throw new Error('Missing required fields: planId, amount');
    }

    console.log('📋 Request:', { planId, amount, currency });

    // 3. Get user's gym (CRITICAL: Backend derives gym_id from user profile)
    console.log('🔵 Fetching user gym association...');
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('gym_id, id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    if (!profile.gym_id) {
      throw new Error('User not associated with any gym');
    }

    console.log('✅ User gym:', profile.gym_id);

    // 4. Get gym owner details
    console.log('🔵 Fetching gym owner details...');
    const { data: gymOwner, error: gymError } = await supabaseClient
      .from('gym_owners')
      .select('*')
      .eq('id', profile.gym_id)
      .single();

    if (gymError || !gymOwner) {
      throw new Error('Gym owner not found');
    }

    // Validate gym owner status
    if (!gymOwner.razorpay_account_id) {
      throw new Error('Gym owner has not set up payment account');
    }

    if (!gymOwner.onboarding_completed) {
      throw new Error('Gym owner has not completed KYC verification');
    }

    if (!gymOwner.is_active) {
      throw new Error('Gym owner account is inactive');
    }

    if (gymOwner.razorpay_account_status !== 'activated') {
      throw new Error(`Gym owner account status: ${gymOwner.razorpay_account_status}`);
    }

    console.log('✅ Gym owner validated:', {
      account_id: gymOwner.razorpay_account_id,
      status: gymOwner.razorpay_account_status,
      commission: gymOwner.commission_percentage,
    });

    // 5. Get and verify plan
    console.log('🔵 Fetching plan details...');
    const { data: plan, error: planError } = await supabaseClient
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found or inactive');
    }

    // CRITICAL: Verify plan belongs to user's gym
    if (plan.gym_id !== profile.gym_id) {
      console.error('❌ Security violation: Plan gym mismatch', {
        plan_gym: plan.gym_id,
        user_gym: profile.gym_id,
      });
      throw new Error('Unauthorized: Plan does not belong to your gym');
    }

    console.log('✅ Plan verified:', plan.name);

    // 6. Verify amount
    const expectedAmount = Math.round(plan.price * 100);
    if (Math.abs(amount - expectedAmount) > 1) {
      console.error('❌ Amount mismatch:', {
        expected: expectedAmount,
        received: amount,
      });
      throw new Error(`Amount mismatch. Expected ₹${plan.price}, got ₹${amount / 100}`);
    }

    console.log('✅ Amount verified:', amount, 'paise');

    // 7. Calculate commission split
    const platformCommission = Math.floor(amount * gymOwner.commission_percentage / 100);
    const gymOwnerAmount = amount - platformCommission;

    console.log('💰 Split:', {
      total: amount,
      gym_owner: gymOwnerAmount,
      commission: platformCommission,
      percentage: gymOwner.commission_percentage,
    });

    // 8. Create Razorpay order with transfer
    console.log('🔵 Creating Razorpay order...');
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    const timestamp = Date.now().toString().slice(-8);
    const userIdShort = user.id.slice(0, 8);
    const receipt = `rcpt_${userIdShort}_${timestamp}`;

    const orderPayload = {
      amount: amount,
      currency: currency,
      receipt: receipt,
      transfers: [
        {
          account: gymOwner.razorpay_account_id,
          amount: gymOwnerAmount,
          currency: currency,
          notes: {
            gym_id: profile.gym_id,
            gym_name: gymOwner.gym_name,
            plan_id: planId,
            plan_name: plan.name,
            user_id: user.id,
          },
          linked_account_notes: [
            'GymCore Platform',
            `Member: ${user.email}`,
            `Plan: ${plan.name}`,
          ],
          on_hold: false, // Set to true if you want manual release
        },
      ],
      notes: {
        user_id: user.id,
        gym_id: profile.gym_id,
        gym_owner_id: gymOwner.id,
        plan_id: planId,
        gym_owner_amount: gymOwnerAmount,
        platform_commission: platformCommission,
        created_from: 'gymcore_app',
      },
    };

    console.log('📤 Sending to Razorpay...');

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error('❌ Razorpay API error:', errorText);
      throw new Error('Failed to create Razorpay order');
    }

    const order = await razorpayResponse.json();
    console.log('✅ Order created:', order.id);

    // 9. Return success response
    return new Response(
      JSON.stringify({
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        gym_name: gymOwner.gym_name,
        plan_name: plan.name,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Error in create-routed-order:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.toString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});