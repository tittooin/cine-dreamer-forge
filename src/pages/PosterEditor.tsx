import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const PosterEditor = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [lang, setLang] = useState<"en" | "hi" | "mr">("en");
  const [heading, setHeading] = useState("");
  const [bullets, setBullets] = useState("");
  const [cta, setCta] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeStrength, setStrokeStrength] = useState(0.003);
  const [align, setAlign] = useState<"left" | "center">("left");
  const [bgEnabled, setBgEnabled] = useState(true);
  const [bgColor, setBgColor] = useState("#000000");
  const [bgOpacity, setBgOpacity] = useState(0.35);
  const [headingWeight, setHeadingWeight] = useState("700");
  const [bulletWeight, setBulletWeight] = useState("400");
  const [ctaWeight, setCtaWeight] = useState("600");
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowColor, setShadowColor] = useState("#000000");
  const [shadowBlur, setShadowBlur] = useState(0.01);
  const [headingBgEnabled, setHeadingBgEnabled] = useState(true);
  const [headingBgColor, setHeadingBgColor] = useState("#000000");
  const [headingBgOpacity, setHeadingBgOpacity] = useState(0.35);
  const [bulletsBgEnabled, setBulletsBgEnabled] = useState(true);
  const [bulletsBgColor, setBulletsBgColor] = useState("#000000");
  const [bulletsBgOpacity, setBulletsBgOpacity] = useState(0.35);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  const watermarkSrc = `${import.meta.env.BASE_URL}logo.png`;

  useEffect(() => {
    const last = localStorage.getItem("lastGeneratedImage");
    if (last) setImageUrl(last);
  }, []);

  function hexWithOpacity(hex: string, opacity: number) {
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

  async function loadFonts() {
    const devFont = lang === "en" ? '"Inter"' : '"Noto Sans Devanagari"';
    await Promise.all([
      document.fonts.load(`700 64px ${devFont}`),
      document.fonts.load(`600 30px ${devFont}`),
      document.fonts.load(`400 28px ${devFont}`),
    ]);
    return devFont;
  }

  async function buildPoster() {
    if (!imageUrl) { toast.error("No image to edit"); return; }
    try {
      const baseImg = new Image();
      baseImg.crossOrigin = "anonymous";
      baseImg.src = imageUrl;
      await new Promise<void>((resolve, reject) => {
        baseImg.onload = () => resolve();
        baseImg.onerror = () => reject(new Error("Failed to load image"));
      });

      const canvas = document.createElement("canvas");
      canvas.width = baseImg.naturalWidth;
      canvas.height = baseImg.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(baseImg, 0, 0);

      // Watermark
      const wmImg = new Image();
      wmImg.crossOrigin = "anonymous";
      wmImg.src = watermarkSrc;
      await new Promise<void>((resolve, reject) => {
        wmImg.onload = () => resolve();
        wmImg.onerror = () => reject(new Error("Failed to load watermark"));
      });
      const marginSmall = Math.floor(canvas.width * 0.02);
      const wmWidth = Math.floor(canvas.width * 0.08);
      const wmAspect = wmImg.naturalWidth / wmImg.naturalHeight;
      const wmHeight = Math.floor(wmWidth / wmAspect);
      const x = canvas.width - wmWidth - marginSmall;
      const y = marginSmall;
      ctx.globalAlpha = 0.6;
      ctx.drawImage(wmImg, x, y, wmWidth, wmHeight);
      ctx.globalAlpha = 1;

      const devFont = await loadFonts();
      const margin = Math.floor(canvas.width * 0.06);
      const maxWidth = canvas.width - margin * 2;
      const lineW = Math.max(4, Math.floor(canvas.width * strokeStrength));
      ctx.fillStyle = textColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineW;
      ctx.textBaseline = "top";
      ctx.textAlign = align === "center" ? "center" : "left";
      const xText = align === "center" ? canvas.width / 2 : margin;

      const headingSize = Math.floor(canvas.width * 0.06);
      const headingLineH = Math.floor(canvas.width * 0.065);
      ctx.font = `${headingWeight} ${headingSize}px ${devFont}`;
      const headingLines = computeLines(ctx, heading, maxWidth);
      const headingHeight = headingLines.length * headingLineH;

      const bulletSize = Math.floor(canvas.width * 0.03);
      const bulletLineH = Math.floor(canvas.width * 0.035);
      ctx.font = `${bulletWeight} ${bulletSize}px ${devFont}`;
      let yStart = margin + headingHeight;
      const bulletLines: string[] = [];
      bullets.split(/\r?\n/).filter(l => l.trim().length>0).forEach((b) => {
        const lines = computeLines(ctx, `• ${b}`, maxWidth);
        lines.forEach((ln) => bulletLines.push(ln));
      });
      const bulletsHeight = bulletLines.length * bulletLineH + Math.floor(canvas.width * 0.02);

      // Background bands
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

      // Draw text
      ctx.font = `${headingWeight} ${headingSize}px ${devFont}`;
      if (shadowEnabled) { ctx.shadowColor = hexWithOpacity(shadowColor, 0.7); ctx.shadowBlur = Math.floor(canvas.width * shadowBlur); } else { ctx.shadowBlur = 0; }
      drawLines(ctx, headingLines, xText, margin, headingLineH);

      ctx.font = `${bulletWeight} ${bulletSize}px ${devFont}`;
      if (shadowEnabled) { ctx.shadowColor = hexWithOpacity(shadowColor, 0.7); ctx.shadowBlur = Math.floor(canvas.width * shadowBlur); } else { ctx.shadowBlur = 0; }
      drawLines(ctx, bulletLines, xText, yStart, bulletLineH);

      if (cta.trim()) {
        ctx.font = `${ctaWeight} ${Math.floor(canvas.width * 0.032)}px ${devFont}`;
        const ctaWidth = ctx.measureText(cta).width;
        const ctaX = align === "center" ? (canvas.width - ctaWidth) / 2 : margin;
        const ctaY = canvas.height - margin;
        if (shadowEnabled) { ctx.shadowColor = hexWithOpacity(shadowColor, 0.7); ctx.shadowBlur = Math.floor(canvas.width * shadowBlur); } else { ctx.shadowBlur = 0; }
        ctx.fillText(cta, ctaX, ctaY);
        ctx.strokeText(cta, ctaX, ctaY);
      }

      const updated = canvas.toDataURL("image/png");
      setPosterUrl(updated);
      toast.success("Poster built");
    } catch (e) {
      console.error(e);
      toast.error("Failed to build poster");
    }
  }

  const uploadFile = async (f: File) => {
    const url = URL.createObjectURL(f);
    setImageUrl(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Poster Editor</h2>
          <Link to="/">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm">Image Source</label>
            <Input placeholder="Image URL" value={imageUrl ?? ''} onChange={(e)=>setImageUrl(e.target.value)} />
            <div className="mt-2">
              <input type="file" accept="image/*" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) uploadFile(f); }} />
            </div>
          </div>
          <div>
            <label className="text-sm">Language</label>
            <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={lang} onChange={(e)=>setLang(e.target.value as any)}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="mr">Marathi</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={buildPoster} disabled={!imageUrl}>Build Poster</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Heading</label>
            <Input value={heading} onChange={(e)=>setHeading(e.target.value)} placeholder={lang==='hi'? 'AI इमेज मैजिक...' : lang==='mr'? 'AI इमेज मॅजिक...' : 'AI Image Magic Awaits!'} />
          </div>
          <div>
            <label className="text-sm">CTA</label>
            <Input value={cta} onChange={(e)=>setCta(e.target.value)} placeholder={lang==='hi'? 'अभी शुरू करें...' : lang==='mr'? 'आता सुरू करा...' : 'Try it now...'} />
          </div>
        </div>
        <div>
          <label className="text-sm">Bullets (one per line)</label>
          <Textarea value={bullets} onChange={(e)=>setBullets(e.target.value)} className="min-h-[100px]" />
        </div>

        {/* Styles */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-sm">Text Color</label>
            <input type="color" className="w-full h-10" value={textColor} onChange={(e)=>setTextColor(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Stroke Color</label>
            <input type="color" className="w-full h-10" value={strokeColor} onChange={(e)=>setStrokeColor(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Stroke Strength</label>
            <input type="range" min={0.001} max={0.02} step={0.001} className="w-full" value={strokeStrength} onChange={(e)=>setStrokeStrength(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm">Align</label>
            <select className="w-full h-10 bg-input border-border border rounded-md px-2" value={align} onChange={(e)=>setAlign(e.target.value as any)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm">Heading Weight</label>
            <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={headingWeight} onChange={(e)=>setHeadingWeight(e.target.value)}>
              <option value="500">Medium</option>
              <option value="600">Semibold</option>
              <option value="700">Bold</option>
            </select>
          </div>
          <div>
            <label className="text-sm">Bullet Weight</label>
            <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={bulletWeight} onChange={(e)=>setBulletWeight(e.target.value)}>
              <option value="400">Normal</option>
              <option value="500">Medium</option>
            </select>
          </div>
          <div>
            <label className="text-sm">CTA Weight</label>
            <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={ctaWeight} onChange={(e)=>setCtaWeight(e.target.value)}>
              <option value="500">Medium</option>
              <option value="600">Semibold</option>
              <option value="700">Bold</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <input id="shadowEnabled" type="checkbox" className="h-4 w-4" checked={shadowEnabled} onChange={(e)=>setShadowEnabled(e.target.checked)} />
            <label htmlFor="shadowEnabled" className="text-sm">Text shadow</label>
          </div>
          <div>
            <label className="text-sm">Shadow Color</label>
            <input type="color" className="w-full h-10" value={shadowColor} onChange={(e)=>setShadowColor(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Shadow Blur</label>
            <input type="range" min={0} max={0.03} step={0.002} className="w-full" value={shadowBlur} onChange={(e)=>setShadowBlur(Number(e.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <input id="headingBgEnabled" type="checkbox" className="h-4 w-4" checked={headingBgEnabled} onChange={(e)=>setHeadingBgEnabled(e.target.checked)} />
            <label htmlFor="headingBgEnabled" className="text-sm">Heading band</label>
          </div>
          <div className="flex items-center gap-2">
            <input id="bulletsBgEnabled" type="checkbox" className="h-4 w-4" checked={bulletsBgEnabled} onChange={(e)=>setBulletsBgEnabled(e.target.checked)} />
            <label htmlFor="bulletsBgEnabled" className="text-sm">Bullets band</label>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-sm">Heading Band Color</label>
            <input type="color" className="w-full h-10" value={headingBgColor} onChange={(e)=>setHeadingBgColor(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Heading Band Opacity</label>
            <input type="range" min={0} max={0.8} step={0.05} className="w-full" value={headingBgOpacity} onChange={(e)=>setHeadingBgOpacity(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm">Bullets Band Color</label>
            <input type="color" className="w-full h-10" value={bulletsBgColor} onChange={(e)=>setBulletsBgColor(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Bullets Band Opacity</label>
            <input type="range" min={0} max={0.8} step={0.05} className="w-full" value={bulletsBgOpacity} onChange={(e)=>setBulletsBgOpacity(Number(e.target.value))} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={()=>{ setTextColor('#ffffff'); setStrokeColor('#000000'); setStrokeStrength(0.004); setBgEnabled(true); setBgColor('#000000'); setBgOpacity(0.35); setHeadingBgEnabled(true); setBulletsBgEnabled(true); setShadowEnabled(true); setShadowColor('#000000'); setShadowBlur(0.01); }}>Dark</Button>
          <Button variant="outline" onClick={()=>{ setTextColor('#111111'); setStrokeColor('#ffffff'); setStrokeStrength(0.003); setBgEnabled(true); setBgColor('#ffffff'); setBgOpacity(0.4); setHeadingBgEnabled(true); setBulletsBgEnabled(true); setShadowEnabled(false); }}>Light</Button>
          <Button variant="outline" onClick={()=>{ setTextColor('#ffffff'); setStrokeColor('#ff00ff'); setStrokeStrength(0.004); setBgEnabled(true); setBgColor('#7c3aed'); setBgOpacity(0.35); setHeadingBgEnabled(true); setBulletsBgEnabled(true); setShadowEnabled(true); setShadowColor('#7c3aed'); setShadowBlur(0.012); }}>Vibrant</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Original</h3>
            {imageUrl ? (
              <img src={imageUrl} alt="original" className="w-full h-auto rounded-xl border" />
            ) : (
              <div className="text-sm text-muted-foreground">No image selected yet.</div>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Poster Preview</h3>
            {posterUrl ? (
              <img src={posterUrl} alt="poster" className="w-full h-auto rounded-xl border" />
            ) : (
              <div className="text-sm text-muted-foreground">Build Poster to preview.</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={()=>{ if (!posterUrl) { toast.error('Build Poster first'); return; } const a=document.createElement('a'); a.href=posterUrl; a.download=`poster-${Date.now()}.png`; a.click(); }}>Download Poster</Button>
          <Button variant="secondary" onClick={()=>{ if (!imageUrl) { toast.error('No image'); return; } const a=document.createElement('a'); a.href=imageUrl; a.download=`original-${Date.now()}.png`; a.click(); }}>Download Original</Button>
        </div>
      </div>
    </div>
  );
};

export default PosterEditor;