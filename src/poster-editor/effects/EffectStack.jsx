import React from 'react';

export default function EffectStack({ effects = [], onToggle, onMove, onRemove }) {
  return (
    <div className="border rounded p-2 space-y-2">
      {effects.length === 0 && <div className="text-muted-foreground">No effects applied</div>}
      {effects.map((eff, idx) => (
        <div key={eff.id || idx} className="flex items-center gap-2">
          <button className="px-2 py-1 border rounded" title="Move up" onClick={() => onMove?.(eff.id, idx - 1)} disabled={idx === 0}>↑</button>
          <button className="px-2 py-1 border rounded" title="Move down" onClick={() => onMove?.(eff.id, idx + 1)} disabled={idx === effects.length - 1}>↓</button>
          <label className="inline-flex items-center gap-2 flex-1">
            <input type="checkbox" checked={eff.enabled !== false} onChange={() => onToggle?.(eff.id)} />
            <span className="font-medium">{eff.type}</span>
            <span className="text-muted-foreground">{serializeParams(eff.params)}</span>
          </label>
          <button className="px-2 py-1 border rounded" onClick={() => onRemove?.(eff.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}

function serializeParams(params) {
  if (!params) return '';
  try { return Object.entries(params).map(([k,v]) => `${k}:${v}`).join(', '); } catch { return ''; }
}