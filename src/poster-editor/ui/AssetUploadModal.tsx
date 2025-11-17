import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { uploadAsset } from '../cloud/assetsApi';

type Props = { open: boolean; onClose: () => void; onUploaded?: () => void };

const AssetUploadModal: React.FC<Props> = ({ open, onClose, onUploaded }) => {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>('photo');
  const [tags, setTags] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onUpload = async () => {
    if (!file) { setError('Select a file'); return; }
    setLoading(true); setError(null);
    try { await uploadAsset(file, category, tags.split(',').map(t=>t.trim()).filter(Boolean)); onUploaded?.(); onClose(); }
    catch (e: any) { setError(e?.message ?? 'Upload failed'); }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v)=>{ if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Asset</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <div className="text-sm text-destructive">{error}</div>}
          <input type="file" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} />
          <div className="grid grid-cols-2 gap-3">
            <select className="h-10 bg-input border border-border rounded-md px-2" value={category} onChange={(e)=>setCategory(e.target.value)}>
              <option value="photo">Photo</option>
              <option value="background">Background</option>
              <option value="icon">Icon</option>
              <option value="shape">Shape</option>
            </select>
            <Input placeholder="tags comma-separated" value={tags} onChange={(e)=>setTags(e.target.value)} />
          </div>
          <Button className="w-full" onClick={onUpload} disabled={loading}>{loading ? 'Uploading…' : 'Upload'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssetUploadModal;