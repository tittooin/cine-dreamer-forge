// Animation application helpers and easing functions
// Anim schema: { type, duration, delay, easing, loop }

export const EASING = {
  'linear': (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => t * (2 - t),
  'ease': (t) => (t < 0.5) ? (4 * t * t * t) : (1 - Math.pow(-2 * t + 2, 3) / 2),
};

// Precompute keyframes for an object given its animation
export function precomputeKeyframes(object, anim) {
  const frames = [];
  const duration = Math.max(1, anim.duration || 1000);
  const delay = Math.max(0, anim.delay || 0);
  const easing = EASING[anim.easing || 'ease'] || EASING['ease'];

  const start = { left: object.left || 0, top: object.top || 0, scaleX: object.scaleX || 1, scaleY: object.scaleY || 1, opacity: (object.opacity ?? 1), angle: object.angle || 0 };

  const type = anim.type || 'fade-in';
  const target = { ...start };

  switch (type) {
    case 'fade-in': target.opacity = 1; start.opacity = 0; break;
    case 'fade-out': target.opacity = 0; start.opacity = object.opacity ?? 1; break;
    case 'slide-in-left': start.left = (object.left || 0) - 200; target.left = object.left || 0; break;
    case 'slide-in-right': start.left = (object.left || 0) + 200; target.left = object.left || 0; break;
    case 'slide-in-up': start.top = (object.top || 0) - 200; target.top = object.top || 0; break;
    case 'slide-in-down': start.top = (object.top || 0) + 200; target.top = object.top || 0; break;
    case 'slide-out-left': target.left = (object.left || 0) - 200; break;
    case 'slide-out-right': target.left = (object.left || 0) + 200; break;
    case 'slide-out-up': target.top = (object.top || 0) - 200; break;
    case 'slide-out-down': target.top = (object.top || 0) + 200; break;
    case 'zoom-in': start.scaleX = start.scaleY = (object.scaleX || 1) * 0.5; target.scaleX = target.scaleY = object.scaleX || 1; break;
    case 'zoom-out': target.scaleX = target.scaleY = (object.scaleX || 1) * 0.5; break;
    case 'pop': start.scaleX = start.scaleY = (object.scaleX || 1) * 0.8; target.scaleX = target.scaleY = object.scaleX || 1.05; break;
    case 'bounce': start.top = (object.top || 0) - 40; target.top = object.top || 0; break;
    case 'rotate-in': start.angle = (object.angle || 0) - 90; target.angle = object.angle || 0; break;
    case 'rotate-out': target.angle = (object.angle || 0) + 90; break;
    case 'pulse': start.scaleX = start.scaleY = (object.scaleX || 1) * 0.95; target.scaleX = target.scaleY = (object.scaleX || 1) * 1.05; break;
    case 'breathe': start.opacity = 0.8; target.opacity = 1; break;
    case 'shake': start.left = (object.left || 0) - 10; target.left = (object.left || 0) + 10; break;
    default: break;
  }

  const steps = Math.max(8, Math.floor(duration / 33));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const e = easing(t);
    frames.push({
      time: delay + t * duration,
      left: lerp(start.left, target.left, e),
      top: lerp(start.top, target.top, e),
      scaleX: lerp(start.scaleX, target.scaleX, e),
      scaleY: lerp(start.scaleY, target.scaleY, e),
      opacity: lerp(start.opacity, target.opacity, e),
      angle: lerp(start.angle, target.angle, e),
    });
  }
  return frames;
}

function lerp(a = 0, b = 0, t = 0) { return (a ?? 0) + ((b ?? 0) - (a ?? 0)) * t; }

export function applyFrame(object, frame) {
  if (!object || !frame) return;
  try {
    if (typeof frame.left === 'number') object.set('left', frame.left);
    if (typeof frame.top === 'number') object.set('top', frame.top);
    if (typeof frame.scaleX === 'number') object.set('scaleX', frame.scaleX);
    if (typeof frame.scaleY === 'number') object.set('scaleY', frame.scaleY);
    if (typeof frame.opacity === 'number') object.set('opacity', frame.opacity);
    if (typeof frame.angle === 'number') object.set('angle', frame.angle);
    object.setCoords();
  } catch {}
}