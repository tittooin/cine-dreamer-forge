import { supabase } from './supabaseClient';

const hasSupabaseEnv = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export type Project = {
  id: string;
  user_id: string;
  name: string;
  canvas_json: any;
  preview_url: string | null;
  updated_at: string;
};

export async function saveProjectToCloud(userId: string, name: string, canvasJSON: any, previewBlob?: Blob): Promise<Project> {
  let preview_url: string | null = null;
  if (previewBlob) {
    if (!hasSupabaseEnv) {
      throw new Error('Supabase not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Login required to upload preview');
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
  if (!hasSupabaseEnv) {
    throw new Error('Supabase not configured: cannot save project to cloud');
  }
  const { data, error } = await supabase.from('projects').upsert({
    name,
    user_id: userId,
    canvas_json: canvasJSON,
    preview_url,
    updated_at: new Date().toISOString(),
  }).select('*').maybeSingle();
  if (error) throw error;
  return data as Project;
}

export async function listProjects(userId: string, page = 0, pageSize = 20): Promise<Project[]> {
  if (!hasSupabaseEnv) return [];
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

export async function renameProject(id: string, name: string) {
  const { error } = await supabase.from('projects').update({ name, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function duplicateProject(id: string) {
  const { data, error } = await supabase.from('projects').select('user_id,name,canvas_json,preview_url').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Project not found');
  const { data: inserted, error: insErr } = await supabase
    .from('projects')
    .insert({ user_id: data.user_id, name: `${data.name} (Copy)`, canvas_json: data.canvas_json, preview_url: data.preview_url, updated_at: new Date().toISOString() })
    .select('*')
    .maybeSingle();
  if (insErr) throw insErr;
  return inserted;
}