import React from 'react';
import Clip from './Clip.jsx';

export default function Track({ type = 'video', mediaMgr, zoom = 1 }) {
  const clips = mediaMgr.state.tracks[type] || [];
  return (
    <div className="rounded-md bg-card border border-border p-2">
      <div className="text-xs mb-1 uppercase text-muted-foreground">{type} track</div>
      <div className="relative h-16 overflow-x-auto">
        <div className="relative" style={{ width: `${(60 * zoom) * 10}px` }}>
          {clips.map((clip) => (
            <Clip key={clip.id} type={type} clip={clip} mediaMgr={mediaMgr} zoom={zoom} />
          ))}
        </div>
      </div>
    </div>
  );
}