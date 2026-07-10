import React, { useEffect, useState } from 'react';

interface AnimatedRectProps extends React.SVGProps<SVGRectElement> {
  targetY: number;
  targetHeight: number;
  duration?: number;
}

export function AnimatedRect({ targetY, targetHeight, duration = 1000, ...props }: AnimatedRectProps) {
  const [currentY, setCurrentY] = useState(100);
  const [currentHeight, setCurrentHeight] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    let startTimestamp: number | null = null;
    const startY = currentY;
    const startHeight = currentHeight;
    const endY = targetY;
    const endHeight = targetHeight;

    if (startY === endY && startHeight === endHeight) return;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing function (easeOutExpo)
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setCurrentY(startY + (endY - startY) * easeProgress);
      setCurrentHeight(startHeight + (endHeight - startHeight) * easeProgress);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setCurrentY(endY);
        setCurrentHeight(endHeight);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [targetY, targetHeight, duration]);

  return (
    <rect
      y={`${currentY}%`}
      height={`${currentHeight}%`}
      {...props}
    />
  );
}
