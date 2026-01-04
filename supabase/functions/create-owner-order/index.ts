// supabase/functions/create-owner-order/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log('🔵 create-owner-order Edge function called');

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('🔍 Auth header present:', !!authHeader);

    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📦 Request body received:', {
        hasAmount: !!requestBody.amount,
        amount: requestBody.amount,
        hasCurrency: !!requestBody.currency,
        currency: requestBody.currency,
        hasSubscriptionId: !!requestBody.subscription_id,
        hasPlanId: !!requestBody.plan_id,
      });
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ 
          error: "Invalid JSON in request body",
          message: "Request body must be valid JSON"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { amount, currency, subscription_id, plan_id, plan_name } = requestBody;

    // Validate input
    const missingFields = [];
    if (amount === undefined || amount === null) missingFields.push('amount');
    if (!currency) missingFields.push('currency');
    if (!subscription_id) missingFields.push('subscription_id');
    if (!plan_id) missingFields.push('plan_id');

    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields);
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields",
          message: `Missing required fields: ${missingFields.join(', ')}`,
          missing_fields: missingFields
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      console.error('❌ Invalid amount:', amount);
      return new Response(
        JSON.stringify({ 
          error: "Invalid amount",
          message: "Amount must be a positive number"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user authentication
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
        },
      }
    );
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('❌ User verification failed:', userError?.message);
      return new Response(
        JSON.stringify({ 
          error: "Unauthorized",
          message: "Invalid or expired authentication token"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log('✅ User verified:', user.id);

    // Get Razorpay credentials
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    console.log('🔍 Environment check:', {
      hasRazorpayKeyId: !!razorpayKeyId,
      hasRazorpayKeySecret: !!razorpayKeySecret,
    });

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('❌ Razorpay credentials not configured');
      return new Response(
        JSON.stringify({ 
          error: "Razorpay credentials not configured",
          message: "Server configuration error. Please contact support."
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Basic Auth header for Razorpay
    const razorpayAuthHeader = "Basic " + btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // Generate short receipt (SAME FORMAT AS WORKING create-razorpay-order)
    // Format: rcpt_ + first 8 chars of user ID + _ + last 8 digits of timestamp
    // Example: rcpt_abc12345_98765432 = ~25 chars (well under 40)
    const timestamp = Date.now().toString().slice(-10);
    const receipt = `OWN${timestamp}`; // e.g., "OWN7398765432" = 13 chars
    
    console.log('✅ Receipt generated:', {
      receipt: receipt,
      length: receipt.length,
      validation: receipt.length <= 40 ? '✅ VALID' : '❌ INVALID'
    });
    
    // Safety check
    if (receipt.length > 40) {
      console.error('❌ Receipt too long:', receipt.length);
      throw new Error('Receipt generation failed');
    }

    // Create Razorpay order
    const razorpayPayload = {
      amount: amount, // Amount in paise
      currency: currency,
      receipt: receipt, // CRITICAL: Must be <= 40 chars
      notes: {
        subscription_id: subscription_id,
        plan_id: plan_id,
        plan_name: plan_name || "Unknown Plan",
        user_id: user.id,
        type: "owner_subscription",
        purpose: "gym_owner_subscription_payment",
      },
    };

    console.log('🔵 Creating Razorpay order with payload:', {
      amount: razorpayPayload.amount,
      currency: razorpayPayload.currency,
      receipt: razorpayPayload.receipt,
      receiptLength: razorpayPayload.receipt.length,
      receiptValidation: razorpayPayload.receipt.length <= 40 ? '✅ VALID' : '❌ TOO LONG',
    });

    console.log('🔵 Calling Razorpay API...');
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": razorpayAuthHeader,
      },
      body: JSON.stringify(razorpayPayload),
    });

    console.log('🔵 Razorpay API responded:', {
      status: razorpayResponse.status,
      statusText: razorpayResponse.statusText,
      ok: razorpayResponse.ok
    });

    if (!razorpayResponse.ok) {
      console.error('❌ Razorpay API returned error status');
      const errorText = await razorpayResponse.text();
      console.error('❌ Error response text (raw):', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
        console.error("❌ Error response (parsed):", JSON.stringify(errorData, null, 2));
      } catch (parseErr) {
        console.error("❌ Failed to parse error response as JSON:", parseErr);
        errorData = { error: { description: errorText } };
      }
      
      const errorMessage = errorData?.error?.description || 
                          errorData?.error?.message || 
                          errorData?.message ||
                          errorText || 
                          "Unknown error from Razorpay API";
      
      console.error("❌ FINAL ERROR DETAILS:", {
        status: razorpayResponse.status,
        statusText: razorpayResponse.statusText,
        errorCode: errorData?.error?.code,
        errorDescription: errorData?.error?.description,
        errorReason: errorData?.error?.reason,
        receiptUsed: receipt,
        receiptLength: receipt.length
      });
      
      return new Response(
        JSON.stringify({ 
          error: "Failed to create Razorpay order",
          details: errorMessage,
          receiptUsed: receipt,
          receiptLength: receipt.length
        }),
        {
          status: razorpayResponse.status >= 400 && razorpayResponse.status < 500 ? razorpayResponse.status : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('✅ Razorpay order created successfully!');
    const order = await razorpayResponse.json();
    console.log('✅ Order details:', {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status
    });

    return new Response(
      JSON.stringify({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        created_at: order.created_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const isError = (err: unknown): err is Error => err instanceof Error;
    
    let message = 'Internal server error';
    let statusCode = 500;

    if (isError(error)) {
      message = error.message;
      
      if (message.includes('Unauthorized') || message.includes('authentication') || message.includes('Missing authorization')) {
        statusCode = 401;
      } else if (message.includes('Missing required')) {
        statusCode = 400;
      } else if (message.includes('Razorpay')) {
        statusCode = 502;
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

    console.error("❌ Create owner order error:", {
      message,
      error,
    });
    
    return new Response(
      JSON.stringify({ 
        error: message,
        message: message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});