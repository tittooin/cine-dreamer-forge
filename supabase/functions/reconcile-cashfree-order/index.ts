// Supabase Edge Function: reconcile-cashfree-order
// Authenticated users can reconcile an order by payment_id or order_id.
// It verifies with Cashfree, confirms payment, and grants credits.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type CfOrderDetails = {
  order_id?: string;
  order_status?: string; // e.g. PAID
  payments?: { url?: string };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CASHFREE_ENV, CASHFREE_APP_ID, CASHFREE_SECRET_KEY } = Deno.env.toObject();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: corsHeaders });
  }
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Payments not configured' }), { status: 500, headers: corsHeaders });
  }

  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
  if (userErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

  const { payment_id, order_id } = await req.json().catch(() => ({ payment_id: undefined, order_id: undefined }));
  if (!payment_id && !order_id) {
    return new Response(JSON.stringify({ error: 'payment_id or order_id required' }), { status: 400, headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: paymentRow } = await admin
    .from('payments')
    .select('payment_id, user_id, amount, credits, status, provider, order_id')
    .eq(payment_id ? 'payment_id' : 'order_id', payment_id || order_id)
    .maybeSingle();
  if (!paymentRow) return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404, headers: corsHeaders });
  if (paymentRow.user_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  }
  if ((paymentRow.status || '').toLowerCase() === 'confirmed') {
    return new Response(JSON.stringify({ ok: true, message: 'Already confirmed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const env = (CASHFREE_ENV || 'sandbox').toLowerCase();
  const baseUrl = env === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
  const ordId = paymentRow.order_id || order_id || paymentRow.payment_id;

  // Verify with Cashfree
  const ordRes = await fetch(`${baseUrl}/orders/${ordId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': CASHFREE_APP_ID,
      'x-client-secret': CASHFREE_SECRET_KEY,
      'x-api-version': '2023-08-01',
    },
  });
  if (!ordRes.ok) {
    const errText = await ordRes.text();
    return new Response(JSON.stringify({ error: 'Verification failed', details: errText }), { status: 502, headers: corsHeaders });
  }
  const ordJson = await ordRes.json() as CfOrderDetails;
  const status = (ordJson.order_status || '').toUpperCase();
  if (status !== 'PAID') {
    return new Response(JSON.stringify({ error: 'Order not paid', order_status: status }), { status: 409, headers: corsHeaders });
  }

  // Confirm payment
  const { error: updErr } = await admin
    .from('payments')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('payment_id', paymentRow.payment_id);
  if (updErr) return new Response(JSON.stringify({ error: 'Update failed', details: updErr.message }), { status: 500, headers: corsHeaders });

  // Grant credits
  const { data: icRow } = await admin
    .from('image_credits')
    .select('paid_credits')
    .eq('user_id', user.id)
    .maybeSingle();
  if (icRow) {
    const newPaid = Number(icRow.paid_credits || 0) + (Number(paymentRow.credits) || 0);
    await admin.from('image_credits').update({ paid_credits: newPaid, updated_at: new Date().toISOString() }).eq('user_id', user.id);
  } else {
    await admin.from('image_credits').insert({ user_id: user.id, paid_credits: (Number(paymentRow.credits) || 0), updated_at: new Date().toISOString() });
  }

  return new Response(JSON.stringify({ ok: true, reconciled: true, order_id: ordId, payment_id: paymentRow.payment_id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});