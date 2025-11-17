import { supabase } from './supabaseClient';

const hasSupabaseEnv = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type Template = {
  id: string;
  name: string;
  preview_url: string | null;
  canvas_json: any;
  category: string | null;
  user_id: string | null;
  created_at: string;
};

export async function listTemplates({ category, userOnly = false, page = 0, pageSize = 30 }: { category?: string; userOnly?: boolean; page?: number; pageSize?: number; }) {
  let q = supabase.from('templates').select('*').order('created_at', { ascending: false });
  if (category) q = q.eq('category', category);
  if (userOnly) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    q = q.eq('user_id', user.id);
  }
  const { data, error } = await q.range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw error;
  return (data ?? []) as Template[];
}

export async function uploadTemplate(name: string, canvasJSON: any, previewBlob?: Blob, category?: string) {
  let preview_url: string | null = null;
  if (previewBlob) {
    if (!hasSupabaseEnv) {
      throw new Error('Supabase not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Login required to upload template preview');
    }
    const { data: uploadRes, error: uploadErr } = await supabase.functions.invoke('get-upload-url', {
      body: { category: 'previews', contentType: previewBlob.type || 'image/png' }
    });
    if (uploadErr) throw uploadErr;
    const { putUrl, publicUrl } = uploadRes as any;
    const putResp = await fetch(putUrl, { method: 'PUT', body: previewBlob, headers: { 'Content-Type': previewBlob.type || 'image/png' } });
    if (!putResp.ok) throw new Error('Upload to R2 failed');
    preview_url = publicUrl;
  }
  const { data, error } = await supabase
    .from('templates')
    .insert({ name, preview_url, canvas_json: canvasJSON, category, created_at: new Date().toISOString() })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as Template;
}