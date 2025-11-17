// Minimal VideoEngine: draw hidden <video> to fabric object at ~30fps
export class VideoEngine {
  constructor({ canvas }) {
    this.canvas = canvas;
    this.clips = new Map(); // clipId -> { videoEl, object }
    this.lastRender = 0;
    this.targetDelta = 33; // ~30fps
  }

  attachClip(clip, url, object) {
    let entry = this.clips.get(clip.id);
    if (!entry) {
      const videoEl = document.createElement('video');
      videoEl.crossOrigin = 'anonymous';
      videoEl.src = url;
      videoEl.preload = 'metadata';
      videoEl.muted = true; // audio handled by AudioEngine
      videoEl.playsInline = true;
      entry = { videoEl, object };
      this.clips.set(clip.id, entry);
    } else {
      entry.object = object || entry.object;
    }
  }

  detachClip(clipId) {
    const entry = this.clips.get(clipId);
    if (!entry) return;
    try { entry.videoEl.pause(); } catch {}
    this.clips.delete(clipId);
  }

  setClipTime(clip, currentTime) {
    const entry = this.clips.get(clip.id);
    if (!entry) return;
    const localTime = currentTime - clip.start + (clip.in || 0);
    if (localTime < 0 || localTime > clip.duration) {
      entry.videoEl.pause();
      return;
    }
    if (Math.abs(entry.videoEl.currentTime - localTime) > 0.05) {
      try { entry.videoEl.currentTime = localTime; } catch {}
    }
    if (entry.videoEl.paused) {
      entry.videoEl.play().catch(() => {});
    }
  }

  renderFrame(ts) {
    if (!this.canvas) return;
    if (ts - this.lastRender < this.targetDelta) return;
    this.lastRender = ts;
    for (const [clipId, entry] of this.clips.entries()) {
      const { videoEl, object } = entry;
      if (!object || !videoEl) continue;
      try {
        if (!videoEl.videoWidth) continue;
        // Draw current frame into fabric object element if supported
        if (object._element && object._element.getContext) {
          const ctx = object._element.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoEl, 0, 0, object._element.width, object._element.height);
            object.dirty = true;
          }
        }
      } catch {}
    }
    try { this.canvas.requestRenderAll(); } catch {}
  }
}