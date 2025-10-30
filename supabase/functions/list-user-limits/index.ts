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
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL) {
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
    const requesterEmail = user.email ?? "";
    if (requesterEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const today = new Date();
    const periodStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
      .toISOString()
      .slice(0, 10);
    // Read pagination/search params from body or URL
    let page = 0;
    let pageSize = 10;
    let q: string | undefined = undefined;
    try {
      const body = await req.json();
      if (typeof body.page === "number" && body.page >= 0) page = body.page;
      if (typeof body.pageSize === "number" && body.pageSize > 0 && body.pageSize <= 100) pageSize = body.pageSize;
      if (typeof body.q === "string") q = body.q.trim();
    } catch (_) {
      const url = new URL(req.url);
      const p = Number(url.searchParams.get("page"));
      const ps = Number(url.searchParams.get("pageSize"));
      const qq = url.searchParams.get("q");
      if (Number.isFinite(p) && p >= 0) page = p;
      if (Number.isFinite(ps) && ps > 0 && ps <= 100) pageSize = ps;
      if (qq) q = qq.trim();
    }

    // Build base query
    let base = adminClient.from("user_limits").select("user_id, daily_limit", { count: "exact" });
    if (q && q.length > 0) {
      base = base.ilike("user_id", `%${q}%`);
    }
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data: pageRows, error, count } = await base.range(from, to);
    if (error) {
      return new Response(JSON.stringify({ error: "Query failed", detail: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = [] as Array<{ user_id: string; email?: string; daily_limit: number; today_count: number }>;
    for (const row of pageRows ?? []) {
      const { data: usageRow } = await adminClient
        .from("image_usage")
        .select("count")
        .eq("user_id", row.user_id)
        .eq("period_start", periodStart)
        .maybeSingle();
      const today_count = usageRow && typeof usageRow.count === "number" ? (usageRow.count as number) : 0;
      let email: string | undefined = undefined;
      try {
        const { data: userById } = await adminClient.auth.admin.getUserById(row.user_id);
        email = userById?.user?.email ?? undefined;
      } catch (_) {}
      result.push({ user_id: row.user_id, email, daily_limit: row.daily_limit, today_count });
    }

    return new Response(JSON.stringify({ items: result, page, pageSize, totalCount: count ?? result.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("list-user-limits error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});