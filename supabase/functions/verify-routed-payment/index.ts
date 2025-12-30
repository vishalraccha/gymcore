// supabase/functions/verify-routed-payment/index.ts
// Deploy: supabase functions deploy verify-routed-payment

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  plan_id: string;
  user_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔵 Verifying routed payment...');

    // 1. Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
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

    // 2. Parse request
    const body: VerifyPaymentRequest = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_id,
      user_id,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error('Missing payment parameters');
    }

    if (user.id !== user_id) {
      throw new Error('User ID mismatch');
    }

    console.log('📋 Payment to verify:', {
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
    });

    // 3. Verify signature
    console.log('🔵 Verifying signature...');
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error('❌ Signature mismatch');
      throw new Error('Invalid payment signature');
    }

    console.log('✅ Signature verified');

    // 4. Get payment details from Razorpay
    console.log('🔵 Fetching payment details from Razorpay...');
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
      {
        headers: { 'Authorization': `Basic ${auth}` },
      }
    );

    if (!paymentResponse.ok) {
      throw new Error('Failed to fetch payment details');
    }

    const payment = await paymentResponse.json();
    console.log('✅ Payment fetched:', {
      status: payment.status,
      amount: payment.amount,
    });

    if (payment.status !== 'captured') {
      throw new Error(`Payment not captured. Status: ${payment.status}`);
    }

    // 5. Get transfer details
    console.log('🔵 Fetching transfer details...');
    const transfersResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${razorpay_payment_id}/transfers`,
      {
        headers: { 'Authorization': `Basic ${auth}` },
      }
    );

    if (!transfersResponse.ok) {
      throw new Error('Failed to fetch transfer details');
    }

    const transfers = await transfersResponse.json();
    const transfer = transfers.items[0];

    console.log('✅ Transfer found:', transfer?.id || 'none');

    // 6. Get plan and gym owner info
    const { data: plan } = await supabaseClient
      .from('plans')
      .select('*, gym_id')
      .eq('id', plan_id)
      .single();

    if (!plan) {
      throw new Error('Plan not found');
    }

    const { data: gymOwner } = await supabaseClient
      .from('gym_owners')
      .select('*')
      .eq('id', plan.gym_id)
      .single();

    if (!gymOwner) {
      throw new Error('Gym owner not found');
    }

    // 7. Create payment record
    console.log('🔵 Creating payment record...');
    const { data: paymentRecord, error: paymentError } = await supabaseClient
      .from('payments')
      .insert({
        user_id: user_id,
        plan_id: plan_id,
        razorpay_order_id: razorpay_order_id,
        razorpay_payment_id: razorpay_payment_id,
        razorpay_signature: razorpay_signature,
        amount: payment.amount / 100, // Convert paise to rupees
        currency: payment.currency,
        payment_method: payment.method,
        status: 'success',
        payment_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (paymentError) {
      console.error('❌ Payment record error:', paymentError);
      throw paymentError;
    }

    console.log('✅ Payment record created:', paymentRecord.id);

    // 8. Record route transaction
    if (transfer) {
      console.log('🔵 Recording route transaction...');
      const notes = payment.notes || {};
      
      const { error: routeError } = await supabaseClient
        .from('route_transactions')
        .insert({
          payment_id: paymentRecord.id,
          razorpay_payment_id: razorpay_payment_id,
          razorpay_order_id: razorpay_order_id,
          gym_owner_id: gymOwner.id,
          razorpay_account_id: transfer.recipient,
          total_amount: payment.amount,
          gym_owner_amount: parseInt(notes.gym_owner_amount || transfer.amount),
          platform_commission: parseInt(notes.platform_commission || (payment.amount - transfer.amount)),
          razorpay_transfer_id: transfer.id,
          transfer_status: transfer.status,
          transfer_created_at: new Date(transfer.created_at * 1000).toISOString(),
          notes: {
            payment_method: payment.method,
            gym_name: gymOwner.gym_name,
            plan_name: plan.name,
          },
        });

      if (routeError) {
        console.error('⚠️ Route transaction error:', routeError);
        // Non-critical, continue
      } else {
        console.log('✅ Route transaction recorded');
      }
    }

    // 9. Activate subscription
    console.log('🔵 Activating subscription...');
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration_days);

    const { data: subscription, error: subError } = await supabaseClient
      .from('razorpay_subscriptions')
      .insert({
        user_id: user_id,
        plan_id: plan_id,
        razorpay_subscription_id: `sub_${razorpay_payment_id}`, // Generate unique ID
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active',
      })
      .select()
      .single();

    if (subError) {
      console.error('❌ Subscription error:', subError);
      throw subError;
    }

    console.log('✅ Subscription activated:', subscription.id);

    // 10. Return success
    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: subscription.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        plan_name: plan.name,
        gym_name: gymOwner.gym_name,
        message: 'Payment verified and subscription activated',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Error in verify-routed-payment:', error);
    return new Response(
      JSON.stringify({
        success: false,
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