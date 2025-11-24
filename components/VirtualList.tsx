import React, { useRef, useState, useLayoutEffect, useMemo, useEffect } from 'react';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemHeight: (index: number) => number; // Agora aceita uma função para altura variável
  containerHeight?: string | number;
  overscan?: number;
  className?: string;
}

function VirtualList<T>({ items, renderItem, getItemHeight, containerHeight = '100%', overscan = 3, className = '' }: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(0);

  // Observa o tamanho do container
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

  // Calcula as posições (offsets) de todos os itens
  // Isso é necessário para alturas variáveis
  const { offsets, totalHeight } = useMemo(() => {
      const offsets = new Array(items.length);
      let total = 0;
      for (let i = 0; i < items.length; i++) {
          offsets[i] = total;
          total += getItemHeight(i);
      }
      return { offsets, totalHeight: total };
  }, [items, getItemHeight]);

  // Encontra o índice inicial e final visível usando busca binária ou linear simples
  // Como a lista é ordenada por offset, podemos otimizar, mas linear é ok para milhares de itens
  const startIndex = useMemo(() => {
      let start = 0;
      // Encontra o primeiro item que está visível (offset + height > scrollTop)
      while (start < items.length && offsets[start + 1] <= scrollTop) {
          start++;
      }
      return Math.max(0, start - overscan);
  }, [offsets, scrollTop, overscan, items.length]);

  // Calcula o índice final baseado na altura da viewport
  const endIndex = useMemo(() => {
      let end = startIndex;
      let currentOffset = offsets[startIndex];
      const targetOffset = scrollTop + viewportHeight;
      
      while (end < items.length && currentOffset < targetOffset) {
          currentOffset += getItemHeight(end);
          end++;
      }
      return Math.min(items.length, end + overscan);
  }, [startIndex, offsets, getItemHeight, scrollTop, viewportHeight, items.length, overscan]);

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
        style={{ height: containerHeight, position: 'relative' }}
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
                    height: getItemHeight(index)
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