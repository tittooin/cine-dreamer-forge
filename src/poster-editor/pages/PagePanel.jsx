import React, { useState } from 'react';
import PageThumbnail from './PageThumbnail.jsx';

export default function PagePanel({
  pages,
  activeIndex,
  onSwitch,
  onAdd,
  onDuplicate,
  onDelete,
  onRename,
  onReorder,
  onExportPDF,
  onExportAllPNG,
}) {
  const [dragIndex, setDragIndex] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const [editValue, setEditValue] = useState('');

  const startDrag = (index) => (e) => { setDragIndex(index); e.dataTransfer.effectAllowed = 'move'; };
  const overDrag = (index) => (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const dropDrag = (index) => (e) => { e.preventDefault(); if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index); setDragIndex(null); };

  const beginRename = (index, current) => { setEditIndex(index); setEditValue(current || ''); };
  const commitRename = (index) => { onRename(index, editValue.trim() || `Page ${index + 1}`); setEditIndex(null); setEditValue(''); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pages</h3>
        <div className="flex items-center gap-2">
          <button className="text-xs px-2 py-1 rounded border" onClick={onAdd}>Add Page</button>
          <button className="text-xs px-2 py-1 rounded border" onClick={() => onDuplicate(activeIndex)} disabled={!pages.length}>Duplicate</button>
          <button className="text-xs px-2 py-1 rounded border" onClick={() => onDelete(activeIndex)} disabled={pages.length <= 1}>Delete</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {pages.map((p, i) => (
          <div key={p.id}
               onDragOver={overDrag(i)}
               onDrop={dropDrag(i)}
               className="rounded-md border p-2 bg-card">
            <PageThumbnail
              index={i}
              page={p}
              active={i === activeIndex}
              onClick={() => onSwitch(i)}
              draggableProps={{ onDragStart: startDrag(i) }}
            />
            <div className="mt-2 flex items-center justify-between">
              {editIndex === i ? (
                <div className="flex items-center gap-2">
                  <input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="text-xs px-2 py-1 border rounded" />
                  <button className="text-xs px-2 py-1 border rounded" onClick={() => commitRename(i)}>Save</button>
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground">{p.name || `Page ${i + 1}`}</div>
              )}
              {editIndex !== i && (
                <button className="text-[11px] px-2 py-1 border rounded" onClick={() => beginRename(i, p.name)}>Rename</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t flex items-center gap-2">
        <button className="text-xs px-2 py-1 rounded border" onClick={onExportPDF}>Export PDF</button>
        <button className="text-xs px-2 py-1 rounded border" onClick={onExportAllPNG}>Export All PNG</button>
      </div>
    </div>
  );
}