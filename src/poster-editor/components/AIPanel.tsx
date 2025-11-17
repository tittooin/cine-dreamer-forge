import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { fabric as FabricNS } from 'fabric';
import { generateLayout } from '../ai/layoutGenerator';
import { generateSuggestions } from '../ai/suggestions';
import { generatePalettes, PaletteSet } from '../ai/paletteGenerator';
import { smartResize } from '../ai/resizeEngine';
import { getFontPairs, loadGoogleFont } from '../ai/fontPairing';
import { saveAiTemplate } from '../cloud/aiTemplatesApi';

type Props = {
  fabric: typeof FabricNS | null;
  canvas: FabricNS.Canvas | null;
  applyCanvasJSON: (json: any) => void;
  onApplyBgColor: (color: string) => void;
  onSaveTemplate?: (name: string) => Promise<void>;
};

const AIPanel: React.FC<Props> = ({ fabric, canvas, applyCanvasJSON, onApplyBgColor }) => {
  const [prompt, setPrompt] = useState<string>('Birthday invitation poster for Aanya, floral pastel elegant');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [palettes, setPalettes] = useState<PaletteSet[]>([]);
  const [fontPairs, setFontPairs] = useState<{ heading: string; body: string; accent?: string }[]>([]);
  const [resizePreset, setResizePreset] = useState<'square' | 'youtube' | 'facebook' | 'a4' | null>(null);

  const size = useMemo(() => ({ width: canvas?.getWidth() || 1080, height: canvas?.getHeight() || 1920 }), [canvas]);

  const handleGenerate = async (variant = 0) => {
    if (!canvas) return;
    setBusy(true); setError(null);
    try {
      const layout = await generateLayout({
        type: 'generate_layout',
        prompt,
        canvas: { width: size.width, height: size.height },
        variant,
      });

      if (layout.background) onApplyBgColor(layout.background);

      if (layout.canvasJSON) {
        applyCanvasJSON(layout.canvasJSON);
      } else if (layout.objects && fabric) {
        // Fallback: build directly into canvas
        canvas.clear();
        layout.objects.forEach((obj: any) => {
          if (obj.type === 'textbox') {
            const t = new (fabric as any).Textbox(obj.text || '', { left: obj.left || 80, top: obj.top || 80, fontSize: obj.fontSize || 64, fontFamily: obj.fontFamily || 'Poppins', fill: obj.fill || '#111827', fontWeight: obj.fontWeight || '700', textAlign: obj.textAlign || 'center' });
            canvas.add(t);
          } else if (obj.type === 'rect') {
            const r = new (fabric as any).Rect({ left: obj.left || 40, top: obj.top || 40, width: obj.width || 300, height: obj.height || 200, fill: obj.fill || '#FEC5BB', angle: obj.angle || 0 });
            canvas.add(r);
          }
        });
        canvas.renderAll();
      }

      // Ensure fonts are loaded if provided
      if (layout.fonts) {
        const fonts = Object.values(layout.fonts).filter(Boolean) as string[];
        for (const f of fonts) await loadGoogleFont(f);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to generate layout');
    } finally { setBusy(false); }
  };

  const handleSuggestions = () => {
    if (!canvas) return;
    const json = canvas.toJSON();
    setSuggestions(generateSuggestions(json));
  };

  const handlePalettes = () => {
    setPalettes(generatePalettes());
  };

  const applyPalette = (palette: string[]) => {
    if (!canvas) return;
    const [bg, ...others] = palette;
    onApplyBgColor(bg);
    const objs = canvas.getObjects();
    let i = 0;
    objs.forEach(o => {
      if ((o as any).fill && typeof (o as any).fill === 'string') {
        (o as any).set('fill', others[i % others.length]);
        i++;
      }
    });
    canvas.renderAll();
  };

  const handleFonts = async () => {
    const theme = prompt.toLowerCase().includes('elegant') ? 'elegant' : prompt.toLowerCase().includes('retro') ? 'retro' : 'default';
    const pairs = getFontPairs(theme);
    setFontPairs(pairs);
  };

  const applyFontPair = async (pair: { heading: string; body: string }) => {
    if (!canvas) return;
    await loadGoogleFont(pair.heading);
    await loadGoogleFont(pair.body);
    const objs = canvas.getObjects();
    objs.forEach((o, idx) => {
      if (o.type === 'textbox' || o.type === 'text') {
        (o as any).set('fontFamily', idx === 0 ? pair.heading : pair.body);
      }
    });
    canvas.renderAll();
  };

  const handleResize = () => {
    if (!canvas || !resizePreset) return;
    const target = resizePreset === 'square' ? { width: 1080, height: 1080 } : resizePreset === 'youtube' ? { width: 1280, height: 720 } : resizePreset === 'facebook' ? { width: 1200, height: 628 } : { width: 2480, height: 3508 };
    const oldJSON = canvas.toJSON();
    const newJSON = smartResize(oldJSON, { width: size.width, height: size.height }, target);
    canvas.setWidth(target.width);
    canvas.setHeight(target.height);
    applyCanvasJSON(newJSON);
  };

  const handleSaveAsTemplate = async () => {
    if (!canvas) return;
    const preview = canvas.toDataURL({ format: 'png', quality: 0.9 });
    const json = canvas.toJSON();
    try {
      await saveAiTemplate({ prompt, canvas_json: json, preview_data_url: preview });
    } catch (e) {
      // non-blocking
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">AI Designer</h3>
      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your poster theme" />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => handleGenerate(0)} disabled={busy}>Generate Layout</Button>
        <Button variant="outline" onClick={() => handleGenerate(1)} disabled={busy}>Generate Variation</Button>
        <Button variant="outline" onClick={handleSuggestions}>AI Suggestions</Button>
        <Button variant="outline" onClick={handlePalettes}>AI Color Palettes</Button>
        <Button variant="outline" onClick={handleFonts}>Font Pairing</Button>
        <Button variant="secondary" onClick={handleSaveAsTemplate}>Save as Template</Button>
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}

      {!!suggestions.length && (
        <div className="rounded-md border p-2">
          <div className="text-xs font-medium mb-1">Suggestions</div>
          <ul className="list-disc ml-4 text-xs">
            {suggestions.map((s, i) => (<li key={i}>{s}</li>))}
          </ul>
        </div>
      )}

      {!!palettes.length && (
        <div className="rounded-md border p-2 space-y-2">
          <div className="text-xs font-medium">Palettes</div>
          {palettes.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs w-20">{p.name}</span>
              {p.colors.map((c, j) => (
                <button key={j} className="w-6 h-6 rounded border" style={{ background: c }} title={c} onClick={() => applyPalette(p.colors)} />
              ))}
            </div>
          ))}
        </div>
      )}

      {!!fontPairs.length && (
        <div className="rounded-md border p-2 space-y-2">
          <div className="text-xs font-medium">Font Pairs</div>
          {fontPairs.map((fp, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-40">{fp.heading} + {fp.body}</span>
              <Button size="sm" variant="outline" onClick={() => applyFontPair(fp)}>Apply</Button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-md border p-2 space-y-2">
        <div className="text-xs font-medium">Smart Resize</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'square', label: 'Instagram 1080×1080' },
            { id: 'youtube', label: 'YouTube 1280×720' },
            { id: 'facebook', label: 'Facebook 1200×628' },
            { id: 'a4', label: 'A4 2480×3508' },
          ].map(p => (
            <button key={p.id} className={`px-2 py-1 rounded border text-xs ${resizePreset===p.id ? 'bg-muted' : ''}`} onClick={() => setResizePreset(p.id as any)}>
              {p.label}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={handleResize}>Apply Resize</Button>
      </div>
    </div>
  );
};

export default AIPanel;