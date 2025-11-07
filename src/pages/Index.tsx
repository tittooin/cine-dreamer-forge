import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, Sparkles, Shield, Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";

const Index = () => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
  const [usage, setUsage] = useState<{ count: number; limit: number; remaining: number } | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [upiLink, setUpiLink] = useState<string>("");
  const [qrUrl, setQrUrl] = useState<string>("");
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
    // Credits gating: when 0, show UPI modal instead of error
    const credits = usage ? (typeof (usage as any).credits === "number" ? (usage as any).credits as number : usage.remaining) : 0;
    if (credits <= 0) {
      const pa = "more.43@superyes";
      const pn = "TittoosAI";
      const am = "2.99";
      const tn = encodeURIComponent("Image credit");
      const link = `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
      setUpiLink(link);
      setQrUrl(`https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl=${encodeURIComponent(link)}`);
      setShowPayModal(true);
      return;
    }
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

  // Start Stripe Checkout via Edge Function
  const handleUpgrade = async () => {
    if (!userEmail) {
      toast.error("Please login with Google first");
      return;
    }
    try {
      const priceId = "price_12345_basic"; // replace with real Stripe Price ID
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { priceId, mode: "payment" },
      });
      if (error) {
        console.error("Checkout error:", error);
        toast.error(error.message || "Checkout failed");
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Invalid checkout response");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to start checkout");
    }
  };

  const watermarkSrc = `${import.meta.env.BASE_URL}logo.png`;


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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Auth header */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {userEmail ? (
          <>
            <span className="text-sm text-muted-foreground">Logged in as {userEmail}</span>
            {usage && (() => {
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
          <Button size="sm" onClick={handleSignInGoogle}>Continue with Google</Button>
        )}
      </div>

      {showPayModal && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-lg font-semibold">Buy 1 Credit (₹2.99)</h3>
            <p className="text-xs text-muted-foreground">Pay via UPI to proceed. Scan the QR or open your UPI app.</p>
            <div className="flex items-center justify-center">
              <img src={qrUrl} alt="UPI QR" className="w-48 h-48 border rounded-md" />
            </div>
            <div className="text-xs"><b>UPI ID:</b> more.43@superyes</div>
            <div className="grid grid-cols-2 gap-2">
              <a href={upiLink} className="w-full" onClick={() => toast.info("Opening UPI app...")}> 
                <Button className="w-full">Open UPI App</Button>
              </a>
              <Button variant="outline" onClick={() => setShowPayModal(false)}>Cancel</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!userEmail) { toast.error("Login first"); return; }
                  const { data, error } = await supabase.functions.invoke("confirm-upi-payment", { body: { amount: 2.99 } });
                  if (error || (data && (data as any).error)) { toast.error("Payment confirmation failed"); return; }
                  toast.success("Credit added");
                  setShowPayModal(false);
                  try {
                    const { data: u } = await supabase.functions.invoke("usage-status");
                    if (u && typeof u.count === "number") setUsage({ count: u.count, limit: u.limit, remaining: u.remaining });
                  } catch {}
                }}
              >I've paid</Button>
              <Button variant="outline" onClick={() => { const a = document.createElement("a"); a.href = upiLink; a.click(); }}>Retry Open</Button>
            </div>
            <p className="text-xs text-muted-foreground">Note: Automatic verification will be added later via PSP webhooks. For now, tap “I've paid” after successful transfer.</p>
          </div>
        </div>
      )}
      {/* Animated gradient background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-primary rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
        <div className="absolute top-0 -right-4 w-96 h-96 bg-accent rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-75" />
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-primary-glow rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-150" />
      </div>

      <div className="relative z-10 w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-full">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="TittoosAI logo" className="w-6 h-6 rounded-sm" />
            <span className="text-sm text-muted-foreground">Tittoos AI</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-foreground">
            Show Your Imagination to The World
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transform your imagination into realistic, cinematic images with AI
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
      </div>
    </div>
    {/* Footer policy links */}
    <div className="w-full border-t border-border mt-6 py-4 text-center text-xs text-muted-foreground">
      <a href={`${import.meta.env.BASE_URL}contact`} className="mx-2 underline">Contact</a>
      <a href={`${import.meta.env.BASE_URL}privacy`} className="mx-2 underline">Privacy</a>
      <a href={`${import.meta.env.BASE_URL}terms`} className="mx-2 underline">Terms</a>
      <a href={`${import.meta.env.BASE_URL}refunds`} className="mx-2 underline">Refunds</a>
      <a href={`${import.meta.env.BASE_URL}shipping`} className="mx-2 underline">Shipping</a>
    </div>
  );
};

export default Index;
