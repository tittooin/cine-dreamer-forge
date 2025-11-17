export default function CursorOverlay({ cursors }) {
  const items = Array.from(cursors || new Map());
  return (
    <div
      id="cursor-overlay"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {items.map(([userId, c]) => (
        <div
          key={userId}
          style={{ position: 'absolute', left: c.x, top: c.y, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.8)', borderRadius: 4, padding: '2px 4px' }}>{c.username || 'User'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}