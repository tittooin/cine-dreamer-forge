import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RAZORPAY_WEBHOOK_SECRET || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return new Response("Server not configured", { status: 500 });
    }

    // Raw body for signature
    const payloadText = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || req.headers.get("X-Razorpay-Signature") || "";
    const enc = new TextEncoder();
    const key = await (crypto as any).subtle.importKey("raw", enc.encode(RAZORPAY_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await (crypto as any).subtle.sign("HMAC", key, enc.encode(payloadText));
    const expected = toHex(sig);
    if (expected !== signature) {
      return new Response("Invalid signature", { status: 401 });
    }

    const evt = JSON.parse(payloadText);
    if (evt.event === "payment.captured") {
      const payment = evt.payload.payment?.entity;
      const orderId = payment?.order_id;
      // fetch order to read notes
      const basicAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
      let userId = ""; let quantity = 1;
      if (orderId) {
        const oRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, { headers: { Authorization: `Basic ${basicAuth}` } });
        if (oRes.ok) {
          const oJson = await oRes.json();
          userId = oJson?.notes?.userId ?? "";
          quantity = Number(oJson?.notes?.quantity ?? 1);
        }
      }
      if (userId) {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
        await admin.from("image_credits").upsert({ user_id: userId, updated_at: new Date().toISOString() });
        const { data: row } = await admin.from("image_credits").select("paid_credits").eq("user_id", userId).maybeSingle();
        const current = Number(row?.paid_credits ?? 0);
        await admin.from("image_credits").update({ paid_credits: current + Math.max(1, quantity), updated_at: new Date().toISOString() }).eq("user_id", userId);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("razorpay-webhook error:", e);
    return new Response("Server error", { status: 500 });
  }
});