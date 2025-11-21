import React, { useState, useEffect, useRef } from 'react';

interface CountUpProps {
  end: number;
  duration?: number;
  decimals?: number;
  formatter?: (value: number) => string;
  prefix?: string;
  suffix?: string;
}

const CountUp: React.FC<CountUpProps> = ({ 
  end, 
  duration = 1000, 
  decimals = 2, 
  formatter, 
  prefix = '', 
  suffix = '' 
}) => {
  // FIX: The `useState` hook requires an initial value. Initializing with 0 resolves the error.
  const [count, setCount] = useState(0);
  const startRef = useRef(0);
  const animationRef = useRef<number>();

  useEffect(() => {
    let startTime: number | null = null;
    const startValue = startRef.current;
    const change = end - startValue;

    if (change === 0) {
      setCount(end);
      return;
    }

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      // Ease out quart
      const ease = 1 - Math.pow(1 - percentage, 4);
      
      const currentCount = startValue + (change * ease);
      setCount(currentCount);

      if (progress < duration) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setCount(end);
        startRef.current = end;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      startRef.current = count;
    };
  }, [end, duration]);

  const displayValue = formatter 
    ? formatter(count) 
    : count.toFixed(decimals);

  return (
    <span>
      {prefix}{displayValue}{suffix}
    </span>
  );
};

export default CountUp;