import React from 'react';

export const RightPanel: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <div className="rounded-lg border border-border p-4">
      {children}
    </div>
  );
};

export default RightPanel;