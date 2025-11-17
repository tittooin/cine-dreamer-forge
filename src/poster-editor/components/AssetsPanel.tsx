import React, { useMemo, useState, useEffect } from 'react';
import type { AssetItem } from '../data/assets';
import DEFAULT_ASSETS from '../data/assets';
import { getAssets, saveAssets } from '../utils/storage';
import AssetCard from './AssetCard';
import { useAuth } from '../cloud/useAuth';
import { listAssets } from '../cloud/assetsApi';
import AssetUploadModal from '../ui/AssetUploadModal';

type FabricModule = typeof import('fabric');

export const AssetsPanel: React.FC<{
  fabric: FabricModule['fabric'] | null;
  canvas: FabricModule['fabric']['Canvas'] | null;
}> = ({ fabric, canvas }) => {
  const { user } = useAuth();
  const [assets, setAssets] = useState<AssetItem[]>(() => {
    const user = getAssets<AssetItem[]>([]);
    return [...DEFAULT_ASSETS, ...user];
  });
  const [cloudAssets, setCloudAssets] = useState<AssetItem[]>([]);
  const [page, setPage] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);

  const categories = useMemo(() => (
    [
      { id: 'photo', label: 'Photos' },
      { id: 'background', label: 'Backgrounds' },
      { id: 'shape', label: 'Shapes' },
      { id: 'icon', label: 'Icons' },
    ] as const
  ), []);
  const [active, setActive] = useState<typeof categories[number]['id']>('photo');

  const autoscaleAndCenter = (obj: any) => {
    if (!canvas || !fabric) return;
    const cw = canvas.getWidth();
    const ch = canvas.getHeight();
    const bounds = obj.getBoundingRect(true);
    const scaleX = (cw * 0.9) / bounds.width;
    const scaleY = (ch * 0.9) / bounds.height;
    const scale = Math.min(scaleX, scaleY, 1);
    obj.scale(scale);
    obj.set({ left: cw / 2 - (bounds.width * scale) / 2, top: ch / 2 - (bounds.height * scale) / 2 });
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.renderAll();
  };

  const insertAsset = (item: AssetItem) => {
    if (!canvas || !fabric) return;
    if (item.category === 'shape' || item.category === 'icon') {
      fabric.loadSVGFromURL(item.url, (objects, options) => {
        const obj = fabric.util.groupSVGElements(objects, options);
        autoscaleAndCenter(obj);
      });
    } else {
      fabric.Image.fromURL(item.url, (img) => {
        autoscaleAndCenter(img);
      }, { crossOrigin: 'anonymous' });
    }
  };

  const onUpload: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newItem: AssetItem = {
        id: `upload_${Date.now()}`,
        url: dataUrl,
        thumb: dataUrl,
        category: 'photo',
        tags: ['upload'],
      };
      const next = [...assets, newItem];
      setAssets(next);
      saveAssets(next.filter(a => a.id.startsWith('upload_')));
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const items = await listAssets({ page, pageSize: 30 });
      const mapped: AssetItem[] = items.map(a => ({ id: a.id, url: a.url, thumb: a.thumb_url ?? a.url, category: (a.category as any) || 'photo', tags: a.tags ?? [] }));
      setCloudAssets(prev => page === 0 ? mapped : [...prev, ...mapped]);
    })();
  }, [user, page]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {categories.map(c => (
          <button key={c.id} className={`px-2 py-1 rounded-md text-xs border ${active===c.id ? 'border-primary' : 'border-border'}`} onClick={() => setActive(c.id)}>{c.label}</button>
        ))}
      </div>

      <div>
        {user ? (
          <>
            <label className="text-xs block mb-1">Upload Asset (Cloud)</label>
            <button className="px-2 py-1 border rounded-md text-xs" onClick={()=>setUploadOpen(true)}>Open Upload</button>
            <div className="text-[11px] text-muted-foreground mt-1">Files upload to cloud and generate thumbnails.</div>
          </>
        ) : (
          <>
            <label className="text-xs block mb-1">Upload Asset (Local)</label>
            <input type="file" accept="image/*,image/svg+xml" onChange={onUpload} />
            <div className="text-[11px] text-muted-foreground mt-1">Uploaded assets are saved to your browser.</div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {(user ? cloudAssets : assets).filter(a => a.category === active).map(a => (
          <AssetCard key={a.id} item={a} onClick={insertAsset} />
        ))}
      </div>
      {user && (
        <div className="flex items-center justify-center">
          <button className="px-3 py-1 border rounded-md text-xs" onClick={()=>setPage(p=>p+1)}>Load more</button>
        </div>
      )}
      <AssetUploadModal open={uploadOpen} onClose={()=>setUploadOpen(false)} onUploaded={()=>setPage(0)} />
    </div>
  );
};

export default AssetsPanel;