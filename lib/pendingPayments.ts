/**
 * Pending payments and installment utilities
 */

import { supabase } from './supabase';
import { formatRupees } from './currency';

export interface PendingPaymentData {
  user_id: string;
  subscription_id?: string;
  total_amount: number;
  paid_amount?: number;
  pending_amount: number;
  due_date: string;
  currency?: string;
  notes?: string;
}

export interface InstallmentData {
  pending_payment_id: string;
  installment_number: number;
  amount: number;
  payment_method: 'cash' | 'online' | 'razorpay';
  receipt_number?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  notes?: string;
}

/**
 * Create pending payment record
 */
export async function createPendingPayment(data: PendingPaymentData): Promise<string> {
  try {
    const now = new Date();
    const dueDate = new Date(data.due_date);
    const status = dueDate < now ? 'overdue' : 'pending';

    const { data: pendingPayment, error } = await supabase
      .from('pending_payments')
      .insert([
        {
          user_id: data.user_id,
          subscription_id: data.subscription_id || null,
          total_amount: data.total_amount,
          paid_amount: data.paid_amount || 0,
          pending_amount: data.pending_amount,
          currency: data.currency || 'INR',
          due_date: data.due_date,
          status: status,
          notes: data.notes || null,
        },
      ])
      .select('id')
      .single();

    if (error) throw error;

    return pendingPayment.id;
  } catch (error) {
    console.error('Error creating pending payment:', error);
    throw error;
  }
}

/**
 * Create installment payment
 */
export async function createInstallment(data: InstallmentData): Promise<string> {
  try {
    const { data: installment, error } = await supabase
      .from('payment_installments')
      .insert([
        {
          pending_payment_id: data.pending_payment_id,
          installment_number: data.installment_number,
          amount: data.amount,
          currency: 'INR',
          payment_method: data.payment_method,
          receipt_number: data.receipt_number || null,
          razorpay_order_id: data.razorpay_order_id || null,
          razorpay_payment_id: data.razorpay_payment_id || null,
          status: 'paid',
          payment_date: new Date().toISOString(),
          notes: data.notes || null,
        },
      ])
      .select('id')
      .single();

    if (error) throw error;

    // The trigger will automatically update pending_payment status
    return installment.id;
  } catch (error) {
    console.error('Error creating installment:', error);
    throw error;
  }
}

/**
 * Get user's pending payments
 */
export async function getUserPendingPayments(userId: string) {
  try {
    const { data, error } = await supabase
    .from('pending_payments')
    .select(`
      *,
      razorpay_subscriptions (*)
    `)
      .eq('user_id', userId)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    return [];
  }
}

/**
 * Get pending payment with installments
 */
export async function getPendingPaymentWithInstallments(pendingPaymentId: string) {
  try {
    const { data: pendingPayment, error: pendingError } = await supabase
      .from('pending_payments')
      .select('*')
      .eq('id', pendingPaymentId)
      .single();

    if (pendingError) throw pendingError;

    const { data: installments, error: installmentsError } = await supabase
      .from('payment_installments')
      .select('*')
      .eq('pending_payment_id', pendingPaymentId)
      .order('installment_number', { ascending: true });

    if (installmentsError) throw installmentsError;

    return {
      ...pendingPayment,
      installments: installments || [],
    };
  } catch (error) {
    console.error('Error fetching pending payment:', error);
    throw error;
  }
}

/**
 * Calculate next installment number
 */
export async function getNextInstallmentNumber(pendingPaymentId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('payment_installments')
      .select('installment_number')
      .eq('pending_payment_id', pendingPaymentId)
      .order('installment_number', { ascending: false })
      .limit(1);

    if (error) throw error;

    return data && data.length > 0 ? data[0].installment_number + 1 : 1;
  } catch (error) {
    console.error('Error getting next installment number:', error);
    return 1;
  }
}

