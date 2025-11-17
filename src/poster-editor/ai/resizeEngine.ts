type Size = { width: number; height: number };

export function smartResize(canvasJSON: any, oldSize: Size, newSize: Size): any {
  const sx = newSize.width / oldSize.width;
  const sy = newSize.height / oldSize.height;
  const out = JSON.parse(JSON.stringify(canvasJSON));

  if (out.objects && Array.isArray(out.objects)) {
    out.objects.forEach((o: any) => {
      if (typeof o.left === 'number') o.left = Math.round(o.left * sx);
      if (typeof o.top === 'number') o.top = Math.round(o.top * sy);
      if (typeof o.width === 'number') o.width = Math.round(o.width * sx);
      if (typeof o.height === 'number') o.height = Math.round(o.height * sy);
      if (typeof o.fontSize === 'number') o.fontSize = Math.round(o.fontSize * ((sx + sy) / 2));
      if (typeof o.scaleX === 'number') o.scaleX = (o.scaleX || 1) * sx;
      if (typeof o.scaleY === 'number') o.scaleY = (o.scaleY || 1) * sy;
    });
  }

  out.background = out.background || canvasJSON.background;
  return out;
}