// supabase/functions/create-gym-account/index.ts
// Deploy: supabase functions deploy create-gym-account

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateAccountRequest {
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

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔵 Creating gym owner account...');

    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
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
      console.error('❌ Authentication failed:', userError);
      throw new Error('Unauthorized');
    }

    console.log('✅ User authenticated:', user.id);

    // 2. Parse and validate request
    const body: CreateAccountRequest = await req.json();
    const {
      gymName,
      gymAddress,
      gymCity,
      gymState,
      gymPincode,
      gymPhone,
      email,
      phone,
      businessType,
      businessName,
      gstin,
    } = body;

    // Validation
    if (!gymName || !email || !phone || !businessType) {
      throw new Error('Missing required fields');
    }

    console.log('✅ Request validated');

    // 3. Check if user already has a gym owner account
    const { data: existingOwner, error: checkError } = await supabaseClient
      .from('gym_owners')
      .select('id, razorpay_account_id, razorpay_account_status')
      .eq('user_id', user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingOwner?.razorpay_account_id) {
      console.log('⚠️ Account already exists');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Account already exists',
          account_id: existingOwner.razorpay_account_id,
          status: existingOwner.razorpay_account_status,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // 4. Create Razorpay Linked Account
    console.log('🔵 Creating Razorpay linked account...');
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    const razorpayPayload = {
      email: email,
      phone: phone,
      type: 'route',
      reference_id: user.id,
      legal_business_name: businessName || gymName,
      business_type: businessType,
      contact_name: gymName,
      profile: {
        category: 'healthcare',
        subcategory: 'fitness',
        addresses: {
          registered: {
            street1: gymAddress || 'To be updated',
            street2: '',
            city: gymCity || 'To be updated',
            state: gymState || 'To be updated',
            postal_code: gymPincode || '000000',
            country: 'IN',
          },
        },
      },
      legal_info: gstin ? { gst: gstin } : {},
      notes: {
        gym_name: gymName,
        created_from: 'gymcore_app',
        user_id: user.id,
      },
    };

    console.log('📤 Sending to Razorpay:', { ...razorpayPayload, notes: '...' });

    const razorpayResponse = await fetch('https://api.razorpay.com/v2/accounts', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(razorpayPayload),
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error('❌ Razorpay API error:', errorText);
      throw new Error(`Razorpay error: ${errorText}`);
    }

    const account = await razorpayResponse.json();
    console.log('✅ Razorpay account created:', account.id);

    // 5. Save to database
    console.log('🔵 Saving to database...');
    const { data: gymOwner, error: dbError } = await supabaseClient
      .from('gym_owners')
      .upsert(
        {
          user_id: user.id,
          gym_name: gymName,
          gym_address: gymAddress,
          gym_city: gymCity,
          gym_state: gymState,
          gym_pincode: gymPincode,
          gym_phone: gymPhone,
          business_type: businessType,
          business_name: businessName || gymName,
          gstin: gstin,
          razorpay_account_id: account.id,
          razorpay_account_status: account.status,
          onboarding_link: `https://dashboard.razorpay.com/app/route/account/${account.id}`,
          onboarding_completed: false,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database error:', dbError);
      throw dbError;
    }

    console.log('✅ Gym owner record created');

    // 6. Create default settings
    const { error: settingsError } = await supabaseClient
      .from('gym_owner_settings')
      .insert({
        gym_owner_id: gymOwner.id,
      });

    if (settingsError) {
      console.error('⚠️ Settings creation failed:', settingsError);
      // Non-critical, continue
    }

    // 7. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        gym_owner_id: gymOwner.id,
        account_id: account.id,
        onboarding_link: `https://dashboard.razorpay.com/app/route/account/${account.id}`,
        status: account.status,
        message: 'Account created successfully. Please complete KYC to start receiving payments.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Error in create-gym-account:', error);
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