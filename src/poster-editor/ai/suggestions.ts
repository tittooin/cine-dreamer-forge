export function generateSuggestions(canvasJSON: any): string[] {
  const objs = (canvasJSON?.objects || []) as any[];
  const suggestions: string[] = [];

  const textObjs = objs.filter(o => o.type === 'textbox' || o.type === 'text');
  const rects = objs.filter(o => o.type === 'rect');

  if (textObjs.length) {
    const fontSizes = textObjs.map(t => t.fontSize || 0).sort((a, b) => b - a);
    if (fontSizes[0] - (fontSizes[1] || 0) < 8) {
      suggestions.push('Increase title font size for clearer hierarchy');
    }
    suggestions.push('Align text blocks evenly and maintain consistent margins');
  }

  if (rects.length >= 2) {
    suggestions.push('Ensure shapes have enough breathing space around text');
  }

  suggestions.push('Use contrasting colors for title vs background');
  suggestions.push('Consider a bold CTA near the bottom area');
  suggestions.push('Limit fonts to 2–3 families for cohesion');

  return suggestions.slice(0, 5);
}