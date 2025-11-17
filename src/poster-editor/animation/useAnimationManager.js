// Hook to manage animations per object and page
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HAS_SUPABASE = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function useAnimationManager({ canvas, pagesMgr, projectId, pageId, user, cloudEnabled = true }) {
  const [selected, setSelected] = useState(null);
  const USE_CLOUD = HAS_SUPABASE && cloudEnabled && projectId && projectId !== 'local' && !!user?.id;

  // track selected object
  useEffect(() => {
    if (!canvas) return;
    const onSel = () => setSelected(canvas.getActiveObject() || null);
    const onClear = () => setSelected(null);
    canvas.on('selection:created', onSel);
    canvas.on('selection:updated', onSel);
    canvas.on('selection:cleared', onClear);
    return () => {
      canvas.off('selection:created', onSel);
      canvas.off('selection:updated', onSel);
      canvas.off('selection:cleared', onClear);
    };
  }, [canvas]);

  const getPageAnimations = useCallback(() => {
    const p = pagesMgr.activePage || null;
    return p?.animations || [];
  }, [pagesMgr]);

  const setPageAnimations = useCallback((anims) => {
    if (!pagesMgr.activePage) return;
    const next = { ...pagesMgr.activePage, animations: anims, updated_at: new Date().toISOString() };
    const pages = pagesMgr.pages.map((p) => p.id === next.id ? next : p);
    pagesMgr.saveActivePageJSON && pagesMgr.saveActivePageJSON(next.canvas_json);
    try { localStorage.setItem(`poster:project:${projectId}:pages`, JSON.stringify(pages)); } catch {}
    // cloud upsert handled by usePagesManager autosave; also we can call upsert if needed
  }, [pagesMgr, projectId]);

  const setObjectAnim = useCallback(async (obj, anim) => {
    if (!obj) return;
    if (!obj.id) obj.id = crypto.randomUUID();
    obj.anim = { ...anim };
    const pageAnims = getPageAnimations();
    const idx = pageAnims.findIndex(a => a.object_id === obj.id);
    const nextAnims = idx >= 0 ? pageAnims.map((a,i)=> i===idx ? { ...anim, object_id: obj.id } : a) : [...pageAnims, { ...anim, object_id: obj.id }];
    setPageAnimations(nextAnims);
    if (USE_CLOUD) {
      const patch = {
        id: crypto.randomUUID(),
        project_id: projectId,
        page_id: pageId || null,
        user_id: user?.id,
        username: user?.username,
        op_type: 'anim-update',
        object_id: obj.id,
        payload: { anim, client_id: crypto.randomUUID() },
      };
      try { await supabase.from('project_live_updates').insert(patch); } catch {}
    }
    canvas.requestRenderAll();
  }, [canvas, getPageAnimations, setPageAnimations, USE_CLOUD, projectId, pageId, user]);

  const removeObjectAnim = useCallback(async (objectId) => {
    const pageAnims = getPageAnimations();
    const nextAnims = pageAnims.filter(a => a.object_id !== objectId);
    setPageAnimations(nextAnims);
    const target = canvas?.getObjects().find(o => o.id === objectId);
    if (target && target.anim) { delete target.anim; }
    if (USE_CLOUD) {
      const patch = {
        id: crypto.randomUUID(),
        project_id: projectId,
        page_id: pageId || null,
        user_id: user?.id,
        username: user?.username,
        op_type: 'anim-update',
        object_id: objectId,
        payload: { anim: null, client_id: crypto.randomUUID() },
      };
      try { await supabase.from('project_live_updates').insert(patch); } catch {}
    }
    canvas?.requestRenderAll();
  }, [canvas, getPageAnimations, setPageAnimations, USE_CLOUD, projectId, pageId, user]);

  const getObjects = useCallback(() => canvas ? canvas.getObjects() : [], [canvas]);

  return { selected, getObjects, getPageAnimations, setObjectAnim, removeObjectAnim };
}