import { supabase } from '@/integrations/supabase/client';
import { applyPatch } from './applyPatch';

// Simple color pool for cursors/avatars
const COLORS = ['#ff4d4f','#40a9ff','#73d13d','#faad14','#9254de','#13c2c2','#eb2f96'];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function useRealtimeProject({ projectId, pageId, canvas, user }) {
  const HAS_SUPABASE = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  let presenceChannel; let patchChannel; let commentsChannel;
  const state = {
    cursors: new Map(),
    avatars: new Map(),
    comments: [],
    clientIds: new Set(), // dedupe by id
  };

  const color = COLORS[Math.abs(hashCode(user?.id || '')) % COLORS.length] || COLORS[0];

  const joinPresence = () => {
    const pagePart = pageId ? `:${pageId}` : '';
    presenceChannel = supabase.channel(`project-presence:${projectId}${pagePart}`, {
      config: { presence: { key: user?.id || crypto.randomUUID() } },
    });

    presenceChannel.on('presence', { event: 'sync' }, () => {
      const presences = presenceChannel.presenceState();
      const users = Object.values(presences).flat();
      state.avatars.clear();
      users.forEach((u) => {
        state.avatars.set(u.user_id, { username: u.username, color: u.color });
        if (u.cursor) state.cursors.set(u.user_id, { ...u.cursor, username: u.username, color: u.color });
      });
      listeners.forEach((l) => l('presence', getSnapshot()));
    });

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ user_id: user?.id, username: user?.username, color, cursor: null, tool: 'idle' });
      }
    });
  };

  const subscribePatches = () => {
    const pagePart = pageId ? `:${pageId}` : '';
    patchChannel = supabase.channel(`project-patches:${projectId}${pagePart}`);
    patchChannel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'project_live_updates',
      filter: pageId ? `project_id=eq.${projectId},page_id=eq.${pageId}` : `project_id=eq.${projectId}`,
    }, (payload) => {
      const patch = payload?.new;
      if (!patch) return;
      // dedupe own
      if (state.clientIds.has(patch.id)) return;
      applyPatch(canvas, patch);
      listeners.forEach((l) => l('patch', patch));
    });
    patchChannel.subscribe();
  };

  const subscribeComments = () => {
    const pagePart = pageId ? `:${pageId}` : '';
    commentsChannel = supabase.channel(`project-comments:${projectId}${pagePart}`);
    commentsChannel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'comments',
      filter: pageId ? `project_id=eq.${projectId},page_id=eq.${pageId}` : `project_id=eq.${projectId}`,
    }, (payload) => {
      const row = payload?.new;
      if (!row) return;
      state.comments.push(row);
      listeners.forEach((l) => l('comment', row));
    });
    commentsChannel.subscribe();
  };

  const listeners = new Set();
  const getSnapshot = () => ({
    cursors: new Map(state.cursors),
    avatars: new Map(state.avatars),
    comments: [...state.comments],
  });

  const onMouseMove = (x, y) => {
    presenceChannel?.track({ user_id: user?.id, username: user?.username, color, cursor: { x, y }, tool: 'move' });
  };

  const addComment = async ({ x, y, text }) => {
    const row = {
      project_id: projectId,
      page_id: pageId || null,
      user_id: user?.id,
      username: user?.username,
      comment: text,
      x, y,
    };
    await supabase.from('comments').insert(row);
  };

  const start = async () => {
    if (!HAS_SUPABASE) {
      // Offline mode: skip realtime setup when Supabase is not configured
      return;
    }
    joinPresence();
    subscribePatches();
    subscribeComments();
  };

  const stop = () => {
    presenceChannel && supabase.removeChannel(presenceChannel);
    patchChannel && supabase.removeChannel(patchChannel);
    commentsChannel && supabase.removeChannel(commentsChannel);
  };

  const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

  return { start, stop, onMouseMove, addComment, subscribe, getSnapshot };
}