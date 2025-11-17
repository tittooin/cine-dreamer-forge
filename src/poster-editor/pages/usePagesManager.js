import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Utility: detect Supabase env
const HAS_SUPABASE = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function lsKey(projectId) {
  return `poster:project:${projectId}:pages`;
}

function normalizePages(rows) {
  const pages = (rows || []).map((r) => ({
    id: r.id,
    name: r.name || 'Page',
    page_index: r.page_index ?? 0,
    canvas_json: r.canvas_json || { objects: [], background: '#111827' },
    animations: r.animations || [],
    thumbnail_url: r.thumbnail_url || null,
    updated_at: r.updated_at || new Date().toISOString(),
  }));
  pages.sort((a, b) => a.page_index - b.page_index);
  return pages;
}

export function usePagesManager({ projectId, onLoadCanvasJSON, getCanvasJSON, getCanvasPNG, cloudEnabled = true }) {
  const [pages, setPages] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const saveTimer = useRef(null);

  // Stabilize function props to prevent effect re-runs on every render
  const onLoadCanvasJSONRef = useRef(onLoadCanvasJSON);
  useEffect(() => { onLoadCanvasJSONRef.current = onLoadCanvasJSON; }, [onLoadCanvasJSON]);
  const getCanvasJSONRef = useRef(getCanvasJSON);
  useEffect(() => { getCanvasJSONRef.current = getCanvasJSON; }, [getCanvasJSON]);
  const getCanvasPNGRef = useRef(getCanvasPNG);
  useEffect(() => { getCanvasPNGRef.current = getCanvasPNG; }, [getCanvasPNG]);

  const activePage = pages[activeIndex] || null;
  const activePageId = activePage?.id || null;

  // Only use Supabase when properly configured, cloud is enabled, AND projectId is not 'local'
  const USE_CLOUD = HAS_SUPABASE && cloudEnabled && projectId && projectId !== 'local';

  const persistLocal = useCallback((next) => {
    try { localStorage.setItem(lsKey(projectId), JSON.stringify(next)); } catch (_) {}
  }, [projectId]);

  const loadLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem(lsKey(projectId));
      if (!raw) return null;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : null;
    } catch (_) { return null; }
  }, [projectId]);

  const upsertPageRow = useCallback(async (page) => {
    if (!USE_CLOUD) return;
    const payload = {
      id: page.id,
      project_id: projectId,
      page_index: page.page_index,
      name: page.name,
      canvas_json: page.canvas_json,
      animations: page.animations || [],
      thumbnail_url: page.thumbnail_url || null,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = await supabase.from('project_pages').upsert(payload);
    if (err) throw err;
  }, [projectId, USE_CLOUD]);

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        if (USE_CLOUD) {
          const { data, error: err } = await supabase
            .from('project_pages')
            .select('*')
            .eq('project_id', projectId)
            .order('page_index', { ascending: true });
          if (err) throw err;
          let initial = normalizePages(data);
          if (!initial.length) {
            // create a first page
            const first = {
              id: crypto.randomUUID(),
              name: 'Page 1',
              page_index: 0,
              canvas_json: { objects: [], background: '#111827' },
              thumbnail_url: null,
              updated_at: new Date().toISOString(),
            };
            await upsertPageRow(first);
            initial = [first];
          }
          if (!mounted) return;
          setPages(initial);
          setActiveIndex(0);
          onLoadCanvasJSON && onLoadCanvasJSON(initial[0].canvas_json);
        } else {
          const local = loadLocal();
          let initial = normalizePages(local || []);
          if (!initial.length) {
            initial = [{ id: crypto.randomUUID(), name: 'Page 1', page_index: 0, canvas_json: { objects: [], background: '#111827' }, thumbnail_url: null, updated_at: new Date().toISOString() }];
            persistLocal(initial);
          }
          if (!mounted) return;
          setPages(initial);
          setActiveIndex(0);
          onLoadCanvasJSON && onLoadCanvasJSON(initial[0].canvas_json);
        }
      } catch (e) {
        setError(e?.message || 'Failed to load pages');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projectId, loadLocal, persistLocal, upsertPageRow, USE_CLOUD]);

  // Autosave active page every 5s
  useEffect(() => {
    if (!activePage) return;
    clearInterval(saveTimer.current);
    saveTimer.current = setInterval(async () => {
      try {
        const json = getCanvasJSONRef.current ? getCanvasJSONRef.current() : null;
        if (!json) return;
        const nextPages = pages.map((p, i) => i === activeIndex ? { ...p, canvas_json: json, updated_at: new Date().toISOString() } : p);
        setPages(nextPages);
        persistLocal(nextPages);
        if (USE_CLOUD) {
          await upsertPageRow(nextPages[activeIndex]);
        }
      } catch (_) {}
    }, 5000);
    return () => clearInterval(saveTimer.current);
  }, [activePage, activeIndex, pages, upsertPageRow, persistLocal, USE_CLOUD]);

  const switchTo = useCallback(async (index) => {
    if (index === activeIndex) return;
    // save current first
    try {
      const json = getCanvasJSONRef.current ? getCanvasJSONRef.current() : null;
      if (json && activePage) {
        const nextPages = pages.map((p, i) => i === activeIndex ? { ...p, canvas_json: json, updated_at: new Date().toISOString() } : p);
        setPages(nextPages);
        persistLocal(nextPages);
        if (USE_CLOUD) await upsertPageRow(nextPages[activeIndex]);
      }
    } catch (_) {}
    // load target
    const target = pages[index];
    if (target) {
      setActiveIndex(index);
      onLoadCanvasJSONRef.current && onLoadCanvasJSONRef.current(target.canvas_json);
    }
  }, [activeIndex, pages, activePage, upsertPageRow, persistLocal, USE_CLOUD]);

  const addPage = useCallback(async () => {
    const next = {
      id: crypto.randomUUID(),
      name: `Page ${pages.length + 1}`,
      page_index: pages.length,
      canvas_json: { objects: [], background: '#111827' },
      animations: [],
      thumbnail_url: null,
      updated_at: new Date().toISOString(),
    };
    const nextPages = [...pages, next];
    setPages(nextPages);
    persistLocal(nextPages);
    if (USE_CLOUD) await upsertPageRow(next);
  }, [pages, persistLocal, upsertPageRow]);

  const duplicatePage = useCallback(async (index) => {
    const base = pages[index];
    if (!base) return;
    const copy = {
      id: crypto.randomUUID(),
      name: `${base.name} Copy`,
      page_index: pages.length,
      canvas_json: base.canvas_json,
      animations: base.animations || [],
      thumbnail_url: base.thumbnail_url || null,
      updated_at: new Date().toISOString(),
    };
    const nextPages = [...pages, copy];
    setPages(nextPages);
    persistLocal(nextPages);
    if (USE_CLOUD) await upsertPageRow(copy);
  }, [pages, persistLocal, upsertPageRow]);

  const deletePage = useCallback(async (index) => {
    if (pages.length <= 1) return; // keep at least one page
    const target = pages[index];
    const nextPages = pages
      .filter((_, i) => i !== index)
      .map((p, i) => ({ ...p, page_index: i }));
    setPages(nextPages);
    persistLocal(nextPages);
    if (USE_CLOUD && target?.id) {
      try { await supabase.from('project_pages').delete().eq('id', target.id); } catch (_) {}
    }
    // adjust active
    const nextActive = Math.max(0, Math.min(nextPages.length - 1, activeIndex > index ? activeIndex - 1 : activeIndex));
    setActiveIndex(nextActive);
    onLoadCanvasJSONRef.current && onLoadCanvasJSONRef.current(nextPages[nextActive].canvas_json);
  }, [pages, activeIndex, persistLocal]);

  const renamePage = useCallback(async (index, name) => {
    const nextPages = pages.map((p, i) => i === index ? { ...p, name } : p);
    setPages(nextPages);
    persistLocal(nextPages);
    if (USE_CLOUD) await upsertPageRow(nextPages[index]);
  }, [pages, persistLocal, upsertPageRow]);

  const reorderPages = useCallback(async (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    const arr = [...pages];
    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    const nextPages = arr.map((p, i) => ({ ...p, page_index: i }));
    setPages(nextPages);
    persistLocal(nextPages);
    if (USE_CLOUD) {
      for (const p of nextPages) await upsertPageRow(p);
    }
  }, [pages, persistLocal, upsertPageRow]);

  const saveActivePageJSON = useCallback(async (json) => {
    if (!activePage) return;
    const nextPage = { ...activePage, canvas_json: json, updated_at: new Date().toISOString() };
    const nextPages = pages.map((p, i) => i === activeIndex ? nextPage : p);
    setPages(nextPages);
    persistLocal(nextPages);
    if (USE_CLOUD) await upsertPageRow(nextPage);
  }, [activePage, activeIndex, pages, persistLocal, upsertPageRow]);

  const updateThumbnail = useCallback(async () => {
    if (!activePage || !getCanvasPNGRef.current) return;
    try {
      const dataUrl = getCanvasPNGRef.current();
      if (!dataUrl) return;
      let publicUrl = null;
      if (USE_CLOUD) {
        const blob = (function d2b(d){ const arr=d.split(','); const mime=arr[0].match(/:(.*?);/)?.[1]||'image/png'; const bstr=atob(arr[1]); let n=bstr.length; const u8=new Uint8Array(n); while(n--) u8[n]=bstr.charCodeAt(n); return new Blob([u8],{type:mime}); })(dataUrl);
        const { data: uploadRes, error: uploadErr } = await supabase.functions.invoke('get-upload-url', {
          body: { category: 'page-thumbs', contentType: blob.type || 'image/png' }
        });
        if (uploadErr) throw uploadErr;
        const { putUrl, publicUrl: pub } = uploadRes || {};
        const putResp = await fetch(putUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type || 'image/png' } });
        if (!putResp.ok) throw new Error('Upload to R2 failed');
        publicUrl = pub;
      }
      const nextPage = { ...activePage, thumbnail_url: publicUrl || null };
      const nextPages = pages.map((p, i) => i === activeIndex ? nextPage : p);
      setPages(nextPages);
      persistLocal(nextPages);
      if (USE_CLOUD) await upsertPageRow(nextPage);
    } catch (_) {}
  }, [activePage, activeIndex, pages, persistLocal, upsertPageRow, USE_CLOUD]);

  return {
    pages,
    activeIndex,
    activePage,
    activePageId,
    loading,
    error,
    addPage,
    duplicatePage,
    deletePage,
    renamePage,
    reorderPages,
    switchTo,
    saveActivePageJSON,
    updateThumbnail,
    setActivePageAnimations: async (anims) => {
      if (!activePage) return;
      const nextPage = { ...activePage, animations: anims, updated_at: new Date().toISOString() };
      const nextPages = pages.map((p, i) => i === activeIndex ? nextPage : p);
      setPages(nextPages);
      persistLocal(nextPages);
      if (USE_CLOUD) await upsertPageRow(nextPage);
    },
  };
}