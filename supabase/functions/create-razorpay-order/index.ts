// supabase/functions/create-razorpay-order/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateOrderRequest {
  amount: number;
  currency: string;
  planId: string;
  userId: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔵 Edge function called');

    // Check environment variables
    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    console.log('🔍 Environment check:', {
      hasRazorpayKeyId: !!RAZORPAY_KEY_ID,
      hasRazorpayKeySecret: !!RAZORPAY_KEY_SECRET,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasSupabaseAnonKey: !!SUPABASE_ANON_KEY,
    });

    if (!RAZORPAY_KEY_ID) {
      throw new Error('RAZORPAY_KEY_ID environment variable is not set');
    }

    if (!RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_SECRET environment variable is not set');
    }

    if (!SUPABASE_URL) {
      throw new Error('SUPABASE_URL environment variable is not set');
    }

    if (!SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_ANON_KEY environment variable is not set');
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('🔍 Auth header present:', !!authHeader);

    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client
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

    if (userError) {
      console.error('❌ User error:', userError);
      throw new Error(`Unauthorized: ${userError.message}`);
    }

    if (!user) {
      throw new Error('Unauthorized - No user found');
    }

    console.log('✅ User verified:', user.id);

    // Parse request body
    console.log('🔵 Parsing request body...');
    const body: CreateOrderRequest = await req.json();
    console.log('📦 Request body:', {
      amount: body.amount,
      currency: body.currency,
      planId: body.planId,
      userId: body.userId,
    });

    const { amount, currency = 'INR', planId, userId } = body;

    // Validate request
    if (!amount) {
      throw new Error('Missing required parameter: amount');
    }

    if (!planId) {
      throw new Error('Missing required parameter: planId');
    }

    if (!userId) {
      throw new Error('Missing required parameter: userId');
    }

    if (user.id !== userId) {
      throw new Error('User ID mismatch - authentication error');
    }

    console.log('✅ Request validated');

    // Fetch plan from database (using plans table - CREATOR's global plans)
    console.log('🔵 Fetching subscription plan from database...');
    const { data: plan, error: planError } = await supabaseClient
      .from('plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single();

    if (planError) {
      console.error('❌ Plan error:', planError);
      throw new Error(`Plan error: ${planError.message}`);
    }

    if (!plan) {
      throw new Error('Invalid or inactive plan');
    }

    console.log('✅ Plan found:', {
      id: plan.id,
      name: plan.name,
      price: plan.price,
      gym_id: plan.gym_id,
    });

    // ⭐ CRITICAL: ALL ONLINE PAYMENTS GO TO CREATOR
    // Do NOT route payments to gym owners for online subscriptions
    // Gym fees remain OFFLINE and paid to gym owners separately
    
    // Verify amount
    const expectedAmount = Math.round(plan.price * 100);
    console.log('🔍 Amount check:', {
      expected: expectedAmount,
      received: amount,
      difference: Math.abs(amount - expectedAmount),
    });

    if (Math.abs(amount - expectedAmount) > 1) {
      throw new Error(
        `Amount mismatch: Expected ${expectedAmount} paise (₹${plan.price}), got ${amount} paise`
      );
    }

    console.log('✅ Amount verified');

    // Create Razorpay order - ALL PAYMENTS GO TO CREATOR
    console.log('🔵 Creating Razorpay order (payment goes to CREATOR)...');
    
    // Always use CREATOR's Razorpay credentials
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    
    // Generate short receipt (max 40 chars)
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits
    const userIdShort = user.id.slice(0, 8); // First 8 chars of user ID
    const receipt = `rcpt_${userIdShort}_${timestamp}`; // Total: ~25 chars
    
    console.log('📝 Receipt generated:', receipt, `(${receipt.length} chars)`);
    
    // ⭐ NO TRANSFERS - Payment goes directly to CREATOR
    const razorpayPayload: any = {
      amount: amount,
      currency: currency,
      receipt: receipt,
      notes: {
        user_id: user.id,
        plan_id: planId,
        plan_name: plan.name,
        payment_type: 'member_subscription',
        purpose: 'app_subscription_payment', // Goes to CREATOR
      },
    };

    console.log('✅ Payment will go directly to CREATOR account (no routing)');

    console.log('📦 Razorpay payload:', razorpayPayload);

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(razorpayPayload),
    });

    console.log('📡 Razorpay response status:', razorpayResponse.status);

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error('❌ Razorpay API error:', {
        status: razorpayResponse.status,
        statusText: razorpayResponse.statusText,
        body: errorText,
      });
      throw new Error(`Razorpay API error: ${errorText}`);
    }

    const order = await razorpayResponse.json();
    console.log('✅ Razorpay order created:', order.id);

    // Return success response
    return new Response(
      JSON.stringify({
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const isError = (err: unknown): err is Error => err instanceof Error;

    let message = 'Internal server error';
    let name = 'Error';
    let stack: string | undefined;
    let statusCode = 500;

    if (isError(error)) {
      message = error.message;
      name = error.name;
      stack = error.stack;
      
      // Set appropriate status code based on error type
      if (message.includes('Unauthorized') || message.includes('authentication') || message.includes('Missing authorization')) {
        statusCode = 401;
      } else if (message.includes('not found') || message.includes('Invalid') || message.includes('inactive')) {
        statusCode = 404;
      } else if (message.includes('mismatch') || message.includes('Missing required')) {
        statusCode = 400;
      } else if (message.includes('Razorpay API error')) {
        statusCode = 502; // Bad Gateway
      }
    } else if (typeof error === 'string') {
      message = error;
    } else {
      try {
        message = JSON.stringify(error);
      } catch {
        message = String(error);
      }
    }

    console.error('❌ Error in create-razorpay-order:', {
      message,
      stack,
      name,
      statusCode,
    });

    // Return error response with proper status code
    return new Response(
      JSON.stringify({
        error: message,
        message: message, // Also include as 'message' for consistency
        details: typeof error === 'object' && !isError(error) ? JSON.stringify(error) : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      }
    );
  }
});