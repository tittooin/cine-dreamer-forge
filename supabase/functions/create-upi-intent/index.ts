import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const GPAY_VPA = Deno.env.get("GPAY_VPA");
    const GPAY_NAME = Deno.env.get("GPAY_NAME");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { amount, credits, note } = await req.json().catch(() => ({ amount: null, credits: null, note: "" }));
    const amt = Number(amount);
    const cr = Number(credits ?? 1);
    if (!GPAY_VPA || !GPAY_NAME) {
      return new Response(JSON.stringify({ error: "Payment not configured", detail: "Set GPAY_VPA and GPAY_NAME in Supabase secrets." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!(amt > 0) || !(cr > 0)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const payment_id = `pay_${crypto.randomUUID()}`;
    const upi_tr = payment_id; // embed our reference into UPI URI

    const { error: insErr } = await adminClient
      .from("payments")
      .insert({ payment_id, user_id: user.id, amount: amt, credits: cr, upi_tr, status: "pending" });
    if (insErr) {
      return new Response(JSON.stringify({ error: "Unable to create payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({
      pa: GPAY_VPA,
      pn: GPAY_NAME,
      am: amt.toFixed(2),
      cu: "INR",
      tn: `${(note || "Credits").slice(0, 40)} • ${user.email ?? user.id}`,
      tr: upi_tr,
    });
    const upiUri = `upi://pay?${params.toString()}`;

    return new Response(JSON.stringify({ payment_id, upiUri }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-upi-intent error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});