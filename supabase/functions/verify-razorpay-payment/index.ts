import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function hmacSHA256(data: string, secret: string): string {
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  const msgData = enc.encode(data);
  return (crypto as any).subtle
    .importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]) // deno
    .then((key: CryptoKey) => (crypto as any).subtle.sign("HMAC", key, msgData))
    .then((sig: ArrayBuffer) => Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join(""));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RAZORPAY_KEY_SECRET) {
      return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, quantity = 1, userId } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId) {
      return new Response(JSON.stringify({ error: "Missing params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = await hmacSHA256(payload, RAZORPAY_KEY_SECRET);
    if (expected !== razorpay_signature) {
      return new Response(JSON.stringify({ error: "Signature mismatch" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const qty = Math.max(1, Number(quantity || 1));
    // Ensure row exists
    await admin.from("image_credits").upsert({ user_id: userId, updated_at: new Date().toISOString() });
    const { data: row } = await admin.from("image_credits").select("paid_credits").eq("user_id", userId).maybeSingle();
    const current = Number(row?.paid_credits ?? 0);
    const { error: upErr } = await admin.from("image_credits").update({ paid_credits: current + qty, updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (upErr) return new Response(JSON.stringify({ error: "Failed to add credits" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    return new Response(JSON.stringify({ ok: true, credits_added: qty }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("verify-razorpay-payment error:", e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});