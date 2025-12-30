/**
 * Cash payment utilities
 */

import { supabase } from './supabase';
import { generateReceiptNumber } from './invoice';
import { formatRupees } from './currency';

export interface CashPaymentData {
  user_id: string;
  subscription_id?: string;
  gym_id?: string;
  amount: number;
  receipt_number?: string;
  notes?: string;
  received_by?: string;
}

/**
 * Create cash payment record
 */
export async function createCashPayment(data: CashPaymentData): Promise<string> {
  try {
    const receiptNumber = data.receipt_number || generateReceiptNumber();

    const { data: payment, error } = await supabase
      .from('cash_payments')
      .insert([
        {
          user_id: data.user_id,
          subscription_id: data.subscription_id || null,
          gym_id: data.gym_id || null,
          amount: data.amount,
          currency: 'INR',
          receipt_number: receiptNumber,
          received_by: data.received_by || null,
          notes: data.notes || null,
          payment_date: new Date().toISOString(),
        },
      ])
      .select('id')
      .single();

    if (error) throw error;

    return payment.id;
  } catch (error) {
    console.error('Error creating cash payment:', error);
    throw error;
  }
}

/**
 * Create user subscription with cash payment
 * IMPORTANT: Create user_subscription FIRST, then create cash payment
 * The cash_payments.subscription_id FK constraint may point to razorpay_subscriptions,
 * so we set it to null and link via user_id instead
 */
export async function createSubscriptionWithCashPayment(
  userId: string,
  planId: string, // This is the subscription plan ID (from subscriptions table)
  amount: number,
  gymId?: string,
  receivedBy?: string,
  receiptNumber?: string
): Promise<{ paymentId: string; userSubscriptionId: string }> {
  try {
    // Step 1: Fetch subscription plan details
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('duration_days, duration_months')
      .eq('id', planId)
      .single();

    if (subError) {
      console.error('Error fetching subscription plan:', subError);
      throw subError;
    }

    // Step 2: Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + subscription.duration_days);

    // Step 3: Create user_subscription FIRST (this must exist before cash payment)
    const { data: userSubscription, error: subCreateError } = await supabase
      .from('user_subscriptions')
      .insert([
        {
          user_id: userId,
          subscription_id: planId, // Reference to the subscription plan
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          amount_paid: amount,
          payment_status: 'paid',
          payment_method: 'cash',
          payment_date: new Date().toISOString(),
          is_active: true,
          currency: 'INR',
        },
      ])
      .select('id')
      .single();

    if (subCreateError) {
      console.error('Error creating user subscription:', subCreateError);
      throw subCreateError;
    }

    console.log('✅ User subscription created:', userSubscription.id);

    // Step 4: Create cash payment AFTER user_subscription is created
    // Set subscription_id to null because the FK constraint points to razorpay_subscriptions,
    // not subscriptions or user_subscriptions. We link via user_id instead.
    const paymentId = await createCashPayment({
      user_id: userId,
      subscription_id: undefined, // Set to undefined to avoid FK constraint error
      gym_id: gymId,
      amount: amount,
      receipt_number: receiptNumber,
      received_by: receivedBy,
      notes: `Cash payment for subscription plan ${planId}. User subscription ID: ${userSubscription.id}`,
    });

    console.log('✅ Cash payment created:', paymentId);

    return {
      paymentId,
      userSubscriptionId: userSubscription.id,
    };
  } catch (error) {
    console.error('Error creating subscription with cash payment:', error);
    throw error;
  }
}

/**
 * Get cash payments for a user
 */
export async function getUserCashPayments(userId: string) {
  try {
    const { data, error } = await supabase
      .from('cash_payments')
      .select('*, subscriptions(name, duration_months)')
      .eq('user_id', userId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching cash payments:', error);
    return [];
  }
}

