import React from 'react';

export const EditorCanvas: React.FC<{ canvasRef: React.RefObject<HTMLCanvasElement> } > = ({ canvasRef }) => {
  return (
    <div className="relative w-full overflow-auto">
      <canvas ref={canvasRef} className="mx-auto block" />
    </div>
  );
};

export default EditorCanvas;