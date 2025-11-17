import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toHex(b: ArrayBuffer) {
  const u = new Uint8Array(b);
  return Array.from(u).map(x => x.toString(16).padStart(2, '0')).join('');
}

async function signV4(url: URL, method: string, headers: Headers, accessKeyId: string, secretKey: string, region = "auto") {
  const service = "s3";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const signedHeaders = ["host", "x-amz-content-sha256", "x-amz-date"].join(";");
  headers.set("x-amz-date", amzDate);
  headers.set("x-amz-content-sha256", "UNSIGNED-PAYLOAD");
  const canonicalHeaders = `host:${url.host}\n` + `x-amz-content-sha256:UNSIGNED-PAYLOAD\n` + `x-amz-date:${amzDate}\n`;
  const canonicalQuery = url.searchParams.toString();
  const canonicalRequest = [method, url.pathname, canonicalQuery, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const encoder = new TextEncoder();
  const hashCanon = await crypto.subtle.digest("SHA-256", encoder.encode(canonicalRequest));
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    toHex(hashCanon),
  ].join("\n");
  const kDate = await crypto.subtle.importKey("raw", encoder.encode("AWS4" + secretKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then(key => crypto.subtle.sign("HMAC", key, encoder.encode(dateStamp)));
  const kRegion = await crypto.subtle.importKey("raw", kDate, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]) 
    .then(key => crypto.subtle.sign("HMAC", key, encoder.encode(region)));
  const kService = await crypto.subtle.importKey("raw", kRegion, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]) 
    .then(key => crypto.subtle.sign("HMAC", key, encoder.encode(service)));
  const kSigning = await crypto.subtle.importKey("raw", kService, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]) 
    .then(key => crypto.subtle.sign("HMAC", key, encoder.encode("aws4_request")));
  const signature = await crypto.subtle.importKey("raw", kSigning, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then(key => crypto.subtle.sign("HMAC", key, encoder.encode(stringToSign)));
  const sigHex = toHex(signature);
  const credential = `${accessKeyId}/${credentialScope}`;
  return { amzDate, credential, signedHeaders, signature: sigHex };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = Deno.env.toObject();
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_ASSETS, R2_BUCKET_PREVIEWS, R2_PUBLIC_BASE_URL } = Deno.env.toObject();
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Server not configured" }), { status: 500, headers: corsHeaders });
    }
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const category = String(body?.category || "assets");
    const contentType = String(body?.contentType || "application/octet-stream");
    const isPreview = category === 'previews';
    const bucket = isPreview ? (R2_BUCKET_PREVIEWS || 'tittoos-previews') : (R2_BUCKET_ASSETS || 'tittoos-assets');
    const key = `${category}/${crypto.randomUUID()}`;
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const url = new URL(`https://${host}/${bucket}/${key}`);
    url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
    const amzDate = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + "Z";
    const dateStamp = amzDate.slice(0,8);
    url.searchParams.set("X-Amz-Date", amzDate);
    url.searchParams.set("X-Amz-Expires", "900");
    url.searchParams.set("X-Amz-SignedHeaders", "host;x-amz-content-sha256;x-amz-date");
    url.searchParams.set("X-Amz-Credential", `${R2_ACCESS_KEY_ID}/${dateStamp}/auto/s3/aws4_request`);
    const headers = new Headers({ "host": host, "x-amz-content-sha256": "UNSIGNED-PAYLOAD", "x-amz-date": amzDate, "content-type": contentType });
    const sig = await signV4(url, "PUT", headers, R2_ACCESS_KEY_ID!, R2_SECRET_ACCESS_KEY!);
    url.searchParams.set("X-Amz-Signature", sig.signature);

    const publicBase = R2_PUBLIC_BASE_URL || `https://pub-${R2_ACCOUNT_ID}.r2.dev`;
    const publicUrl = `${publicBase}/${bucket}/${key}`;
    return new Response(JSON.stringify({ putUrl: url.toString(), publicUrl, key }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("get-upload-url error", e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: corsHeaders });
  }
});