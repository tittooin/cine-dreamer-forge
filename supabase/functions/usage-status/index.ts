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
    const DEFAULT_DAILY_LIMIT = Number(Deno.env.get("DAILY_IMAGE_LIMIT") || 50);
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

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Determine effective limits (daily and monthly) from user overrides or app defaults
    let effectiveDailyLimit = DEFAULT_DAILY_LIMIT;
    let effectiveMonthlyLimit = Number(Deno.env.get("MONTHLY_IMAGE_LIMIT") || 100);
    const { data: defaultsRow } = await adminClient
      .from("app_settings")
      .select("daily_default, monthly_default")
      .eq("key", "default_limits")
      .maybeSingle();
    if (defaultsRow) {
      effectiveDailyLimit = defaultsRow.daily_default ?? effectiveDailyLimit;
      effectiveMonthlyLimit = defaultsRow.monthly_default ?? effectiveMonthlyLimit;
    }
    const { data: limitRow } = await adminClient
      .from("user_limits")
      .select("daily_limit, monthly_limit")
      .eq("user_id", user.id)
      .maybeSingle();
    if (limitRow) {
      if (typeof limitRow.daily_limit === "number") effectiveDailyLimit = limitRow.daily_limit as number;
      if (typeof limitRow.monthly_limit === "number") effectiveMonthlyLimit = limitRow.monthly_limit as number;
    }

    const today = new Date();
    const periodStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
      .toISOString()
      .slice(0, 10);
    const { data: usageRow } = await adminClient
      .from("image_usage")
      .select("count")
      .eq("user_id", user.id)
      .eq("period_start", periodStart)
      .maybeSingle();
    const count = usageRow && typeof usageRow.count === "number" ? usageRow.count as number : 0;
    const remaining = Math.max(effectiveDailyLimit - count, 0);
    // Monthly stats
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const { data: monthRows } = await adminClient
      .from("image_usage")
      .select("count")
      .eq("user_id", user.id)
      .gte("period_start", monthStart)
      .lte("period_start", periodStart);
    const monthlyCount = Array.isArray(monthRows) ? monthRows.reduce((acc, r) => acc + (typeof r.count === "number" ? r.count : 0), 0) : 0;
    const monthlyRemaining = Math.max(effectiveMonthlyLimit - monthlyCount, 0);

    return new Response(
      JSON.stringify({ userId: user.id, periodStart, count, limit: effectiveDailyLimit, remaining, monthlyCount, monthlyLimit: effectiveMonthlyLimit, monthlyRemaining }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("usage-status error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});