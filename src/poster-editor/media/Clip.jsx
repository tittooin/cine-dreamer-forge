import React, { useRef, useState } from 'react';

export default function Clip({ type, clip, mediaMgr, zoom }) {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(null); // 'start' | 'end' | null

  const pxPerSecond = 60 * zoom;
  const left = clip.start * pxPerSecond;
  const width = Math.max(20, clip.duration * pxPerSecond);

  const onMouseDown = (e) => {
    if (e.target.dataset.handle === 'start') setResizing('start');
    else if (e.target.dataset.handle === 'end') setResizing('end');
    else setDragging(true);
    ref.current._originX = e.clientX;
    ref.current._originStart = clip.start;
    ref.current._originEnd = clip.start + clip.duration;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e) => {
    const dx = e.clientX - ref.current._originX;
    const dt = dx / pxPerSecond;
    if (dragging) {
      mediaMgr.moveClip(clip.id, type, Math.max(0, ref.current._originStart + dt));
    } else if (resizing === 'start') {
      const newStart = Math.max(0, ref.current._originStart + dt);
      mediaMgr.trimClip(clip.id, type, newStart, ref.current._originEnd);
    } else if (resizing === 'end') {
      const newEnd = Math.max(ref.current._originStart, ref.current._originEnd + dt);
      mediaMgr.trimClip(clip.id, type, ref.current._originStart, newEnd);
    }
  };

  const onMouseUp = () => {
    setDragging(false);
    setResizing(null);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  const onSplit = (at) => {
    mediaMgr.splitClip(clip.id, type, at);
  };

  const onDelete = () => {
    mediaMgr.deleteClip(clip.id, type);
  };

  return (
    <div
      ref={ref}
      className={`absolute top-2 h-12 rounded-md bg-primary/60 text-xs text-primary-foreground border border-border cursor-move select-none`}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={onMouseDown}
    >
      <div className="flex items-center justify-between h-full px-2">
        <span>clip {clip.id.slice(0, 4)}</span>
        <div className="flex items-center gap-2">
          <button className="text-[10px] underline" onClick={(e) => { e.stopPropagation(); onSplit(clip.start + clip.duration / 2); }}>split</button>
          <button className="text-[10px] underline" onClick={(e) => { e.stopPropagation(); onDelete(); }}>delete</button>
        </div>
      </div>
      <div data-handle="start" className="absolute left-0 top-0 bottom-0 w-1 bg-border cursor-ew-resize" />
      <div data-handle="end" className="absolute right-0 top-0 bottom-0 w-1 bg-border cursor-ew-resize" />
    </div>
  );
}