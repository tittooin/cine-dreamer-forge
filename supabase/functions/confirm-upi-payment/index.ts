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

    const { payment_id, utr } = await req.json().catch(() => ({ payment_id: null, utr: null }));
    if (!payment_id || typeof payment_id !== "string") {
      return new Response(JSON.stringify({ error: "Invalid payment id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!utr || typeof utr !== "string" || utr.length < 6) {
      return new Response(JSON.stringify({ error: "Invalid UTR" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: payment, error: pErr } = await adminClient
      .from("payments")
      .select("payment_id, user_id, amount, credits, status")
      .eq("payment_id", payment_id)
      .maybeSingle();
    if (pErr || !payment) {
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (payment.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (payment.status !== "pending") {
      return new Response(JSON.stringify({ error: "Payment already processed", status: payment.status }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark payment as confirmed (note: real verification needs PSP webhook)
    const { error: updErr } = await adminClient
      .from("payments")
      .update({ status: "confirmed", utr, updated_at: new Date().toISOString() })
      .eq("payment_id", payment_id);
    if (updErr) {
      return new Response(JSON.stringify({ error: "Unable to confirm payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Grant credits
    let { data: creditsRow } = await adminClient
      .from("image_credits")
      .select("paid_credits, free_remaining")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!creditsRow) {
      await adminClient.from("image_credits").insert({ user_id: user.id, free_remaining: 2, paid_credits: 0 });
      creditsRow = { paid_credits: 0, free_remaining: 2 } as any;
    }
    const newPaid = (Number(creditsRow.paid_credits) || 0) + (Number(payment.credits) || 0);
    const { error: credErr } = await adminClient
      .from("image_credits")
      .update({ paid_credits: newPaid, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    if (credErr) {
      return new Response(JSON.stringify({ error: "Credits update failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, payment_id, utr, paid_credits: newPaid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("confirm-upi-payment error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});