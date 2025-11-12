import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Sparkles, Shield } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import QRCode from "react-qr-code";

const Index = () => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
  const [usage, setUsage] = useState<{ count: number; limit: number; remaining: number } | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [buyQty, setBuyQty] = useState<number>(1);
  const [isMultiAccount, setIsMultiAccount] = useState(false);
  const GPAY_VPA = import.meta.env.VITE_GPAY_VPA || "";
  const GPAY_NAME = import.meta.env.VITE_GPAY_NAME || "Tittoos Store";
  const GPAY_AMOUNTS = (import.meta.env.VITE_GPAY_AMOUNT || "2.99,11.99,49")
    .split(",")
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const [A1 = 2.99, A2 = 11.99, A3 = 49] = GPAY_AMOUNTS;
  const [upiIntent, setUpiIntent] = useState<string | null>(null);
  const [showUpiHelp, setShowUpiHelp] = useState(false);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [utrInput, setUtrInput] = useState("");
  // Poster editing moved to dedicated page (/poster)

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setUserEmail(data.session?.user?.email ?? null);
      if (data.session?.user) {
        try {
          const { data: u } = await supabase.functions.invoke("usage-status");
          if (u && typeof u.count === "number") setUsage({ count: u.count, limit: u.limit, remaining: u.remaining });
        } catch (e) {
          console.error("usage-status error", e);
        }
        try {
          const { data: s } = await supabase.functions.invoke("multi-account-status");
          if (s && typeof s.is_suspect === "boolean") setIsMultiAccount(!!s.is_suspect);
        } catch (e) {
          console.error("multi-account-status error", e);
        }
      }
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription?.unsubscribe();
    };
  }, []);

  const handleSignInGoogle = async () => {
    // Redirect back to the exact page path (robust for GH Pages)
    // new URL('.', href) resolves to origin + pathname with trailing slash
    const redirectTo = new URL('.', window.location.href).toString();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      toast.error("Google sign-in failed");
      console.error(error);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Sign out failed");
      console.error(error);
    } else {
      toast.success("Signed out");
    }
  };

  const handleGenerate = async () => {
    if (!userEmail) {
      toast.error("Please login with Google first");
      return;
    }
    // Credits gating: when 0, block generation (no payments enabled)
    const credits = usage ? (typeof (usage as any).credits === "number" ? (usage as any).credits as number : usage.remaining) : 0;
    if (credits <= 0) { toast.error("No credits left. Please contact support."); return; }
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt },
      });

      if (error) {
        console.error("Generate-image failed:", error);
        toast.error(error.message || "Failed to generate image");
        return;
      }

      if (data && data.error) {
        console.error("Hugging Face error detail:", data);
        let detail = "";
        if (data.detail !== undefined) {
          if (typeof data.detail === "string") detail = data.detail;
          else detail = JSON.stringify(data.detail);
        }
        detail = detail.slice(0, 240);
        toast.error(`${data.error}${detail ? ": " + detail : ""}`);
        return;
      }

      setGeneratedImage(data.imageUrl);
      toast.success("Image generated successfully!");
      // Refresh usage after success
      try {
        const { data: u } = await supabase.functions.invoke("usage-status");
        if (u && typeof u.count === "number") setUsage({ count: u.count, limit: u.limit, remaining: u.remaining });
      } catch {}
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Stripe Upgrade flow removed; using UPI/Razorpay gating instead

  const watermarkSrc = `${import.meta.env.BASE_URL}logo.png`;

  // SEO: page title and description tuned for ranking on key terms
  useEffect(() => {
    document.title = "Text to Image Generator & YouTube Thumbnail Maker | Tittoos AI";
    const meta = document.querySelector('meta[name="description"]');
    const desc = "Generate cinematic, realistic images and design YouTube thumbnails with AI. Fast, simple, and creator‑friendly.";
    if (meta) meta.setAttribute('content', desc);
  }, []);


  const handleDownload = async () => {
    if (!generatedImage) return;

    try {
      const baseImg = new Image();
      baseImg.crossOrigin = "anonymous";
      baseImg.src = generatedImage;
      await new Promise<void>((resolve, reject) => {
        baseImg.onload = () => resolve();
        baseImg.onerror = () => reject(new Error("Failed to load base image"));
      });

      const wmImg = new Image();
      wmImg.crossOrigin = "anonymous";
      wmImg.src = watermarkSrc;
      await new Promise<void>((resolve, reject) => {
        wmImg.onload = () => resolve();
        wmImg.onerror = () => reject(new Error("Failed to load watermark"));
      });

      const canvas = document.createElement("canvas");
      canvas.width = baseImg.naturalWidth;
      canvas.height = baseImg.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      ctx.drawImage(baseImg, 0, 0);
      const margin = Math.floor(canvas.width * 0.02);
      const wmWidth = Math.floor(canvas.width * 0.08);
      const wmAspect = wmImg.naturalWidth / wmImg.naturalHeight;
      const wmHeight = Math.floor(wmWidth / wmAspect);
      const x = canvas.width - wmWidth - margin;
      const y = margin;
      ctx.globalAlpha = 0.6;
      ctx.drawImage(wmImg, x, y, wmWidth, wmHeight);

      // Poster editing now happens on /poster page only

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `ai-generated-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Watermarked image downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to watermark. Downloading original.");
      const link = document.createElement("a");
      link.href = generatedImage;
      link.download = `ai-generated-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const navigateToPoster = () => {
    if (!generatedImage) { toast.error("Generate an image first"); return; }
    try {
      localStorage.setItem("lastGeneratedImage", generatedImage);
    } catch {}
    window.location.href = `${import.meta.env.BASE_URL}poster`;
  };

  // Backend-generated payment via Cashfree (returns hosted payment link)
  const createCashfreeOrder = async (amount: number, credits: number, note: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("create-cashfree-order", {
        body: { amount, credits, note },
      });
      if (error) {
        console.error("create-cashfree-order failed:", error);
        const detail = (error as any)?.context || (error as any)?.message || "Payment setup failed. Try again.";
        toast.error(String(detail));
        return null;
      }
      if (!data || !data.payment_id) {
        toast.error("Payment setup failed");
        return null;
      }
      setCurrentPaymentId(data.payment_id);
      // Attempt to extract a hosted checkout link from multiple possible fields
      const candidates = [
        (data.payment_link as string),
        (data.provider_link as string),
        (data.payments?.url as string),
        (data.payment_links?.link_url as string),
        (data.session?.url as string),
        (data.payment_session?.url as string),
        (data.url as string),
      ];
      const link = candidates.find((v) => typeof v === "string" && v.length > 0) || "";
      if (link) {
        console.log("Cashfree hosted link:", link);
        return { link } as any;
      } else {
        console.warn("Cashfree order created but no hosted link found", data);
        const sessionId: string | undefined = (data.payment_session_id as string) || undefined;
        const env: string = (data.env as string) || "sandbox";
        if (sessionId) {
          return { sessionId, env } as any;
        }
      }
      return null;
    } catch (e: any) {
      console.error("create-cashfree-order exception:", e);
      toast.error(e?.message || "Payment setup failed. Try again.");
      return null;
    }
  };

  const creditsForAmount = (amt: number) => {
    // Map configured pricing amounts to credits
    if (Math.abs(amt - A1) < 0.01) return 1;
    if (Math.abs(amt - A2) < 0.01) return 5;
    if (Math.abs(amt - A3) < 0.01) return 50;
    // Fallback: 1 credit if unknown amount
    return 1;
  };

  const startGPay = async (amount: number, note: string) => {
    if (!userEmail) { toast.error("Please login to purchase credits"); return; }
    const res = await createCashfreeOrder(amount, creditsForAmount(amount), note);
    if (res && (res as any).link) {
      const link = (res as any).link as string;
      try { window.open(link, "_blank"); } catch { window.location.href = link; }
      toast.success("Redirecting to payment gateway");
      return;
    }
    if (res && (res as any).sessionId) {
      const { sessionId, env } = res as any;
      try {
        // Load Cashfree JS SDK dynamically and open checkout in new tab
        await new Promise<void>((resolve, reject) => {
          if ((window as any).Cashfree) { resolve(); return; }
          const s = document.createElement("script");
          s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
          document.head.appendChild(s);
        });
        const cashfree = (window as any).Cashfree({ mode: env === "production" ? "production" : "sandbox" });
        await cashfree.checkout({ paymentSessionId: sessionId, redirectTarget: "_blank" });
        toast.success("Opening Cashfree checkout");
        return;
      } catch (e) {
        console.error("Cashfree SDK checkout failed:", e);
      }
    }
    toast.error("Unable to start payment");
    console.error("No payment link or session id available from createCashfreeOrder response.");
  };

  const showGPayQR = async (amount: number, note: string) => {
    // Legacy UPI QR fallback remains for users preferring direct UPI
    if (!userEmail) { toast.error("Please login to purchase credits"); return; }
    const { data, error } = await supabase.functions.invoke("create-upi-intent", {
      body: { amount, credits: creditsForAmount(amount), note },
    });
    if (error || !data?.upiUri || !data?.payment_id) { toast.error("UPI intent failed"); return; }
    setUpiIntent(data.upiUri);
    setCurrentPaymentId(data.payment_id);
    setShowUpiHelp(true);
    try { await navigator.clipboard.writeText(data.upiUri); toast.success("UPI link copied"); } catch {}
  };

  return (
    <>
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Auth header */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {userEmail ? (
          <>
            <span className="text-sm text-muted-foreground">Logged in as {userEmail}</span>
            {!isMultiAccount && usage && (() => {
              const credits = typeof (usage as any).credits === "number" ? (usage as any).credits as number : usage.remaining;
              const color = credits <= 5 ? "bg-red-500/15 text-red-600 border-red-500/30" : credits <= 10 ? "bg-orange-500/15 text-orange-600 border-orange-500/30" : "bg-green-500/15 text-green-700 border-green-500/30";
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`text-xs px-2 py-1 border rounded-md cursor-help ${color}`}>Credits: {credits} left</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600" /> Green: 10+ credits</div>
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Orange: 6–10 credits</div>
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" /> Red: ≤5 credits</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })()}
            <Link to="/dashboard" className="inline-flex">
              <Button variant="outline" size="sm">Credits</Button>
            </Link>
            {ADMIN_EMAIL && userEmail.toLowerCase() === String(ADMIN_EMAIL).toLowerCase() && (
              <Link to="/admin-quiet-6b27c9" className="inline-flex">
                <Button variant="outline" size="sm">
                  <Shield className="mr-2 h-4 w-4" /> Admin
                </Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>Sign out</Button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSignInGoogle}>Continue with Google</Button>
            <a href={`${import.meta.env.BASE_URL}login`}>
              <Button variant="outline" size="sm">Login with Email</Button>
            </a>
          </div>
        )}
      </div>

      {/* Payment modal disabled: using Razorpay Payment Page temporarily */}
      {/* Animated gradient background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-primary rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
        <div className="absolute top-0 -right-4 w-96 h-96 bg-accent rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-75" />
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-primary-glow rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-150" />
      </div>

      <div className="relative z-10 w-full max-w-4xl space-y-8">
        {/* Quick access to Dashboard so users don't have to hunt */}
        <Card className="p-4 border-dashed">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Manage credits and history</div>
              <div className="text-lg font-medium">Open Dashboard</div>
              <div className="text-xs text-muted-foreground">View remaining credits, purchases, and payment status</div>
            </div>
            <Link to="/dashboard" className="inline-flex">
              <Button>Dashboard</Button>
            </Link>
          </div>
        </Card>
        {(
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-xl font-semibold">Pricing</h3>
            <p className="text-xs text-muted-foreground">Choose a bundle and pay via Google Pay (UPI).</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-border rounded-xl p-4 space-y-2">
                <h4 className="text-lg font-medium">Per Image</h4>
                <div className="text-2xl font-bold">₹{A1}</div>
                <p className="text-xs text-muted-foreground">1 credit for a single image</p>
                <div className="flex gap-2">
                  <Button className="w-full" onClick={() => startGPay(A1, "Per Image (1 credit)")}>Buy</Button>
                </div>
              </div>
              <div className="border border-border rounded-xl p-4 space-y-2">
                <h4 className="text-lg font-medium">Bundle (5)</h4>
                <div className="text-2xl font-bold">₹{A2}</div>
                <p className="text-xs text-muted-foreground">5 credits — discounted</p>
                <div className="flex gap-2">
                  <Button className="w-full" onClick={() => startGPay(A2, "Bundle (5 credits)")}>Buy</Button>
                </div>
              </div>
              <div className="border border-border rounded-xl p-4 space-y-2">
                <h4 className="text-lg font-medium">Monthly (50)</h4>
                <div className="text-2xl font-bold">₹{A3}</div>
                <p className="text-xs text-muted-foreground">50 credits per month</p>
                <div className="flex gap-2">
                  <Button className="w-full" onClick={() => startGPay(A3, "Monthly (50 credits)")}>Buy</Button>
                </div>
              </div>
            </div>
            {showUpiHelp && upiIntent && (
              <div className="mt-4 p-3 border rounded-lg bg-muted/20">
                <div className="text-xs text-muted-foreground mb-2">Payment didn’t open. Scan the QR with Google Pay on mobile or copy the UPI link.</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  <div className="flex justify-center md:justify-start">
                    <div className="bg-white p-3 rounded-md border">
                      <QRCode value={upiIntent} size={140} />
                    </div>
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <Input readOnly value={upiIntent} className="text-[11px]" aria-label="UPI payment link" />
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(upiIntent); toast.success("UPI link copied"); }
                        catch { toast.error("Copy failed. Select and copy manually."); }
                      }}
                    >Copy</Button>
                    <a href={upiIntent} className="inline-flex">
                      <Button variant="default">Open in UPI app</Button>
                    </a>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">Payee: {GPAY_NAME} • VPA: {GPAY_VPA}</div>
                {currentPaymentId && (
                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      placeholder="Enter UPI Transaction ID (UTR)"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      className="text-[12px]"
                      aria-label="UPI Transaction ID"
                    />
                    <Button
                      onClick={async () => {
                        const utr = utrInput.trim();
                        if (utr.length < 6) { toast.error("Please enter valid UTR"); return; }
                        if (!currentPaymentId) { toast.error("Payment not initialized"); return; }
                        try {
                          const { data, error } = await supabase.functions.invoke("confirm-upi-payment", {
                            body: { payment_id: currentPaymentId, utr },
                          });
                          if (error) { throw error; }
                          if (data && data.ok) {
                            toast.success("Payment confirmed. Credits added.");
                            setShowUpiHelp(false);
                            setUtrInput("");
                            setCurrentPaymentId(null);
                            try {
                              const { data: u } = await supabase.functions.invoke("usage-status");
                              if (u && typeof u.count === "number") setUsage({ count: u.count, limit: u.limit, remaining: u.remaining });
                            } catch {}
                          } else {
                            toast.error("Unable to confirm payment");
                          }
                        } catch (e) {
                          console.error("confirm-upi-payment failed:", e);
                          toast.error("Payment confirmation failed");
                        }
                      }}
                    >Confirm Payment</Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-full">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="TittoosAI logo" className="w-6 h-6 rounded-sm" />
            <span className="text-sm text-muted-foreground">Tittoos AI</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-foreground">
            Text to Image & YouTube Thumbnail Maker
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transform your imagination into realistic, cinematic images and eye‑catching thumbnails with AI.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-2xl backdrop-blur-sm">
          <Textarea
            placeholder="Describe your image... (e.g., 'A majestic lion in golden sunset, cinematic lighting, 8k, ultra realistic')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px] text-lg resize-none bg-input border-border focus-visible:ring-primary"
            disabled={isGenerating}
          />
          {/* Poster controls removed — use dedicated Poster Editor */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={navigateToPoster} disabled={!generatedImage}>Make Poster</Button>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || !userEmail}
            className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-300 shadow-[0_0_20px_rgba(124,58,237,0.5)] hover:shadow-[0_0_30px_rgba(124,58,237,0.7)]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                {userEmail ? "Generate Image" : "Login to Generate"}
              </>
            )}
          </Button>
        </div>

        {/* Image Display */}
        {generatedImage && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-2xl backdrop-blur-sm animate-in fade-in duration-500">
            <div className="relative group">
              <img
                src={generatedImage}
                alt="Generated"
                className="w-full h-auto rounded-xl shadow-2xl"
              />
              {/* Watermark overlay (top-right) */}
              <img
                src={watermarkSrc}
                alt="watermark"
                className="absolute top-3 right-3 w-10 h-10 opacity-60 select-none pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl flex items-end justify-center pb-6">
                <Button
                  onClick={handleDownload}
                  variant="secondary"
                  className="shadow-lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Image
                </Button>
                <Button onClick={navigateToPoster} variant="outline" className="ml-3 shadow-lg">Make Poster</Button>
              </div>
            </div>
          </div>
        )}

        {/* SEO content: keyword-rich sections and internal links */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-2xl font-bold">Text to Image Generator</h2>
          <p className="text-sm text-muted-foreground">
            Describe your vision and instantly turn text into images. Our AI creates cinematic, realistic visuals suitable for thumbnails, posters, and social posts.
          </p>
          <div className="text-sm">
            <a href={`${import.meta.env.BASE_URL}`} className="underline">Text to image generator</a> ·
            <Link to="/poster" className="underline ml-1">YouTube thumbnail maker</Link> ·
            <Link to="/youtube-thumbnail" className="underline ml-1">YouTube thumbnail tips</Link>
          </div>
          <h2 className="text-2xl font-bold mt-4">YouTube Thumbnail Maker</h2>
          <p className="text-sm text-muted-foreground">
            Craft thumbnails that pop: bold fonts, glow text, frames, stickers, and cinematic color grading. Export at 1280×720 for the best YouTube results.
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>Impact/Bebas presets for big readable titles</li>
            <li>Neon glow, vignette, and high contrast for CTR</li>
            <li>Quick export with watermark option</li>
          </ul>
        </div>

        {/* FAQ schema for rich results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              'mainEntity': [
                {
                  '@type': 'Question',
                  'name': 'What is a Text to Image generator?',
                  'acceptedAnswer': {
                    '@type': 'Answer',
                    'text': 'It converts your written prompt into an image using AI. Tittoos AI focuses on cinematic, realistic output.'
                  }
                },
                {
                  '@type': 'Question',
                  'name': 'How do I design a YouTube thumbnail?',
                  'acceptedAnswer': {
                    '@type': 'Answer',
                    'text': 'Generate an image here, then open the Poster editor to add bold text, glow, frames, and stickers. Export at 1280×720.'
                  }
                },
                {
                  '@type': 'Question',
                  'name': 'Is there a free plan?',
                  'acceptedAnswer': {
                    '@type': 'Answer',
                    'text': 'We offer low‑cost credits for creators to try and use regularly.'
                  }
                }
              ]
            }),
          }}
        />
      </div>
    </div>
    {/* Footer policy links */}
    <div className="w-full border-t border-border mt-6 py-4 text-center text-xs text-muted-foreground">
      <Link to="/guides" className="mx-2 underline">Creator guides</Link>
      <a href={`${import.meta.env.BASE_URL}contact`} className="mx-2 underline">Contact</a>
      <a href={`${import.meta.env.BASE_URL}privacy`} className="mx-2 underline">Privacy</a>
      <a href={`${import.meta.env.BASE_URL}terms`} className="mx-2 underline">Terms</a>
      <a href={`${import.meta.env.BASE_URL}refunds`} className="mx-2 underline">Refunds</a>
      {/* Shipping page removed */}
    </div>
    </>
  );
};

export default Index;
