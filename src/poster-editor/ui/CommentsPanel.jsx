import { useState } from 'react';

export default function CommentsPanel({ comments, onAddComment, enabled, onToggle }) {
  const [text, setText] = useState('');
  return (
    <div style={{ borderTop: '1px solid #eee', padding: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 12 }}>Comments</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
          Comment mode
        </label>
      </div>
      <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
        {(comments || []).map((c) => (
          <div key={c.id} style={{ fontSize: 12, padding: 6, border: '1px solid #eee', borderRadius: 6 }}>
            <div style={{ color: '#666' }}>{c.username}</div>
            <div>{c.comment}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <input style={{ flex: 1 }} placeholder="Type comment, then click on canvas" value={text} onChange={(e) => setText(e.target.value)} />
        <button onClick={() => onAddComment(text)} disabled={!text}>Prepare</button>
      </div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
        Tip: Enable Comment mode, click canvas to place a pin.
      </div>
    </div>
  );
}