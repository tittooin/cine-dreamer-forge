import React, { useEffect, useRef, useState } from 'react';

export default function Track({ label, delay, duration, total, onChange }) {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [localDelay, setLocalDelay] = useState(delay);
  const [localDuration, setLocalDuration] = useState(duration);

  useEffect(() => { setLocalDelay(delay); }, [delay]);
  useEffect(() => { setLocalDuration(duration); }, [duration]);

  const pxPerMs = 0.05; // 20ms per px
  const width = Math.max(200, total * pxPerMs);
  const blockLeft = localDelay * pxPerMs;
  const blockWidth = Math.max(30, localDuration * pxPerMs);

  const onMouseDown = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const insideResize = x > blockLeft + blockWidth - 10 && x < blockLeft + blockWidth;
    if (insideResize) {
      setResizing(true);
    } else if (x > blockLeft && x < blockLeft + blockWidth) {
      setDragging(true);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, width));
    if (dragging) {
      const d = Math.round(x / pxPerMs);
      setLocalDelay(d);
    } else if (resizing) {
      const w = Math.round((x - blockLeft) / pxPerMs);
      setLocalDuration(Math.max(100, w));
    }
  };

  const onMouseUp = () => {
    setDragging(false); setResizing(false);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    onChange && onChange({ delay: localDelay, duration: localDuration });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] w-24 truncate">{label}</span>
      <div ref={ref} className="relative h-6 w-full border rounded bg-muted/50" onMouseDown={onMouseDown}>
        <div
          className="absolute top-1 h-4 rounded bg-primary/70"
          style={{ left: blockLeft, width: blockWidth }}
        />
        <div
          className="absolute top-1 h-4 w-[6px] rounded bg-primary"
          style={{ left: blockLeft + blockWidth - 3 }}
        />
      </div>
    </div>
  );
}