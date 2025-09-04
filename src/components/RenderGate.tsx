import React, { useState, useEffect } from 'react';
import { OctahedronLoader } from '@/components/ui/octahedron-loader';

interface RenderGateProps {
  children: React.ReactNode;
}

export function RenderGate({ children }: RenderGateProps) {
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    // Wait for multiple animation frames to ensure everything is painted
    let frameCount = 0;
    const waitForFrames = () => {
      requestAnimationFrame(() => {
        frameCount++;
        if (frameCount < 5) {
          waitForFrames();
        } else {
          // Add small timeout to be absolutely sure
          setTimeout(() => {
            document.body.classList.add('app-ready');
            setCanRender(true);
          }, 100);
        }
      });
    };
    
    waitForFrames();
  }, []);

  if (!canRender) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <OctahedronLoader size="3xl" />
      </div>
    );
  }

  return <>{children}</>;
}
