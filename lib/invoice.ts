/**
 * Invoice generation utilities - CORRECTED VERSION
 */

import { supabase } from './supabase';
import { formatRupees } from './currency';

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface InvoiceData {
  invoice_number: string;
  user_id: string;
  subscription_id?: string;
  payment_id?: string;
  payment_type: 'cash' | 'online' | 'razorpay';
  amount: number; // paid amount
  plan_amount: number; // original plan amount
  
  total_amount: number; 
  items: InvoiceItem[];
  gym_id?: string;
}

/**
 * Generate invoice number (INV-TIMESTAMP-RANDOM)
 */
export function generateInvoiceNumber(): string {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${timestamp}-${random}`;
}

/**
 * Generate receipt number (RCP-TIMESTAMP-RANDOM)
 */
export function generateReceiptNumber(): string {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RCP-${timestamp}-${random}`;
}

/**
 * Create invoice in database
 */
export async function createInvoice(data: InvoiceData): Promise<string> {
  try {
    const paidAmount = data.amount;
    const originalTotal = data.total_amount;

    let paymentStatus: 'paid' | 'partial' | 'pending' = 'pending';
    let remainingAmount = originalTotal - paidAmount;

    if (paidAmount >= originalTotal) {
      paymentStatus = 'paid';
      remainingAmount = 0;
    } else if (paidAmount > 0) {
      paymentStatus = 'partial';
    } else {
      paymentStatus = 'pending';
      remainingAmount = originalTotal;
    }

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert([
        {
          invoice_number: data.invoice_number,
          user_id: data.user_id,
          
          // FK-safe: Only set subscription_id for razorpay payments
          subscription_id:
            data.payment_type === 'razorpay' ? (data.subscription_id ?? null) : null,
          
          payment_id: data.payment_id || null,
          payment_type: data.payment_type,
          
          // AMOUNTS - CORRECTED
          amount: paidAmount, // Amount paid in this transaction
          original_total_amount: originalTotal, // Full amount 
          remaining_amount: Math.max(0, remainingAmount), // Ensure non-negative
          
          total_amount: originalTotal, // Same as original_total_amount
          currency: 'INR',
          
          items: data.items,
          payment_status: paymentStatus,
          invoice_date: new Date().toISOString(),
          gym_id: data.gym_id || null,
        },
      ])
      .select('id')
      .single();

    if (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }

    return invoice.id;
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
}

/**
 * Create invoice for subscription payment
 */
export async function createSubscriptionInvoice(
  userId: string,
  subscriptionId: string | null,
  amount: number, // paid amount
  paymentType: 'cash' | 'online' | 'razorpay',
  paymentId?: string,
  gymId?: string
): Promise<string> {
  try {
    // Fetch subscription details
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('name, price, duration_months, features')
      .eq('id', subscriptionId)
      .single();

    if (subError) {
      console.error('Error fetching subscription:', subError);
      throw subError;
    }

    const invoiceNumber = generateInvoiceNumber();
    
    // Plan amount (original price from subscription)
    const planAmount = subscription.price;
    
    
    const totalAmount = planAmount;

    const items: InvoiceItem[] = [
      {
        description: `${subscription.name} - ${subscription.duration_months} month${
          subscription.duration_months > 1 ? 's' : ''
        }`,
        amount: planAmount,
      },
    ];

    return createInvoice({
      invoice_number: invoiceNumber,
      user_id: userId,
      subscription_id: paymentType === 'razorpay' ? subscriptionId : null,
      payment_id: paymentId,
      payment_type: paymentType,
      amount: amount, // Paid amount
      plan_amount: planAmount, // Original plan amount
      total_amount: totalAmount, // Plan 
      items: items,
      gym_id: gymId,
    });
  } catch (error) {
    console.error('Error creating subscription invoice:', error);
    throw error;
  }
}

/**
 * Get user invoices
 */
export async function getUserInvoices(userId: string) {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .order('invoice_date', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
}

/**
 * Update invoice payment (for partial payments)
 */
export async function updateInvoicePayment(
  invoiceId: string,
  additionalPayment: number,
  paymentId?: string
): Promise<void> {
  try {
    // Get current invoice
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (fetchError) throw fetchError;

    const currentPaid = invoice.amount;
    const totalRequired = invoice.original_total_amount || invoice.total_amount;
    const newPaidAmount = currentPaid + additionalPayment;
    const newRemainingAmount = Math.max(0, totalRequired - newPaidAmount);

    let newStatus: 'paid' | 'partial' | 'pending' = 'pending';
    if (newPaidAmount >= totalRequired) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        amount: newPaidAmount,
        remaining_amount: newRemainingAmount,
        payment_status: newStatus,
        payment_id: paymentId || invoice.payment_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error('Error updating invoice payment:', error);
    throw error;
  }
}