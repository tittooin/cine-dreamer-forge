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

    // Auth check (admin only)
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

    // Read pagination & search
    let page = 0;
    let pageSize = 10;
    let q: string | undefined = undefined;
    try {
      const body = await req.json();
      if (typeof body.page === "number" && body.page >= 0) page = body.page;
      if (typeof body.pageSize === "number" && body.pageSize > 0 && body.pageSize <= 100) pageSize = body.pageSize;
      if (typeof body.q === "string") q = body.q.trim();
    } catch (_) {}

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    // Supabase Admin API: list users
    // Use 1-based page indexing for admin API
    const { data: listed, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: pageSize, page: page + 1 });
    if (listErr) {
      return new Response(JSON.stringify({ error: "Query failed", detail: String(listErr) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let users = (listed?.users ?? []).map((u) => ({ id: u.id, email: u.email ?? "", created_at: u.created_at }));
    if (q && q.length > 0) {
      const qLower = q.toLowerCase();
      users = users.filter((u) => (u.email || "").toLowerCase().includes(qLower) || u.id.toLowerCase().includes(qLower));
    }

    return new Response(JSON.stringify({ items: users, page, pageSize, totalCount: users.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("list-users error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});