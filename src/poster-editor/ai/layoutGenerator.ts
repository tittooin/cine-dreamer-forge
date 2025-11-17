import { callOpenAILayout } from './aiClient';
import { generatePalettes } from './paletteGenerator';

type Input = {
  type: 'generate_layout';
  prompt: string;
  canvas: { width: number; height: number };
  variant?: number;
};

export async function generateLayout(input: Input): Promise<any> {
  // Try OpenAI if key present
  try {
    if (import.meta.env.VITE_OPENAI_API_KEY) {
      const out = await callOpenAILayout(input);
      return out;
    }
  } catch (_) {
    // fall through to heuristics
  }

  // Heuristic layout fallback: background, headline, subtitle, CTA, decorative rect
  const palettes = generatePalettes();
  const palette = palettes[(input.variant ?? 0) % palettes.length].colors;
  const [bg, c1, c2, c3] = palette;
  const w = input.canvas.width, h = input.canvas.height;

  const canvasJSON = {
    version: '5.2.4',
    objects: [
      { type: 'textbox', left: Math.round(w * 0.08), top: Math.round(h * 0.12), text: 'Aanya\'s Birthday', fontSize: Math.round(h * 0.08), fontFamily: 'Playfair Display', fill: '#111827', fontWeight: '700', textAlign: 'left' },
      { type: 'textbox', left: Math.round(w * 0.08), top: Math.round(h * 0.22), text: 'Join us for a celebration', fontSize: Math.round(h * 0.04), fontFamily: 'Inter', fill: '#111827', fontWeight: '400', textAlign: 'left' },
      { type: 'textbox', left: Math.round(w * 0.08), top: Math.round(h * 0.85), text: 'RSVP Now →', fontSize: Math.round(h * 0.05), fontFamily: 'Inter', fill: '#ffffff', fontWeight: '700', textAlign: 'left' },
      { type: 'rect', left: Math.round(w * 0.05), top: Math.round(h * 0.70), width: Math.round(w * 0.90), height: Math.round(h * 0.12), fill: c1, angle: -2 },
      { type: 'rect', left: 0, top: 0, width: Math.round(w * 0.25), height: h, fill: c2 },
      { type: 'rect', left: Math.round(w * 0.7), top: Math.round(h * 0.15), width: Math.round(w * 0.25), height: Math.round(h * 0.4), fill: c3 },
    ],
    background: bg,
  };

  return {
    background: bg,
    colorPalette: palette,
    fonts: { heading: 'Playfair Display', body: 'Inter' },
    canvasJSON,
  };
}