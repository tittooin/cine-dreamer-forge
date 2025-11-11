// Supabase Edge Function: cashfree-webhook
// Verifies Cashfree payment notifications, reconciles order status,
// updates payments table, and grants image credits.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type CfOrderDetails = {
  order_id?: string;
  order_status?: string; // e.g. PAID
  payments?: { url?: string };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

function getOrderIdFromBody(body: Record<string, unknown>): string | null {
  // Try multiple shapes commonly used by Cashfree webhooks
  const tryPaths = [
    ['data','order','order_id'],
    ['order','order_id'],
    ['order_id'],
    ['data','order_id'],
    ['order','id'],
  ];
  for (const path of tryPaths) {
    let cur: any = body;
    for (const key of path) {
      if (cur && typeof cur === 'object' && key in cur) cur = cur[key];
      else { cur = undefined; break; }
    }
    if (typeof cur === 'string' && cur) return cur;
  }
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV } = Deno.env.toObject();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env' }), { status: 500, headers: corsHeaders });
  }
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
  }

  const signature = req.headers.get('x-webhook-signature') || '';
  const orderId = getOrderIdFromBody(body) || String((body as any)?.order_id || '');
  if (!orderId) {
    // Attempt to accept but log; no-op to avoid 5xx retries storm
    console.warn('cashfree-webhook: missing order_id in body', body);
    return new Response(JSON.stringify({ ok: true, note: 'no order_id' }), { status: 200, headers: corsHeaders });
  }

  // Verify with Cashfree API (robust even if signature config differs)
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    console.error('cashfree-webhook: CASHFREE env missing');
    return new Response(JSON.stringify({ error: 'Cashfree env not configured' }), { status: 500, headers: corsHeaders });
  }
  const env = (CASHFREE_ENV || 'sandbox').toLowerCase();
  const envMode = env === 'prod' || env === 'production' ? 'production' : 'sandbox';
  const baseUrl = envMode === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

  let verifiedPaid = false;
  try {
    const ordRes = await fetch(`${baseUrl}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': '2023-08-01',
      },
    });
    if (ordRes.ok) {
      const ordJson = (await ordRes.json()) as CfOrderDetails & Record<string, unknown>;
      const status = String((ordJson as any)?.order_status || '').toUpperCase();
      verifiedPaid = status === 'PAID' || status === 'COMPLETED' || status === 'SUCCESS';
    } else {
      console.warn('cashfree-webhook: order verify failed', await ordRes.text());
    }
  } catch (e) {
    console.error('cashfree-webhook: verify error', e);
  }

  // Find the payment row by order_id first, then fallback to payment_id
  const { data: payRow } = await admin
    .from('payments')
    .select('payment_id,user_id,credits,status')
    .eq('order_id', orderId)
    .maybeSingle();

  const paymentId = payRow?.payment_id || orderId;

  if (!verifiedPaid) {
    // If webhook body itself indicates success, allow confirmation
    const inlineStatus = String((body as any)?.data?.payment?.payment_status || (body as any)?.payment_status || '').toUpperCase();
    if (inlineStatus === 'SUCCESS' || inlineStatus === 'PAID' || inlineStatus === 'COMPLETED') {
      verifiedPaid = true;
    }
  }

  if (!verifiedPaid) {
    // Nothing to do; acknowledge to avoid retries storms
    return new Response(JSON.stringify({ ok: true, order_id: orderId, verified: false }), { status: 200, headers: corsHeaders });
  }

  // Persist confirmation and grant credits atomically (best-effort without explicit transaction)
  const { data: rowAfterSelect, error: selErr } = payRow
    ? { data: payRow, error: null }
    : await admin.from('payments').select('payment_id,user_id,credits,status').eq('payment_id', paymentId).single();
  if (selErr) {
    console.error('cashfree-webhook: select error', selErr);
  }

  const userId = rowAfterSelect?.user_id as string | undefined;
  const credits = Number(rowAfterSelect?.credits || 0);

  // Update payments status
  const { error: updErr } = await admin
    .from('payments')
    .update({ status: 'confirmed', provider_signature: signature, updated_at: new Date().toISOString() })
    .or(`order_id.eq.${orderId},payment_id.eq.${paymentId}`);
  if (updErr) {
    console.error('cashfree-webhook: update payments error', updErr);
  }

  // Grant credits if we have a user
  if (userId && credits > 0) {
    // Read existing credits and increment
    const { data: icRow } = await admin
      .from('image_credits')
      .select('paid_credits')
      .eq('user_id', userId)
      .maybeSingle();

    if (icRow) {
      const newPaid = Number(icRow.paid_credits || 0) + credits;
      const { error: updIcErr } = await admin
        .from('image_credits')
        .update({ paid_credits: newPaid, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (updIcErr) console.warn('cashfree-webhook: image_credits increment failed', updIcErr);
    } else {
      const { error: insIcErr } = await admin
        .from('image_credits')
        .insert({ user_id: userId, paid_credits: credits, updated_at: new Date().toISOString() });
      if (insIcErr) console.warn('cashfree-webhook: image_credits insert failed', insIcErr);
    }
  }

  return new Response(JSON.stringify({ ok: true, order_id: orderId, payment_id: paymentId, confirmed: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(handler);
// Verifies Cashfree webhook signature and auto-credits user on successful payment
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get('x-webhook-signature') || req.headers.get('x-cf-signature') || '';
  const { SUPABASE_URL, SUPABASE_ANON_KEY, CASHFREE_WEBHOOK_SECRET } = Deno.env.toObject();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env' }), { status: 500, headers: corsHeaders });
  }

  // Verify HMAC SHA256 signature if secret is configured
  if (CASHFREE_WEBHOOK_SECRET) {
    const key = new TextEncoder().encode(CASHFREE_WEBHOOK_SECRET);
    const data = new TextEncoder().encode(rawBody);
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));
    const expected = Array.from(sigBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const provided = signatureHeader.toLowerCase().replace(/[^0-9a-f]/g, '');
    const ok = timingSafeEqual(new TextEncoder().encode(expected), new TextEncoder().encode(provided));
    if (!ok) {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 401, headers: corsHeaders });
    }
  }

  const payload = (() => {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
  }

  // Attempt to read common fields from Cashfree webhook
  const orderId = (payload as any)?.order?.order_id || (payload as any)?.data?.order?.order_id || (payload as any)?.order_id;
  const paymentStatus = (payload as any)?.payment?.payment_status || (payload as any)?.data?.payment?.payment_status || (payload as any)?.payment_status;

  if (!orderId) {
    return new Response(JSON.stringify({ error: 'Missing order_id in webhook' }), { status: 400, headers: corsHeaders });
  }

  const supabase = (await import('https://esm.sh/@supabase/supabase-js@2')).createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Find payment by order_id
  const { data: payRow, error: payErr } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (payErr || !payRow) {
    return new Response(JSON.stringify({ error: 'Payment not found', details: payErr?.message }), { status: 404, headers: corsHeaders });
  }

  // Only proceed if still pending
  if (payRow.status !== 'pending') {
    return new Response(JSON.stringify({ ok: true, message: 'Already processed' }), { status: 200, headers: corsHeaders });
  }

  const isSuccess = String(paymentStatus || '').toUpperCase().includes('SUCCESS') || String((payload as any)?.event)?.includes('order.payment.completed');

  if (!isSuccess) {
    // Mark failed/cancelled if the payload indicates a terminal non-success state
    const terminal = String(paymentStatus || '').toUpperCase();
    if (terminal.startsWith('FAILED') || terminal.startsWith('CANCELLED')) {
      await supabase.from('payments').update({ status: 'failed' }).eq('payment_id', payRow.payment_id);
      return new Response(JSON.stringify({ ok: true, message: 'Marked failed' }), { status: 200, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ ok: true, message: 'Ignored non-success webhook' }), { status: 200, headers: corsHeaders });
  }

  // Mark confirmed and grant credits
  const { error: upErr } = await supabase
    .from('payments')
    .update({ status: 'confirmed' })
    .eq('payment_id', payRow.payment_id);
  if (upErr) {
    return new Response(JSON.stringify({ error: 'Failed to update payment status', details: upErr.message }), { status: 500, headers: corsHeaders });
  }

  // Grant credits
  const { error: credErr } = await supabase.rpc('grant_paid_credits', {
    target_user_id: payRow.user_id,
    credit_count: payRow.credits,
  });
  if (credErr) {
    return new Response(JSON.stringify({ error: 'Failed to grant credits', details: credErr.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
}

serve(handler);