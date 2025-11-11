import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    // Preflight response (200 OK to match conventions)
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify requester is admin (by email)
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user || (user.email ?? "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read payload
    let userId: string | undefined;
    let credits: number | undefined;
    let amount: number | undefined;
    try {
      const body = await req.json();
      userId = typeof body.userId === "string" ? body.userId.trim() : undefined;
      credits = typeof body.credits === "number" ? body.credits : undefined;
      amount = typeof body.amount === "number" ? body.amount : 0;
    } catch (_) {}

    if (!userId || !credits || !Number.isFinite(credits) || credits <= 0) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Increment paid credits (create row if missing)
    const { data: icRow } = await admin
      .from('image_credits')
      .select('paid_credits')
      .eq('user_id', userId)
      .maybeSingle();

    if (icRow) {
      const newPaid = Number(icRow.paid_credits || 0) + Number(credits);
      const { error: updIcErr } = await admin
        .from('image_credits')
        .update({ paid_credits: newPaid, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (updIcErr) {
        return new Response(JSON.stringify({ error: 'Credits update failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      const { error: insIcErr } = await admin
        .from('image_credits')
        .insert({ user_id: userId, free_remaining: 2, paid_credits: Number(credits), updated_at: new Date().toISOString() });
      if (insIcErr) {
        return new Response(JSON.stringify({ error: 'Credits insert failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Create a payments record for audit
    const payment_id = `admin-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const upi_tr = `admin-manual-${payment_id}`;
    const { error: insPayErr } = await admin.from('payments').insert({
      payment_id,
      user_id: userId,
      amount: Number(amount ?? 0),
      credits: Number(credits),
      upi_tr,
      status: 'confirmed',
      provider: 'admin',
      order_id: null,
      provider_link: null,
      provider_signature: null,
    });
    if (insPayErr) {
      // Not fatal for credits (audit failed), but report it
      console.warn('admin-grant-credits: payments insert failed', insPayErr);
    }

    return new Response(JSON.stringify({ ok: true, userId, credits: Number(credits), payment_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-grant-credits error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});