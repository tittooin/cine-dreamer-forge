// Apply Fabric.js patches based on op_type
export async function applyPatch(canvas, patch) {
  const { op_type, object_id, payload } = patch;
  if (!canvas) return;
  const mod = await import('fabric');
  const fabric = mod.fabric;

  const findObject = (id) => {
    const objs = canvas.getObjects();
    return objs.find((o) => o.id === id);
  };

  switch (op_type) {
    case 'add': {
      try {
        const obj = payload.object ? { ...payload.object } : null;
        if (obj) {
          if (!obj.id) obj.id = payload.object_id || crypto.randomUUID();
          const created = fabric.util.enlivenObjects([obj], (enlivened) => {
            if (enlivened && enlivened[0]) {
              canvas.add(enlivened[0]);
              canvas.requestRenderAll();
            }
          });
          if (created && created.then) await created;
        }
      } catch (e) {
        console.error('applyPatch add error', e);
      }
      break;
    }
    case 'remove': {
      const target = findObject(object_id);
      if (target) {
        canvas.remove(target);
        canvas.requestRenderAll();
      }
      break;
    }
    case 'modify':
    case 'transform': {
      const target = findObject(object_id);
      if (target) {
        try {
          target.set(payload.props || {});
          if (payload.coords) target.setCoords();
          canvas.requestRenderAll();
        } catch (e) {
          console.error('applyPatch modify/transform error', e);
        }
      }
      break;
    }
    case 'reorder': {
      const target = findObject(object_id);
      if (target) {
        const newIndex = payload.index ?? canvas.getObjects().length - 1;
        canvas.moveTo(target, newIndex);
        canvas.requestRenderAll();
      }
      break;
    }
    case 'replace': {
      // Replace entire canvas JSON
      const json = payload.canvas_json;
      if (json) {
        canvas.loadFromJSON(json, () => {
          canvas.requestRenderAll();
        });
      }
      break;
    }
    case 'anim-update': {
      const target = findObject(object_id);
      try {
        if (target) {
          if (payload.anim) {
            target.anim = { ...payload.anim };
          } else {
            delete target.anim;
          }
          canvas.requestRenderAll();
        }
      } catch (e) {
        console.error('applyPatch anim-update error', e);
      }
      break;
    }
    case 'media-op': {
      try {
        const handler = canvas?._onMediaPatch;
        if (typeof handler === 'function') {
          handler(payload);
        }
      } catch (e) {
        console.error('applyPatch media-op error', e);
      }
      break;
    }
    case 'effect-op': {
      try {
        const handler = canvas?._onEffectPatch;
        if (typeof handler === 'function') {
          handler(payload);
        }
      } catch (e) {
        console.error('applyPatch effect-op error', e);
      }
      break;
    }
    default:
      console.warn('Unknown op_type', op_type);
  }
}