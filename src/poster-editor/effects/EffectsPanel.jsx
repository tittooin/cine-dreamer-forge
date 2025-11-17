import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import EffectStack from './EffectStack.jsx';

export default function EffectsPanel({ canvas, projectId, pageId, user }) {
  const [livePreview, setLivePreview] = useState(true);
  const [selectedEffect, setSelectedEffect] = useState('blur');
  const [effectValue, setEffectValue] = useState(8);
  const [globalLut, setGlobalLut] = useState(null);
  const [transition, setTransition] = useState({ type: 'fade', duration: 500, easing: 'linear', direction: 'left' });
  const overlayRef = useRef(null);

  // Lazy-load heavy modules only when panel mounts
  const modRefs = useRef({});
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ applyEffects, updateEffectStack }, { BUILT_IN_LUTS }, shaders, transitions] = await Promise.all([
        import('./applyEffect.js'),
        import('./LUTManager.js'),
        import('./glShaders.js'),
        import('./transitions.js'),
      ]);
      if (!mounted) return;
      modRefs.current.applyEffects = applyEffects;
      modRefs.current.updateEffectStack = updateEffectStack;
      modRefs.current.BUILT_IN_LUTS = BUILT_IN_LUTS;
      modRefs.current.shaders = shaders;
      modRefs.current.transitions = transitions;

      // Bind realtime handler for incoming effect patches
      if (canvas) {
        canvas._onEffectPatch = async (payload) => {
          const { action } = payload || {};
          if (action === 'apply-effect') {
            const target = findObjectById(canvas, payload.object_id);
            if (!target) return;
            modRefs.current.updateEffectStack(target, (stack) => {
              const exists = stack.find((e) => e.id === payload.effect?.id);
              if (exists) {
                return stack.map((e) => e.id === exists.id ? { ...payload.effect } : e);
              } else {
                return [...stack, { ...payload.effect, enabled: payload.effect?.enabled !== false }];
              }
            });
            await modRefs.current.applyEffects(canvas, target, { preview: livePreview });
          } else if (action === 'toggle-effect') {
            const target = findObjectById(canvas, payload.object_id);
            if (!target) return;
            modRefs.current.updateEffectStack(target, (stack) => stack.map(e => e.id === payload.effect_id ? { ...e, enabled: payload.enabled } : e));
            await modRefs.current.applyEffects(canvas, target, { preview: livePreview });
          } else if (action === 'remove-effect') {
            const target = findObjectById(canvas, payload.object_id);
            if (!target) return;
            modRefs.current.updateEffectStack(target, (stack) => stack.filter(e => e.id !== payload.effect_id));
            await modRefs.current.applyEffects(canvas, target, { preview: livePreview });
          } else if (action === 'reorder-effects') {
            const target = findObjectById(canvas, payload.object_id);
            if (!target) return;
            modRefs.current.updateEffectStack(target, (stack) => {
              const idx = stack.findIndex(e => e.id === payload.effect_id);
              if (idx < 0) return stack;
              const next = [...stack];
              const [item] = next.splice(idx, 1);
              next.splice(Math.max(0, Math.min(payload.toIndex, next.length)), 0, item);
              return next;
            });
            await modRefs.current.applyEffects(canvas, target, { preview: livePreview });
          } else if (action === 'set-global-lut') {
            setGlobalLut(payload.lut);
            await updateGlobalLUTPreview();
          } else if (action === 'set-page-transition') {
            setTransition(payload.transition);
            runPageTransition();
          }
        };
      }
    })();
    return () => { mounted = false; if (canvas) canvas._onEffectPatch = null; clearOverlay(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas]);

  const findObjectById = (c, id) => {
    const objs = c.getObjects(); return objs.find(o => o.id === id);
  };

  const sendPatch = async (payload) => {
    const { sendPatch } = await import('../realtime/sendPatch.js');
    await sendPatch({ projectId, pageId, user, patch: { op_type: 'effect-op', payload } });
  };

  const applySelectedEffect = async () => {
    if (!canvas) return;
    const target = canvas.getActiveObject();
    if (!target) return;
    const eff = { id: target.id ? `${target.id}-eff-${selectedEffect}` : `eff-${Date.now()}`, type: selectedEffect, params: { value: effectValue }, enabled: true };
    await sendPatch({ action: 'apply-effect', object_id: target.id, effect: eff });
  };

  const togglePreview = async () => {
    setLivePreview((v) => !v);
    // No-op; effects applied via handler will respect current preview state
  };

  const clearOverlay = () => {
    const el = overlayRef.current; if (el && el.parentNode) el.parentNode.removeChild(el); overlayRef.current = null;
  };

  const updateGlobalLUTPreview = async () => {
    clearOverlay(); if (!canvas || !globalLut || !livePreview) return;
    try {
      const shaders = modRefs.current.shaders;
      const glCanvas = await shaders.applyLUTPreview(canvas.lowerCanvasEl, globalLut.url);
      if (glCanvas) {
        canvas.lowerCanvasEl.parentNode.appendChild(glCanvas);
        overlayRef.current = glCanvas;
      }
    } catch {}
  };

  const runPageTransition = async () => {
    if (!canvas || !transition) return;
    try { modRefs.current.transitions.runTransition(canvas, transition); } catch {}
  };

  // UI rendering
  return (
    <div className="p-3 border-t bg-muted/40 text-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Effects</div>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={livePreview} onChange={togglePreview} />
          Live preview
        </label>
      </div>

      {/* Transitions */}
      <div className="space-y-2">
        <div className="font-medium">Transitions</div>
        <div className="flex gap-2">
          <select value={transition.type} onChange={(e) => setTransition({ ...transition, type: e.target.value })} className="border rounded px-2 py-1">
            <option value="fade">Fade</option>
            <option value="slide">Slide</option>
            <option value="wipe">Wipe</option>
            <option value="zoom">Zoom</option>
            <option value="flip">Flip</option>
          </select>
          <input type="number" value={transition.duration} onChange={(e) => setTransition({ ...transition, duration: Number(e.target.value) })} className="border rounded px-2 py-1 w-24" />
          <button className="px-2 py-1 border rounded" onClick={() => sendPatch({ action: 'set-page-transition', transition })}>Apply</button>
        </div>
      </div>

      {/* Per-object effects */}
      <div className="space-y-2">
        <div className="font-medium">Per-object Effects</div>
        <div className="flex gap-2 items-center">
          <select value={selectedEffect} onChange={(e) => setSelectedEffect(e.target.value)} className="border rounded px-2 py-1">
            <option value="blur">Gaussian Blur</option>
            <option value="shadow">Shadow</option>
            <option value="glow">Glow</option>
            <option value="blend">Blend Mode</option>
            <option value="vignette">Vignette (global)</option>
            <option value="lut">LUT (global recommended)</option>
          </select>
          <input type="number" value={effectValue} onChange={(e) => setEffectValue(Number(e.target.value))} className="border rounded px-2 py-1 w-24" />
          <button className="px-2 py-1 border rounded" onClick={applySelectedEffect}>Apply to selected</button>
        </div>
        {canvas && canvas.getActiveObject() && (
          <EffectStack
            effects={(canvas.getActiveObject().effects) || []}
            onToggle={async (id) => sendPatch({ action: 'toggle-effect', object_id: canvas.getActiveObject().id, effect_id: id, enabled: !(canvas.getActiveObject().effects?.find(e => e.id===id)?.enabled) })}
            onMove={async (id, toIndex) => sendPatch({ action: 'reorder-effects', object_id: canvas.getActiveObject().id, effect_id: id, toIndex })}
            onRemove={async (id) => sendPatch({ action: 'remove-effect', object_id: canvas.getActiveObject().id, effect_id: id })}
          />
        )}
      </div>

      {/* LUTs */}
      <div className="space-y-2">
        <div className="font-medium">LUTs & Color Grading</div>
        <div className="flex gap-2 items-center">
          <select value={globalLut?.id || ''} onChange={async (e) => {
            const id = e.target.value; if (!id) return; const { BUILT_IN_LUTS } = modRefs.current; const lut = BUILT_IN_LUTS.find(x => x.id === id); setGlobalLut(lut); await sendPatch({ action: 'set-global-lut', lut });
          }} className="border rounded px-2 py-1">
            <option value="">Select LUT</option>
            {modRefs.current.BUILT_IN_LUTS && modRefs.current.BUILT_IN_LUTS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <input type="file" accept=".png,.cube" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return; const { loadLUTFromFile } = await import('./LUTManager.js'); const lut = await loadLUTFromFile(file); if (lut) { setGlobalLut(lut); await sendPatch({ action: 'set-global-lut', lut }); }
          }} />
        </div>
      </div>

      {/* Motion Presets */}
      <MotionPresetSection canvas={canvas} projectId={projectId} pageId={pageId} user={user} />
    </div>
  );
}

function MotionPresetSection({ canvas, projectId, pageId, user }) {
  const [presetId, setPresetId] = useState('smooth-pop');
  const [running, setRunning] = useState(false);
  const [presets, setPresets] = useState([]);
  useEffect(() => { (async () => { const { PRESETS } = await import('./motionPresets.js'); setPresets(PRESETS); })(); }, []);
  const applyPreset = async () => {
    if (!canvas) return; const obj = canvas.getActiveObject(); if (!obj) return;
    const { PRESETS, applyMotionPreset } = await import('./motionPresets.js');
    const preset = PRESETS.find(p => p.id === presetId); if (!preset) return;
    setRunning(true);
    await applyMotionPreset(canvas, obj, preset);
    setRunning(false);
  };
  return (
    <div className="space-y-2">
      <div className="font-medium">Motion Presets</div>
      <div className="flex gap-2 items-center">
        <select value={presetId} onChange={(e) => setPresetId(e.target.value)} className="border rounded px-2 py-1">
          {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="px-2 py-1 border rounded" disabled={running} onClick={applyPreset}>Apply to selected</button>
        {!canvas?.getActiveObject() && <span className="text-muted-foreground">Select an object to apply</span>}
      </div>
    </div>
  );
}