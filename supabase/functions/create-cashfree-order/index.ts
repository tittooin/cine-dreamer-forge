// Deno / Supabase Edge Function: create-cashfree-order
// Creates a Cashfree PG order and stores provider identifiers in payments table
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type CfOrderResponse = {
  order_id?: string;
  payment_link?: string;
  payment_links?: { link_url?: string };
  payment_session_id?: string;
  status?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY, CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV } =
      Deno.env.toObject();

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env' }), { status: 500, headers: corsHeaders });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } },
    );

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
    }

    const amount = Number(body.amount);
    const credits = Number(body.credits);
    const note = String(body.note ?? 'Image credits purchase');
    if (!amount || amount <= 0 || !credits || credits <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount or credits' }), { status: 400, headers: corsHeaders });
    }

    // Create a pending payment row with service role (bypass RLS)
    const paymentId = `cf_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: 'Missing service role key' }), { status: 500, headers: corsHeaders });
    }
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: inserted, error: insErr } = await adminClient
      .from('payments')
      .insert({
        payment_id: paymentId,
        user_id: user.id,
        amount,
        credits,
        status: 'pending',
        provider: 'cashfree',
        upi_tr: '',
      })
      .select('payment_id')
      .single();
    if (insErr) {
      return new Response(JSON.stringify({ error: 'Failed to create payment row', details: insErr.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      // Keep record pending; client can retry after secrets set
      return new Response(
        JSON.stringify({
          error: 'Cashfree env not configured',
          payment_id: paymentId,
        }),
        { status: 500, headers: corsHeaders },
      );
    }

    const env = (CASHFREE_ENV || 'sandbox').toLowerCase();
    const envMode = env === 'prod' || env === 'production' ? 'production' : 'sandbox';
    const baseUrl = envMode === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

    // Build order payload as per Cashfree PG Orders API
    const originHeader = req.headers.get('origin') ?? '';
    const origin = originHeader && originHeader.startsWith('http://localhost')
      ? 'https://tittoos.cloud'
      : originHeader || 'https://tittoos.cloud';
    const projectRef = SUPABASE_URL.match(/https:\/\/([^\.]+)\.supabase\.co/i)?.[1] ?? '';
    const notifyUrl = `https://${projectRef}.functions.supabase.co/cashfree-webhook`;
    const returnUrl = `${origin}/?cf_return={order_id}`;

    const validEmail = (user.email && /.+@.+\..+/.test(user.email)) ? user.email : 'noreply@example.com';
    const customerPhone = (user as any).phone || (user.user_metadata as any)?.phone || '9999999999';
    const orderPayload = {
      order_id: paymentId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: user.id,
        customer_email: validEmail,
        customer_phone: String(customerPhone).replace(/[^0-9]/g, '').slice(-10) || '9999999999',
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl,
      },
      order_note: note,
    };

    const cfRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY,
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!cfRes.ok) {
      const errText = await cfRes.text();
      return new Response(JSON.stringify({ error: 'Cashfree order creation failed', details: errText }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    const cfJson = (await cfRes.json()) as CfOrderResponse & Record<string, unknown>;
    const cfOrderId = (cfJson.order_id as string) || paymentId;
    const paymentSessionId = (cfJson.payment_session_id as string) || '';
    let paymentLink = (cfJson.payment_link as string)
      || (cfJson.payment_links?.link_url as string)
      || ((cfJson as any)?.payments?.url as string)
      || '';

    // If hosted link not present in create response, fetch order details to get payments.url
    if (!paymentLink) {
      const ordRes = await fetch(`${baseUrl}/orders/${cfOrderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': CASHFREE_APP_ID,
          'x-client-secret': CASHFREE_SECRET_KEY,
          'x-api-version': '2023-08-01',
        },
      });
      if (ordRes.ok) {
        const ordJson = await ordRes.json();
        paymentLink = ((ordJson as any)?.payments?.url as string)
          || ((ordJson as any)?.payment_links?.link_url as string)
          || '';
      }

      // As a final fallback, try creating a payment session for checkout
      if (!paymentLink && !paymentSessionId) {
        try {
          const sessRes = await fetch(`${baseUrl}/orders/sessions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-client-id': CASHFREE_APP_ID,
              'x-client-secret': CASHFREE_SECRET_KEY,
              'x-api-version': '2023-08-01',
            },
            body: JSON.stringify({ order_id: cfOrderId }),
          });
          if (sessRes.ok) {
            const sessJson = await sessRes.json();
            // Cashfree may return payment_session_id or url
            const psid = (sessJson as any)?.payment_session_id as string;
            const surl = (sessJson as any)?.url as string;
            if (psid && !paymentSessionId) {
              (cfJson as any).payment_session_id = psid;
            }
            if (surl && !paymentLink) {
              paymentLink = surl;
            }
          }
        } catch (_) {
          // Ignore session creation errors and proceed
        }
      }
    }

    // Update payment row with provider details
    const { error: upErr } = await adminClient
      .from('payments')
      .update({ order_id: cfOrderId, provider_link: paymentLink })
      .eq('payment_id', paymentId);
    if (upErr) {
      return new Response(JSON.stringify({ error: 'Failed to persist provider info', details: upErr.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({
        payment_id: paymentId,
        order_id: cfOrderId,
        payment_link: paymentLink,
        payment_session_id: (cfJson as any)?.payment_session_id || paymentSessionId || '',
        env: envMode,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Unhandled error', details: String(e) }), { status: 500, headers: corsHeaders });
  }
}

// Start the server
serve(handler);