import React from 'react';

export default function PageThumbnail({ index, page, active, onClick, draggableProps }) {
  const label = page?.name || `Page ${index + 1}`;
  const thumb = page?.thumbnail_url;
  return (
    <div
      className={`border rounded-md p-2 flex items-center gap-2 cursor-pointer ${active ? 'border-foreground' : 'border-border'}`}
      onClick={onClick}
      draggable={true}
      {...draggableProps}
    >
      <div className="w-14 h-10 bg-muted rounded-sm overflow-hidden flex items-center justify-center">
        {thumb ? (
          <img src={thumb} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="text-[10px] text-muted-foreground">No thumb</div>
        )}
      </div>
      <div className="flex-1">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[10px] text-muted-foreground">#{index + 1}</div>
      </div>
    </div>
  );
}