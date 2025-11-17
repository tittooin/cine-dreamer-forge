// Minimal AudioEngine using Web Audio API with per-clip gain control
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.destination = null;
    this.clips = new Map(); // clipId -> { audioEl, source, gain }
    this.enabled = false;
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.destination = this.ctx.createGain();
      this.destination.connect(this.ctx.destination);
      this.enabled = true;
    }
  }

  attachClip(clip, url) {
    this.ensureContext();
    if (!this.enabled) return;
    let entry = this.clips.get(clip.id);
    if (!entry) {
      const audioEl = new Audio(url);
      audioEl.crossOrigin = 'anonymous';
      audioEl.preload = 'metadata';
      const source = this.ctx.createMediaElementSource(audioEl);
      const gain = this.ctx.createGain();
      source.connect(gain).connect(this.destination);
      entry = { audioEl, source, gain };
      this.clips.set(clip.id, entry);
    }
    entry.gain.gain.value = clip.muted ? 0 : (clip.volume ?? 1);
  }

  detachClip(clipId) {
    const entry = this.clips.get(clipId);
    if (!entry) return;
    try { entry.audioEl.pause(); } catch {}
    this.clips.delete(clipId);
  }

  setClipTime(clip, currentTime) {
    const entry = this.clips.get(clip.id);
    if (!entry) return;
    const localTime = currentTime - clip.start + (clip.in || 0);
    if (localTime < 0 || localTime > clip.duration) {
      entry.audioEl.pause();
      return;
    }
    if (Math.abs(entry.audioEl.currentTime - localTime) > 0.05) {
      entry.audioEl.currentTime = localTime;
    }
  }

  playFrom(clip, currentTime) {
    const entry = this.clips.get(clip.id);
    if (!entry) return;
    this.setClipTime(clip, currentTime);
    entry.audioEl.muted = !!clip.muted;
    entry.gain.gain.value = clip.muted ? 0 : (clip.volume ?? 1);
    entry.audioEl.play().catch(() => {});
  }

  pauseAll() {
    for (const entry of this.clips.values()) {
      try { entry.audioEl.pause(); } catch {}
    }
  }

  stopAll() {
    for (const entry of this.clips.values()) {
      try { entry.audioEl.pause(); entry.audioEl.currentTime = 0; } catch {}
    }
  }

  getMixedStream() {
    // Return the mixed audio stream for MediaRecorder
    return this.ctx?.destination?.stream || null;
  }
}