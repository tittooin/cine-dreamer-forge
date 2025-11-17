import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createAnimationPlayer } from '../animation/animationPlayer';

const TYPES = [
  // Entry
  { id: 'fade-in', label: 'Fade In' },
  { id: 'slide-in-left', label: 'Slide In Left' },
  { id: 'slide-in-right', label: 'Slide In Right' },
  { id: 'slide-in-up', label: 'Slide In Up' },
  { id: 'slide-in-down', label: 'Slide In Down' },
  { id: 'zoom-in', label: 'Zoom In' },
  { id: 'pop', label: 'Pop' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'rotate-in', label: 'Rotate In' },
  // Exit
  { id: 'fade-out', label: 'Fade Out' },
  { id: 'slide-out-left', label: 'Slide Out Left' },
  { id: 'slide-out-right', label: 'Slide Out Right' },
  { id: 'slide-out-up', label: 'Slide Out Up' },
  { id: 'slide-out-down', label: 'Slide Out Down' },
  { id: 'zoom-out', label: 'Zoom Out' },
  { id: 'rotate-out', label: 'Rotate Out' },
  // Loop
  { id: 'pulse', label: 'Pulse (Loop)' },
  { id: 'breathe', label: 'Breathe (Loop)' },
  { id: 'shake', label: 'Shake (Loop)' },
];

const EASING = ['ease', 'ease-in', 'ease-out', 'linear'];

export default function AnimationPanel({ canvas, pagesMgr, animMgr }) {
  const { selected } = animMgr;
  const [type, setType] = useState('fade-in');
  const [duration, setDuration] = useState(1200);
  const [delay, setDelay] = useState(0);
  const [easing, setEasing] = useState('ease-out');
  const [loop, setLoop] = useState(false);

  const player = useMemo(() => createAnimationPlayer({
    canvas,
    getObjects: () => canvas ? canvas.getObjects() : [],
    getPageAnimations: () => pagesMgr?.activePage?.animations || [],
  }), [canvas, pagesMgr]);

  const applyAnim = () => {
    if (!selected) return;
    const anim = { type, duration: Number(duration), delay: Number(delay), easing, loop };
    animMgr.setObjectAnim(selected, anim);
  };

  const removeAnim = () => {
    if (!selected) return;
    animMgr.removeObjectAnim(selected.id);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Animation</h3>
      {!selected && <div className="text-xs text-muted-foreground">Select an object to animate.</div>}
      {selected && (
        <>
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map(t => (<SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Duration (ms)</label>
              <Input type="number" min={100} max={10000} value={duration} onChange={(e)=>setDuration(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Delay (ms)</label>
              <Input type="number" min={0} max={5000} value={delay} onChange={(e)=>setDelay(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Easing</label>
            <Select value={easing} onValueChange={setEasing}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EASING.map(e => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={loop} onChange={(e)=>setLoop(e.target.checked)} id="animLoop" />
            <label htmlFor="animLoop" className="text-xs">Loop</label>
          </div>
          <div className="flex gap-2">
            <Button onClick={applyAnim}>Apply</Button>
            <Button variant="outline" onClick={removeAnim}>Remove</Button>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={player.play}>Play</Button>
            <Button variant="outline" onClick={player.pause}>Pause</Button>
            <Button variant="destructive" onClick={player.stop}>Stop</Button>
          </div>
        </>
      )}
      <div className="text-[11px] text-muted-foreground">Per-object animation is saved into page animations JSON and broadcast via realtime patches.</div>
    </div>
  );
}