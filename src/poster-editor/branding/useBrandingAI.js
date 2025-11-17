import { supabase } from '../cloud/supabaseClient';
import { makeBrandKit, PRESET_FONTS, PRESET_COLORS } from './brandKit';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const OPENAI_KEY = (import.meta.env.VITE_OPENAI_API_KEY || '').trim();
const OPENAI_MODEL = (import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini').trim();
const HAS_SUPABASE = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function heuristicKitFromPrompt(prompt){
  const p = (prompt||'').toLowerCase();
  const tone = p.includes('luxury')||p.includes('premium') ? 'luxury'
    : p.includes('modern') ? 'modern'
    : p.includes('minimal') ? 'minimal'
    : p.includes('bold') ? 'bold'
    : 'playful';
  const fonts = PRESET_FONTS[tone];
  const colors = PRESET_COLORS[tone];
  const vibe_words = Array.from(new Set((prompt||'').split(/[,\s]+/).filter(Boolean)));
  return makeBrandKit({ name: 'Auto Brand', colors, fonts, vibe_words });
}

async function callOpenAI(prompt){
  const body = {
    model: OPENAI_MODEL,
    input: `You are a branding assistant. Given this style prompt: "${prompt}", produce a JSON brand kit with keys: brand_name, colors (array of hex), fonts {heading, body, accent}, vibe_words, shadows (object), border_styles (object). Keep it compact.`,
    response_format: { type: 'json_object' },
  };
  const resp = await fetch(OPENAI_URL, { method: 'POST', headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!resp.ok) throw new Error('AI request failed');
  const json = await resp.json();
  const out = json?.output_text || json?.content?.[0]?.text || json;
  try { return JSON.parse(out); } catch { return out; }
}

export function useBrandingAI() {
  async function generateBrandKit(prompt){
    let kit;
    if (OPENAI_KEY) {
      try { kit = await callOpenAI(prompt); } catch (_) { kit = heuristicKitFromPrompt(prompt); }
    } else {
      kit = heuristicKitFromPrompt(prompt);
    }
    // normalize
    kit = makeBrandKit({ name: kit.brand_name || 'Auto Brand', colors: kit.colors || [], fonts: kit.fonts || {}, vibe_words: kit.vibe_words || [], shadows: kit.shadows || {}, border_styles: kit.border_styles || {} });
    return kit;
  }

  async function saveBrandKit(kit){
    if (!HAS_SUPABASE) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const name = kit.brand_name || 'My Brand';
    const { data, error } = await supabase.from('brand_kits').insert({ user_id: user.id, name, data: kit }).select('*').maybeSingle();
    if (error) throw error;
    return data;
  }

  async function listBrandKits(){
    if (!HAS_SUPABASE) return [];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase.from('brand_kits').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  return { generateBrandKit, saveBrandKit, listBrandKits };
}