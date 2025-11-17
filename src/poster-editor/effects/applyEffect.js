// Effect application utilities for Fabric.js objects
// Supports: blur (images), shadow, glow, blend (globalCompositeOperation), vignette (overlay), lut (placeholder)

export function ensureEffectStack(obj) {
  if (!obj) return;
  if (!Array.isArray(obj.effects)) obj.effects = [];
}

export async function applyEffects(canvas, obj, opts = { preview: true }) {
  if (!canvas || !obj) return;
  ensureEffectStack(obj);
  const mod = await import('fabric');
  const fabric = mod.fabric;

  // Clear previous states likely affected by effects
  obj.set({ shadow: null, globalCompositeOperation: undefined });

  // Image filters (WebGL-backed in Fabric when available)
  const isImage = obj.type === 'image' || obj._element instanceof Image;
  if (isImage) {
    obj.filters = [];
  }

  const stack = obj.effects.filter(e => e && e.enabled !== false);
  for (const eff of stack) {
    const type = eff.type;
    const p = eff.params || {};
    switch (type) {
      case 'blur': {
        if (isImage) {
          const Blur = fabric.Image.filters.Blur;
          obj.filters.push(new Blur({ blur: Math.max(0, Number(p.value || 0)) / 10 }));
        } else {
          // Fallback: soft shadow with zero offsets to simulate blur
          obj.set({ shadow: { color: 'rgba(0,0,0,0.001)', blur: Math.max(0, Number(p.value || 0)) * 2, offsetX: 0, offsetY: 0 } });
        }
        break;
      }
      case 'shadow': {
        obj.set({ shadow: { color: p.color || 'rgba(0,0,0,0.5)', blur: Math.max(0, Number(p.blur || 8)), offsetX: Number(p.offsetX || 4), offsetY: Number(p.offsetY || 4) } });
        break;
      }
      case 'glow': {
        obj.set({ shadow: { color: p.color || 'rgba(255,255,255,0.7)', blur: Math.max(0, Number(p.blur || 12)), offsetX: 0, offsetY: 0 } });
        break;
      }
      case 'blend': {
        // Canvas compositing mode; not supported on all objects in all fabric versions, but generally works
        obj.set('globalCompositeOperation', p.mode || 'multiply');
        break;
      }
      case 'vignette': {
        // Vignette preview handled globally in EffectsPanel via glShaders; keep placeholder
        break;
      }
      case 'lut': {
        // Per-object LUT preview is complex; rely on global LUT pipeline; keep as serialized config only
        break;
      }
      case 'mask': {
        // TODO: optional clipPath handling; for now store-only
        break;
      }
      default:
        break;
    }
  }

  if (isImage) {
    try { obj.applyFilters(); } catch {}
  }
  obj.setCoords();
  canvas.requestRenderAll();
}

export function updateEffectStack(obj, fn) {
  ensureEffectStack(obj);
  obj.effects = fn(Array.isArray(obj.effects) ? obj.effects : []);
}

export function serializeEffects(obj) {
  ensureEffectStack(obj);
  return obj.effects.map(e => ({ id: e.id, type: e.type, params: e.params || {}, enabled: e.enabled !== false }));
}