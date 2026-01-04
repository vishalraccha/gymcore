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
    // Get current session for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      throw new Error('Authentication error. Please login again.');
    }

    if (!session) {
      throw new Error('Not authenticated. Please login again.');
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("owner_subscription_plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found or inactive');
    }

    // Prepare request body
    const amountInPaise = Math.round(plan.price * 100);
    const requestBody = {
      amount: amountInPaise, // Convert to paise, ensure integer
      currency: plan.currency || 'INR',
      subscription_id: subscriptionId,
      plan_id: planId,
      plan_name: plan.name,
    };

    console.log('🔵 STEP 1: Preparing payment order request:', {
      planName: plan.name,
      planPrice: plan.price,
      amountInRupees: plan.price,
      amountInPaise: amountInPaise,
      currency: requestBody.currency,
      subscription_id: requestBody.subscription_id,
      plan_id: requestBody.plan_id,
    });

    // Call Supabase Edge Function to create Razorpay order
    console.log('🔵 STEP 2: Calling Supabase Edge Function (create-owner-order)...');
    let data, error;
    try {
      console.log('🔵 STEP 2a: Invoking edge function with request body...');
      const result = await supabase.functions.invoke('create-owner-order', {
        body: requestBody,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      console.log('🔵 STEP 2b: Edge function responded:', {
        hasData: !!result.data,
        hasError: !!result.error,
        dataKeys: result.data ? Object.keys(result.data) : [],
        errorType: result.error ? result.error.constructor?.name : 'none'
      });
      
      data = result.data;
      error = result.error;
      
      // If invoke returned a 400/error response, check the data for error details
      if (!error && data && (data.error || data.message)) {
        console.error('❌ STEP 2c: Edge function returned error in data field:', data);
        // Convert data error to error object for consistent handling
        error = {
          message: data.message || data.error || 'Edge Function returned an error',
          context: data,
          status: 400,
        };
        data = null;
      }
    } catch (invokeError: any) {
      console.error('❌ STEP 2d: Exception during edge function invoke:', {
        error: invokeError,
        message: invokeError?.message,
        stack: invokeError?.stack
      });
      error = invokeError;
      data = null;
    }

    // Handle function errors - Supabase returns errors in different ways
    if (error) {
      console.error('❌ STEP 3: Error occurred during order creation');
      console.error('❌ Error object structure:', {
        name: error?.name,
        message: error?.message,
        hasContext: !!error?.context,
        contextType: error?.context ? error.context.constructor?.name : 'none',
        status: error?.status,
        statusCode: error?.statusCode
      });
      
      let errorMsg = 'Failed to create payment order';
      
      // Try to read the response body from the error context (Response object)
      if (error.context && error.context instanceof Response) {
        try {
          console.log('🔵 STEP 3a: Reading error response body from Response object...');
          const responseText = await error.context.clone().text();
          console.error('❌ Error response body (raw):', responseText);
          
          try {
            const errorData = JSON.parse(responseText);
            console.error('❌ Error response body (parsed):', JSON.stringify(errorData, null, 2));
            
            if (errorData.message) {
              errorMsg = errorData.message;
            } else if (errorData.error) {
              errorMsg = typeof errorData.error === 'string' 
                ? errorData.error 
                : errorData.error?.description || errorData.error?.message || errorMsg;
            } else if (errorData.details) {
              errorMsg = typeof errorData.details === 'string' 
                ? errorData.details 
                : JSON.stringify(errorData.details);
            }
            
            console.error('❌ Extracted error message:', errorMsg);
          } catch (parseErr) {
            console.warn('⚠️ Could not parse error response as JSON:', parseErr);
            // If not JSON, use the text as error message
            errorMsg = responseText || errorMsg;
          }
        } catch (readErr) {
          console.warn('⚠️ Could not read error response body:', readErr);
        }
      }
      
      // Check if error has a context object (not Response)
      if (error.context && typeof error.context === 'object' && !(error.context instanceof Response)) {
        try {
          console.log('🔵 STEP 3b: Processing error context object...');
          const context = typeof error.context === 'string' ? JSON.parse(error.context) : error.context;
          console.error('❌ Error context:', JSON.stringify(context, null, 2));
          
          if (context?.message) {
            errorMsg = context.message;
          } else if (context?.error) {
            errorMsg = typeof context.error === 'string' 
              ? context.error 
              : context.error?.description || context.error?.message || errorMsg;
          } else if (context?.details) {
            errorMsg = typeof context.details === 'string' 
              ? context.details 
              : JSON.stringify(context.details);
          }
        } catch (e) {
          console.warn('⚠️ Could not parse error context:', e);
        }
      }
      
      // Try to extract from message
      if (error.message && error.message !== 'Edge Function returned a non-2xx status code') {
        console.log('🔵 STEP 3c: Using error.message:', error.message);
        errorMsg = error.message;
      }
      
      // Check if it's an HTTP error with status
      if (error.status || error.statusCode) {
        const status = error.status || error.statusCode;
        console.error(`❌ HTTP ${status} error detected`);
        
        // If we have the actual response body, use it
        if (data?.error || data?.message) {
          console.log('🔵 STEP 3d: Found error in data object:', data);
          errorMsg = data.message || data.error || errorMsg;
        }
      }
      
      console.error('❌ FINAL ERROR MESSAGE TO THROW:', errorMsg);
      throw new Error(errorMsg);
    }

    // Check for error in response body (edge function returned 200 but with error field)
    if (data?.error) {
      console.error('❌ STEP 4: Error found in response body:', data);
      throw new Error(data.message || data.error || 'Failed to create payment order');
    }

    // Validate response
    if (!data || !data.order_id) {
      console.error('❌ STEP 5: Invalid response from edge function:', {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        hasOrderId: !!data?.order_id
      });
      throw new Error('Invalid order response from server. Please try again.');
    }

    console.log('✅ STEP 6: Order created successfully!', {
      orderId: data.order_id,
      amount: data.amount,
      currency: data.currency,
      createdAt: data.created_at
    });
    return { data, error: null };
  } catch (error: any) {
    console.error("❌ createOwnerRazorpayOrder error:", error);
    
    // Return error in consistent format
    const errorMessage = error instanceof Error ? error.message : 'Failed to create payment order';
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error(errorMessage)
    };
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