export default function PresenceBar({ avatars }) {
  const items = Array.from(avatars || new Map());
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid #eee' }}>
      {items.map(([userId, info]) => (
        <div key={userId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: info.color }} />
          <span style={{ fontSize: 12, color: '#555' }}>{info.username || 'User'}</span>
        </div>
      ))}
    </div>
  );
}