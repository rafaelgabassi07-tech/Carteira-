
import React, { useRef, useState, useLayoutEffect, useMemo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemHeight: (item: T, index: number) => number;
  containerHeight?: string | number;
  overscan?: number;
  className?: string;
}

function VirtualList<T>({ items, renderItem, getItemHeight, containerHeight = '100%', overscan = 3, className = '' }: VirtualListProps<T>) {
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

  const { offsets, totalHeight } = useMemo(() => {
      const offsets = new Array(items.length);
      let total = 0;
      for (let i = 0; i < items.length; i++) {
          offsets[i] = total;
          total += getItemHeight(items[i], i);
      }
      return { offsets, totalHeight: total };
  }, [items, getItemHeight]);

  const startIndex = useMemo(() => {
      let start = 0;
      let low = 0;
      let high = offsets.length - 1;

      while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          if (offsets[mid] < scrollTop) {
              start = mid;
              low = mid + 1;
          } else {
              high = mid - 1;
          }
      }
      return Math.max(0, start - overscan);
  }, [offsets, scrollTop, overscan]);

  const endIndex = useMemo(() => {
      let end = startIndex;
      const targetLimit = scrollTop + viewportHeight;
      while(end < items.length && offsets[end] < targetLimit) {
          end++;
      }
      return Math.min(items.length, end + overscan);
  }, [startIndex, offsets, scrollTop, viewportHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
      const visible = [];
      for (let i = startIndex; i < endIndex; i++) {
          visible.push({
              item: items[i],
              index: i,
              offset: offsets[i]
          });
      }
      return visible;
  }, [items, startIndex, endIndex, offsets]);

  return (
    <div 
        ref={containerRef} 
        onScroll={onScroll} 
        className={`overflow-y-auto custom-scrollbar ${className}`}
        style={{ height: containerHeight, position: 'relative', willChange: 'transform' }}
    >
      <div style={{ height: totalHeight, width: '100%' }}>
        {visibleItems.map(({ item, index, offset }) => (
             <div 
                key={index} 
                style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    transform: `translateY(${offset}px)`,
                    height: getItemHeight(item, index)
                }}
             >
                 {renderItem(item, index)}
             </div>
        ))}
      </div>
    </div>
  );
}

export default VirtualList;
