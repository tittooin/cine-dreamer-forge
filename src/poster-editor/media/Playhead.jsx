import React, { useRef } from 'react';

export default function Playhead({ currentTime, onSeek }) {
  const ref = useRef(null);
  const onMouseDown = (e) => {
    ref.current._originX = e.clientX;
    const move = (ev) => {
      const dx = ev.clientX - ref.current._originX;
      const dt = dx / 60; // px per second
      onSeek(Math.max(0, currentTime + dt));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  return (
    <div className="flex items-center gap-2">
      <div className="text-xs">{currentTime.toFixed(2)}s</div>
      <div className="w-48 h-2 bg-border rounded-sm relative cursor-ew-resize" onMouseDown={onMouseDown}>
        <div className="absolute top-0 bottom-0 bg-primary" style={{ width: `${Math.min(100, (currentTime / 30) * 100)}%` }} />
      </div>
    </div>
  );
}