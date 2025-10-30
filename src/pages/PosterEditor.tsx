import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Stage, Layer, Text as KonvaText, Rect as KonvaRect, Image as KonvaImage, Transformer, TextPath as KonvaTextPath } from "react-konva";
import { Picker } from "emoji-mart";
import data from "@emoji-mart/data";
// Emoji picker CSS import removed due to Vite resolution issue.

const LazyPicker = React.lazy(() => import("emoji-mart").then(mod => ({ default: (mod as any).Picker })));

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }>{
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(_error: any) { return { hasError: true }; }
  componentDidCatch(_error: any, _info: any) {}
  render() { if (this.state.hasError) return <div className="text-sm text-red-500">Failed to load picker.</div>; return this.props.children; }
}

class EditorErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: any }>{
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) { console.error('PosterEditor crashed', error, info); }
  handleReload = () => { try { window.location.reload(); } catch { /* noop */ } };
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-xl font-semibold">Editor crashed</h2>
            <p className="text-sm text-muted-foreground">Please reload. If this keeps happening, share the exact steps.</p>
            <Button onClick={this.handleReload}>Reload Editor</Button>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}
import Konva from "konva";

type BlendMode = GlobalCompositeOperation;

type ElementBase = {
  id: string;
  type: "text" | "rect" | "image" | "textPath";
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  blendMode?: BlendMode;
  locked?: boolean;
  hidden?: boolean;
};

type TextElement = ElementBase & {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily?: string;
  fontStyle?: "normal" | "bold" | "italic" | "bold italic";
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: "none" | "underline";
  gradient?: { enabled: boolean; color1: string; color2: string; horizontal?: boolean };
};

type RectElement = ElementBase & {
  type: "rect";
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  gradient?: { enabled: boolean; color1: string; color2: string; horizontal?: boolean };
};

type ImageElement = ElementBase & {
  type: "image";
  src: string;
  filters?: {
    blur?: number;
    brightness?: number;
    contrast?: number;
    grayscale?: boolean;
    hue?: number;
    saturation?: number;
    value?: number;
  };
  crop?: { x: number; y: number; width: number; height: number } | null;
};

type TextPathElement = ElementBase & {
  type: "textPath";
  text: string;
  data: string; // svg path
  fontSize: number;
  fontFamily?: string;
  fontStyle?: "normal" | "bold" | "italic" | "bold italic";
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  letterSpacing?: number;
  textDecoration?: "none" | "underline";
  gradient?: { enabled: boolean; color1: string; color2: string; horizontal?: boolean };
};

type Element = TextElement | RectElement | ImageElement | TextPathElement;

