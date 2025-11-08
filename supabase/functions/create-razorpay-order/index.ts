import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { quantity = 1, amountPaise: bodyAmountPaise, plan = "single" } = await req.json();
    const qty = Math.max(1, Number(quantity || 1));
    // Price per image default: ₹2.99 => 299 paise; allow override for bundles/monthly
    const amountPaise = Number(bodyAmountPaise ?? qty * 299);

    const orderPayload = {
      amount: amountPaise,
      currency: "INR",
      notes: { userId: user.id, email: user.email ?? "", quantity: String(qty), plan },
      receipt: `cd_${user.id}_${Date.now()}_${plan}`,
      payment_capture: 1,
    };

    const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Authorization": `Basic ${basicAuth}`, "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload),
    });
    const text = await res.text();
    if (!res.ok) return new Response(JSON.stringify({ error: "Failed to create order", status: res.status, detail: text }), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const json = JSON.parse(text);
    return new Response(JSON.stringify({ order: json, keyId: RAZORPAY_KEY_ID }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("create-razorpay-order error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});