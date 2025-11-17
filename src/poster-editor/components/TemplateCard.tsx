import React from 'react';
import type { TemplateItem } from '../data/templates';

export const TemplateCard: React.FC<{
  item: TemplateItem;
  onClick: (item: TemplateItem) => void;
}> = ({ item, onClick }) => {
  return (
    <button
      className="border rounded-md overflow-hidden hover:ring-2 ring-primary focus:outline-none"
      title={item.name}
      onClick={() => onClick(item)}
    >
      <img src={item.thumbnail} alt={item.name} className="w-full h-20 object-cover bg-muted" loading="lazy" />
      <div className="text-xs p-1 text-center truncate">{item.name}</div>
    </button>
  );
};

export default TemplateCard;