const PosterEditor = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [bgImageObj, setBgImageObj] = useState<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const [stageScale, setStageScale] = useState<number>(1);

  const [elements, setElements] = useState<Element[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [editorStyle, setEditorStyle] = useState<{ left: number; top: number; width: number } | null>(null);
  const [cropActive, setCropActive] = useState(false);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [guides, setGuides] = useState<{ vx?: number; hy?: number }>({});
  const [past, setPast] = useState<Element[][]>([]);
  const [future, setFuture] = useState<Element[][]>([]);
  const cropRectRef = useRef<any>(null);
  const trCropRef = useRef<any>(null);

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
  const [emojiOpen, setEmojiOpen] = useState(false);

  const watermarkSrc = `${import.meta.env.BASE_URL}logo.png`;

  useEffect(() => {
    const last = localStorage.getItem("lastGeneratedImage");
    if (last) setImageUrl(last);
  }, []);

  useEffect(() => {
    if (!imageUrl) { setBgImageObj(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      setBgImageObj(img);
      const cw = containerRef.current?.clientWidth ?? 800;
      setStageScale(cw / img.naturalWidth);
    };
    img.onerror = () => setBgImageObj(null);
  }, [imageUrl]);

  useEffect(() => {
    const stage = stageRef.current as any;
    const tr = trRef.current as any;
    if (!stage || !tr) return;
    const node = selectedId ? stage.findOne(`#${selectedId}`) : null;
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, elements]);

  useEffect(() => {
    if (!cropActive) return;
    const tr = trCropRef.current as any;
    const node = cropRectRef.current as any;
    if (tr && node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    }
  }, [cropActive, cropRect]);

  const uploadFile = async (f: File) => {
    const url = URL.createObjectURL(f);
    setImageUrl(url);
  };

  const addTextElement = (text = "New Text") => {
    const el: TextElement = {
      id: `el_${Date.now()}`,
      type: "text",
      x: 100,
      y: 100,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      blendMode: "source-over",
      locked: false,
      hidden: false,
      text,
      fontSize: 48,
      fontFamily: lang === 'en' ? 'Inter' : 'Noto Sans Devanagari',
      fontStyle: 'normal',
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 1,
      shadowColor: shadowEnabled ? shadowColor : undefined,
      shadowBlur: shadowEnabled ? Math.floor((bgImageObj?.naturalWidth ?? 1000) * shadowBlur) * 0.02 : 0,
      align: "left",
      lineHeight: 1.2,
      letterSpacing: 0,
      textDecoration: 'none',
      gradient: { enabled: false, color1: '#ffffff', color2: '#999999', horizontal: true },
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  };

  const addEmojiElement = () => addTextElement("😀");

  const addRectElement = () => {
    const el: RectElement = {
      id: `el_${Date.now()}`,
      type: "rect",
      x: 120,
      y: 140,
      width: 300,
      height: 120,
      fill: "rgba(0,0,0,0.4)",
      stroke: "#ffffff",
      strokeWidth: 1,
      opacity: 1,
      blendMode: "source-over",
      locked: false,
      hidden: false,
      cornerRadius: 0,
      gradient: { enabled: false, color1: '#000000', color2: '#333333', horizontal: true },
    } as RectElement;
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  };

  const addImageElement = (src: string) => {
    const el: ImageElement = {
      id: `el_${Date.now()}`,
      type: "image",
      x: 150,
      y: 160,
      opacity: 1,
      blendMode: "source-over",
      locked: false,
      hidden: false,
      src,
      filters: {},
      crop: null,
    } as ImageElement;
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  };

  const onUploadElementImage = (f: File) => {
    const url = URL.createObjectURL(f);
    addImageElement(url);
  };

  const arcPath = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg * Math.PI) / 180;
    const sx = cx + r * Math.cos(s);
    const sy = cy + r * Math.sin(s);
    const ex = cx + r * Math.cos(e);
    const ey = cy + r * Math.sin(e);
    const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    const sweep = endDeg > startDeg ? 1 : 0;
    return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} ${sweep} ${ex} ${ey}`;
  };

  const addCurvedTextElement = (text = 'Curved Text') => {
    const w = bgImageObj?.naturalWidth ?? 1000;
    const h = bgImageObj?.naturalHeight ?? 1000;
    const cx = w / 2;
    const cy = h * 0.2;
    const r = Math.min(w, h) * 0.25;
    const el: TextPathElement = {
      id: `el_${ Date.now() }`,
      type: 'textPath',
      x: 0,
      y: 0,
      opacity: 1,
      blendMode: 'source-over',
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      text,
      data: arcPath(cx, cy, r, 200, -20),
      fontSize: 56,
      fontFamily: lang === 'en' ? 'Inter' : 'Noto Sans Devanagari',
      fontStyle: 'bold',
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 1,
      letterSpacing: 0,
      textDecoration: 'none',
      gradient: { enabled: false, color1: '#ffffff', color2: '#999999', horizontal: true },
      locked: false,
      hidden: false,
    };
    setElements((prev)=>[...prev, el]);
    setSelectedId(el.id);
  };

  const pushHistory = (prevElements: Element[]) => {
    setPast((p) => [...p, prevElements]);
    setFuture([]);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setElements((prev) => {
      pushHistory(prev);
      return prev.filter((e) => e.id !== selectedId);
    });
    setSelectedId(null);
  };

  const updateSelected = (patch: Partial<Element>) => {
    if (!selectedId) return;
    setElements((prev) => {
      pushHistory(prev);
      return prev.map((e) => (e.id === selectedId ? { ...e, ...patch } as Element : e));
    });
  };

  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [...f, elements]);
      setElements(prev);
      return p.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[f.length - 1];
      setPast((p) => [...p, elements]);
      setElements(next);
      return f.slice(0, -1);
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true');
      if (isInput || editingId) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSelected();
      } else if (selectedId && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft') updateSelected({ x: ((elements.find(el=>el.id===selectedId)?.x ?? 0) - delta) } as any);
        if (e.key === 'ArrowRight') updateSelected({ x: ((elements.find(el=>el.id===selectedId)?.x ?? 0) + delta) } as any);
        if (e.key === 'ArrowUp') updateSelected({ y: ((elements.find(el=>el.id===selectedId)?.y ?? 0) - delta) } as any);
        if (e.key === 'ArrowDown') updateSelected({ y: ((elements.find(el=>el.id===selectedId)?.y ?? 0) + delta) } as any);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [elements, selectedId, editingId]);

  const exportPosterFromStage = () => {
    if (!stageRef.current) { toast.error("Editor not ready"); return; }
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 1 / stageScale });
    setPosterUrl(dataUrl);
    toast.success("Poster exported");
  };

  return (
    <EditorErrorBoundary>
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
            <Button className="w-full" onClick={exportPosterFromStage} disabled={!bgImageObj}>Export Poster</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={()=>addTextElement(heading || (lang==='hi'? 'AI इमेज मैजिक...' : lang==='mr'? 'AI इमेज मॅजिक...' : 'AI Image Magic'))}>Add Heading</Button>
            <Button variant="outline" onClick={()=>addTextElement(bullets ? bullets.split('\n')[0] : '• Point')}>Add Bullet</Button>
            <Button variant="outline" onClick={()=>addTextElement(cta || (lang==='hi'? 'अभी शुरू करें' : lang==='mr'? 'आता सुरू करा' : 'Try now'))}>Add CTA</Button>
            <Button variant="outline" onClick={()=>setEmojiOpen(true)}>Add Emoji</Button>
            <Button variant="outline" onClick={()=>addCurvedTextElement(heading || 'Curved Heading')}>Add Curved Text</Button>
            {/* Style Presets */}
            <Button variant="outline" onClick={()=>{
              if (!selectedId) { toast.error('Select a text element'); return; }
              const el = elements.find(e=>e.id===selectedId);
              if (!el || el.type !== 'text') { toast.error('Select a text element'); return; }
              updateSelected({ fontStyle: 'bold', stroke: '#000000', strokeWidth: 3, shadowColor: '#000000', shadowBlur: 8 } as Partial<TextElement>);
            }}>Outline Bold</Button>
            <Button variant="outline" onClick={()=>{
              if (!selectedId) { toast.error('Select a text element'); return; }
              const el = elements.find(e=>e.id===selectedId);
              if (!el || el.type !== 'text') { toast.error('Select a text element'); return; }
              updateSelected({ shadowColor: '#7c3aed', shadowBlur: 16, strokeWidth: 0 } as Partial<TextElement>);
            }}>Glow</Button>
            <Button variant="outline" onClick={()=>{
              if (!selectedId) { toast.error('Select a text element'); return; }
              const el = elements.find(e=>e.id===selectedId);
              if (!el || el.type !== 'text') { toast.error('Select a text element'); return; }
              updateSelected({ shadowColor: '#000000', shadowBlur: 6, strokeWidth: 0 } as Partial<TextElement>);
            }}>Subtle Shadow</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={addRectElement}>Add Shape</Button>
            <label className="text-sm inline-flex items-center gap-2">
              <span>Element Image:</span>
              <input type="file" accept="image/*" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) onUploadElementImage(f); }} />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="destructive" onClick={removeSelected} disabled={!selectedId}>Delete Selected</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <h3 className="text-sm font-medium mb-2">Canvas Editor</h3>
            <div ref={containerRef} className="w-full border rounded-lg overflow-auto relative">
              {bgImageObj ? (
                <Stage ref={stageRef} width={bgImageObj.naturalWidth} height={bgImageObj.naturalHeight} scaleX={stageScale} scaleY={stageScale}>
                  <Layer listening={false}>
                    <KonvaImage image={bgImageObj} x={0} y={0} />
                  </Layer>
                  <Layer>
                    {elements.filter((e)=>!e.hidden).map((el) => {
                      if (el.type === 'text') {
                        const t = el as TextElement;
                        return (
                          <KonvaText
                            key={el.id}
                            id={el.id}
                            x={el.x}
                            y={el.y}
                            text={t.text}
                            fontSize={t.fontSize}
                            fontFamily={t.fontFamily}
                            fontStyle={t.fontStyle}
                            fill={t.gradient?.enabled ? undefined : t.fill}
                            stroke={t.stroke}
                            strokeWidth={t.strokeWidth}
                            shadowColor={t.shadowColor}
                            shadowBlur={t.shadowBlur}
                            opacity={el.opacity}
                            globalCompositeOperation={el.blendMode}
                            rotation={el.rotation}
                            scaleX={el.scaleX}
                            scaleY={el.scaleY}
                            align={t.align}
                            lineHeight={t.lineHeight}
                            letterSpacing={t.letterSpacing}
                            textDecoration={t.textDecoration}
                            draggable={!el.locked}
                            fillLinearGradientColorStops={t.gradient?.enabled ? [0, t.gradient.color1, 1, t.gradient.color2] : undefined}
                            fillLinearGradientStartPoint={t.gradient?.enabled ? { x: 0, y: 0 } : undefined}
                            fillLinearGradientEndPoint={t.gradient?.enabled ? { x: (t.gradient.horizontal ? 300 : 0), y: (t.gradient.horizontal ? 0 : 100) } : undefined}
                            onClick={()=>setSelectedId(el.id)}
                            onDragMove={(e)=>{
                              const rect = (e.target as any).getClientRect();
                              const st = stageRef.current as any;
                              const cx = st.width() / 2;
                              const cy = st.height() / 2;
                              let vx: number | undefined = undefined;
                              let hy: number | undefined = undefined;
                              const threshold = 5;
                              const centerX = rect.x + rect.width / 2;
                              const centerY = rect.y + rect.height / 2;
                              if (Math.abs(centerX - cx) < threshold) {
                                vx = cx;
                                e.target.x(e.target.x() + (cx - centerX));
                              }
                              if (Math.abs(centerY - cy) < threshold) {
                                hy = cy;
                                e.target.y(e.target.y() + (cy - centerY));
                              }
                              setGuides({ vx, hy });
                            }}
                            onDragEnd={(e)=>{ setGuides({}); updateSelected({ x: e.target.x(), y: e.target.y() })}}
                            onTransformEnd={(e)=>{
                              const node = e.target as any;
                              updateSelected({ x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() });
                            }}
                            onDblClick={(e)=>{
                              const node = e.target as any;
                              const rect = node.getClientRect();
                              const c = containerRef.current as HTMLDivElement | null;
                              const left = rect.x * stageScale - (c?.scrollLeft ?? 0);
                              const top = rect.y * stageScale - (c?.scrollTop ?? 0);
                              const width = Math.max(120, rect.width * stageScale);
                              setEditingId(el.id);
                              setEditingValue(t.text);
                              setEditorStyle({ left, top, width });
                            }}
                            onDblTap={(e)=>{
                              const node = e.target as any;
                              const rect = node.getClientRect();
                              const c = containerRef.current as HTMLDivElement | null;
                              const left = rect.x * stageScale - (c?.scrollLeft ?? 0);
                              const top = rect.y * stageScale - (c?.scrollTop ?? 0);
                              const width = Math.max(120, rect.width * stageScale);
                              setEditingId(el.id);
                              setEditingValue(t.text);
                              setEditorStyle({ left, top, width });
                            }}
                          />
                        );
                      }
                      if (el.type === 'textPath') {
                        const tp = el as TextPathElement;
                        return (
                          <KonvaTextPath
                            key={el.id}
                            id={el.id}
                            data={tp.data}
                            text={tp.text}
                            fill={tp.gradient?.enabled ? undefined : tp.fill}
                            fontSize={tp.fontSize}
                            fontFamily={tp.fontFamily}
                            fontStyle={tp.fontStyle}
                            stroke={tp.stroke}
                            strokeWidth={tp.strokeWidth}
                            letterSpacing={tp.letterSpacing}
                            textDecoration={tp.textDecoration}
                            opacity={tp.opacity}
                            globalCompositeOperation={tp.blendMode}
                            rotation={tp.rotation}
                            scaleX={tp.scaleX}
                            scaleY={tp.scaleY}
                            draggable={!tp.locked}
                            fillLinearGradientColorStops={tp.gradient?.enabled ? [0, tp.gradient.color1, 1, tp.gradient.color2] : undefined}
                            fillLinearGradientStartPoint={tp.gradient?.enabled ? { x: 0, y: 0 } : undefined}
                            fillLinearGradientEndPoint={tp.gradient?.enabled ? { x: (tp.gradient.horizontal ? 300 : 0), y: (tp.gradient.horizontal ? 0 : 100) } : undefined}
                            onClick={()=>setSelectedId(el.id)}
                            onDragMove={(e)=>{
                              const rect = (e.target as any).getClientRect();
                              const st = stageRef.current as any;
                              const cx = st.width() / 2;
                              const cy = st.height() / 2;
                              let vx: number | undefined = undefined;
                              let hy: number | undefined = undefined;
                              const threshold = 5;
                              const centerX = rect.x + rect.width / 2;
                              const centerY = rect.y + rect.height / 2;
                              if (Math.abs(centerX - cx) < threshold) {
                                vx = cx;
                                e.target.x(e.target.x() + (cx - centerX));
                              }
                              if (Math.abs(centerY - cy) < threshold) {
                                hy = cy;
                                e.target.y(e.target.y() + (cy - centerY));
                              }
                              setGuides({ vx, hy });
                            }}
                            onDragEnd={(e)=>{ setGuides({}); updateSelected({ x: e.target.x(), y: e.target.y() })}}
                            onTransformEnd={(e)=>{
                              const node = e.target as any;
                              updateSelected({ rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() });
                            }}
                          />
                        );
                      }
                      if (el.type === 'rect') {
                        const r = el as RectElement;
                        return (
                          <KonvaRect
                            key={el.id}
                            id={el.id}
                            x={el.x}
                            y={el.y}
                            width={r.width}
                            height={r.height}
                            fill={r.gradient?.enabled ? undefined : r.fill}
                            stroke={r.stroke}
                            strokeWidth={r.strokeWidth}
                            cornerRadius={r.cornerRadius}
                            opacity={el.opacity}
                            globalCompositeOperation={el.blendMode}
                            rotation={el.rotation}
                            scaleX={el.scaleX}
                            scaleY={el.scaleY}
                            draggable={!el.locked}
                            fillLinearGradientColorStops={r.gradient?.enabled ? [0, r.gradient.color1, 1, r.gradient.color2] : undefined}
                            fillLinearGradientStartPoint={r.gradient?.enabled ? { x: 0, y: 0 } : undefined}
                            fillLinearGradientEndPoint={r.gradient?.enabled ? { x: (r.gradient.horizontal ? r.width : 0), y: (r.gradient.horizontal ? 0 : r.height) } : undefined}
                            onClick={()=>setSelectedId(el.id)}
                            onDragMove={(e)=>{
                              const rect = (e.target as any).getClientRect();
                              const st = stageRef.current as any;
                              const cx = st.width() / 2;
                              const cy = st.height() / 2;
                              let vx: number | undefined = undefined;
                              let hy: number | undefined = undefined;
                              const threshold = 5;
                              const centerX = rect.x + rect.width / 2;
                              const centerY = rect.y + rect.height / 2;
                              if (Math.abs(centerX - cx) < threshold) {
                                vx = cx;
                                e.target.x(e.target.x() + (cx - centerX));
                              }
                              if (Math.abs(centerY - cy) < threshold) {
                                hy = cy;
                                e.target.y(e.target.y() + (cy - centerY));
                              }
                              setGuides({ vx, hy });
                            }}
                            onDragEnd={(e)=>{ setGuides({}); updateSelected({ x: e.target.x(), y: e.target.y() })}}
                            onTransformEnd={(e)=>{
                              const node = e.target as any;
                              updateSelected({ x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() });
                            }}
                          />
                        );
                      }
                      if (el.type === 'image') {
                        const imgNode = new Image();
                        imgNode.crossOrigin = 'anonymous';
                        imgNode.src = (el as ImageElement).src;
                        const imgEl = el as ImageElement;
                        const activeFilters: any[] = [];
                        if (imgEl.filters?.blur) activeFilters.push(Konva.Filters.Blur);
                        if (imgEl.filters?.brightness !== undefined) activeFilters.push(Konva.Filters.Brighten);
                        if (imgEl.filters?.contrast !== undefined) activeFilters.push(Konva.Filters.Contrast);
                        if (imgEl.filters?.grayscale) activeFilters.push(Konva.Filters.Grayscale);
                        if (imgEl.filters?.hue !== undefined || imgEl.filters?.saturation !== undefined || imgEl.filters?.value !== undefined) activeFilters.push(Konva.Filters.HSV);
                        return (
                          <KonvaImage
                            key={el.id}
                            id={el.id}
                            x={el.x}
                            y={el.y}
                            image={imgNode}
                            width={(imgEl.crop?.width) ?? undefined}
                            height={(imgEl.crop?.height) ?? undefined}
                            crop={imgEl.crop ?? undefined}
                            opacity={el.opacity}
                            globalCompositeOperation={el.blendMode}
                            rotation={el.rotation}
                            scaleX={el.scaleX}
                            scaleY={el.scaleY}
                            filters={activeFilters}
                            blurRadius={imgEl.filters?.blur ?? 0}
                            brightness={imgEl.filters?.brightness ?? 0}
                            contrast={imgEl.filters?.contrast ?? 0}
                            hue={imgEl.filters?.hue ?? 0}
                            saturation={imgEl.filters?.saturation ?? 0}
                            value={imgEl.filters?.value ?? 0}
                            draggable={!el.locked}
                            onDragMove={(e)=>{
                              const rect = (e.target as any).getClientRect();
                              const st = stageRef.current as any;
                              const cx = st.width() / 2;
                              const cy = st.height() / 2;
                              let vx: number | undefined = undefined;
                              let hy: number | undefined = undefined;
                              const threshold = 5;
                              const centerX = rect.x + rect.width / 2;
                              const centerY = rect.y + rect.height / 2;
                              if (Math.abs(centerX - cx) < threshold) {
                                vx = cx;
                                e.target.x(e.target.x() + (cx - centerX));
                              }
                              if (Math.abs(centerY - cy) < threshold) {
                                hy = cy;
                                e.target.y(e.target.y() + (cy - centerY));
                              }
                              setGuides({ vx, hy });
                            }}
                            onDragEnd={(e)=>{ setGuides({}); updateSelected({ x: e.target.x(), y: e.target.y() })}}
                            onClick={()=>setSelectedId(el.id)}
                            onDragEnd={(e)=>updateSelected({ x: e.target.x(), y: e.target.y() })}
                            onTransformEnd={(e)=>{
                              const node = e.target as any;
                              updateSelected({ x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() });
                            }}
                          />
                        );
                      }
                      return null;
                    })}
                    {/* Smart Guides */}
                    {guides.vx !== undefined ? (
                      <KonvaRect x={guides.vx} y={0} width={1} height={(stageRef.current as any)?.height?.()} fill={"#7c3aed"} opacity={0.6} listening={false} />
                    ) : null}
                    {guides.hy !== undefined ? (
                      <KonvaRect x={0} y={guides.hy} width={(stageRef.current as any)?.width?.()} height={1} fill={"#7c3aed"} opacity={0.6} listening={false} />
                    ) : null}
                    <Transformer ref={trRef} rotateEnabled enabledAnchors={["top-left","top-right","bottom-left","bottom-right"]} />
                  </Layer>
                  {/* Crop overlay */}
                  {cropActive && cropRect ? (
                    <Layer>
                      <KonvaRect
                        ref={cropRectRef}
                        x={cropRect.x}
                        y={cropRect.y}
                        width={cropRect.width}
                        height={cropRect.height}
                        stroke="#00e5ff"
                        dash={[6, 4]}
                        draggable
                        onDragEnd={(e)=>{
                          setCropRect({ x: e.target.x(), y: e.target.y(), width: cropRect.width, height: cropRect.height });
                        }}
                      />
                      <Transformer ref={trCropRef} enabledAnchors={["top-left","top-right","bottom-left","bottom-right"]} rotateEnabled={false} />
                    </Layer>
                  ) : null}
                </Stage>
              ) : (
                <div className="p-6 text-sm text-muted-foreground">Load an image to start editing.</div>
              )}
              {emojiOpen ? (
                <div style={{ position: 'absolute', right: 16, top: 16, zIndex: 20 }}>
                  <div className="rounded-lg border bg-background shadow-lg">
                    <ErrorBoundary>
                      <React.Suspense fallback={<div className="p-3 text-sm">Loading emojis…</div>}>
                        <LazyPicker data={data} onEmojiSelect={(emoji:any)=>{ addTextElement(emoji?.native || emoji?.shortcodes || '😀'); setEmojiOpen(false); }} />
                      </React.Suspense>
                    </ErrorBoundary>
                  </div>
                </div>
              ) : null}
              {editingId && editorStyle ? (
                <input
                  autoFocus
                  value={editingValue}
                  onChange={(e)=>setEditingValue(e.target.value)}
                  onBlur={()=>{ updateSelected({ text: editingValue } as Partial<TextElement>); setEditingId(null); setEditorStyle(null); }}
                  onKeyDown={(e)=>{
                    if (e.key === 'Enter') { updateSelected({ text: editingValue } as Partial<TextElement>); setEditingId(null); setEditorStyle(null); }
                    if (e.key === 'Escape') { setEditingId(null); setEditorStyle(null); }
                  }}
                  style={{ position: 'absolute', left: editorStyle.left, top: editorStyle.top, width: editorStyle.width, background: '#111', color: '#fff', border: '1px solid #444', borderRadius: 6, padding: '6px 8px', outline: 'none', zIndex: 10 }}
                />
              ) : null}
              {editingId && editorStyle ? (() => {
                const el = elements.find((e) => e.id === editingId);
                if (!el || el.type !== 'text') return null;
                const t = el as TextElement;
                return (
                  <div style={{ position: 'absolute', left: editorStyle.left + editorStyle.width + 8, top: editorStyle.top, background: '#0f0f14', border: '1px solid #34343c', borderRadius: 8, padding: '8px', zIndex: 11, width: 220, boxShadow: '0 6px 24px rgba(0,0,0,0.4)' }}>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Font Size</label>
                        <input type="range" min={12} max={160} step={2} value={t.fontSize} onChange={(e)=>updateSelected({ fontSize: Number(e.target.value) } as Partial<TextElement>)} className="w-full" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Fill</label>
                          <input type="color" className="w-full h-8" value={t.fill} onChange={(e)=>updateSelected({ fill: e.target.value } as Partial<TextElement>)} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Stroke</label>
                          <input type="color" className="w-full h-8" value={t.stroke ?? '#000000'} onChange={(e)=>updateSelected({ stroke: e.target.value } as Partial<TextElement>)} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Stroke Width</label>
                        <input type="range" min={0} max={8} step={1} value={t.strokeWidth ?? 0} onChange={(e)=>updateSelected({ strokeWidth: Number(e.target.value) } as Partial<TextElement>)} className="w-full" />
                      </div>
                      <div className="grid grid-cols-3 gap-1 items-center">
                        <label className="text-xs text-muted-foreground col-span-1">Align</label>
                        <select className="col-span-2 h-8 bg-input border border-border rounded-md px-2" value={t.align ?? 'left'} onChange={(e)=>updateSelected({ align: e.target.value as any } as Partial<TextElement>)}>
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-1 items-center">
                        <label className="text-xs text-muted-foreground col-span-1">Shadow</label>
                        <input type="color" className="col-span-1 h-8" value={t.shadowColor ?? '#000000'} onChange={(e)=>updateSelected({ shadowColor: e.target.value } as Partial<TextElement>)} />
                        <input type="range" className="col-span-1" min={0} max={24} step={1} value={t.shadowBlur ?? 0} onChange={(e)=>updateSelected({ shadowBlur: Number(e.target.value) } as Partial<TextElement>)} />
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80" onClick={()=>{ setEditingId(null); setEditorStyle(null); }}>Done</button>
                      </div>
                    </div>
                  </div>
                );
              })() : null}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Inspector</h3>
            {selectedId ? (
              (() => {
                const el = elements.find((e) => e.id === selectedId)!;
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm">Visibility</label>
                      <button className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80" onClick={()=>updateSelected({ hidden: !(el as any).hidden })}>{(el as any).hidden ? 'Show' : 'Hide'}</button>
                      <button className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80" onClick={()=>updateSelected({ locked: !(el as any).locked })}>{(el as any).locked ? 'Unlock' : 'Lock'}</button>
                    </div>
                    <div>
                      <label className="text-sm">Opacity</label>
                      <input type="range" min={0} max={1} step={0.05} value={el.opacity ?? 1} onChange={(e)=>updateSelected({ opacity: Number(e.target.value) })} className="w-full" />
                    </div>
                    <div>
                      <label className="text-sm">Blend Mode</label>
                      <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={el.blendMode ?? 'source-over'} onChange={(e)=>updateSelected({ blendMode: e.target.value as BlendMode })}>
                        <option value="source-over">Normal</option>
                        <option value="multiply">Multiply</option>
                        <option value="screen">Screen</option>
                        <option value="overlay">Overlay</option>
                        <option value="darken">Darken</option>
                        <option value="lighten">Lighten</option>
                      </select>
                    </div>
                    {el.type === 'text' ? (
                      <>
                        <div>
                          <label className="text-sm">Text</label>
                          <Input value={(el as TextElement).text} onChange={(e)=>updateSelected({ text: e.target.value } as Partial<TextElement>)} />
                        </div>
                        <div>
                          <label className="text-sm">Font Size</label>
                          <input type="range" min={12} max={160} step={2} value={(el as TextElement).fontSize} onChange={(e)=>updateSelected({ fontSize: Number(e.target.value) } as Partial<TextElement>)} className="w-full" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-sm">Font Family</label>
                            <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={(el as TextElement).fontFamily ?? ''} onChange={(e)=>updateSelected({ fontFamily: e.target.value } as Partial<TextElement>)}>
                              <option value="Inter">Inter</option>
                              <option value="Noto Sans Devanagari">Noto Sans Devanagari</option>
                              <option value="Noto Sans">Noto Sans</option>
                              <option value="Roboto">Roboto</option>
                              <option value="Poppins">Poppins</option>
                              <option value="Oswald">Oswald</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm">Style</label>
                            <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={(el as TextElement).fontStyle ?? 'normal'} onChange={(e)=>updateSelected({ fontStyle: e.target.value as any } as Partial<TextElement>)}>
                              <option value="normal">Normal</option>
                              <option value="bold">Bold</option>
                              <option value="italic">Italic</option>
                              <option value="bold italic">Bold Italic</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-sm">Line Height</label>
                            <input type="range" min={0.8} max={2} step={0.05} value={(el as TextElement).lineHeight ?? 1.2} onChange={(e)=>updateSelected({ lineHeight: Number(e.target.value) } as Partial<TextElement>)} className="w-full" />
                          </div>
                          <div>
                            <label className="text-sm">Letter Spacing</label>
                            <input type="range" min={-2} max={8} step={0.5} value={(el as TextElement).letterSpacing ?? 0} onChange={(e)=>updateSelected({ letterSpacing: Number(e.target.value) } as Partial<TextElement>)} className="w-full" />
                          </div>
                        </div>
                        <div>
                          <label className="text-sm">Fill</label>
                          <input type="color" value={(el as TextElement).fill} onChange={(e)=>updateSelected({ fill: e.target.value } as Partial<TextElement>)} className="w-full h-10" />
                        </div>
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" id="textGrad" checked={(el as TextElement).gradient?.enabled ?? false} onChange={(e)=>{
                              const g = { enabled: e.target.checked, color1: (el as TextElement).gradient?.color1 ?? '#ffffff', color2: (el as TextElement).gradient?.color2 ?? '#999999', horizontal: (el as TextElement).gradient?.horizontal ?? true };
                              updateSelected({ gradient: g } as Partial<TextElement>);
                            }} />
                            <label htmlFor="textGrad" className="text-sm">Gradient</label>
                          </div>
                          <input type="color" className="h-10" value={(el as TextElement).gradient?.color1 ?? '#ffffff'} onChange={(e)=>{
                            const g = { ...(el as TextElement).gradient, enabled: true, color1: e.target.value };
                            updateSelected({ gradient: g } as Partial<TextElement>);
                          }} />
                          <input type="color" className="h-10" value={(el as TextElement).gradient?.color2 ?? '#999999'} onChange={(e)=>{
                            const g = { ...(el as TextElement).gradient, enabled: true, color2: e.target.value };
                            updateSelected({ gradient: g } as Partial<TextElement>);
                          }} />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm">Horizontal</label>
                          <input type="checkbox" checked={(el as TextElement).gradient?.horizontal ?? true} onChange={(e)=>{
                            const g = { ...(el as TextElement).gradient, horizontal: e.target.checked };
                            updateSelected({ gradient: g } as Partial<TextElement>);
                          }} />
                        </div>
                        <div>
                          <label className="text-sm">Stroke</label>
                          <input type="color" value={(el as TextElement).stroke ?? '#000000'} onChange={(e)=>updateSelected({ stroke: e.target.value } as Partial<TextElement>)} className="w-full h-10" />
                        </div>
                        <div>
                          <label className="text-sm">Stroke Width</label>
                          <input type="range" min={0} max={8} step={1} value={(el as TextElement).strokeWidth ?? 0} onChange={(e)=>updateSelected({ strokeWidth: Number(e.target.value) } as Partial<TextElement>)} className="w-full" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                          <div>
                            <label className="text-sm">Decoration</label>
                            <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={(el as TextElement).textDecoration ?? 'none'} onChange={(e)=>updateSelected({ textDecoration: e.target.value as any } as Partial<TextElement>)}>
                              <option value="none">None</option>
                              <option value="underline">Underline</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={()=>updateSelected({ x: (el.x ?? 0) - 1 } as any)}>←</Button>
                            <Button variant="outline" onClick={()=>updateSelected({ x: (el.x ?? 0) + 1 } as any)}>→</Button>
                            <Button variant="outline" onClick={()=>updateSelected({ y: (el.y ?? 0) - 1 } as any)}>↑</Button>
                            <Button variant="outline" onClick={()=>updateSelected({ y: (el.y ?? 0) + 1 } as any)}>↓</Button>
                          </div>
                        </div>
                      </>
                    ) : null}
                    {el.type === 'rect' ? (
                      <>
                        <div>
                          <label className="text-sm">Fill</label>
                          <input type="color" value={(el as RectElement).fill ?? '#000000'} onChange={(e)=>updateSelected({ fill: e.target.value } as Partial<RectElement>)} className="w-full h-10" />
                        </div>
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" id="rectGrad" checked={(el as RectElement).gradient?.enabled ?? false} onChange={(e)=>{
                              const g = { enabled: e.target.checked, color1: (el as RectElement).gradient?.color1 ?? '#000000', color2: (el as RectElement).gradient?.color2 ?? '#333333', horizontal: (el as RectElement).gradient?.horizontal ?? true };
                              updateSelected({ gradient: g } as Partial<RectElement>);
                            }} />
                            <label htmlFor="rectGrad" className="text-sm">Gradient</label>
                          </div>
                          <input type="color" className="h-10" value={(el as RectElement).gradient?.color1 ?? '#000000'} onChange={(e)=>{
                            const g = { ...(el as RectElement).gradient, enabled: true, color1: e.target.value };
                            updateSelected({ gradient: g } as Partial<RectElement>);
                          }} />
                          <input type="color" className="h-10" value={(el as RectElement).gradient?.color2 ?? '#333333'} onChange={(e)=>{
                            const g = { ...(el as RectElement).gradient, enabled: true, color2: e.target.value };
                            updateSelected({ gradient: g } as Partial<RectElement>);
                          }} />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm">Horizontal</label>
                          <input type="checkbox" checked={(el as RectElement).gradient?.horizontal ?? true} onChange={(e)=>{
                            const g = { ...(el as RectElement).gradient, horizontal: e.target.checked };
                            updateSelected({ gradient: g } as Partial<RectElement>);
                          }} />
                        </div>
                        <div>
                          <label className="text-sm">Stroke</label>
                          <input type="color" value={(el as RectElement).stroke ?? '#ffffff'} onChange={(e)=>updateSelected({ stroke: e.target.value } as Partial<RectElement>)} className="w-full h-10" />
                        </div>
                        <div>
                          <label className="text-sm">Stroke Width</label>
                          <input type="range" min={0} max={12} step={1} value={(el as RectElement).strokeWidth ?? 0} onChange={(e)=>updateSelected({ strokeWidth: Number(e.target.value) } as Partial<RectElement>)} className="w-full" />
                        </div>
                        <div>
                          <label className="text-sm">Corner Radius</label>
                          <input type="range" min={0} max={64} step={2} value={(el as RectElement).cornerRadius ?? 0} onChange={(e)=>updateSelected({ cornerRadius: Number(e.target.value) } as Partial<RectElement>)} className="w-full" />
                        </div>
                      </>
                    ) : null}
                    {el.type === 'image' ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" onClick={() => {
                            const imgEl = el as ImageElement;
                            // initialize crop rect in stage coords
                            const natW = bgImageObj?.naturalWidth ?? 1000;
                            const natH = bgImageObj?.naturalHeight ?? 1000;
                            const displayW = (imgEl.crop?.width ?? natW) * (imgEl.scaleX ?? 1);
                            const displayH = (imgEl.crop?.height ?? natH) * (imgEl.scaleY ?? 1);
                            const init = {
                              x: imgEl.x + displayW * 0.1,
                              y: imgEl.y + displayH * 0.1,
                              width: displayW * 0.8,
                              height: displayH * 0.8,
                            };
                            setCropRect(init);
                            setCropActive(true);
                          }}>Start Crop</Button>
                          <Button variant="outline" onClick={() => {
                            if (!cropRect) return;
                            const imgEl = el as ImageElement;
                            const scaleX = imgEl.scaleX ?? 1;
                            const scaleY = imgEl.scaleY ?? 1;
                            const crop = {
                              x: Math.max(0, Math.round((cropRect.x - imgEl.x) / scaleX)),
                              y: Math.max(0, Math.round((cropRect.y - imgEl.y) / scaleY)),
                              width: Math.round(cropRect.width / scaleX),
                              height: Math.round(cropRect.height / scaleY),
                            };
                            updateSelected({ crop } as Partial<ImageElement>);
                            setCropActive(false);
                            setCropRect(null);
                          }}>Apply Crop</Button>
                          <Button variant="outline" onClick={() => { setCropActive(false); setCropRect(null); }}>Cancel</Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm">Image Presets:</span>
                          <Button variant="outline" onClick={()=>{
                            const filters = { brightness: -0.1, contrast: 0.2, saturation: -0.2, hue: -10 };
                            updateSelected({ filters } as Partial<ImageElement>);
                          }}>Moody</Button>
                          <Button variant="outline" onClick={()=>{
                            const filters = { brightness: 0.1, contrast: 0.2, saturation: 0.4, hue: 10 };
                            updateSelected({ filters } as Partial<ImageElement>);
                          }}>Vibrant</Button>
                          <Button variant="outline" onClick={()=>{
                            const filters = { grayscale: true, brightness: 0, contrast: 0 };
                            updateSelected({ filters } as Partial<ImageElement>);
                          }}>B&amp;W</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-sm">Blur</label>
                            <input type="range" min={0} max={24} step={1} value={(el as ImageElement).filters?.blur ?? 0} onChange={(e)=>{
                              const v = Number(e.target.value);
                              const filters = { ...(el as ImageElement).filters, blur: v };
                              updateSelected({ filters } as Partial<ImageElement>);
                            }} className="w-full" />
                          </div>
                          <div>
                            <label className="text-sm">Brightness</label>
                            <input type="range" min={-1} max={1} step={0.05} value={(el as ImageElement).filters?.brightness ?? 0} onChange={(e)=>{
                              const v = Number(e.target.value);
                              const filters = { ...(el as ImageElement).filters, brightness: v };
                              updateSelected({ filters } as Partial<ImageElement>);
                            }} className="w-full" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-sm">Contrast</label>
                            <input type="range" min={-1} max={1} step={0.05} value={(el as ImageElement).filters?.contrast ?? 0} onChange={(e)=>{
                              const v = Number(e.target.value);
                              const filters = { ...(el as ImageElement).filters, contrast: v };
                              updateSelected({ filters } as Partial<ImageElement>);
                            }} className="w-full" />
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" id="imgGray" checked={(el as ImageElement).filters?.grayscale ?? false} onChange={(e)=>{
                              const filters = { ...(el as ImageElement).filters, grayscale: e.target.checked };
                              updateSelected({ filters } as Partial<ImageElement>);
                            }} />
                            <label htmlFor="imgGray" className="text-sm">Grayscale</label>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-sm">Hue</label>
                            <input type="range" min={-180} max={180} step={5} value={(el as ImageElement).filters?.hue ?? 0} onChange={(e)=>{
                              const v = Number(e.target.value);
                              const filters = { ...(el as ImageElement).filters, hue: v };
                              updateSelected({ filters } as Partial<ImageElement>);
                            }} className="w-full" />
                          </div>
                          <div>
                            <label className="text-sm">Sat</label>
                            <input type="range" min={-2} max={2} step={0.1} value={(el as ImageElement).filters?.saturation ?? 0} onChange={(e)=>{
                              const v = Number(e.target.value);
                              const filters = { ...(el as ImageElement).filters, saturation: v };
                              updateSelected({ filters } as Partial<ImageElement>);
                            }} className="w-full" />
                          </div>
                          <div>
                            <label className="text-sm">Value</label>
                            <input type="range" min={-2} max={2} step={0.1} value={(el as ImageElement).filters?.value ?? 0} onChange={(e)=>{
                              const v = Number(e.target.value);
                              const filters = { ...(el as ImageElement).filters, value: v };
                              updateSelected({ filters } as Partial<ImageElement>);
                            }} className="w-full" />
                          </div>
                        </div>
                      </>
                    ) : null}
                    {el.type === 'textPath' ? (
                      <>
                        <div>
                          <label className="text-sm">Text</label>
                          <Input value={(el as TextPathElement).text} onChange={(e)=>updateSelected({ text: e.target.value } as Partial<TextPathElement>)} />
                        </div>
                        <div>
                          <label className="text-sm">Font Size</label>
                          <input type="range" min={12} max={160} step={2} value={(el as TextPathElement).fontSize} onChange={(e)=>updateSelected({ fontSize: Number(e.target.value) } as Partial<TextPathElement>)} className="w-full" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-sm">Font Family</label>
                            <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={(el as TextPathElement).fontFamily ?? ''} onChange={(e)=>updateSelected({ fontFamily: e.target.value } as Partial<TextPathElement>)}>
                              <option value="Inter">Inter</option>
                              <option value="Noto Sans Devanagari">Noto Sans Devanagari</option>
                              <option value="Noto Sans">Noto Sans</option>
                              <option value="Roboto">Roboto</option>
                              <option value="Poppins">Poppins</option>
                              <option value="Oswald">Oswald</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm">Style</label>
                            <select className="w-full h-10 bg-input border border-border rounded-md px-2" value={(el as TextPathElement).fontStyle ?? 'normal'} onChange={(e)=>updateSelected({ fontStyle: e.target.value as any } as Partial<TextPathElement>)}>
                              <option value="normal">Normal</option>
                              <option value="bold">Bold</option>
                              <option value="italic">Italic</option>
                              <option value="bold italic">Bold Italic</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" id="tpGrad" checked={(el as TextPathElement).gradient?.enabled ?? false} onChange={(e)=>{
                              const g = { enabled: e.target.checked, color1: (el as TextPathElement).gradient?.color1 ?? '#ffffff', color2: (el as TextPathElement).gradient?.color2 ?? '#999999', horizontal: (el as TextPathElement).gradient?.horizontal ?? true };
                              updateSelected({ gradient: g } as Partial<TextPathElement>);
                            }} />
                            <label htmlFor="tpGrad" className="text-sm">Gradient</label>
                          </div>
                          <input type="color" className="h-10" value={(el as TextPathElement).gradient?.color1 ?? '#ffffff'} onChange={(e)=>{
                            const g = { ...(el as TextPathElement).gradient, enabled: true, color1: e.target.value };
                            updateSelected({ gradient: g } as Partial<TextPathElement>);
                          }} />
                          <input type="color" className="h-10" value={(el as TextPathElement).gradient?.color2 ?? '#999999'} onChange={(e)=>{
                            const g = { ...(el as TextPathElement).gradient, enabled: true, color2: e.target.value };
                            updateSelected({ gradient: g } as Partial<TextPathElement>);
                          }} />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm">Horizontal</label>
                          <input type="checkbox" checked={(el as TextPathElement).gradient?.horizontal ?? true} onChange={(e)=>{
                            const g = { ...(el as TextPathElement).gradient, horizontal: e.target.checked };
                            updateSelected({ gradient: g } as Partial<TextPathElement>);
                          }} />
                        </div>
                        <div>
                          <label className="text-sm">Path Radius</label>
                          <input type="range" min={50} max={Math.min(bgImageObj?.naturalWidth ?? 1000, bgImageObj?.naturalHeight ?? 1000) / 2} step={10} value={200} onChange={(e)=>{
                            const r = Number(e.target.value);
                            const w = bgImageObj?.naturalWidth ?? 1000;
                            const h = bgImageObj?.naturalHeight ?? 1000;
                            const cx = w / 2;
                            const cy = h * 0.2;
                            const data = arcPath(cx, cy, r, 200, -20);
                            updateSelected({ data } as Partial<TextPathElement>);
                          }} className="w-full" />
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })()
            ) : (
              <div className="text-sm text-muted-foreground">Select an element to edit.</div>
            )}
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
              <div className="text-sm text-muted-foreground">Export Poster to preview.</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={()=>{ if (!posterUrl) { toast.error('Build Poster first'); return; } const a=document.createElement('a'); a.href=posterUrl; a.download=`poster-${Date.now()}.png`; a.click(); }}>Download Poster</Button>
          <Button variant="secondary" onClick={()=>{ if (!imageUrl) { toast.error('No image'); return; } const a=document.createElement('a'); a.href=imageUrl; a.download=`original-${Date.now()}.png`; a.click(); }}>Download Original</Button>
          <Button variant="outline" onClick={()=>undo()}>Undo</Button>
          <Button variant="outline" onClick={()=>redo()}>Redo</Button>
        </div>
      </div>
    </div>
    </EditorErrorBoundary>
  );
};

export default PosterEditor;