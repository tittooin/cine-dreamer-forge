import React, { useEffect, useMemo, useState } from 'react';
import { useBrandingAI } from '../branding/useBrandingAI';
import { applyBrandKit } from '../branding/applyBrandKit';
import { extractColorsFromImage, extractColorsFromWebsite } from '../branding/extractColors';
import { PRESET_COLORS } from '../branding/brandKit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const BrandingPanel = ({ fabric, canvas }) => {
  const { generateBrandKit, saveBrandKit, listBrandKits } = useBrandingAI();
  const [prompt, setPrompt] = useState('premium, minimal, gold, black, luxury');
  const [currentKit, setCurrentKit] = useState(null);
  const [kits, setKits] = useState([]);
  const [palette, setPalette] = useState([]);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [autoApply, setAutoApply] = useState(true);

  useEffect(()=>{ (async()=>{ try { const rows = await listBrandKits(); setKits(rows); } catch(_){} })(); },[]);

  const adapter = useMemo(()=>{
    if (!canvas) return null;
    return canvas; // applyBrandKit detects Fabric via getObjects()
  }, [canvas]);

  async function onGenerate(){
    const kit = await generateBrandKit(prompt);
    setCurrentKit(kit);
    if (autoApply && adapter) applyBrandKit(kit, adapter);
  }

  async function onSave(){
    if (!currentKit) return;
    try { await saveBrandKit(currentKit); const rows = await listBrandKits(); setKits(rows); } catch(e){ console.warn('Save failed', e); }
  }

  async function onLogoFile(e){
    const f = e.target.files?.[0]; if (!f) return;
    const { palette, theme } = await extractColorsFromImage(f, 5);
    setPalette(palette);
    if (autoApply && adapter && currentKit) {
      const next = { ...currentKit, colors: palette };
      setCurrentKit(next);
      applyBrandKit(next, adapter);
    }
  }

  async function onWebsite(){
    const { palette } = await extractColorsFromWebsite(websiteUrl);
    setPalette(palette);
    if (autoApply && adapter && currentKit) {
      const next = { ...currentKit, colors: palette };
      setCurrentKit(next);
      applyBrandKit(next, adapter);
    }
  }

  function onApplyFonts(){
    if (!currentKit || !adapter) return;
    applyBrandKit({ ...currentKit, colors: currentKit.colors ?? PRESET_COLORS.modern }, adapter);
  }

  function onApplyPalette(){
    if (!adapter) return;
    const colors = palette.length ? palette : (currentKit?.colors ?? PRESET_COLORS.modern);
    const kit = currentKit || { fonts: {}, colors };
    applyBrandKit({ ...kit, colors }, adapter);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Generate Brand Kit</h3>
        <Input value={prompt} onChange={(e)=>setPrompt(e.target.value)} placeholder="Brand style prompt" />
        <div className="flex items-center gap-2">
          <Button onClick={onGenerate}>Generate</Button>
          <Button variant="secondary" onClick={onSave} disabled={!currentKit}>Save Brand Kit</Button>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={autoApply} onChange={(e)=>setAutoApply(e.target.checked)} /> Auto Apply
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Extract from Logo</h3>
        <input type="file" accept="image/*" onChange={onLogoFile} />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Create Palette from Website</h3>
        <Input value={websiteUrl} onChange={(e)=>setWebsiteUrl(e.target.value)} placeholder="https://example.com" />
        <Button variant="outline" onClick={onWebsite}>Extract Palette</Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Apply</h3>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onApplyPalette}>Auto Apply Palette</Button>
          <Button variant="secondary" onClick={onApplyFonts}>Auto Apply Fonts</Button>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Saved Brand Kits</h3>
        {kits?.length ? (
          <div className="space-y-2">
            {kits.map(k => (
              <div key={k.id} className="flex items-center justify-between rounded border p-2">
                <div>
                  <div className="text-sm font-medium">{k.name}</div>
                  <div className="text-xs text-muted-foreground">{Array.isArray(k.data?.colors) ? k.data.colors.join(', ') : 'No colors'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={()=>{ setCurrentKit(k.data); if (adapter) applyBrandKit(k.data, adapter); }}>Apply</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No saved kits yet.</div>
        )}
      </div>
    </div>
  );
};

export default BrandingPanel;