// /lib/razorpayOwner.ts
import { supabase } from "./supabase";

/**
 * Create Razorpay order for owner subscription payment
 * This payment goes to YOU (the platform creator)
 * 
 * Note: This function calls your Supabase Edge Function which uses YOUR Razorpay credentials
 */
export async function createOwnerRazorpayOrder(
  subscriptionId: string,
  planId: string
) {
  try {
    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("owner_subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError) throw planError;

    // Call Supabase Edge Function to create Razorpay order
    const { data, error } = await supabase.functions.invoke('create-owner-order', {
      body: {
        amount: plan.price * 100, // Convert to paise
        currency: plan.currency,
        subscription_id: subscriptionId,
        plan_id: planId,
        plan_name: plan.name,
      },
    });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error("createOwnerRazorpayOrder error:", error);
    return { data: null, error };
  }
}

/**
 * Verify Razorpay payment signature
 * This ensures the payment is legitimate
 */
export async function verifyOwnerPayment(
  orderId: string,
  paymentId: string,
  signature: string
) {
  try {
    // Call Supabase Edge Function to verify payment
    const { data, error } = await supabase.functions.invoke('verify-owner-payment', {
      body: {
        order_id: orderId,
        payment_id: paymentId,
        signature,
      },
    });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error("verifyOwnerPayment error:", error);
    return { data: null, error };
  }
}

/**
 * Get Razorpay key for frontend integration
 */
export async function getRazorpayKey() {
  try {
    // Call Supabase Edge Function to get Razorpay key
    const { data, error } = await supabase.functions.invoke('get-razorpay-key', {
      method: 'GET',
    });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error("getRazorpayKey error:", error);
    return { data: null, error };
  }
}

/**
 * Initialize Razorpay payment
 * Opens Razorpay checkout modal
 */
export async function initializeRazorpayPayment(
  orderId: string,
  amount: number,
  currency: string,
  ownerEmail: string,
  ownerPhone: string,
  onSuccess: (paymentId: string, signature: string) => void,
  onFailure: (error: any) => void
) {
  try {
    // Get Razorpay key
    const { data: keyData, error: keyError } = await getRazorpayKey();
    if (keyError) throw keyError;

    // Load Razorpay SDK if not already loaded
    if (typeof window !== 'undefined' && !(window as any).Razorpay) {
      await loadRazorpayScript();
    }

    const options = {
      key: keyData.key_id,
      amount: amount,
      currency: currency,
      name: "FitPro Platform",
      description: "Gym Management Subscription",
      order_id: orderId,
      prefill: {
        email: ownerEmail,
        contact: ownerPhone,
      },
      theme: {
        color: "#3B82F6",
      },
      handler: function (response: any) {
        onSuccess(response.razorpay_payment_id, response.razorpay_signature);
      },
      modal: {
        ondismiss: function () {
          onFailure(new Error("Payment cancelled by user"));
        },
      },
    };

    const razorpay = new (window as any).Razorpay(options);
    razorpay.open();

    razorpay.on('payment.failed', function (response: any) {
      onFailure(response.error);
    });
  } catch (error) {
    console.error("initializeRazorpayPayment error:", error);
    onFailure(error);
  }
}

/**
 * Load Razorpay script dynamically
 */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
}