import React, { useEffect, useMemo, useRef, useState } from 'react';
import Track from './Track.jsx';

export default function TimelinePanel({ canvas, pagesMgr, animMgr }) {
  const { selected, getPageAnimations } = animMgr;
  const [visible, setVisible] = useState(false);
  const timelineRef = useRef(null);

  const anims = getPageAnimations();
  const selectedAnim = useMemo(() => anims.find(a => a.object_id === selected?.id), [anims, selected]);

  useEffect(() => {
    setVisible(!!selected);
  }, [selected]);

  if (!visible || !selected) return null;

  const onChangeTiming = (next) => {
    if (!selected) return;
    const anim = { ...(selectedAnim || { type: 'fade-in', duration: 1200, delay: 0, easing: 'ease', loop: false }), ...next };
    animMgr.setObjectAnim(selected, anim);
  };

  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 w-[90%] md:w-[70%] bg-background/95 border border-border rounded-md shadow p-2 z-30">
      <div className="text-xs font-medium mb-1">Timeline</div>
      <div className="flex flex-col gap-1">
        <Track
          label={selected?.type || 'Object'}
          delay={selectedAnim?.delay || 0}
          duration={selectedAnim?.duration || 1200}
          total={Math.max(2000, (selectedAnim?.delay||0) + (selectedAnim?.duration||1200))}
          onChange={onChangeTiming}
        />
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">Drag the block to change start time; resize to change duration.</div>
    </div>
  );
}