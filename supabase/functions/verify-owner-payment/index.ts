// supabase/functions/verify-owner-payment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createHash } from "https://deno.land/std@0.160.0/hash/mod.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { order_id, payment_id, signature } = await req.json();

    // Validate input
    if (!order_id || !payment_id || !signature) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Razorpay secret from environment
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeySecret) {
      return new Response(
        JSON.stringify({ error: "Razorpay secret not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate expected signature using HMAC SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(razorpayKeySecret);
    const message = encoder.encode(`${order_id}|${payment_id}`);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, message);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const generatedSignature = signatureArray
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    // Compare signatures
    if (generatedSignature === signature) {
      return new Response(
        JSON.stringify({
          verified: true,
          message: "Payment verified successfully",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          verified: false,
          error: "Invalid signature - payment verification failed",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    return new Response(
      JSON.stringify({
        verified: false,
        error: "Verification failed",
        details: error.message || "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});