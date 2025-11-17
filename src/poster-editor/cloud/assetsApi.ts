import { supabase } from './supabaseClient';

const hasSupabaseEnv = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type Asset = {
  id: string;
  user_id: string | null;
  url: string;
  thumb_url: string | null;
  category: 'photo' | 'background' | 'shape' | 'icon' | string;
  tags: string[] | null;
  created_at: string;
};

export async function uploadAsset(file: File, category: string, tags: string[] = []) {
  if (!hasSupabaseEnv) {
    throw new Error('Supabase not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Login required to upload assets');
  }
  const { data: uploadRes, error: uploadErr } = await supabase.functions.invoke('get-upload-url', {
    body: { category: 'assets', contentType: file.type || 'application/octet-stream' }
  });
  if (uploadErr) throw uploadErr;
  const { putUrl, publicUrl } = uploadRes as any;
  const putResp = await fetch(putUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
  if (!putResp.ok) throw new Error('Upload to R2 failed');

  // trigger thumbnail generation
  let thumbUrl: string | null = null;
  try {
    const { data: thumbRes } = await supabase.functions.invoke('generate-thumbnail', { body: { url: publicUrl } });
    thumbUrl = (thumbRes as any)?.thumbUrl ?? null;
  } catch (_) {}

  const { data, error } = await supabase
    .from('assets')
    .insert({ url: publicUrl, thumb_url: thumbUrl, category, tags, created_at: new Date().toISOString() })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as Asset;
}

export async function listAssets({ category, page = 0, pageSize = 30 }: { category?: string; page?: number; pageSize?: number; }) {
  const q = supabase.from('assets').select('*').order('created_at', { ascending: false });
  if (category && category.length) q.eq('category', category);
  const { data, error } = await q.range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw error;
  return (data ?? []) as Asset[];
}