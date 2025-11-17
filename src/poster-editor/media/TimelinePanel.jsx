import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './AudioEngine.js';
import { VideoEngine } from './VideoEngine.js';
import { TimelinePlayer } from './TimelinePlayer.js';
import Controls from './Controls.jsx';
import Playhead from './Playhead.jsx';
import Track from './Track.jsx';

export default function TimelinePanel({ canvas, pagesMgr, mediaMgr, visible = true }) {
  const [collapsed, setCollapsed] = useState(false);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    audioRef.current = new AudioEngine();
    videoRef.current = new VideoEngine({ canvas });
    playerRef.current = new TimelinePlayer({ audioEngine: audioRef.current, videoEngine: videoRef.current });
    playerRef.current.onTick = setCurrentTime;
    // Bind media realtime handler to canvas for applyPatch delegation
    canvas._onMediaPatch = ({ action, clip, ts }) => {
      if (!playerRef.current) return;
      if (action === 'play') {
        const now = performance.now();
        const delta = (now - (ts || now)) / 1000;
        const start = Math.max(0, currentTime + delta);
        playerRef.current.seek(start);
        playerRef.current.play();
      } else if (action === 'pause') {
        playerRef.current.pause();
      } else if (action === 'stop') {
        playerRef.current.stop();
      } else if (clip) {
        // Apply structural clip ops
        if (action === 'add') mediaMgr.addClip(clip.type || 'video', clip);
        if (action === 'move') mediaMgr.moveClip(clip.id, clip.type || 'video', clip.start);
        if (action === 'trim') mediaMgr.trimClip(clip.id, clip.type || 'video', clip.start, clip.start + clip.duration);
        if (action === 'split') mediaMgr.splitClip(clip.id, clip.type || 'video', clip.start + clip.duration / 2);
        if (action === 'delete') mediaMgr.deleteClip(clip.id, clip.type || 'video');
        if (action === 'volume') mediaMgr.setVolume(clip.id, clip.type || 'video', clip.volume, clip.muted);
      }
    };
    return () => {
      playerRef.current?.stop();
    };
  }, [canvas]);

  const allClips = useMemo(() => {
    const { video, audio } = mediaMgr.state.tracks;
    return [...video, ...audio];
  }, [mediaMgr.state.tracks]);

  useEffect(() => {
    playerRef.current?.setClips(allClips);
  }, [allClips]);

  if (!visible) return null;
  return (
    <div className="absolute left-0 right-0 bottom-0 bg-muted/50 border-t border-border p-2">
      <div className="flex items-center justify-between mb-2">
        <Controls
          onPlay={() => { playerRef.current?.play(); mediaMgr.broadcastPlayback('play', performance.now()); }}
          onPause={() => { playerRef.current?.pause(); mediaMgr.broadcastPlayback('pause', performance.now()); }}
          onStop={() => { playerRef.current?.stop(); mediaMgr.broadcastPlayback('stop', performance.now()); }}
          onZoom={(z) => mediaMgr.setZoom(z)}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
        <Playhead currentTime={currentTime} onSeek={(t) => playerRef.current?.seek(t)} />
      </div>
      {!collapsed && (
        <div className="space-y-2">
          <Track type="video" mediaMgr={mediaMgr} zoom={mediaMgr.state.zoom} />
          <Track type="audio" mediaMgr={mediaMgr} zoom={mediaMgr.state.zoom} />
        </div>
      )}
    </div>
  );
}