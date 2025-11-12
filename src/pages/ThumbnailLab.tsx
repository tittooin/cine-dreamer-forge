import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Stage, Layer, Image as KonvaImage, Rect, Text as KonvaText, Group, Transformer, Line } from "react-konva";
import Konva from "konva";
import { supabase } from "@/integrations/supabase/client";

// Local-only page to design YouTube thumbnails by composing an uploaded image and prompt text
const ThumbnailLab = () => {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState<"trending" | "cinematic" | "gaming" | "techy" | "reactions">("trending");
  const [accentColor, setAccentColor] = useState("#ff3b3b");
  const [bgStyle, setBgStyle] = useState<"dark" | "light">("dark");
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
  const [repolishStyle, setRepolishStyle] = useState<RepolishStyle>("cinematic");
  const [repolishStrength, setRepolishStrength] = useState(0.7);
  const [frameStyle, setFrameStyle] = useState<
    | "none"
    | "border"
    | "rounded"
    | "double"
    | "thin"
    | "shadow"
    | "dashed"
    | "filmstrip"
    | "innerStroke"
    | "scanlines"
    | "polaroid"
    | "cornerCut"
    | "grain"
    | "tapeCorners"
    | "burnedEdge"
    | "lightLeak"
    | "gradientRounded"
  >("none");
  const [extraEffect, setExtraEffect] = useState<"none" | "neonGlow" | "vignetteStrong" | "softGlow" | "diagonalRays" | "blueOrange">("none");
  const [textColor, setTextColor] = useState("#ffffff");
  const [subtitleColor, setSubtitleColor] = useState("#ffffff");
  const [mode, setMode] = useState<"generate" | "repolish">("generate");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [texts, setTexts] = useState<Array<TextLayer>>([]);
  const [fontPreset, setFontPreset] = useState<FontPreset>("impact");
  const [tags, setTags] = useState<string[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [editorStyle, setEditorStyle] = useState<{ left: number; top: number; width: number } | null>(null);
  const [imageSelected, setImageSelected] = useState(false);
  const [imageAlwaysHandles, setImageAlwaysHandles] = useState(false);
  const [imageFit, setImageFit] = useState<"free" | "contain" | "cover">("free");

  const stageRef = useRef<any>(null);
  const imgRef = useRef<any>(null);
  const imgTrRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const width = 1280;
  const height = 720;
  const emojiSets: Record<string, string[]> = {
    trending: ['🚀','🔥','✨','🎯','📈','🏆','🔔','🆕','💥','⚡','⭐','😎'],
    cinematic: ['🎬','🎥','📽️','🍿','🎞️','🎟️','⭐','📸','🎨','🎭'],
    gaming: ['🎮','🕹️','👾','💥','⚡','🔥','🟣','🟢','🔵','💎','😈','🏆'],
    techy: ['💻','🤖','🔧','⚙️','🧠','📡','🔵','❄️','🥶','🧊','📱','🛰️'],
    reactions: ['😮','🤩','😎','🙌','✅','❌','📣','💬','❤️','⭐','😲','👏'],
  };

  const optimizedTitle = useMemo(() => optimizePrompt(title), [title]);
  const parsedTokens = useMemo(() => parseTokens(title), [title]);
  const repolishSettings = useMemo(() => getRepolishSettings(repolishStyle, repolishStrength), [repolishStyle, repolishStrength]);
  useEffect(() => {
    if (parsedTokens.accent) setAccentColor(parsedTokens.accent);
    if (parsedTokens.emoji) setEmoji(parsedTokens.emoji);
    if (parsedTokens.style) setRepolishStyle(parsedTokens.style);
    if (typeof parsedTokens.strength === "number") setRepolishStrength(parsedTokens.strength);
    const detected = detectTags(optimizedTitle);
    setTags(detected);
    const styleSuggest = suggestStyleFromPrompt(optimizedTitle);
    if (styleSuggest) setRepolishStyle(styleSuggest);
  }, [parsedTokens, optimizedTitle]);

  // Apply filters imperatively to avoid TS prop friction
  useEffect(() => {
    try {
      const node = imgRef.current as any;
      if (!node) return;
      node.cache();
      const fs = repolishSettings;
      const filters: any[] = [];
      if (fs.blurRadius && fs.blurRadius > 0) filters.push(Konva.Filters.Blur);
      if (fs.sepia && fs.sepia > 0) filters.push(Konva.Filters.Sepia);
      filters.push(Konva.Filters.Contrast, Konva.Filters.Brighten, Konva.Filters.HSL);
      node.filters(filters);
      if (typeof node.contrast === 'function') node.contrast(fs.contrast);
      if (typeof node.brightness === 'function') node.brightness(fs.brightness);
      if (typeof node.saturation === 'function') node.saturation(fs.saturation);
      if (typeof node.hue === 'function') node.hue(fs.hue);
      if (typeof node.blurRadius === 'function') node.blurRadius(fs.blurRadius);
      node.getLayer()?.batchDraw?.();
    } catch (e) {
      console.warn('apply filters failed', e);
    }
  }, [repolishSettings, imageObj]);

  const onFile = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    const url = URL.createObjectURL(f);
    const img = new window.Image();
    img.onload = () => { setImageObj(img); };
    img.onerror = () => { toast.error("Unable to load image"); };
    img.src = url;
  };

  const download = () => {
    try {
      const uri = stageRef.current?.toDataURL({ mimeType: "image/png", pixelRatio: 1 });
      if (!uri) { toast.error("Nothing to download"); return; }
      const a = document.createElement("a");
      a.href = uri;
      a.download = (slugify(optimizedTitle || "thumbnail") || "thumbnail") + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      toast.error("Download failed");
      console.error(e);
    }
  };

  useEffect(() => {
    // Local-only guard
    if (!import.meta.env.DEV && location.hostname !== "localhost") {
      toast.error("Thumbnail Lab is available only locally right now");
    }
  }, []);

  useEffect(() => {
    if (imageSelected && imgTrRef.current && imgRef.current) {
      imgTrRef.current.nodes([imgRef.current]);
      imgTrRef.current.getLayer()?.batchDraw?.();
    }
  }, [imageSelected]);

  // Auto-fit or cover the image based on selected mode
  useEffect(() => {
    if (!imageObj) return;
    if (imageFit === "free") return;
    const imgW = (imageObj as any).naturalWidth ?? (imageObj as any).width;
    const imgH = (imageObj as any).naturalHeight ?? (imageObj as any).height;
    if (!imgW || !imgH) return;
    const scaleX = width / imgW;
    const scaleY = height / imgH;
    const scale = imageFit === "contain" ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
    setImageScale(scale);
    const centeredX = (width - imgW * scale) / 2;
    const centeredY = (height - imgH * scale) / 2;
    setImagePos({ x: centeredX, y: centeredY });
  }, [imageFit, imageObj]);

  const beginEditOverlay = (args: { id: string; currentText: string; node: any }) => {
    try {
      const stage = stageRef.current as any;
      const container = containerRef.current;
      if (!stage || !container || !args.node) return;
      const rect = args.node.getClientRect();
      const box = stage.container().getBoundingClientRect();
      setEditorStyle({ left: rect.x + box.left - box.left, top: rect.y + box.top - box.top, width: Math.max(rect.width, 160) });
      setEditingId(args.id);
      setEditingValue(args.currentText);
    } catch (e) {
      console.error("beginEditOverlay failed", e);
    }
  };

  const commitEditOverlay = () => {
    if (!editingId) return;
    const val = editingValue;
    if (editingId === "title") {
      // Title includes emoji prefix; keep emoji in text field separately
      // We set raw title, which will be optimized for display
      setTitle(val);
    } else if (editingId === "subtitle") {
      setSubtitle(val);
    } else {
      updateTextLayer(setTexts, editingId, { text: val });
    }
    setEditingId(null);
    setEditorStyle(null);
  };

  const generateFromPrompt = async () => {
    const prompt = title.trim();
    if (!prompt) { toast.error("Prompt required"); return; }
    // Parse tokens and apply local repolish parameters first
    const t = parseTokens(prompt);
    if (t.style) setRepolishStyle(t.style);
    if (typeof t.strength === "number") setRepolishStrength(t.strength);
    if (t.accent) setAccentColor(t.accent);

    if (mode === "repolish") {
      // Local repolish only; do not call AI. Filters update via state.
      toast.success("Applied Repolish presets from prompt");
      return;
    }

    try {
      // Require login before invoking Edge Function
      const { data: sessionData } = await supabase.auth.getSession();
      const isLoggedIn = !!sessionData.session?.user;
      if (!isLoggedIn) {
        toast.error("Please login to generate with AI");
        return;
      }
      // Credits gating (aligns with server credit enforcement)
      try {
        const { data: usage } = await supabase.functions.invoke("usage-status");
        const remaining = (usage?.remaining ?? usage?.credits ?? 0) as number;
        if (!remaining || remaining <= 0) {
          toast.error("No credits left. Please contact support or purchase credits.");
          return;
        }
      } catch (e) {
        console.warn("usage-status check failed", e);
      }

      setBusy(true);
      const { data, error } = await supabase.functions.invoke("generate-image", { body: { prompt } });
      if (error) {
        const status = (error as any)?.status || (error as any)?.context?.status;
        const msg = (error as any)?.message || (status === 401 ? "Unauthorized: Please login" : status === 402 ? "No credits remaining" : "Generation failed");
        toast.error(msg);
        console.error("generate-image error", error);
        return;
      }
      const imageUrl = (data as any)?.imageUrl as string;
      if (!imageUrl) { toast.error("No image returned"); return; }
      const img = new window.Image();
      img.onload = () => { setImageObj(img); setImageScale(1); setImagePos({ x: 0, y: 0 }); };
      img.onerror = () => { toast.error("Image load failed"); };
      img.src = imageUrl;
      toast.success("Image regenerated from prompt");
    } catch (e) {
      console.error(e);
      toast.error("Generation error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          <h2 className="text-lg font-semibold">Thumbnail Lab (Local)</h2>
          <p className="text-xs text-muted-foreground">Upload an image and craft a catchy, SEO-friendly YouTube thumbnail. This feature runs locally only.</p>
          <div className="space-y-2">
            <label className="text-xs">Upload Image</label>
            <Input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] || undefined)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-xs">Image Zoom</label>
              <Input type="range" min="0.5" max="2" step="0.01" value={imageScale} onChange={(e) => setImageScale(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs">Font Preset</label>
              <select className="border rounded-md h-9 px-2 bg-card" value={fontPreset} onChange={(e) => setFontPreset(e.target.value as FontPreset)}>
                <option value="impact">Impact</option>
                <option value="bebas">Bebas Neue</option>
                <option value="inter">Inter</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs">Prompt</label>
            <Textarea value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cinematic portrait, teal & orange, high contrast [style:cinematic] [strength:0.8]" rows={3} />
            <p className="text-[10px] text-muted-foreground">Optimized Prompt: <span className="font-medium">{optimizedTitle || "(enter prompt)"}</span></p>
            <p className="text-[10px] text-muted-foreground">Parsed: accent {parsedTokens.accent || "(none)"} · emoji {parsedTokens.emoji || "(none)"} · style {parsedTokens.style || "(none)"} · strength {typeof parsedTokens.strength === "number" ? parsedTokens.strength.toFixed(2) : "(none)"}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-xs">Subtitle (optional)</label>
              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Short kicker" />
            </div>
            <div className="space-y-2">
              <label className="text-xs">Emoji</label>
              <div className="relative">
                <Input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  onFocus={() => setEmojiPickerOpen(true)}
                  onClick={() => setEmojiPickerOpen(true)}
                  placeholder="🔥✨🚀"
                />
                {emojiPickerOpen && (
                  <div className="absolute z-20 mt-1 w-72 max-w-[22rem] rounded-md border bg-popover p-2 shadow">
                    <div className="text-[11px] text-muted-foreground pb-1 flex justify-between items-center">
                      <span>Pick emojis (click to add)</span>
                      <button className="text-xs underline" onClick={() => setEmojiPickerOpen(false)}>Close</button>
                    </div>
                    <div className="flex gap-1 pb-2 flex-wrap">
                      {[
                        { k: 'trending', label: 'Trending' },
                        { k: 'cinematic', label: 'Cinematic' },
                        { k: 'gaming', label: 'Gaming (Neon)' },
                        { k: 'techy', label: 'Techy (Cool Blue)' },
                        { k: 'reactions', label: 'Reactions' },
                      ].map(({ k, label }) => (
                        <button
                          key={k}
                          className={`px-2 py-1 text-xs rounded border ${emojiCategory === k ? 'bg-muted font-medium' : 'bg-card hover:bg-muted'}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setEmojiCategory(k as any)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-8 gap-1 text-lg select-none">
                      {(emojiSets[emojiCategory] || []).map((em) => (
                        <button
                          key={em}
                          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.preventDefault();
                            const parts = (emoji || '').trim();
                            const next = parts ? `${parts} ${em}` : em;
                            setEmoji(next);
                            // Also apply emoji to canvas: append to selected text/subtitle or add a new layer
                            if (selectedId === 'subtitle') {
                              setSubtitle((prev) => (prev ? `${prev} ${em}` : em));
                            } else if (selectedId) {
                              setTexts((prev) => prev.map((t) => (
                                t.id === selectedId ? { ...t, text: (t.text ? `${t.text} ${em}` : em) } : t
                              )));
                            } else {
                              setTexts((prev) => prev.concat([{ id: `t${Date.now()}`, text: em, x: 100, y: 100, fontSize: 72, fill: textColor }]));
                            }
                          }}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-xs">Repolish Style</label>
              <select className="border rounded-md h-9 px-2 bg-card" value={repolishStyle} onChange={(e) => setRepolishStyle(e.target.value as RepolishStyle)}>
                <option value="cinematic">Cinematic (teal & orange)</option>
                <option value="vibrant">Vibrant (pop colors)</option>
                <option value="moody">Moody (cool, contrast)</option>
                <option value="documentary">Documentary (natural)</option>
                <option value="minimal">Minimal (soft)</option>
                <option value="gaming">Gaming (neon)</option>
                <option value="techy">Techy (cool blue)</option>
                <option value="vlog">Vlog (warm)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs">Strength</label>
              <Input type="range" min="0.2" max="1.2" step="0.05" value={repolishStrength} onChange={(e) => setRepolishStrength(Number(e.target.value))} />
              <p className="text-[10px] text-muted-foreground">{repolishStrength.toFixed(2)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-xs">Accent Color</label>
              <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
              <div className="flex gap-1 pt-1">
                {presetColors.map((c) => (
                  <button key={c} className="h-6 w-6 rounded" style={{ backgroundColor: c }} onClick={() => setAccentColor(c)} aria-label={`Pick ${c}`} />
                ))}
              </div>
              <p className="text-[10px]">Contrast: {formatContrast(contrastRatio(textColorForBg(bgStyle), accentColor))}</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs">Style</label>
              <select className="border rounded-md h-9 px-2 bg-card" value={bgStyle} onChange={(e) => setBgStyle(e.target.value as any)}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </div>
          <div className="space-y-2 mt-2">
            <label className="text-xs">Text Color</label>
            <Input type="color" value={textColor} onChange={(e) => {
              const val = e.target.value;
              setTextColor(val);
              if (selectedId === 'subtitle') {
                setSubtitleColor(val);
              } else if (selectedId) {
                updateTextLayer(setTexts, selectedId, { fill: val });
              }
            }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-xs">Frame</label>
              <select className="border rounded-md h-9 px-2 bg-card" value={frameStyle} onChange={(e) => setFrameStyle(e.target.value as any)}>
                <option value="none">None</option>
                <option value="border">Clean Border</option>
                <option value="rounded">Rounded Border</option>
                <option value="double">Double Border</option>
                <option value="thin">Thin Border</option>
                <option value="shadow">Accent Shadow</option>
                <option value="dashed">Dashed Border</option>
                <option value="filmstrip">Film Strip Corners</option>
                <option value="innerStroke">Inner Stroke</option>
                <option value="scanlines">Scanlines</option>
                <option value="polaroid">Polaroid</option>
                <option value="cornerCut">Corner Cut</option>
                <option value="grain">Analog Noise/Grain</option>
                <option value="tapeCorners">Tape Corners</option>
                <option value="burnedEdge">Burned Edge + Vignette</option>
                <option value="lightLeak">Light Leak Borders</option>
                <option value="gradientRounded">Gradient Border (Rounded)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs">Extra Effects</label>
              <select className="border rounded-md h-9 px-2 bg-card" value={extraEffect} onChange={(e) => setExtraEffect(e.target.value as any)}>
                <option value="none">None</option>
                <option value="neonGlow">Neon Glow Overlay</option>
                <option value="vignetteStrong">Strong Vignette</option>
                <option value="softGlow">Soft Glow</option>
                <option value="diagonalRays">Diagonal Rays</option>
                <option value="blueOrange">Blue/Orange Film</option>
              </select>
            </div>
          </div>
          {/* Actions moved below canvas for clearer layout */}
          <ul className="text-[10px] text-muted-foreground space-y-1 pt-2 list-disc pl-4">
            <li>Use 1280×720, high contrast text, and minimal words.</li>
            <li>Place face/subject right or left; avoid center clutter.</li>
            <li>3–6 words max in big bold text; add an emoji/number.</li>
          </ul>
        </Card>

        {/* Bottom action toolbar spanning full width */}
        <Card className="md:col-span-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs">Mode</span>
              <select className="border rounded-md h-9 px-2 bg-card" value={mode} onChange={(e) => setMode(e.target.value as any)}>
                <option value="generate">Generate (AI)</option>
                <option value="repolish">Repolish (Local)</option>
              </select>
            </div>
            {/* Image Fit Mode */}
            <div className="flex items-center gap-2">
              <span className="text-xs">Image Fit</span>
              <select className="border rounded-md h-9 px-2 bg-card" value={imageFit} onChange={(e) => setImageFit(e.target.value as any)}>
                <option value="free">Free</option>
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
              </select>
            </div>
            {/* Always show handles */}
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={imageAlwaysHandles} onChange={(e) => setImageAlwaysHandles(e.target.checked)} />
              Always Show Handles
            </label>
            {/* Quick Text Color Picker */}
            <div className="flex items-center gap-2">
              <span className="text-xs">Text Color</span>
              <Input type="color" value={textColor} onChange={(e) => {
                const val = e.target.value;
                setTextColor(val);
                if (selectedId === 'subtitle') {
                  setSubtitleColor(val);
                } else if (selectedId) {
                  updateTextLayer(setTexts, selectedId, { fill: val });
                }
              }} />
            </div>
            <Button size="sm" variant="default" disabled={busy || !title.trim()} onClick={generateFromPrompt}>
              {mode === "generate" ? "Generate Image (AI)" : "Apply Repolish"}
            </Button>
            <Button size="sm" disabled={busy || !imageObj} onClick={download}>{busy ? "Preparing…" : "Download PNG"}</Button>
            <Button size="sm" variant="secondary" onClick={() => addTextLayer(setTexts, textColor)}>Add Text Box</Button>
            <Button size="sm" variant="secondary" onClick={() => addGlowTextLayer(setTexts, accentColor, textColor)}>Add Glow Text</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary">Add Sticker</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => addSticker(setStickers, "subscribe")}>Subscribe</DropdownMenuItem>
                <DropdownMenuItem onClick={() => addSticker(setStickers, "comment")}>Comment</DropdownMenuItem>
                <DropdownMenuItem onClick={() => addSticker(setStickers, "like")}>Like</DropdownMenuItem>
                <DropdownMenuItem onClick={() => addSticker(setStickers, "share")}>Share</DropdownMenuItem>
                <DropdownMenuItem onClick={() => addSticker(setStickers, "follow")}>Follow</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>

        <Card className="p-2 flex items-center justify-center">
          <div className="w-full relative" ref={containerRef}>
            <Stage ref={stageRef} width={width} height={height}>
              <Layer>
                {/* Background */}
                <Rect x={0} y={0} width={width} height={height} fill={bgStyle === "dark" ? "#090909" : "#f4f4f4"} onClick={() => setImageSelected(false)} />

                {/* Image with subtle vignette */}
                {imageObj && (
                  <Group clip={{ x: 0, y: 0, width, height }}>
                    <KonvaImage
                      ref={imgRef}
                      image={imageObj}
                      x={imagePos.x}
                      y={imagePos.y}
                      scaleX={imageScale}
                      scaleY={imageScale}
                      draggable
                      onDragEnd={(e) => setImagePos({ x: e.target.x(), y: e.target.y() })}
                      onTransformEnd={(e) => {
                        const node = e.target as any;
                        const s = node.scaleX();
                        node.scaleX(1); node.scaleY(1);
                        // Update controlled scale
                        setImageScale(Math.max(0.1, s));
                      }}
                      width={width}
                      height={height}
                    />
                    <Rect x={0} y={0} width={width} height={height}
                      fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                      fillLinearGradientEndPoint={{ x: width, y: 0 }}
                      fillLinearGradientColorStops={[0, `rgba(0,0,0,${Math.min(0.8, repolishSettings.vignette)})`, 1, "rgba(0,0,0,0)"]}
                      listening={false}
                    />
                    {repolishSettings.overlay && (
                      <Rect x={0} y={0} width={width} height={height}
                        fill={repolishSettings.overlay}
                        opacity={repolishSettings.overlayOpacity}
                        globalCompositeOperation={repolishSettings.overlayBlend}
                        listening={false}
                      />
                    )}
                  </Group>
                )}

                {/* Accent banner */}
                <Rect x={0} y={height - 120} width={width} height={120} fill={accentColor} opacity={0.9} listening={false} />

                {/* Title removed: prompt drives AI editing; no text overlay */}

                {/* Subtitle */}
                {subtitle && (
                  <SelectableText
                    id="subtitle"
                    x={40}
                    y={height - 42}
                    width={width - 80}
                    text={subtitle}
                    fontSize={36}
                    fontFamily={fontFamilyForPreset(fontPreset)}
                    fill={subtitleColor}
                    stroke="#000"
                    strokeWidth={4}
                    shadowColor="#000"
                    shadowBlur={8}
                    shadowOffsetY={5}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onEditRequest={(args) => beginEditOverlay(args)}
                  />
                )}

                {/* Extra text layers */}
                {texts.map((t) => (
                  <SelectableText
                    key={t.id}
                    id={t.id}
                    x={t.x}
                    y={t.y}
                    width={t.width ?? width - 80}
                    text={t.text}
                    fontSize={t.fontSize}
                    fontFamily={fontFamilyForPreset(t.preset ?? fontPreset)}
                    fill={t.fill}
                    stroke={t.stroke ?? "#000"}
                    strokeWidth={t.strokeWidth ?? 2}
                    shadowColor={t.shadowColor ?? "#000"}
                    shadowBlur={t.shadowBlur ?? 8}
                    shadowOffsetY={t.shadowOffsetY ?? 5}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onChange={(attrs) => updateTextLayer(setTexts, t.id, attrs)}
                    onEditRequest={(args) => beginEditOverlay(args)}
                  />
                ))}

                {/* Extra visual effects overlays */}
                {extraEffect === "neonGlow" && (
                    <Rect x={0} y={0} width={width} height={height}
                      fillRadialGradientStartPoint={{ x: width/2, y: height/2 }}
                      fillRadialGradientEndPoint={{ x: width/2, y: height/2 }}
                      fillRadialGradientColorStops={[0, `${accentColor}AA`, 0.6, "rgba(0,0,0,0)"]}
                      globalCompositeOperation="screen"
                      opacity={0.35}
                      listening={false}
                  />
                )}
                {extraEffect === "vignetteStrong" && (
                  <Rect x={0} y={0} width={width} height={height}
                    fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                    fillLinearGradientEndPoint={{ x: width, y: 0 }}
                    fillLinearGradientColorStops={[0, "rgba(0,0,0,0.6)", 1, "rgba(0,0,0,0.6)"]}
                    listening={false}
                  />
                )}
                {extraEffect === "softGlow" && (
                  <Rect x={0} y={0} width={width} height={height}
                    fillRadialGradientStartPoint={{ x: width/2, y: height/2 }}
                    fillRadialGradientEndPoint={{ x: width/2, y: height/2 }}
                    fillRadialGradientColorStops={[0, `${accentColor}66`, 0.7, "rgba(0,0,0,0)"]}
                    globalCompositeOperation="soft-light"
                    opacity={0.45}
                    listening={false}
                  />
                )}
                {extraEffect === "diagonalRays" && (
                  <Group listening={false}>
                    {[0,1,2,3].map((i) => (
                      <Rect key={i} x={-width/2 + i*360} y={0} width={width} height={height}
                        rotation={-35}
                        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                        fillLinearGradientEndPoint={{ x: width, y: 0 }}
                        fillLinearGradientColorStops={[0, "rgba(255,255,255,0)", 0.5, `${accentColor}22`, 1, "rgba(255,255,255,0)"]}
                        globalCompositeOperation="screen"
                        opacity={0.5}
                      />
                    ))}
                  </Group>
                )}
                {extraEffect === "blueOrange" && (
                  <Group listening={false}>
                    <Rect x={0} y={0} width={width} height={height} fill="rgba(255,120,0,0.12)" globalCompositeOperation="soft-light" />
                    <Rect x={0} y={0} width={width} height={height} fill="rgba(80,160,255,0.15)" globalCompositeOperation="overlay" />
                  </Group>
                )}

                {/* Auto-emphasis tags */}
                <Group>
                  {tags.map((tag, i) => (
                    <Group key={tag} x={width - 220} y={20 + i * 54}>
                      <Rect width={200} height={44} cornerRadius={22} fill={accentColor} shadowColor="#000" shadowBlur={6} opacity={0.95} />
                      <KonvaText text={tag.toUpperCase()} x={20} y={10} fontSize={24} fontStyle="bold" fill="#fff" />
                    </Group>
                  ))}
                </Group>

                {/* Stickers layer */}
                {stickers.map((s) => renderSticker(s, setSelectedId, selectedId, setStickers))}
                {/* Frame overlays (topmost) */}
                {frameStyle !== "none" && (
                  <Group listening={false}>
                    {frameStyle === "border" && (
                      <Rect x={6} y={6} width={width - 12} height={height - 12} stroke={accentColor} strokeWidth={12} cornerRadius={6} opacity={0.95} />
                    )}
                    {frameStyle === "rounded" && (
                      <Rect x={10} y={10} width={width - 20} height={height - 20} stroke={accentColor} strokeWidth={12} cornerRadius={32} opacity={0.95} />
                    )}
                    {frameStyle === "double" && (
                      <>
                        <Rect x={8} y={8} width={width - 16} height={height - 16} stroke={accentColor} strokeWidth={10} cornerRadius={18} opacity={0.95} />
                        <Rect x={22} y={22} width={width - 44} height={height - 44} stroke="#ffffff" strokeWidth={6} cornerRadius={18} opacity={0.85} />
                      </>
                    )}
                    {frameStyle === "thin" && (
                      <Rect x={12} y={12} width={width - 24} height={height - 24} stroke={accentColor} strokeWidth={4} cornerRadius={10} opacity={0.95} />
                    )}
                    {frameStyle === "shadow" && (
                      <Rect x={10} y={10} width={width - 20} height={height - 20} stroke={accentColor} strokeWidth={8} cornerRadius={18} shadowColor="#000" shadowBlur={40} opacity={0.98} />
                    )}
                    {frameStyle === "dashed" && (
                      <Line
                        points={[12,12, width-12,12, width-12,height-12, 12,height-12]}
                        closed
                        stroke={accentColor}
                        strokeWidth={8}
                        dash={[20,16]}
                      />
                    )}
                    {frameStyle === "filmstrip" && (
                      <>
                        {/* Top strip */}
                        <Rect x={0} y={0} width={width} height={60} fill={bgStyle === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)'} />
                        {/* Bottom strip */}
                        <Rect x={0} y={height - 60} width={width} height={60} fill={bgStyle === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)'} />
                        {/* Holes */}
                        {Array.from({ length: Math.floor(width / 90) }).map((_, i) => (
                          <Rect key={`top-hole-${i}`} x={20 + i * 90} y={12} width={48} height={28} cornerRadius={6} fill={bgStyle === 'dark' ? '#111' : '#222'} opacity={0.9} />
                        ))}
                        {Array.from({ length: Math.floor(width / 90) }).map((_, i) => (
                          <Rect key={`bottom-hole-${i}`} x={20 + i * 90} y={height - 40} width={48} height={28} cornerRadius={6} fill={bgStyle === 'dark' ? '#111' : '#222'} opacity={0.9} />
                        ))}
                      </>
                    )}
                    {frameStyle === "innerStroke" && (
                      <>
                        <Rect x={20} y={20} width={width - 40} height={height - 40} stroke="#ffffff" strokeWidth={6} cornerRadius={14} opacity={0.95} />
                        <Rect x={34} y={34} width={width - 68} height={height - 68} stroke={accentColor} strokeWidth={4} cornerRadius={12} opacity={0.95} />
                      </>
                    )}
                    {frameStyle === "scanlines" && (
                      <Group>
                        {Array.from({ length: Math.floor(height / 4) }).map((_, i) => (
                          <Rect key={`scan-${i}`} x={0} y={i * 4} width={width} height={2} fill={bgStyle === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'} />
                        ))}
                      </Group>
                    )}
                    {frameStyle === "polaroid" && (
                      <>
                        <Rect x={18} y={18} width={width - 36} height={height - 36} stroke="#ffffff" strokeWidth={18} cornerRadius={10} opacity={0.98} />
                        {/* Thicker bottom margin look */}
                        <Rect x={18} y={height - 110} width={width - 36} height={92} fill="rgba(255,255,255,0.9)" />
                      </>
                    )}
                    {frameStyle === "cornerCut" && (
                      <>
                        <Line points={[0,0, 40,0, 0,40]} closed fill={accentColor} opacity={0.95} />
                        <Line points={[width,0, width-40,0, width,40]} closed fill={accentColor} opacity={0.95} />
                        <Line points={[0,height, 40,height, 0,height-40]} closed fill={accentColor} opacity={0.95} />
                        <Line points={[width,height, width-40,height, width,height-40]} closed fill={accentColor} opacity={0.95} />
                      </>
                    )}
                    {frameStyle === "grain" && (
                      <Group listening={false}>
                        {Array.from({ length: Math.max(200, Math.floor((width * height) / 4000)) }).map((_, i) => {
                          const x = (i * 37) % width;
                          const y = (i * 61) % height;
                          const nearEdge = x < 60 || x > width - 60 || y < 60 || y > height - 60;
                          if (!nearEdge) return null;
                          const col = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
                          return (
                            <Rect key={`grain-${i}`} x={x} y={y} width={2} height={2} cornerRadius={1} fill={col} />
                          );
                        })}
                      </Group>
                    )}
                    {frameStyle === "tapeCorners" && (
                      <>
                        {/* masking tape look on corners */}
                        <Rect x={24} y={24} width={100} height={26} fill="#f5e6c5" opacity={0.92} cornerRadius={6} rotation={-10} shadowColor="#000" shadowBlur={18} shadowOpacity={0.35} />
                        <Rect x={width - 124} y={28} width={100} height={26} fill="#f5e6c5" opacity={0.92} cornerRadius={6} rotation={12} shadowColor="#000" shadowBlur={18} shadowOpacity={0.35} />
                        <Rect x={24} y={height - 52} width={100} height={26} fill="#f5e6c5" opacity={0.92} cornerRadius={6} rotation={9} shadowColor="#000" shadowBlur={18} shadowOpacity={0.35} />
                        <Rect x={width - 140} y={height - 60} width={116} height={26} fill="#f5e6c5" opacity={0.92} cornerRadius={6} rotation={-12} shadowColor="#000" shadowBlur={18} shadowOpacity={0.35} />
                      </>
                    )}
                    {frameStyle === "burnedEdge" && (
                      <Group listening={false}>
                        {/* top burn */}
                        <Rect
                          x={0}
                          y={0}
                          width={width}
                          height={90}
                          fillLinearGradientStartPoint={{ x: width / 2, y: 0 }}
                          fillLinearGradientEndPoint={{ x: width / 2, y: 90 }}
                          fillLinearGradientColorStops={[0, 'rgba(0,0,0,0.0)', 0.7, 'rgba(80,40,0,0.45)', 1, 'rgba(0,0,0,0.65)']}
                        />
                        {/* bottom burn */}
                        <Rect
                          x={0}
                          y={height - 90}
                          width={width}
                          height={90}
                          fillLinearGradientStartPoint={{ x: width / 2, y: height - 0 }}
                          fillLinearGradientEndPoint={{ x: width / 2, y: height - 90 }}
                          fillLinearGradientColorStops={[0, 'rgba(0,0,0,0.0)', 0.7, 'rgba(80,40,0,0.45)', 1, 'rgba(0,0,0,0.65)']}
                        />
                        {/* left burn */}
                        <Rect
                          x={0}
                          y={0}
                          width={90}
                          height={height}
                          fillLinearGradientStartPoint={{ x: 0, y: height / 2 }}
                          fillLinearGradientEndPoint={{ x: 90, y: height / 2 }}
                          fillLinearGradientColorStops={[0, 'rgba(0,0,0,0.0)', 0.7, 'rgba(80,40,0,0.45)', 1, 'rgba(0,0,0,0.65)']}
                        />
                        {/* right burn */}
                        <Rect
                          x={width - 90}
                          y={0}
                          width={90}
                          height={height}
                          fillLinearGradientStartPoint={{ x: width, y: height / 2 }}
                          fillLinearGradientEndPoint={{ x: width - 90, y: height / 2 }}
                          fillLinearGradientColorStops={[0, 'rgba(0,0,0,0.0)', 0.7, 'rgba(80,40,0,0.45)', 1, 'rgba(0,0,0,0.65)']}
                        />
                      </Group>
                    )}
                    {frameStyle === "lightLeak" && (
                      <Group listening={false}>
                        {/* warm leak on left */}
                        <Rect
                          x={0}
                          y={0}
                          width={140}
                          height={height}
                          opacity={0.55}
                          fillLinearGradientStartPoint={{ x: 0, y: height / 2 }}
                          fillLinearGradientEndPoint={{ x: 140, y: height / 2 }}
                          fillLinearGradientColorStops={[0, 'rgba(255,120,80,0.0)', 0.5, 'rgba(255,120,80,0.6)', 1, 'rgba(255,220,120,0.0)']}
                        />
                        {/* cool leak on right */}
                        <Rect
                          x={width - 160}
                          y={0}
                          width={160}
                          height={height}
                          opacity={0.55}
                          fillLinearGradientStartPoint={{ x: width - 160, y: height / 2 }}
                          fillLinearGradientEndPoint={{ x: width, y: height / 2 }}
                          fillLinearGradientColorStops={[0, 'rgba(120,80,255,0.0)', 0.5, 'rgba(120,80,255,0.6)', 1, 'rgba(255,140,220,0.0)']}
                        />
                      </Group>
                    )}
                    {frameStyle === "gradientRounded" && (
                      <Group listening={false}>
                        {/* top strip */}
                        <Rect
                          x={12}
                          y={12}
                          width={width - 24}
                          height={22}
                          cornerRadius={12}
                          fillLinearGradientStartPoint={{ x: width / 2, y: 12 }}
                          fillLinearGradientEndPoint={{ x: width / 2, y: 34 }}
                          fillLinearGradientColorStops={[0, 'rgba(255,255,255,0.0)', 1, accentColor]}
                          opacity={0.9}
                        />
                        {/* bottom strip */}
                        <Rect
                          x={12}
                          y={height - 34}
                          width={width - 24}
                          height={22}
                          cornerRadius={12}
                          fillLinearGradientStartPoint={{ x: width / 2, y: height - 12 }}
                          fillLinearGradientEndPoint={{ x: width / 2, y: height - 34 }}
                          fillLinearGradientColorStops={[0, 'rgba(255,255,255,0.0)', 1, accentColor]}
                          opacity={0.9}
                        />
                        {/* left strip */}
                        <Rect
                          x={12}
                          y={12}
                          width={22}
                          height={height - 24}
                          cornerRadius={12}
                          fillLinearGradientStartPoint={{ x: 12, y: height / 2 }}
                          fillLinearGradientEndPoint={{ x: 34, y: height / 2 }}
                          fillLinearGradientColorStops={[0, 'rgba(255,255,255,0.0)', 1, accentColor]}
                          opacity={0.9}
                        />
                        {/* right strip */}
                        <Rect
                          x={width - 34}
                          y={12}
                          width={22}
                          height={height - 24}
                          cornerRadius={12}
                          fillLinearGradientStartPoint={{ x: width - 12, y: height / 2 }}
                          fillLinearGradientEndPoint={{ x: width - 34, y: height / 2 }}
                          fillLinearGradientColorStops={[0, 'rgba(255,255,255,0.0)', 1, accentColor]}
                          opacity={0.9}
                        />
                      </Group>
                    )}
                  </Group>
                )}
                {/* Clickable border to select image and show resize handles */}
                <Rect
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  stroke={"rgba(0,0,0,0)"}
                  hitStrokeWidth={24}
                  onClick={() => setImageSelected(true)}
                />
                {(imageSelected || imageAlwaysHandles) && (
                  <Transformer ref={imgTrRef} rotateEnabled={false} enabledAnchors={["top-left","top-right","bottom-left","bottom-right"]} />
                )}
              </Layer>
            </Stage>
            {editingId && editorStyle && (
              <div style={{ position: "absolute", left: editorStyle.left, top: editorStyle.top, width: editorStyle.width, zIndex: 10 }}>
                <Textarea
                  autoFocus
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => commitEditOverlay()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEditOverlay(); }
                  }}
                  rows={2}
                />
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

function slugify(x: string) {
  return x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function optimizePrompt(raw: string) {
  const s = (raw || "").trim();
  if (!s) return "";
  // Keep top keywords, cap length to ~6–8 words, emphasize numbers
  const words = s.split(/\s+/);
  const important = words.filter((w) => /[A-Za-z0-9]/.test(w)).slice(0, 8);
  const cap = important.map((w) => w.match(/^\d+$/) ? w : capitalize(w));
  return cap.join(" ");
}

function capitalize(w: string) {
  const lower = w.toLowerCase();
  const common = ["the","and","a","to","of","for","in","on","with","how","your","my"];
  if (common.includes(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export default ThumbnailLab;

// ---------- Types & helpers ----------
type FontPreset = "impact" | "bebas" | "inter";
type RepolishStyle = "cinematic" | "vibrant" | "moody" | "documentary" | "minimal" | "gaming" | "techy" | "vlog";
type TextLayer = {
  id: string;
  text: string;
  x: number;
  y: number;
  width?: number;
  fontSize: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  preset?: FontPreset;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetY?: number;
};

type StickerKind = "subscribe" | "comment" | "like" | "share" | "follow";
type Sticker = { id: string; kind: StickerKind; x: number; y: number };

const presetColors = ["#ff3b3b", "#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#0ea5e9"];

function fontFamilyForPreset(p: FontPreset) {
  if (p === "impact") return 'Impact, Haettenschweiler, "Arial Black", sans-serif';
  if (p === "bebas") return '"Bebas Neue", Impact, system-ui, -apple-system';
  return 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial';
}

function parseTokens(s: string) {
  const accentMatch = s.match(/\[accent:\s*([^\]]+)\]/i);
  const emojiMatch = s.match(/\[emoji:\s*([^\]]+)\]/i);
  const styleMatch = s.match(/\[style:\s*([^\]]+)\]/i);
  const strengthMatch = s.match(/\[strength:\s*([^\]]+)\]/i);
  const accentRaw = accentMatch?.[1]?.trim();
  const accent = accentRaw && isColor(accentRaw) ? normalizeColor(accentRaw) : undefined;
  const emoji = emojiMatch?.[1]?.trim();
  const styleRaw = styleMatch?.[1]?.trim().toLowerCase();
  const styleMap: Record<string, RepolishStyle> = {
    cinematic: "cinematic",
    film: "cinematic",
    teal: "cinematic",
    vibrant: "vibrant",
    pop: "vibrant",
    moody: "moody",
    dark: "moody",
    documentary: "documentary",
    natural: "documentary",
    minimal: "minimal",
    clean: "minimal",
    gaming: "gaming",
    neon: "gaming",
    techy: "techy",
    tech: "techy",
    vlog: "vlog",
    warm: "vlog",
  };
  const style = styleRaw ? styleMap[styleRaw] ?? null : null;
  const strengthRaw = strengthMatch?.[1]?.trim();
  let strength: number | undefined = undefined;
  if (strengthRaw) {
    const n = Number(strengthRaw);
    if (!Number.isNaN(n)) strength = Math.max(0.2, Math.min(1.2, n));
  }
  return { accent, emoji, style: style || undefined, strength };
}

function isColor(x: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(x) || ["red","blue","green","orange","purple","cyan","black","white"].includes(x.toLowerCase());
}
function normalizeColor(x: string) {
  const map: Record<string, string> = { red: "#ff3b3b", blue: "#3b82f6", green: "#22c55e", orange: "#f59e0b", purple: "#a855f7", cyan: "#0ea5e9", black: "#000000", white: "#ffffff" };
  if (x.startsWith("#")) return x;
  return map[x.toLowerCase()] ?? x;
}

function textColorForBg(style: "dark" | "light") { return style === "dark" ? "#ffffff" : "#111111"; }
function luminance(hex: string) {
  const h = hex.replace('#','');
  const bigint = parseInt(h.length === 3 ? h.split('').map((c)=>c+c).join('') : h, 16);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  const a = [r,g,b].map((v)=> v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
  return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
}
function contrastRatio(hex1: string, hex2: string) {
  const l1 = luminance(hex1); const l2 = luminance(hex2);
  const lighter = Math.max(l1,l2); const darker = Math.min(l1,l2);
  return (lighter + 0.05) / (darker + 0.05);
}
function formatContrast(cr: number) { return cr.toFixed(2) + ":1"; }

function detectTags(s: string) {
  const lower = s.toLowerCase();
  const tags: string[] = [];
  if (lower.includes("free")) tags.push("FREE");
  if (lower.includes("2025")) tags.push("2025");
  if (lower.includes("top") && lower.match(/top\s*10/i)) tags.push("TOP 10");
  return tags;
}

function suggestStyleFromPrompt(s: string): RepolishStyle | null {
  const t = s.toLowerCase();
  if (t.includes("cinematic")) return "cinematic";
  if (t.includes("vibrant") || t.includes("colorful") || t.includes("neon")) return "vibrant";
  if (t.includes("moody") || t.includes("dark")) return "moody";
  if (t.includes("documentary") || t.includes("natural")) return "documentary";
  if (t.includes("minimal") || t.includes("simple")) return "minimal";
  if (t.includes("gaming") || t.includes("esports")) return "gaming";
  if (t.includes("tech") || t.includes("ai") || t.includes("code")) return "techy";
  if (t.includes("vlog") || t.includes("travel") || t.includes("lifestyle")) return "vlog";
  return null;
}

// Text layer helpers
function addTextLayer(setTexts: (updater: any) => void, color?: string) {
  setTexts((prev: TextLayer[]) => prev.concat([{ id: `t${Date.now()}`, text: "New Text", x: 60, y: 60, fontSize: 48, fill: color ?? "#ffffff" }]));
}
function addGlowTextLayer(setTexts: (updater: any) => void, accent: string, color?: string) {
  setTexts((prev: TextLayer[]) => prev.concat([
    { id: `t${Date.now()}`, text: "Glow Text", x: 80, y: 80, fontSize: 72, fill: color ?? "#ffffff", stroke: "#000000", strokeWidth: 2, shadowColor: accent, shadowBlur: 24, shadowOffsetY: 0, preset: "impact" }
  ]));
}
function updateTextLayer(setTexts: (updater: any) => void, id: string, attrs: Partial<TextLayer>) {
  setTexts((prev: TextLayer[]) => prev.map((t) => (t.id === id ? { ...t, ...attrs } : t)));
}

// Repolish filters mapping
function getRepolishSettings(style: RepolishStyle, strength: number) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const s = clamp(strength, 0.2, 1.2);
  const base = { brightness: 0, contrast: 0, saturation: 0, hue: 0, blurRadius: 0, sepia: 0, vignette: 0.4, overlay: "" as string | null, overlayOpacity: 0, overlayBlend: "overlay" as any };
  switch (style) {
    case "cinematic":
      // Teal & orange bias: push cool-teal overall with gentle warmth
      return { ...base, contrast: 0.22 * s, saturation: 0.12 * s, brightness: -0.03 * s, hue: -8 * s, vignette: 0.6 * s, overlay: "rgba(0,180,200,0.18)", overlayOpacity: 0.28 * s, overlayBlend: "soft-light" };
    case "vibrant":
      return { ...base, contrast: 0.15 * s, saturation: 0.35 * s, brightness: 0.05 * s, hue: 0, vignette: 0.35 * s };
    case "moody":
      return { ...base, contrast: 0.25 * s, saturation: -0.15 * s, brightness: -0.08 * s, hue: -10 * s, vignette: 0.6 * s, sepia: 0.1 * s };
    case "documentary":
      return { ...base, contrast: 0.08 * s, saturation: 0.05 * s, brightness: 0, hue: 0, vignette: 0.3 * s };
    case "minimal":
      return { ...base, contrast: 0.05 * s, saturation: -0.1 * s, brightness: 0.02 * s, hue: 0, vignette: 0.25 * s };
    case "gaming":
      // Neon glow: boost saturation and a cyan/magenta vibe
      return { ...base, contrast: 0.24 * s, saturation: 0.5 * s, brightness: 0.05 * s, hue: 25 * s, vignette: 0.5 * s, overlay: "rgba(0,255,170,0.22)", overlayOpacity: 0.28 * s, overlayBlend: "screen" };
    case "techy":
      // Cool-blue bias: cleaner contrast, bluer hues, subtle overlay
      return { ...base, contrast: 0.2 * s, saturation: 0.15 * s, brightness: 0, hue: -30 * s, vignette: 0.4 * s, overlay: "rgba(80,160,255,0.16)", overlayOpacity: 0.22 * s, overlayBlend: "soft-light" };
    case "vlog":
      return { ...base, contrast: 0.12 * s, saturation: 0.2 * s, brightness: 0.05 * s, hue: 10 * s, vignette: 0.35 * s };
    default:
      return base;
  }
}

// Stickers
function addSticker(setStickers: (updater: any) => void, kind: StickerKind) {
  setStickers((prev: Sticker[]) => prev.concat([{ id: `s${Date.now()}`, kind, x: 40, y: 40 }]));
}
function updateSticker(setStickers: (updater: any) => void, id: string, attrs: Partial<Sticker>) {
  setStickers((prev: Sticker[]) => prev.map((st) => (st.id === id ? { ...st, ...attrs } : st)));
}

function renderSticker(s: Sticker, setSelectedId: (id: string) => void, selectedId: string | null, setStickers: (updater: any) => void) {
  const common = { shadowColor: '#000', shadowBlur: 6 } as const;
  const isSel = selectedId === s.id;
  if (s.kind === 'subscribe') {
    return (
      <Group key={s.id} x={s.x} y={s.y} draggable onClick={() => setSelectedId(s.id)} onDragEnd={(e) => updateSticker(setStickers, s.id, { x: e.target.x(), y: e.target.y() })}>
        <Rect width={220} height={60} cornerRadius={12} fill="#ff0000" {...common} opacity={0.95} />
        <KonvaText text={"SUBSCRIBE 🔔"} x={16} y={16} fontSize={28} fontStyle="bold" fill="#fff" />
        {isSel && <Transformer rotateEnabled={false} />}
      </Group>
    );
  }
  if (s.kind === 'comment') {
    return (
      <Group key={s.id} x={s.x} y={s.y} draggable onClick={() => setSelectedId(s.id)} onDragEnd={(e) => updateSticker(setStickers, s.id, { x: e.target.x(), y: e.target.y() })}>
        <Rect width={240} height={60} cornerRadius={12} fill="#3b82f6" {...common} opacity={0.95} />
        <KonvaText text={"COMMENT 💬"} x={16} y={16} fontSize={28} fontStyle="bold" fill="#fff" />
        {isSel && <Transformer rotateEnabled={false} />}
      </Group>
    );
  }
  if (s.kind === 'share') {
    return (
      <Group key={s.id} x={s.x} y={s.y} draggable onClick={() => setSelectedId(s.id)} onDragEnd={(e) => updateSticker(setStickers, s.id, { x: e.target.x(), y: e.target.y() })}>
        <Rect width={200} height={60} cornerRadius={12} fill="#a855f7" {...common} opacity={0.95} />
        <KonvaText text={"SHARE ↗"} x={16} y={16} fontSize={28} fontStyle="bold" fill="#fff" />
        {isSel && <Transformer rotateEnabled={false} />}
      </Group>
    );
  }
  if (s.kind === 'follow') {
    return (
      <Group key={s.id} x={s.x} y={s.y} draggable onClick={() => setSelectedId(s.id)} onDragEnd={(e) => updateSticker(setStickers, s.id, { x: e.target.x(), y: e.target.y() })}>
        <Rect width={220} height={60} cornerRadius={30} fill="#f59e0b" {...common} opacity={0.95} />
        <KonvaText text={"FOLLOW ⭐"} x={20} y={16} fontSize={28} fontStyle="bold" fill="#fff" />
        {isSel && <Transformer rotateEnabled={false} />}
      </Group>
    );
  }
  return (
    <Group key={s.id} x={s.x} y={s.y} draggable onClick={() => setSelectedId(s.id)} onDragEnd={(e) => updateSticker(setStickers, s.id, { x: e.target.x(), y: e.target.y() })}>
      <Rect width={160} height={60} cornerRadius={30} fill="#22c55e" {...common} opacity={0.95} />
      <KonvaText text={"LIKE 👍"} x={28} y={16} fontSize={28} fontStyle="bold" fill="#fff" />
      {isSel && <Transformer rotateEnabled={false} />}
    </Group>
  );
}

// ---------- Selectable Text with Transformer ----------
type SelectableTextProps = {
  id: string;
  text: string;
  x: number; y: number; width?: number;
  fontSize: number; fontFamily: string; fill: string;
  stroke?: string; strokeWidth?: number;
  shadowColor?: string; shadowBlur?: number; shadowOffsetY?: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChange?: (attrs: Partial<TextLayer>) => void;
  onEditRequest?: (args: { id: string; currentText: string; node: any }) => void;
};

function SelectableText(props: SelectableTextProps) {
  const isSelected = props.selectedId === props.id;
  const textRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  useEffect(() => {
    if (isSelected && trRef.current && textRef.current) {
      trRef.current.nodes([textRef.current]);
      trRef.current.getLayer()?.batchDraw?.();
    }
  }, [isSelected]);
  return (
    <>
      <KonvaText
        ref={textRef}
        x={props.x}
        y={props.y}
        width={props.width}
        text={props.text}
        fontSize={props.fontSize}
        fontFamily={props.fontFamily}
        fill={props.fill}
        stroke={props.stroke}
        strokeWidth={props.strokeWidth}
        shadowColor={props.shadowColor}
        shadowBlur={props.shadowBlur}
        shadowOffsetY={props.shadowOffsetY}
        draggable
        onClick={() => props.onSelect(props.id)}
        onTap={() => props.onSelect(props.id)}
        onDblClick={() => props.onEditRequest?.({ id: props.id, currentText: props.text, node: textRef.current })}
        onDblTap={() => props.onEditRequest?.({ id: props.id, currentText: props.text, node: textRef.current })}
        onDragEnd={(e) => props.onChange?.({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={(e) => {
          const node = e.target as any;
          const scaleX = node.scaleX();
          const fontSize = Math.max(18, props.fontSize * scaleX);
          node.scaleX(1); node.scaleY(1);
          props.onChange?.({ fontSize });
        }}
      />
      {isSelected && (
        <Transformer ref={trRef} rotateEnabled={true} enabledAnchors={["top-left","top-right","bottom-left","bottom-right"]} />
      )}
    </>
  );
}