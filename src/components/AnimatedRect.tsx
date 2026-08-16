import React, { useEffect, useRef, useState } from 'react';

interface AnimatedRectProps extends React.SVGProps<SVGRectElement> {
  targetY: number;
  targetHeight: number;
  duration?: number;
}

export function AnimatedRect({ targetY, targetHeight, duration = 1000, ...props }: AnimatedRectProps) {
  const [currentY, setCurrentY] = useState(100);
  const [currentHeight, setCurrentHeight] = useState(0);
  const currentYRef = useRef(100);
  const currentHeightRef = useRef(0);

  useEffect(() => {
    let animationFrameId: number;
    let startTimestamp: number | null = null;
    const startY = currentYRef.current;
    const startHeight = currentHeightRef.current;
    const endY = targetY;
    const endHeight = targetHeight;

    if (startY === endY && startHeight === endHeight) return;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing function (easeOutExpo)
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      const nextY = startY + (endY - startY) * easeProgress;
      const nextHeight = startHeight + (endHeight - startHeight) * easeProgress;
      currentYRef.current = nextY;
      currentHeightRef.current = nextHeight;
      setCurrentY(nextY);
      setCurrentHeight(nextHeight);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        currentYRef.current = endY;
        currentHeightRef.current = endHeight;
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
