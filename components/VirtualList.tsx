import React, { useRef, useState, useLayoutEffect, useMemo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number; // Altura estimada ou exata de cada item
  containerHeight?: string | number;
  overscan?: number;
  className?: string;
}

function VirtualList<T>({ items, renderItem, itemHeight, containerHeight = '100%', overscan = 3, className = '' }: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(0);

  useLayoutEffect(() => {
    if (containerRef.current) {
      setViewportHeight(containerRef.current.clientHeight);
      
      const observer = new ResizeObserver(entries => {
          for(let entry of entries) {
              setViewportHeight(entry.contentRect.height);
          }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalContentHeight = items.length * itemHeight;
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleNodeCount = Math.ceil(viewportHeight / itemHeight) + 2 * overscan;
  const endIndex = Math.min(items.length, startIndex + visibleNodeCount);

  const visibleItems = useMemo(() => {
      return items.slice(startIndex, endIndex).map((item, index) => ({
          item,
          originalIndex: startIndex + index,
      }));
  }, [items, startIndex, endIndex]);

  const offsetY = startIndex * itemHeight;

  return (
    <div 
        ref={containerRef} 
        onScroll={onScroll} 
        className={`overflow-y-auto custom-scrollbar ${className}`}
        style={{ height: containerHeight }}
    >
      <div style={{ height: totalContentHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)`, position: 'absolute', top: 0, left: 0, width: '100%' }}>
          {visibleItems.map(({ item, originalIndex }) => (
             <React.Fragment key={originalIndex}>
                 {renderItem(item, originalIndex)}
             </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export default VirtualList;