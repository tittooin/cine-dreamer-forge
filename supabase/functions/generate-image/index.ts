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
    const { prompt } = await req.json();
    
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const HF_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
    if (!HF_API_KEY) {
      throw new Error("HUGGINGFACE_API_KEY is not configured");
    }

    // Optional: Use a dedicated Hugging Face Inference Endpoint if provided
    // Set `HF_ENDPOINT_URL` and optionally `HF_ENDPOINT_TOKEN` as secrets.
    const HF_ENDPOINT_URL = Deno.env.get("HF_ENDPOINT_URL");
    const HF_ENDPOINT_TOKEN = Deno.env.get("HF_ENDPOINT_TOKEN") || HF_API_KEY;

    // Per-user quota limiting (soft enforcement). Requires a table `image_usage`:
    //   user_id text, period_start date, count int, unique(user_id, period_start)
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const DEFAULT_DAILY_LIMIT = Number(Deno.env.get("DAILY_IMAGE_LIMIT") || 10);
    const DEFAULT_MONTHLY_LIMIT = Number(Deno.env.get("MONTHLY_IMAGE_LIMIT") || 100);

    // Require logged-in user: validate JWT from Authorization header via Supabase
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false },
        });
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: "Unauthorized", detail: "Login required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        userId = user.id;
      } catch (e) {
        console.warn("Auth check failed:", e);
        return new Response(
          JSON.stringify({ error: "Unauthorized", detail: "Login required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // If envs missing, deny by default to enforce login requirement
      return new Response(
        JSON.stringify({ error: "Unauthorized", detail: "Login required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date();
    const periodStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
      .toISOString()
      .slice(0, 10);

    // If Supabase admin creds exist, check usage; otherwise skip gracefully.
    // Determine effective daily limit: per-user override if present
    let effectiveDailyLimit = DEFAULT_DAILY_LIMIT;
    let effectiveMonthlyLimit = DEFAULT_MONTHLY_LIMIT;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && userId) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });
        // Read app defaults
        const { data: defaultsRow } = await supabase
          .from("app_settings")
          .select("daily_default, monthly_default")
          .eq("key", "default_limits")
          .maybeSingle();
        if (defaultsRow) {
          effectiveDailyLimit = defaultsRow.daily_default ?? effectiveDailyLimit;
          effectiveMonthlyLimit = defaultsRow.monthly_default ?? effectiveMonthlyLimit;
        }
        // Per-user overrides
        const { data: limitRow, error: limitErr } = await supabase
          .from("user_limits")
          .select("daily_limit, monthly_limit")
          .eq("user_id", userId)
          .maybeSingle();
        if (!limitErr && limitRow && typeof limitRow.daily_limit === "number") {
          effectiveDailyLimit = limitRow.daily_limit as number;
        }
        if (!limitErr && limitRow && typeof limitRow.monthly_limit === "number") {
          effectiveMonthlyLimit = limitRow.monthly_limit as number;
        }
      } catch (e) {
        console.warn("User limit fetch skipped:", e);
      }
    }

    // If Supabase admin creds exist, check usage; otherwise skip gracefully.
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });
        const { data, error } = await supabase
          .from("image_usage")
          .select("count")
          .eq("user_id", userId)
          .eq("period_start", periodStart)
          .maybeSingle();

        if (!error && data && typeof data.count === "number" && data.count >= effectiveDailyLimit) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded", userId, periodStart, limit: effectiveDailyLimit }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Monthly check: sum counts in current month
        const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
          .toISOString()
          .slice(0, 10);
        const { data: monthRows } = await supabase
          .from("image_usage")
          .select("count")
          .eq("user_id", userId)
          .gte("period_start", monthStart)
          .lte("period_start", periodStart);
        const monthlyCount = Array.isArray(monthRows) ? monthRows.reduce((acc, r) => acc + (typeof r.count === "number" ? r.count : 0), 0) : 0;
        if (monthlyCount >= effectiveMonthlyLimit) {
          return new Response(
            JSON.stringify({ error: "Monthly rate limit exceeded", userId, monthStart, limit: effectiveMonthlyLimit }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        console.warn("Quota check skipped:", e);
      }
    }

    console.log("Generating image via Hugging Face with prompt:", prompt);

    // Use the new Hugging Face Router Inference endpoint (api-inference deprecated)
    // If a dedicated endpoint URL is provided, use it; otherwise default to router hf-inference
    const inferenceUrl = "https://router.huggingface.co/hf-inference";
    const model = "black-forest-labs/FLUX.1-schnell";

    const hfUrl = HF_ENDPOINT_URL || inferenceUrl;

    // Using Hugging Face Inference API (via Router) which returns binary image data
    const response = await fetch(`${hfUrl}/models/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_ENDPOINT_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "image/png",
      },
      body: JSON.stringify({
        inputs: prompt,
        options: { wait_for_model: true },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Hugging Face error:", response.status, errorText);
      // Propagate a non-200 status so the client receives an 'error' from invoke()
      return new Response(
        JSON.stringify({ error: "Hugging Face error", status: response.status, detail: errorText }),
        { status: response.status || 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Traditional HF returns binary image data; convert to base64 data URL for client display
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:image/png;base64,${base64}`;

    console.log("Image generation completed (data URL length):", dataUrl.length);

    // After success, increment usage counter (best-effort)
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && userId) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });
        // Upsert: if row exists, increment; else create with count=1
        const { data, error } = await supabase
          .from("image_usage")
          .select("count")
          .eq("user_id", userId)
          .eq("period_start", periodStart)
          .maybeSingle();
        if (!error && data && typeof data.count === "number") {
          await supabase
            .from("image_usage")
            .update({ count: (data.count as number) + 1 })
            .eq("user_id", userId)
            .eq("period_start", periodStart);
        } else {
          await supabase
            .from("image_usage")
            .insert({ user_id: userId, period_start: periodStart, count: 1 });
        }
      } catch (e) {
        console.warn("Quota increment skipped:", e);
      }
    }
    return new Response(
      JSON.stringify({ imageUrl: dataUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-image function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
