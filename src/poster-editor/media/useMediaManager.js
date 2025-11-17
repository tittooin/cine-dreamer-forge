// Replace external uuid dependency with native/random ID generator
const uuidv4 = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
import { sendPatch } from '../realtime/sendPatch.js';

// Clip: { id, asset_id, start, duration, in, volume, muted, page_id }
export function useMediaManager({ canvas, pagesMgr, projectId, pageId, user, cloudEnabled }) {
  const state = {
    tracks: { video: [], audio: [] },
    zoom: 1,
  };

  const setTracks = (tracks) => {
    state.tracks = tracks;
  };

  const addClip = (type, clip) => {
    const c = { id: clip.id || uuidv4(), muted: false, volume: 1, in: 0, ...clip, page_id: pageId, type };
    state.tracks[type] = [...state.tracks[type], c];
    broadcast('add', c);
    return c;
  };

  const moveClip = (clipId, type, start) => {
    state.tracks[type] = state.tracks[type].map(c => c.id === clipId ? { ...c, start } : c);
    const clip = state.tracks[type].find(c => c.id === clipId);
    if (clip) broadcast('move', clip);
  };

  const trimClip = (clipId, type, newStart, newEnd) => {
    state.tracks[type] = state.tracks[type].map(c => c.id === clipId ? { ...c, start: newStart, duration: Math.max(0, newEnd - newStart) } : c);
    const clip = state.tracks[type].find(c => c.id === clipId);
    if (clip) broadcast('trim', clip);
  };

  const splitClip = (clipId, type, at) => {
    const c = state.tracks[type].find(x => x.id === clipId);
    if (!c) return;
    const left = { ...c, duration: Math.max(0, at - c.start) };
    const right = { ...c, id: uuidv4(), start: at, duration: Math.max(0, (c.start + c.duration) - at), in: c.in };
    state.tracks[type] = state.tracks[type].flatMap(x => x.id === clipId ? [left, right] : [x]);
    broadcast('split', right);
  };

  const deleteClip = (clipId, type) => {
    const clip = state.tracks[type].find(c => c.id === clipId);
    state.tracks[type] = state.tracks[type].filter(c => c.id !== clipId);
    if (clip) broadcast('delete', clip);
  };

  const setVolume = (clipId, type, volume, muted) => {
    state.tracks[type] = state.tracks[type].map(c => c.id === clipId ? { ...c, volume, muted: !!muted } : c);
    const clip = state.tracks[type].find(c => c.id === clipId);
    if (clip) broadcast('volume', clip);
  };

  const setZoom = (z) => { state.zoom = Math.max(0.25, Math.min(4, z)); };

  const broadcast = (action, clip) => {
    try {
      sendPatch({
        projectId,
        pageId,
        patch: {
          op_type: 'media-op',
          payload: { action, clip },
        },
        user,
      });
    } catch {}
  };

  const broadcastPlayback = (action, ts) => {
    try {
      sendPatch({
        projectId,
        pageId,
        patch: {
          op_type: 'media-op',
          payload: { action, ts },
        },
        user,
      });
    } catch {}
  };

  // Upload media to Cloudflare R2 using signed URL (Phase-3 style)
  const uploadMedia = async (file) => {
    const mime = file.type || 'application/octet-stream';
    const res = await fetch('/functions/v1/get-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: mime }),
    });
    const data = await res.json();
    const { url, uploadUrl } = data;
    await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mime }, body: file });
    // Probe media metadata
    const probe = await probeMedia(url);
    return { url, ...probe };
  };

  const probeMedia = (url) => new Promise((resolve) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.src = url;
    el.onloadedmetadata = () => {
      resolve({ duration: el.duration || 0, width: el.videoWidth || 0, height: el.videoHeight || 0, mime: el.currentSrc ? 'video' : '' });
    };
    el.onerror = () => resolve({ duration: 0, width: 0, height: 0, mime: '' });
  });

  return {
    state,
    setTracks,
    addClip,
    moveClip,
    trimClip,
    splitClip,
    deleteClip,
    setVolume,
    setZoom,
    uploadMedia,
    broadcastPlayback,
  };
}