import React, { useEffect, useState } from 'react';
import { loadDefaultTemplates, TemplateItem } from '../data/templates';
import { getTemplates, saveTemplates, setActiveTemplateName } from '../utils/storage';
import TemplateCard from './TemplateCard';
import { useAuth } from '../cloud/useAuth';
import { listTemplates as listCloudTemplates } from '../cloud/templatesApi';

const HAS_SUPABASE = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const TemplatePanel: React.FC<{
  onApplyCanvasJSON: (json: any) => void;
  cloudEnabled?: boolean;
}> = ({ onApplyCanvasJSON, cloudEnabled = false }) => {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const { user } = useAuth();
  const [cloudTemplates, setCloudTemplates] = useState<TemplateItem[]>([]);
  const [page, setPage] = useState(0);
  const [cloudError, setCloudError] = useState<string | null>(null);

  useEffect(() => {
    const local = getTemplates<TemplateItem[]>([]);
    if (local && local.length) {
      setTemplates(local);
      return;
    }
    (async () => {
      setLoading(true);
      const items = await loadDefaultTemplates('/templates/');
      setTemplates(items);
      saveTemplates(items);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user || !cloudEnabled || !HAS_SUPABASE) return;
    (async () => {
      try {
        const items = await listCloudTemplates({ page, pageSize: 30 });
        const mapped: TemplateItem[] = (items as any[]).map(it => ({ id: it.id, name: it.name, thumbnail: it.preview_url ?? '', canvasJSON: it.canvas_json }));
        setCloudTemplates(prev => page === 0 ? mapped : [...prev, ...mapped]);
        setCloudError(null);
      } catch (e: any) {
        setCloudError(e?.message || 'Cloud templates unavailable');
      }
    })();
  }, [user, page, cloudEnabled]);

  const handleLoad = (item: TemplateItem) => {
    const ok = window.confirm('Replace current design? (This will overwrite the canvas)');
    if (!ok) return;
    setActiveTemplateName(item.name);
    onApplyCanvasJSON(item.canvasJSON);
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">Templates</div>
      {loading && <div className="text-xs">Loading templates…</div>}
      {cloudEnabled && user && HAS_SUPABASE && cloudError && (
        <div className="text-[11px] text-orange-600">{cloudError}. Showing local templates.</div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {(cloudEnabled && user && HAS_SUPABASE && !cloudError ? cloudTemplates : templates).map(t => (
          <TemplateCard key={t.id} item={t} onClick={handleLoad} />
        ))}
      </div>
      {cloudEnabled && user && HAS_SUPABASE && !cloudError && (
        <div className="flex items-center justify-center mt-2">
          <button className="px-3 py-1 border rounded-md text-xs" onClick={()=>setPage(p=>p+1)}>Load more</button>
        </div>
      )}
      <div className="text-xs text-muted-foreground">Click a template to load. This replaces the current design.</div>
    </div>
  );
};

export default TemplatePanel;