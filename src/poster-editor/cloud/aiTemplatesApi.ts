import { supabase } from '@/integrations/supabase/client';

export type AiTemplate = {
  id: string;
  user_id: string;
  prompt: string;
  canvas_json: any;
  preview_url: string | null;
  created_at: string;
};

export async function saveAiTemplate(input: { prompt: string; canvas_json: any; preview_data_url?: string }) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Login required');

  let preview_url: string | null = null;
  // Store preview as data URL for now (could be uploaded to R2 in future)
  if (input.preview_data_url) preview_url = input.preview_data_url;

  const { error } = await supabase.from('ai_templates').insert({
    user_id: user.id,
    prompt: input.prompt,
    canvas_json: input.canvas_json,
    preview_url,
  });
  if (error) throw error;
}

export async function listAiTemplates(userId: string, from = 0, limit = 20): Promise<AiTemplate[]> {
  const { data, error } = await supabase
    .from('ai_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);
  if (error) throw error;
  return (data || []) as AiTemplate[];
}