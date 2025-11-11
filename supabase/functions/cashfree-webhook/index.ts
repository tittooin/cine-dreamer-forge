// Supabase Edge Function: cashfree-webhook
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