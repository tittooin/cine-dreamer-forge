// Animation player using requestAnimationFrame with 30fps throttle
// Reads per-object anim and applies precomputed keyframes

import { precomputeKeyframes, applyFrame } from './applyAnimation';

export function createAnimationPlayer({ canvas, getObjects, getPageAnimations }) {
  let rafId = null;
  let startEpoch = 0;
  let isPlaying = false;
  let pausedAt = 0;
  let lastRender = 0;
  const FPS_INTERVAL = 1000 / 30;

  // timeline: Map<objectId, frames[]>
  let timeline = new Map();
  let totalDuration = 0;

  function buildTimeline() {
    timeline.clear();
    totalDuration = 0;
    const objects = getObjects();
    const pageAnims = getPageAnimations() || [];
    // prefer page-level animations list; fallback to object.anim
    const animMap = new Map(pageAnims.map(a => [a.object_id, a]));
    objects.forEach(obj => {
      const anim = animMap.get(obj.id) || (obj.anim || null);
      if (!anim || !anim.type) return;
      const frames = precomputeKeyframes(obj, anim);
      timeline.set(obj.id, frames);
      const end = Math.max(...frames.map(f => f.time));
      totalDuration = Math.max(totalDuration, end);
    });
  }

  function step(now) {
    if (!isPlaying) return;
    if (!startEpoch) startEpoch = now - (pausedAt || 0);
    const elapsed = now - startEpoch;
    // throttle render
    if (now - lastRender < FPS_INTERVAL) {
      rafId = requestAnimationFrame(step);
      return;
    }
    lastRender = now;

    // apply frames
    const objects = getObjects();
    objects.forEach(obj => {
      const frames = timeline.get(obj.id);
      if (!frames || !frames.length) return;
      // find frame closest to elapsed
      const frame = frames.find(f => f.time >= elapsed) || frames[frames.length - 1];
      applyFrame(obj, frame);
    });
    canvas.requestRenderAll();

    if (elapsed >= totalDuration) {
      stop();
      return;
    }
    rafId = requestAnimationFrame(step);
  }

  function play() {
    if (isPlaying) return;
    buildTimeline();
    isPlaying = true;
    startEpoch = 0;
    lastRender = 0;
    rafId = requestAnimationFrame(step);
  }

  function pause() {
    if (!isPlaying) return;
    isPlaying = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    // compute paused time
    // Not exact since we don't track now; handled in step by pausedAt
    pausedAt = Math.min(totalDuration, pausedAt);
  }

  function stop() {
    isPlaying = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    startEpoch = 0;
    pausedAt = 0;
  }

  // Stubs for export
  async function exportGifOrWebM() {
    // Option A: client-side capture stubs
    // html2canvas + CCapture.js or WebM encoder could be used here.
    // TODO: Implement frame capture and encode pipeline.
    throw new Error('Export stub: GIF/WEBM capture not implemented yet');
  }

  async function exportMp4ServerSide() {
    // Option B: Supabase Edge Function stub
    // TODO: Render frames and POST to edge function to encode MP4.
    throw new Error('Export stub: MP4 server-side encode not implemented yet');
  }

  return { play, pause, stop, isPlaying: () => isPlaying, exportGifOrWebM, exportMp4ServerSide };
}