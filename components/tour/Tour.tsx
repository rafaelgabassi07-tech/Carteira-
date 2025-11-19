
import React, { useState, useLayoutEffect, useMemo, useRef } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { debounce } from '../../utils';

interface TourProps {
  onFinish: () => void;
  isPortfolioEmpty: boolean;
}

interface Step {
  element: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const Tour: React.FC<TourProps> = ({ onFinish, isPortfolioEmpty }) => {
  const { t } = useI18n();
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});
  const popoverRef = useRef<HTMLDivElement>(null);

  const tourSteps: Step[] = useMemo(() => [
    {
      element: '#privacy-toggle',
      title: t('tour_privacy_title'),
      content: t('tour_privacy_content'),
      position: 'bottom',
    },
    {
      element: '#notifications-btn',
      title: t('tour_notifications_title'),
      content: t('tour_notifications_content'),
      position: 'bottom',
    },
    {
      element: '#portfolio-summary',
      title: t('tour_step1_title'),
      content: t('tour_step1_content'),
      position: 'bottom',
    },
    ...(isPortfolioEmpty ? [] : [{
      element: '#sort-btn',
      title: t('tour_sort_title'),
      content: t('tour_sort_content'),
      position: 'bottom' as const,
    }]),
    ...(isPortfolioEmpty ? [] : [{
      element: '#share-btn',
      title: t('tour_share_title'),
      content: t('tour_share_content'),
      position: 'bottom' as const,
    }]),
    {
      element: isPortfolioEmpty ? '#add-first-transaction-button' : '#fab-add-transaction',
      title: t('tour_step2_title'),
      content: isPortfolioEmpty ? t('tour_step2_content') : t('tour_step2_content_existing'),
      position: 'top',
    },
    {
      element: '#nav-analise',
      title: t('tour_analysis_title'),
      content: t('tour_analysis_content'),
      position: 'top',
    },
    {
      element: '#nav-noticias',
      title: t('tour_news_title'),
      content: t('tour_news_content'),
      position: 'top',
    },
    {
      element: '#nav-settings',
      title: t('tour_settings_title'),
      content: t('tour_settings_content'),
      position: 'top',
    },
  ], [t, isPortfolioEmpty]);

  const currentStep = tourSteps[stepIndex];

  useLayoutEffect(() => {
    const updatePosition = () => {
      const element = document.querySelector(currentStep.element);
      if (element && popoverRef.current) {
        const rect = element.getBoundingClientRect();
        const popoverRect = popoverRef.current.getBoundingClientRect();
        
        const highlightPadding = 8;
        const popoverMargin = 16;
        const screenPadding = 16;
        
        const hLeft = rect.left - highlightPadding;
        const hTop = rect.top - highlightPadding;
        const hWidth = rect.width + highlightPadding * 2;
        const hHeight = rect.height + highlightPadding * 2;

        setHighlightStyle({
          top: `${hTop}px`,
          left: `${hLeft}px`,
          width: `${hWidth}px`,
          height: `${hHeight}px`,
        });
        
        // New overlay technique using clip-path to avoid rendering issues with SVGs
        const clipPathValue = `polygon(0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%, ${hLeft}px ${hTop}px, ${hLeft + hWidth}px ${hTop}px, ${hLeft + hWidth}px ${hTop + hHeight}px, ${hLeft}px ${hTop + hHeight}px, ${hLeft}px ${hTop}px)`;
        setOverlayStyle({ clipPath: clipPathValue, WebkitClipPath: clipPathValue });

        // --- Improved Popover Positioning ---
        let popoverLeft = rect.left + rect.width / 2 - popoverRect.width / 2;
        if (popoverLeft < screenPadding) popoverLeft = screenPadding;
        if (popoverLeft + popoverRect.width > window.innerWidth - screenPadding) {
          popoverLeft = window.innerWidth - popoverRect.width - screenPadding;
        }

        let popoverTop = 0;
        const spaceAbove = rect.top - popoverMargin;
        const spaceBelow = window.innerHeight - rect.bottom - popoverMargin;
        let finalPosition = currentStep.position;

        if (finalPosition === 'top' && spaceAbove < popoverRect.height) finalPosition = 'bottom';
        if (finalPosition === 'bottom' && spaceBelow < popoverRect.height) finalPosition = 'top';
        if (spaceAbove < popoverRect.height && spaceBelow < popoverRect.height) {
          finalPosition = spaceBelow > spaceAbove ? 'bottom' : 'top';
        }

        if (finalPosition === 'top') {
          popoverTop = rect.top - popoverMargin - popoverRect.height;
        } else {
          popoverTop = rect.bottom + popoverMargin;
        }
        
        setPopoverStyle({
          top: `${popoverTop}px`,
          left: `${popoverLeft}px`,
        });
      }
    };
    
    // Initial calculation with delay for animations
    const initialTimer = setTimeout(updatePosition, 600);
    
    // Debounced listener for resizing
    const debouncedUpdate = debounce(updatePosition, 100);
    window.addEventListener('resize', debouncedUpdate);
    window.addEventListener('scroll', debouncedUpdate, true);

    return () => {
        clearTimeout(initialTimer);
        window.removeEventListener('resize', debouncedUpdate);
        window.removeEventListener('scroll', debouncedUpdate, true);
    };

  }, [stepIndex, currentStep]);

  const handleNext = () => {
    if (stepIndex < tourSteps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      onFinish();
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div 
        className="fixed inset-0 bg-black/70 pointer-events-auto transition-all duration-300 will-change-transform"
        style={overlayStyle}
      />
      <div
        className="absolute border-2 border-dashed border-[var(--accent-color)] rounded-lg transition-all duration-300 will-change-transform"
        style={highlightStyle}
      />
      <div
        ref={popoverRef}
        className="absolute z-50 bg-[var(--bg-secondary)] p-4 rounded-lg w-72 transition-all duration-300 ease-in-out animate-scale-in pointer-events-auto will-change-transform border border-[var(--border-color)] shadow-2xl"
        style={popoverStyle}
      >
        <div className="flex justify-between items-start mb-2">
             <h3 className="font-bold text-lg">{currentStep.title}</h3>
             <button onClick={onFinish} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold px-2 py-1">
                {t('skip_tour')}
            </button>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">{currentStep.content}</p>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 font-mono">{`${stepIndex + 1} / ${tourSteps.length}`}</span>
          <button
            onClick={handleNext}
            className="bg-[var(--accent-color)] text-[var(--accent-color-text)] px-4 py-1.5 rounded-md font-bold text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all"
          >
            {stepIndex === tourSteps.length - 1 ? t('finish_tour') : t('next_step')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tour;
