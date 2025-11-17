import React from 'react';

export const Toolbar: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      {children}
    </div>
  );
};

export default Toolbar;