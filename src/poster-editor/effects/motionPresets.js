// Reusable motion presets and applicator

const EASE = {
  linear: (t) => t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutBack: (t) => {
    const c1 = 1.70158; const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
};

export const PRESETS = [
  { id: 'smooth-pop', name: 'Smooth Pop', params: { duration: 800, scaleFrom: 0.9, scaleTo: 1.05, settle: 1, easing: 'easeOutBack', glow: true } },
  { id: 'dramatic-slide', name: 'Dramatic Slide', params: { duration: 700, dx: -200, easing: 'easeOutCubic' } },
  { id: 'bouncy-entrance', name: 'Bouncy Entrance', params: { duration: 900, scaleFrom: 0.6, scaleTo: 1.1, settle: 1, easing: 'easeOutBack' } },
  { id: 'subtle-fade', name: 'Subtle Fade', params: { duration: 600, opacityFrom: 0, opacityTo: 1, easing: 'easeOutQuad' } },
  { id: 'zoom-flip', name: 'Zoom Flip', params: { duration: 1000, scaleFrom: 0.8, scaleTo: 1, rotate: 180, easing: 'easeOutCubic' } },
];

export async function applyMotionPreset(canvas, obj, preset, overrides = {}) {
  if (!canvas || !obj || !preset) return;
  const params = { ...preset.params, ...overrides };
  const easing = EASE[params.easing] || EASE.linear;
  const start = performance.now();
  const init = { left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, opacity: obj.opacity, angle: obj.angle };

  const step = () => {
    const now = performance.now();
    const t = Math.min(1, (now - start) / params.duration);
    const e = easing(t);
    // Position
    if (params.dx) obj.set('left', init.left + params.dx * (1 - (1 - e)));
    if (params.dy) obj.set('top', init.top + params.dy * (1 - (1 - e)));
    // Scale
    if (params.scaleFrom != null && params.scaleTo != null) {
      const s = params.scaleFrom + (params.scaleTo - params.scaleFrom) * e;
      obj.set({ scaleX: s, scaleY: s });
    }
    // Opacity
    if (params.opacityFrom != null && params.opacityTo != null) {
      obj.set('opacity', params.opacityFrom + (params.opacityTo - params.opacityFrom) * e);
    }
    // Rotation
    if (params.rotate) {
      obj.set('angle', init.angle + params.rotate * e);
    }
    canvas.requestRenderAll();
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      // settle final scale
      if (params.settle) obj.set({ scaleX: params.settle, scaleY: params.settle });
      canvas.requestRenderAll();
    }
  };
  requestAnimationFrame(step);
}

export function createCustomPreset({ id, name, params }) {
  return { id, name, params };
}