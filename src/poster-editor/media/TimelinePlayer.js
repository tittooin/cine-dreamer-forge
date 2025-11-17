// Coordinates playback across AudioEngine and VideoEngine, keeps global currentTime
export class TimelinePlayer {
  constructor({ audioEngine, videoEngine }) {
    this.audio = audioEngine;
    this.video = videoEngine;
    this.currentTime = 0; // seconds
    this.playing = false;
    this.startWallClock = 0;
    this.startLogicalTime = 0;
    this.clips = []; // all clips across tracks
    this.rafId = null;
    this.onTick = null; // callback(currentTime)
  }

  setClips(clips) {
    this.clips = clips || [];
  }

  seek(time) {
    this.currentTime = Math.max(0, time || 0);
    for (const clip of this.clips) {
      this.audio?.setClipTime(clip, this.currentTime);
      this.video?.setClipTime(clip, this.currentTime);
    }
    this.onTick?.(this.currentTime);
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.startWallClock = performance.now();
    this.startLogicalTime = this.currentTime;
    // Prime engines
    for (const clip of this.clips) {
      this.audio?.playFrom(clip, this.currentTime);
      this.video?.setClipTime(clip, this.currentTime);
    }
    const loop = (ts) => {
      if (!this.playing) return;
      const elapsed = (ts - this.startWallClock) / 1000;
      this.currentTime = this.startLogicalTime + elapsed;
      this.video?.renderFrame(ts);
      this.onTick?.(this.currentTime);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.audio?.pauseAll();
  }

  stop() {
    this.playing = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.audio?.stopAll();
    this.seek(0);
  }
}