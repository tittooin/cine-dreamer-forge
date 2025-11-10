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

    // Credit-based access: first 2 free, then consume paid credits (₹5 per image)
    let consumeFrom: "free" | "paid" | null = null;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && userId) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });
        let { data: credits } = await supabase
          .from("image_credits")
          .select("free_remaining, paid_credits")
          .eq("user_id", userId)
          .maybeSingle();
        if (!credits) {
          await supabase
            .from("image_credits")
            .insert({ user_id: userId, free_remaining: 2, paid_credits: 0 });
          credits = { free_remaining: 2, paid_credits: 0 } as any;
        }
        if (typeof credits.free_remaining === "number" && credits.free_remaining > 0) {
          consumeFrom = "free";
        } else if (typeof credits.paid_credits === "number" && credits.paid_credits > 0) {
          consumeFrom = "paid";
        } else {
          return new Response(
            JSON.stringify({ error: "No credits remaining", status: 402, detail: "You have used 2 free images. Purchase credits to continue (₹5 per image)." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        console.warn("Credit check skipped:", e);
      }
    }

    console.log("Generating image via Hugging Face with prompt:", prompt);

    // Use the new Hugging Face Router Inference endpoint (api-inference deprecated)
    // If a dedicated endpoint URL is provided, use it; otherwise default to router hf-inference
    const inferenceUrl = "https://router.huggingface.co/hf-inference";
    const model = "black-forest-labs/FLUX.1-schnell";

    // If HF_ENDPOINT_URL is provided but points to deprecated api-inference,
    // force-switch to the router hf-inference endpoint
    const hfUrl = (() => {
      const raw = HF_ENDPOINT_URL?.trim();
      if (!raw) return inferenceUrl;
      if (raw.includes("api-inference.huggingface.co")) {
        return inferenceUrl;
      }
      return raw;
    })();

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
      console.error("Hugging Face error:", { status: response.status, url: `${hfUrl}/models/${model}` , detail: errorText });
      // Propagate a non-200 status so the client receives an 'error' from invoke()
      return new Response(
        JSON.stringify({ error: "Hugging Face error", status: response.status, endpoint: hfUrl, detail: errorText?.slice(0, 2000) }),
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

    // After success, consume credit
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && userId && consumeFrom) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });
        if (consumeFrom === "free") {
          await supabase
            .from("image_credits")
            .update({ free_remaining: (await (async () => {
              const { data } = await supabase
                .from("image_credits")
                .select("free_remaining")
                .eq("user_id", userId)
                .maybeSingle();
              const fr = (data?.free_remaining ?? 1) as number;
              return Math.max(fr - 1, 0);
            })(), updated_at: new Date().toISOString() })
            .eq("user_id", userId);
        } else {
          await supabase
            .from("image_credits")
            .update({ paid_credits: (await (async () => {
              const { data } = await supabase
                .from("image_credits")
                .select("paid_credits")
                .eq("user_id", userId)
                .maybeSingle();
              const pc = (data?.paid_credits ?? 1) as number;
              return Math.max(pc - 1, 0);
            })(), updated_at: new Date().toISOString() })
            .eq("user_id", userId);
        }
      } catch (e) {
        console.warn("Credit decrement skipped:", e);
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
