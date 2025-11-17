import React from 'react';

type TabId = 'pages' | 'tools' | 'templates' | 'assets' | 'ai' | 'branding' | 'animation' | 'media' | 'effects';

export const Tabs: React.FC<{
  active: TabId;
  onChange: (tab: TabId) => void;
}> = ({ active, onChange }) => {
  const tabs: { id: TabId; label: string }[] = [
    { id: 'pages', label: 'Pages' },
    { id: 'tools', label: 'Tools' },
    { id: 'templates', label: 'Templates' },
    { id: 'assets', label: 'Assets' },
    { id: 'ai', label: 'AI' },
    { id: 'branding', label: 'Branding' },
    { id: 'animation', label: 'Animation' },
    { id: 'media', label: 'Media' },
    { id: 'effects', label: 'Effects' },
  ];

  return (
    <div className="mb-3 -mx-2 px-2 overflow-x-auto md:overflow-visible">
      <div className="flex gap-2 md:gap-1 whitespace-nowrap md:whitespace-normal md:flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`flex-shrink-0 px-3 py-1 rounded-md text-xs md:text-sm font-medium border ${active===t.id ? 'bg-muted text-foreground border-primary' : 'bg-background border-border'}`}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Tabs;