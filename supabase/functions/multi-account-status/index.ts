import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

    // Extract IP from common headers and hash it for privacy
    const forwarded = req.headers.get("x-forwarded-for") ?? "";
    const cf = req.headers.get("cf-connecting-ip") ?? "";
    const real = req.headers.get("x-real-ip") ?? "";
    const forwardedIp = forwarded.split(",")[0].trim();
    const ipRaw = forwardedIp || cf || real || "unknown";
    const ipHash = await sha256(ipRaw);
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Record a session fingerprint (dedup by minute to avoid spam)
    try {
      await adminClient.from("ip_sessions").insert({
        ip_hash: ipHash,
        user_id: user.id,
        user_email: user.email,
        user_agent: userAgent,
      });
    } catch (e) {
      console.warn("ip_sessions insert failed (possibly table missing):", e);
    }

    // Count distinct users for this IP in the last 24 hours
    let distinctUsers = 0;
    try {
      const { data, error } = await adminClient.rpc("count_distinct_users_for_ip", {
        ip_hash_input: ipHash,
        window_hours: 24,
      });
      if (!error && typeof data === "number") distinctUsers = data;
      else {
        // Fallback query when RPC isn't present
        const { data: rows } = await adminClient
          .from("ip_sessions")
          .select("user_id")
          .eq("ip_hash", ipHash)
          .gte("recorded_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
        const set = new Set<string>((rows || []).map((r: any) => r.user_id).filter(Boolean));
        distinctUsers = set.size;
      }
    } catch (e) {
      console.warn("ip_sessions count failed:", e);
    }

    const isSuspect = distinctUsers >= 2; // same IP used by 2+ accounts in 24h
    return new Response(
      JSON.stringify({ is_suspect: isSuspect, distinct_users: distinctUsers }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("multi-account-status error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});