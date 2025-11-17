import React from 'react';
import type { AssetItem } from '../data/assets';

export const AssetCard: React.FC<{
  item: AssetItem;
  onClick: (item: AssetItem) => void;
}> = ({ item, onClick }) => {
  return (
    <button
      className="border rounded-md overflow-hidden hover:ring-2 ring-primary focus:outline-none"
      title={item.tags.join(', ')}
      onClick={() => onClick(item)}
    >
      <img src={item.thumb} alt={item.id} className="w-full h-20 object-cover bg-muted" loading="lazy" />
      <div className="text-[10px] p-1 text-center truncate">{item.category}</div>
    </button>
  );
};

export default AssetCard;