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
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers: corsHeaders });
    }

    let category: string | undefined;
    let page = 0;
    let pageSize = 30;
    try {
      const body = await req.json();
      if (typeof body.category === 'string' && body.category.length) category = body.category;
      if (typeof body.page === 'number' && body.page >= 0) page = body.page;
      if (typeof body.pageSize === 'number' && body.pageSize > 0 && body.pageSize <= 100) pageSize = body.pageSize;
    } catch (_) {}

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    let q = admin.from('assets').select('*').order('created_at', { ascending: false });
    if (category) q = q.eq('category', category);
    const { data, error } = await q.range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) {
      return new Response(JSON.stringify({ error: 'Query failed', details: error.message }), { status: 500, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ items: data ?? [], page, pageSize }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('list-assets error', e);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: corsHeaders });
  }
});