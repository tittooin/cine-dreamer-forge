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
  // Poster mode state
  const [posterMode, setPosterMode] = useState(false);
  const [posterLang, setPosterLang] = useState<"en" | "hi" | "mr">("en");
  const [posterHeading, setPosterHeading] = useState("");
  const [posterBullets, setPosterBullets] = useState(""); // newline separated
  const [posterCta, setPosterCta] = useState("");
  // Style controls
  const [textColor, setTextColor] = useState<string>("#ffffff");
  const [strokeColor, setStrokeColor] = useState<string>("#000000");
  const [strokeStrength, setStrokeStrength] = useState<number>(0.003); // relative factor to canvas width
  const [bgEnabled, setBgEnabled] = useState<boolean>(true);
  const [bgColor, setBgColor] = useState<string>("#000000");
  const [bgOpacity, setBgOpacity] = useState<number>(0.35);
  const [align, setAlign] = useState<"left" | "center">("left");
  const [headingWeight, setHeadingWeight] = useState<string>("700");
  const [bulletWeight, setBulletWeight] = useState<string>("400");
  const [ctaWeight, setCtaWeight] = useState<string>("600");
  const [shadowEnabled, setShadowEnabled] = useState<boolean>(false);
  const [shadowColor, setShadowColor] = useState<string>("#000000");
  const [shadowBlur, setShadowBlur] = useState<number>(0.01);
  const [headingBgEnabled, setHeadingBgEnabled] = useState<boolean>(true);
  const [headingBgColor, setHeadingBgColor] = useState<string>("#000000");
  const [headingBgOpacity, setHeadingBgOpacity] = useState<number>(0.35);
  const [bulletsBgEnabled, setBulletsBgEnabled] = useState<boolean>(true);
  const [bulletsBgColor, setBulletsBgColor] = useState<string>("#000000");
  const [bulletsBgOpacity, setBulletsBgOpacity] = useState<number>(0.35);

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
    if (usage) {
      if (usage.remaining <= 0) {
        toast.error("Daily limit reached. Try again tomorrow.");
        return;
      }
      if (usage.remaining <= 5) {
        toast.warning(`Approaching limit: ${usage.remaining} left today`);
      }
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

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
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

  const watermarkSrc = `${import.meta.env.BASE_URL}logo.png`;

  // Helpers for poster overlay
  function computeLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line);
    return lines;
  }

  function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number) {
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + i * lineHeight);
      ctx.strokeText(lines[i], x, y + i * lineHeight);
    }
  }

  function hexWithOpacity(hex: string, opacity: number) {
    // hex like #000000; return rgba string
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  async function loadPosterFonts(lang: "en" | "hi" | "mr") {
    const devFont = lang === "en" ? '"Inter"' : '"Noto Sans Devanagari"';
    await Promise.all([
      document.fonts.load(`700 64px ${devFont}`),
      document.fonts.load(`600 30px ${devFont}`),
      document.fonts.load(`400 28px ${devFont}`),
    ]);
    return devFont;
  }

  async function overlayPosterText(canvas: HTMLCanvasElement, heading: string, bullets: string[], cta: string, lang: "en" | "hi" | "mr") {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const devFont = await loadPosterFonts(lang);
    const margin = Math.floor(canvas.width * 0.06);
    const maxWidth = canvas.width - margin * 2;
    const lineW = Math.max(4, Math.floor(canvas.width * strokeStrength));
    ctx.fillStyle = textColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineW;
    ctx.textBaseline = "top";
    ctx.textAlign = align === "center" ? "center" : "left";
    const xText = align === "center" ? canvas.width / 2 : margin;

    // Heading
    const headingSize = Math.floor(canvas.width * 0.06);
    const headingLineH = Math.floor(canvas.width * 0.065);
    ctx.font = `${headingWeight} ${headingSize}px ${devFont}`;
    const headingLines = computeLines(ctx, heading, maxWidth);
    const headingHeight = headingLines.length * headingLineH;

    // Bullets
    const bulletSize = Math.floor(canvas.width * 0.03);
    const bulletLineH = Math.floor(canvas.width * 0.035);
    ctx.font = `${bulletWeight} ${bulletSize}px ${devFont}`;
    let yStart = margin + headingHeight;
    const bulletLines: string[] = [];
    bullets.forEach((b) => {
      const lines = computeLines(ctx, `• ${b}`, maxWidth);
      lines.forEach((ln) => bulletLines.push(ln));
    });
    const bulletsHeight = bulletLines.length * bulletLineH + Math.floor(canvas.width * 0.02);

    // Separate background bands
    if (bgEnabled && headingBgEnabled) {
      ctx.save();
      ctx.fillStyle = hexWithOpacity(headingBgColor, headingBgOpacity);
      const bandX = align === "center" ? (canvas.width - maxWidth) / 2 : margin;
      const bandY = margin - Math.floor(canvas.width * 0.02);
      drawRoundedRect(ctx, bandX, bandY, maxWidth, headingHeight + Math.floor(canvas.width * 0.02), Math.floor(canvas.width * 0.02));
      ctx.restore();
    }
    if (bgEnabled && bulletsBgEnabled) {
      ctx.save();
      ctx.fillStyle = hexWithOpacity(bulletsBgColor, bulletsBgOpacity);
      const bandX = align === "center" ? (canvas.width - maxWidth) / 2 : margin;
      const bandY = yStart - Math.floor(canvas.width * 0.01);
      drawRoundedRect(ctx, bandX, bandY, maxWidth, bulletsHeight, Math.floor(canvas.width * 0.02));
      ctx.restore();
    }

    // Draw heading
    ctx.font = `${headingWeight} ${headingSize}px ${devFont}`;
    if (shadowEnabled) { ctx.shadowColor = hexWithOpacity(shadowColor, 0.7); ctx.shadowBlur = Math.floor(canvas.width * shadowBlur); } else { ctx.shadowBlur = 0; }
    drawLines(ctx, headingLines, xText, margin, headingLineH);

    // Draw bullets
    ctx.font = `${bulletWeight} ${bulletSize}px ${devFont}`;
    if (shadowEnabled) { ctx.shadowColor = hexWithOpacity(shadowColor, 0.7); ctx.shadowBlur = Math.floor(canvas.width * shadowBlur); } else { ctx.shadowBlur = 0; }
    drawLines(ctx, bulletLines, xText, yStart, bulletLineH);

    // CTA bottom
    if (cta.trim()) {
      ctx.font = `${ctaWeight} ${Math.floor(canvas.width * 0.032)}px ${devFont}`;
      const ctaWidth = ctx.measureText(cta).width;
      const ctaX = align === "center" ? (canvas.width - ctaWidth) / 2 : margin;
      const ctaY = canvas.height - margin;
      if (shadowEnabled) { ctx.shadowColor = hexWithOpacity(shadowColor, 0.7); ctx.shadowBlur = Math.floor(canvas.width * shadowBlur); } else { ctx.shadowBlur = 0; }
      ctx.fillText(cta, ctaX, ctaY);
      ctx.strokeText(cta, ctaX, ctaY);
    }
  }

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

      // Poster overlay if enabled
      if (posterMode) {
        const bullets = posterBullets.split(/\r?\n/).filter((l) => l.trim().length > 0);
        await overlayPosterText(canvas, posterHeading || "", bullets, posterCta || "", posterLang);
      }

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

  const handleApplyPosterOverlay = async () => {
    if (!generatedImage) {
      toast.error("Generate an image first");
      return;
    }
    try {
      const baseImg = new Image();
      baseImg.crossOrigin = "anonymous";
      baseImg.src = generatedImage;
      await new Promise<void>((resolve, reject) => {
        baseImg.onload = () => resolve();
        baseImg.onerror = () => reject(new Error("Failed to load base image"));
      });
      const canvas = document.createElement("canvas");
      canvas.width = baseImg.naturalWidth;
      canvas.height = baseImg.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(baseImg, 0, 0);
      const wmImg = new Image();
      wmImg.crossOrigin = "anonymous";
      wmImg.src = watermarkSrc;
      await new Promise<void>((resolve, reject) => {
        wmImg.onload = () => resolve();
        wmImg.onerror = () => reject(new Error("Failed to load watermark"));
      });
      const margin = Math.floor(canvas.width * 0.02);
      const wmWidth = Math.floor(canvas.width * 0.08);
      const wmAspect = wmImg.naturalWidth / wmImg.naturalHeight;
      const wmHeight = Math.floor(wmWidth / wmAspect);
      const x = canvas.width - wmWidth - margin;
      const y = margin;
      ctx.globalAlpha = 0.6;
      ctx.drawImage(wmImg, x, y, wmWidth, wmHeight);

      const bullets = posterBullets.split(/\r?\n/).filter((l) => l.trim().length > 0);
      await overlayPosterText(canvas, posterHeading || "", bullets, posterCta || "", posterLang);
      const updated = canvas.toDataURL("image/png");
      setGeneratedImage(updated);
      toast.success("Poster overlay applied");
    } catch (e) {
      console.error(e);
      toast.error("Failed to apply poster overlay");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Auth header */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {userEmail ? (
          <>
            <span className="text-sm text-muted-foreground">Logged in as {userEmail}</span>
            {usage && (() => {
              const pct = usage.limit > 0 ? (usage.remaining / usage.limit) : 0;
              const color = usage.remaining <= 5 ? "bg-red-500/15 text-red-600 border-red-500/30" : pct <= 0.2 ? "bg-orange-500/15 text-orange-600 border-orange-500/30" : "bg-green-500/15 text-green-700 border-green-500/30";
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={`text-xs px-2 py-1 border rounded-md cursor-help ${color}`}>Today: {usage.count} / {usage.limit} ({usage.remaining} left)</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600" /> Green: healthy remaining</div>
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> Orange: ≤20% remaining</div>
                      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600" /> Red: ≤5 left today</div>
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
          {/* Poster Mode Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <input id="posterMode" type="checkbox" className="h-4 w-4" checked={posterMode} onChange={(e) => setPosterMode(e.target.checked)} />
              <label htmlFor="posterMode" className="text-sm">Poster mode</label>
            </div>
            <div>
              <label className="text-sm">Language</label>
              <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={posterLang} onChange={(e) => setPosterLang(e.target.value as any)}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
              </select>
            </div>
            <div>
              <label className="text-sm">CTA (optional)</label>
              <Input placeholder={posterLang === 'hi' ? 'अभी शुरू करें...' : posterLang === 'mr' ? 'आता सुरू करा...' : 'Try it now...'} value={posterCta} onChange={(e) => setPosterCta(e.target.value)} />
            </div>
          </div>
          {/* Style controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-sm">Text Color</label>
              <input type="color" className="w-full h-10" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Stroke Color</label>
              <input type="color" className="w-full h-10" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Stroke Strength</label>
              <input type="range" min={0.001} max={0.01} step={0.001} className="w-full" value={strokeStrength} onChange={(e) => setStrokeStrength(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-sm">Align</label>
              <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={align} onChange={(e) => setAlign(e.target.value as any)}>
                <option value="left">Left</option>
                <option value="center">Center</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <input id="bgEnabled" type="checkbox" className="h-4 w-4" checked={bgEnabled} onChange={(e) => setBgEnabled(e.target.checked)} />
              <label htmlFor="bgEnabled" className="text-sm">Text background band</label>
            </div>
            <div>
              <label className="text-sm">BG Color</label>
              <input type="color" className="w-full h-10" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">BG Opacity</label>
              <input type="range" min={0} max={0.8} step={0.05} className="w-full" value={bgOpacity} onChange={(e) => setBgOpacity(Number(e.target.value))} />
            </div>
          </div>
          {/* Advanced bands & font weights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm">Heading Weight</label>
              <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={headingWeight} onChange={(e) => setHeadingWeight(e.target.value)}>
                <option value="500">Medium</option>
                <option value="600">Semibold</option>
                <option value="700">Bold</option>
              </select>
            </div>
            <div>
              <label className="text-sm">Bullet Weight</label>
              <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={bulletWeight} onChange={(e) => setBulletWeight(e.target.value)}>
                <option value="400">Normal</option>
                <option value="500">Medium</option>
              </select>
            </div>
            <div>
              <label className="text-sm">CTA Weight</label>
              <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={ctaWeight} onChange={(e) => setCtaWeight(e.target.value)}>
                <option value="500">Medium</option>
                <option value="600">Semibold</option>
                <option value="700">Bold</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <input id="headingBgEnabled" type="checkbox" className="h-4 w-4" checked={headingBgEnabled} onChange={(e) => setHeadingBgEnabled(e.target.checked)} />
              <label htmlFor="headingBgEnabled" className="text-sm">Heading band</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="bulletsBgEnabled" type="checkbox" className="h-4 w-4" checked={bulletsBgEnabled} onChange={(e) => setBulletsBgEnabled(e.target.checked)} />
              <label htmlFor="bulletsBgEnabled" className="text-sm">Bullets band</label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-sm">Heading Band Color</label>
              <input type="color" className="w-full h-10" value={headingBgColor} onChange={(e) => setHeadingBgColor(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Heading Band Opacity</label>
              <input type="range" min={0} max={0.8} step={0.05} className="w-full" value={headingBgOpacity} onChange={(e) => setHeadingBgOpacity(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-sm">Bullets Band Color</label>
              <input type="color" className="w-full h-10" value={bulletsBgColor} onChange={(e) => setBulletsBgColor(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Bullets Band Opacity</label>
              <input type="range" min={0} max={0.8} step={0.05} className="w-full" value={bulletsBgOpacity} onChange={(e) => setBulletsBgOpacity(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <input id="shadowEnabled" type="checkbox" className="h-4 w-4" checked={shadowEnabled} onChange={(e) => setShadowEnabled(e.target.checked)} />
              <label htmlFor="shadowEnabled" className="text-sm">Text shadow</label>
            </div>
            <div>
              <label className="text-sm">Shadow Color</label>
              <input type="color" className="w-full h-10" value={shadowColor} onChange={(e) => setShadowColor(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Shadow Blur</label>
              <input type="range" min={0} max={0.03} step={0.002} className="w-full" value={shadowBlur} onChange={(e) => setShadowBlur(Number(e.target.value))} />
            </div>
          </div>
          {/* Preset themes */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setTextColor('#ffffff'); setStrokeColor('#000000'); setStrokeStrength(0.004); setBgEnabled(true); setBgColor('#000000'); setBgOpacity(0.35); setHeadingBgEnabled(true); setBulletsBgEnabled(true); setShadowEnabled(true); setShadowColor('#000000'); setShadowBlur(0.01); }}>Dark</Button>
            <Button variant="outline" size="sm" onClick={() => { setTextColor('#111111'); setStrokeColor('#ffffff'); setStrokeStrength(0.003); setBgEnabled(true); setBgColor('#ffffff'); setBgOpacity(0.4); setHeadingBgEnabled(true); setBulletsBgEnabled(true); setShadowEnabled(false); }}>Light</Button>
            <Button variant="outline" size="sm" onClick={() => { setTextColor('#ffffff'); setStrokeColor('#ff00ff'); setStrokeStrength(0.004); setBgEnabled(true); setBgColor('#7c3aed'); setBgOpacity(0.35); setHeadingBgEnabled(true); setBulletsBgEnabled(true); setShadowEnabled(true); setShadowColor('#7c3aed'); setShadowBlur(0.012); }}>Vibrant</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Heading</label>
              <Input placeholder={posterLang === 'hi' ? 'AI इमेज मैजिक...' : posterLang === 'mr' ? 'AI इमेज मॅजिक...' : 'AI Image Magic Awaits!'} value={posterHeading} onChange={(e) => setPosterHeading(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Bullets (one per line)</label>
              <Textarea placeholder={posterLang === 'hi' ? 'रीयल रिज़ल्ट्स\nLinkedIn के लिए शानदार\nमज़ेदार और अनरियल' : posterLang === 'mr' ? 'खरे परिणाम\nLinkedIn साठी छान\nमजेदार आणि वेडेवाकडे' : 'Real results\nGreat for LinkedIn\nFun & Unreal'} value={posterBullets} onChange={(e) => setPosterBullets(e.target.value)} className="min-h-[100px]" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleApplyPosterOverlay} disabled={!generatedImage || !posterMode}>Apply Poster Overlay</Button>
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
  );
};

export default Index;
