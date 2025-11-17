import React from 'react';

export default function Controls({ onPlay, onPause, onStop, onZoom, collapsed, onToggle }) {
  return (
    <div className="flex items-center gap-2">
      <button className="px-2 py-1 rounded border" onClick={onPlay}>Play</button>
      <button className="px-2 py-1 rounded border" onClick={onPause}>Pause</button>
      <button className="px-2 py-1 rounded border" onClick={onStop}>Stop</button>
      <div className="flex items-center gap-1 ml-4">
        <span className="text-xs">Zoom</span>
        <input type="range" min="0.25" max="4" step="0.25" defaultValue={1} onChange={(e) => onZoom(parseFloat(e.target.value))} />
      </div>
      <button className="px-2 py-1 rounded border ml-4" onClick={onToggle}>{collapsed ? 'Expand' : 'Collapse'}</button>
    </div>
  );
}