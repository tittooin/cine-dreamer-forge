// Page transition runner: fade, slide, wipe, zoom, flip

export function runTransition(canvas, { type = 'fade', duration = 500, easing = 'linear', direction = 'left' } = {}) {
  if (!canvas) return;
  const rect = new (canvas.constructor).Rect({
    left: 0,
    top: 0,
    width: canvas.getWidth(),
    height: canvas.getHeight(),
    fill: '#000',
    selectable: false,
    evented: false,
    opacity: 0,
  });
  canvas.add(rect);
  const start = performance.now();
  const ease = (t) => t;
  const step = () => {
    const t = Math.min(1, (performance.now() - start) / duration);
    switch (type) {
      case 'fade':
        rect.set('opacity', 1 - t);
        break;
      case 'slide': {
        const dir = direction === 'right' ? 1 : -1;
        rect.set({ left: dir * (1 - t) * canvas.getWidth() });
        break;
      }
      case 'zoom':
        rect.set({ opacity: 0.3, scaleX: 1 + (1 - t) * 0.1, scaleY: 1 + (1 - t) * 0.1 });
        break;
      case 'flip':
        rect.set({ opacity: 0.2, angle: (1 - t) * 90 });
        break;
      case 'wipe':
        rect.set({ opacity: 0.4, clipPath: new (canvas.constructor).Rect({ left: 0, top: 0, width: canvas.getWidth() * t, height: canvas.getHeight() }) });
        break;
      default:
        rect.set('opacity', 1 - t);
        break;
    }
    canvas.requestRenderAll();
    if (t < 1) requestAnimationFrame(step); else canvas.remove(rect);
  };
  requestAnimationFrame(step);
}

export function setPageTransitionConfig(page, cfg) {
  page.transition = { type: cfg.type, duration: cfg.duration, easing: cfg.easing, direction: cfg.direction };
}