// supabase/functions/razorpay-webhook/index.ts
// Deploy: supabase functions deploy razorpay-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-razorpay-signature, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔵 Webhook received');

    // 1. Get signature
    const signature = req.headers.get('x-razorpay-signature');
    if (!signature) {
      throw new Error('Missing signature');
    }

    // 2. Get body
    const body = await req.text();
    
    // 3. Verify signature
    const expectedSignature = createHmac('sha256', WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('❌ Invalid signature');
      throw new Error('Invalid signature');
    }

    console.log('✅ Signature verified');

    // 4. Parse event
    const event = JSON.parse(body);
    console.log('📨 Event type:', event.event);

    // 5. Create Supabase client with service key
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false, // Don't persist in edge functions
        },
      }
    );
    // Verify user
    console.log('🔵 Verifying user...');
    const {
      // Skipping user verification; 'token' is undefined in webhook context.

    // 6. Log webhook
    const eventId = (
      event.payload?.payment?.entity?.id ||
      event.payload?.transfer?.entity?.id ||
      event.payload?.account?.entity?.id ||
      `unknown_${Date.now()}`
    );


    await supabaseClient
      .from('razorpay_webhooks')
      .insert({
        event_type: event.event,
        event_id: eventId,
        razorpay_account_id: event.account_id,
        payload: event,
        processed: false,
      });

    // 7. Handle different event types
    switch (event.event) {
      // Account activated - Gym owner completed KYC
      case 'account.activated':
        console.log('🔵 Handling account.activated');
        const accountId = event.payload.account.entity.id;
        
        await supabaseClient
          .from('gym_owners')
          .update({
            onboarding_completed: true,
            razorpay_account_status: 'activated',
            kyc_status: 'verified',
            kyc_verified_at: new Date().toISOString(),
            is_active: true,
            onboarding_completed_at: new Date().toISOString(),
          })
          .eq('razorpay_account_id', accountId);
        
        console.log('✅ Account activated');
        break;

      // Account needs clarification
      case 'account.needs_clarification':
        console.log('🔵 Handling account.needs_clarification');
        const needsClarificationId = event.payload.account.entity.id;
        
        await supabaseClient
          .from('gym_owners')
          .update({
            razorpay_account_status: 'needs_clarification',
            kyc_status: 'needs_clarification',
          })
          .eq('razorpay_account_id', needsClarificationId);
        
        console.log('✅ Status updated to needs_clarification');
        break;

      // Account suspended
      case 'account.suspended':
        console.log('🔵 Handling account.suspended');
        const suspendedId = event.payload.account.entity.id;
        
        await supabaseClient
          .from('gym_owners')
          .update({
            razorpay_account_status: 'suspended',
            is_active: false,
          })
          .eq('razorpay_account_id', suspendedId);
        
        console.log('✅ Account suspended');
        break;

      // Transfer processed - Money transferred to gym owner
      case 'transfer.processed':
        console.log('🔵 Handling transfer.processed');
        const processedTransferId = event.payload.transfer.entity.id;
        
        await supabaseClient
          .from('route_transactions')
          .update({
            transfer_status: 'transferred',
            transfer_processed_at: new Date().toISOString(),
          })
          .eq('razorpay_transfer_id', processedTransferId);
        
        console.log('✅ Transfer marked as processed');
        break;

      // Transfer failed
      case 'transfer.failed':
        console.log('🔵 Handling transfer.failed');
        const failedTransferId = event.payload.transfer.entity.id;
        const failureReason = event.payload.transfer.entity.notes?.failure_reason || 'Unknown';
        
        await supabaseClient
          .from('route_transactions')
          .update({
            transfer_status: 'failed',
            transfer_failure_reason: failureReason,
          })
          .eq('razorpay_transfer_id', failedTransferId);
        
        console.log('✅ Transfer marked as failed');
        break;

      // Payment captured
      case 'payment.captured':
        console.log('🔵 Handling payment.captured');
        // Payment is already handled by verify-payment function
        // This is just for logging
        console.log('✅ Payment captured (already processed)');
        break;

      // Payment failed
      case 'payment.failed':
        console.log('🔵 Handling payment.failed');
        const failedPaymentId = event.payload.payment.entity.id;
        
        // Update payment record if exists
        await supabaseClient
          .from('payments')
          .update({
            status: 'failed',
          })
          .eq('razorpay_payment_id', failedPaymentId);
        
        console.log('✅ Payment marked as failed');
        break;

      // Refund created
      case 'refund.created':
        console.log('🔵 Handling refund.created');
        const refundId = event.payload.refund.entity.id;
        const refundPaymentId = event.payload.refund.entity.payment_id;
        
        // Find and update refund request
        const { data: paymentData } = await supabaseClient
          .from('payments')
          .select('id')
          .eq('razorpay_payment_id', refundPaymentId)
          .single();
        
        if (paymentData) {
          await supabaseClient
            .from('refund_requests')
            .update({
              status: 'processed',
              razorpay_refund_id: refundId,
              processed_at: new Date().toISOString(),
            })
            .eq('payment_id', paymentData.id)
            .eq('status', 'approved');
        }
        
        console.log('✅ Refund recorded');
        break;

      default:
        console.log('⚠️ Unhandled event type:', event.event);
    }

    // 8. Mark webhook as processed
    await supabaseClient
      .from('razorpay_webhooks')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('event_id', eventId);

    // 9. Return success
    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});