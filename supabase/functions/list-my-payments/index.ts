// Supabase Edge Function: list-my-payments
// Returns recent payment records for the authenticated user
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = Deno.env.toObject();
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: corsHeaders });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    let page = 0;
    let pageSize = 20;
    try {
      const body = await req.json();
      if (typeof body.page === 'number' && body.page >= 0) page = body.page;
      if (typeof body.pageSize === 'number' && body.pageSize > 0 && body.pageSize <= 100) pageSize = body.pageSize;
    } catch (_) {}

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await admin
      .from('payments')
      .select('payment_id, amount, credits, status, provider, order_id, provider_link, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) {
      return new Response(JSON.stringify({ error: 'Query failed', details: error.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ items: data ?? [], page, pageSize }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('list-my-payments error', e);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: corsHeaders });
  }
});