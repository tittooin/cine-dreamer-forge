import { loadGoogleFonts } from './FontLoader';

export function applyBrandKit(kit, editor){
  if (!kit || !editor) return;
  const fonts = kit.fonts || {};
  const colors = kit.colors || [];
  loadGoogleFonts(fonts);

  const primary = colors[0] || '#111827';
  const secondary = colors[1] || '#6B7280';
  const accent = colors[2] || '#2563EB';
  const spacing = kit?.spacing?.padding || 16;

  // Fabric adapter
  if (typeof editor.getObjects === 'function') {
    // Background
    if (typeof editor.setBackgroundColor === 'function') {
      try { editor.setBackgroundColor(primary, () => editor.renderAll()); } catch(_) {}
    }
    // Iterate objects
    try {
      const objs = editor.getObjects();
      for (const obj of objs) {
        const type = obj.type;
        if (type === 'textbox' || type === 'text') {
          if (fonts.heading) obj.fontFamily = fonts.heading;
          if (fonts.weights) obj.fontWeight = Array.isArray(fonts.weights) ? fonts.weights[0] : fonts.weights;
          obj.fill = '#FFFFFF';
        } else if (type === 'rect' || type === 'circle' || type === 'triangle' || type === 'path' || type === 'polygon') {
          obj.fill = secondary;
          obj.stroke = accent;
          obj.strokeWidth = Math.max(1, obj.strokeWidth || 2);
        }
        if ('padding' in obj) obj.padding = spacing;
      }
      editor.renderAll();
    } catch(_) {}
    return;
  }

  // Generic editor adapter
  safeIterateCanvas(editor, node => {
    if (node.type === 'text' || node.kind === 'text') {
      if (fonts.heading) node.fontFamily = fonts.heading;
      if (fonts.weights) node.fontWeight = Array.isArray(fonts.weights) ? fonts.weights[0] : fonts.weights;
      node.color = '#FFFFFF';
    }
    if (node.type === 'shape' || node.kind === 'shape') {
      node.fill = secondary;
      node.stroke = accent;
    }
    if ('padding' in node) node.padding = spacing;
    if ('margin' in node) node.margin = Math.round(spacing * 0.75);
  });
  if (editor.setBackgroundColor) editor.setBackgroundColor(primary);
}

function safeIterateCanvas(editor, fn){
  try {
    const nodes = editor.getAllNodes ? editor.getAllNodes() : [];
    for (const n of nodes) fn(n);
    if (editor.refresh) editor.refresh();
  } catch (_) {}
}