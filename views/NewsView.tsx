

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { NewsArticle, ToastMessage } from '../types';
import { fetchMarketNews, type NewsFilter } from '../services/geminiService';
import StarIcon from '../components/icons/StarIcon';
import ShareIcon from '../components/icons/ShareIcon';
import RefreshIcon from '../components/icons/RefreshIcon';
import FilterIcon from '../components/icons/FilterIcon';
import GlobeIcon from '../components/icons/GlobeIcon';
import NewsIcon from '../components/icons/NewsIcon';
import Modal from '../components/modals/Modal'; // Reutilizando o Modal existente
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { CacheManager, vibrate, debounce } from '../utils';
import { CACHE_TTL } from '../constants';

// --- Sub-components ---

const SentimentIndicator: React.FC<{ sentiment: NewsArticle['sentiment'], type?: 'bar' | 'badge' }> = ({ sentiment, type = 'badge' }) => {
    const { t } = useI18n();
    const colors = {
        Positive: 'bg-emerald-500',
        Neutral: 'bg-gray-400',
        Negative: 'bg-rose-500',
    };
    const bgColors = {
        Positive: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        Neutral: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
        Negative: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    };

    const colorClass = sentiment ? colors[sentiment] : colors.Neutral;
    const badgeClass = sentiment ? bgColors[sentiment] : bgColors.Neutral;
    const label = sentiment ? t(`sentiment_${sentiment.toLowerCase()}`) : 'Neutro';

    if (type === 'bar') {
        return <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorClass}`}></div>;
    }

    return (
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider ${badgeClass}`}>
            {label}
        </span>
    );
};

const NewsCard: React.FC<{ 
  article: NewsArticle;
  isFavorited: boolean;
  onClick: () => void;
}> = ({ article, isFavorited, onClick }) => {
  return (
    <div 
        onClick={() => { vibrate(); onClick(); }}
        className="group relative bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden cursor-pointer active:scale-[0.98] transition-all hover:border-[var(--accent-color)]/30 hover:shadow-md flex flex-col min-h-[120px]"
    >
      {/* Visual Sentiment Strip */}
      <SentimentIndicator sentiment={article.sentiment} type="bar" />

      <div className="p-4 pl-5 flex flex-col h-full">
        {/* Header: Source & Date */}
        <div className="flex justify-between items-start mb-2 opacity-70">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">{article.source}</span>
                <span className="text-[10px] text-[var(--text-secondary)]">•</span>
                <span className="text-[10px] text-[var(--text-secondary)]">
                    {new Date(article.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                </span>
            </div>
            {isFavorited && <StarIcon filled className="w-3 h-3 text-amber-400" />}
        </div>
        
        {/* Title */}
        <h3 className="text-sm font-bold leading-snug text-[var(--text-primary)] mb-2 line-clamp-3 group-hover:text-[var(--accent-color)] transition-colors">
            {article.title}
        </h3>
        
        {/* Summary Snippet */}
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2 opacity-80">
          {article.summary}
        </p>
      </div>
    </div>
  );
};

const NewsDetailModal: React.FC<{
    article: NewsArticle;
    onClose: () => void;
    isFavorited: boolean;
    onToggleFavorite: () => void;
    addToast: (msg: string, type: any) => void;
}> = ({ article, onClose, isFavorited, onToggleFavorite, addToast }) => {
    const { t } = useI18n();

    const handleShare = async () => {
        vibrate();
        const shareData = {
            title: article.title,
            text: article.summary,
            url: article.url || window.location.href,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(article.url || '');
                addToast('Link copiado!', 'success');
            }
        } catch (err) {}
    };

    return (
        <Modal title={article.source} onClose={onClose} type="slide-up">
            <div className="flex flex-col space-y-5 pb-6">
                
                {/* Meta Header */}
                <div className="flex justify-between items-center">
                    <span className="text-xs text-[var(--text-secondary)]">
                        {new Date(article.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    <SentimentIndicator sentiment={article.sentiment} />
                </div>

                {/* Content */}
                <div>
                    <h2 className="text-xl font-bold leading-tight mb-4 text-[var(--text-primary)]">{article.title}</h2>
                    <div className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)]">
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                            {article.summary}
                        </p>
                    </div>
                </div>

                {/* Actions Bar */}
                <div className="grid grid-cols-4 gap-3 pt-2">
                    <button 
                        onClick={onToggleFavorite}
                        className={`col-span-1 flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all active:scale-95 ${isFavorited ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-secondary)]'}`}
                    >
                        <StarIcon filled={isFavorited} className="w-5 h-5" />
                        <span className="text-[9px] font-bold uppercase">{isFavorited ? 'Salvo' : 'Salvar'}</span>
                    </button>

                    <button 
                        onClick={handleShare}
                        className="col-span-1 flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-secondary)] transition-all active:scale-95 hover:text-[var(--text-primary)]"
                    >
                        <ShareIcon className="w-5 h-5" />
                        <span className="text-[9px] font-bold uppercase">Share</span>
                    </button>

                    <a 
                        href={article.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="col-span-2 flex items-center justify-center gap-2 p-3 rounded-xl bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold shadow-lg shadow-[var(--accent-color)]/20 active:scale-95 transition-transform"
                    >
                        <span className="text-xs uppercase tracking-wide">{t('view_original')}</span>
                        <GlobeIcon className="w-4 h-4" />
                    </a>
                </div>
            </div>
        </Modal>
    );
};

const NewsCardSkeleton: React.FC = () => (
    <div className="bg-[var(--bg-secondary)] p-4 rounded-xl animate-pulse border border-[var(--border-color)] h-[120px] flex flex-col justify-between">
        <div className="flex justify-between">
            <div className="h-3 bg-[var(--bg-primary)] rounded w-20"></div>
            <div className="h-3 bg-[var(--bg-primary)] rounded w-8"></div>
        </div>
        <div className="space-y-2">
            <div className="h-4 bg-[var(--bg-primary)] rounded w-full"></div>
            <div className="h-4 bg-[var(--bg-primary)] rounded w-2/3"></div>
        </div>
        <div className="h-2 bg-[var(--bg-primary)] rounded w-full mt-2 opacity-50"></div>
    </div>
);


const NewsView: React.FC<{addToast: (message: string, type?: ToastMessage['type']) => void; isEmbedded?: boolean }> = ({ addToast, isEmbedded = false }) => {
  const { t } = useI18n();
  const { assets, preferences, logApiUsage } = usePortfolio();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week');
  const [sourceFilter, setSourceFilter] = useState('');

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem('news-favorites');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  
  const touchStartY = useRef(0);
  const [pullPosition, setPullPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const assetTickers = useMemo(() => assets.map(a => a.ticker), [assets]);

  useEffect(() => {
    localStorage.setItem('news-favorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  const handleToggleFavorite = (articleTitle: string) => {
    vibrate(20);
    setFavorites(prevFavorites => {
      const newFavorites = new Set(prevFavorites);
      if (newFavorites.has(articleTitle)) {
        newFavorites.delete(articleTitle);
      } else {
        newFavorites.add(articleTitle);
      }
      return newFavorites;
    });
  };

  const loadNews = useCallback(async (isRefresh = false, currentQuery: string, currentDateRange: 'today' | 'week' | 'month', currentSource: string) => {
    if(!isRefresh) setLoading(true);
    setError(null);
    
    try {
      const filterKey = `news_${currentQuery}_${currentDateRange}_${currentSource}`.toLowerCase().replace(/\s+/g, '_');
      
      if (!isRefresh) {
          const cachedNews = CacheManager.get<NewsArticle[]>(filterKey, CACHE_TTL.NEWS);
          if (cachedNews) {
              setNews(cachedNews);
              setLoading(false);
              setPullPosition(0);
              return;
          }
      }

      const filter: NewsFilter = {
          query: currentQuery,
          tickers: assetTickers,
          dateRange: currentDateRange,
          sources: currentSource
      };

      const { data: articles, stats } = await fetchMarketNews(preferences, filter);
      if (stats && stats.bytesReceived > 0) {
        logApiUsage('gemini', { requests: 1, ...stats });
      }

      setNews(articles || []);
      if(articles && articles.length > 0) CacheManager.set(filterKey, articles);

    } catch (err: any) {
      setError(err.message || t('unknown_error'));
    } finally {
      setLoading(false);
      setPullPosition(0);
    }
  }, [t, assetTickers, addToast, preferences, logApiUsage]);
  
  const debouncedLoadNews = useCallback(debounce((q: string, d: 'today'|'week'|'month', s: string) => loadNews(true, q, d, s), 800), [loadNews]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setLoading(true);
      debouncedLoadNews(e.target.value, dateRange, sourceFilter);
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSourceFilter(e.target.value);
      setLoading(true);
      debouncedLoadNews(searchQuery, dateRange, e.target.value);
  };

  const handleDateRangeChange = (range: 'today' | 'week' | 'month') => {
      setDateRange(range);
      setLoading(true);
      loadNews(true, searchQuery, range, sourceFilter);
  };
  
  const handleRefresh = () => {
    vibrate();
    setLoading(true);
    loadNews(true, searchQuery, dateRange, sourceFilter);
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
      if(containerRef.current && containerRef.current.scrollTop === 0) {
          touchStartY.current = e.targetTouches[0].clientY;
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if(touchStartY.current > 0 && !loading) {
          const touchY = e.targetTouches[0].clientY;
          const pullDistance = touchY - touchStartY.current;
          if(pullDistance > 0) {
              if (!isEmbedded && e.cancelable) e.preventDefault();
              setPullPosition(Math.min(pullDistance, 100));
          }
      }
  };
  
  const handleTouchEnd = () => {
      if(pullPosition > 70) {
          setLoading(true);
          loadNews(true, searchQuery, dateRange, sourceFilter);
      } else {
          setPullPosition(0);
      }
      touchStartY.current = 0;
  };

  useEffect(() => {
    loadNews(false, '', 'week', ''); 
  }, [loadNews]);

  const displayedNews = useMemo(() => {
      return activeTab === 'favorites' 
        ? news.filter(n => favorites.has(n.title))
        : news;
  }, [news, activeTab, favorites]);

  return (
    <div 
        className={isEmbedded ? 'space-y-4' : `p-4 h-full pb-32 md:pb-6 flex flex-col landscape-pb-6 pt-2`}
        ref={containerRef}
        onTouchStart={!isEmbedded ? handleTouchStart : undefined}
        onTouchMove={!isEmbedded ? handleTouchMove : undefined}
        onTouchEnd={!isEmbedded ? handleTouchEnd : undefined}
    >
      {!isEmbedded && (
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 transition-all duration-300" 
            style={{ top: `${Math.min(pullPosition / 2, 20) - 20}px`, opacity: pullPosition/70 }}
          >
            <RefreshIcon className={`w-6 h-6 text-[var(--accent-color)] ${loading ? 'animate-spin' : ''}`}/>
          </div>
      )}
      
      <div className={`w-full mx-auto ${isEmbedded ? '' : 'max-w-2xl'}`}>
        {!isEmbedded && (
            <div className="mb-4 pt-safe">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{t('market_news')}</h1>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-0.5">Últimas Atualizações</p>
            </div>
        )}
        
        {/* Search & Filter Bar */}
        <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
                <input 
                    type="text"
                    placeholder={t('search_news_placeholder')}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl py-3 pl-4 pr-10 text-sm font-medium focus:outline-none focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] transition-all shadow-sm"
                />
            </div>
            
            <button 
                onClick={() => { setShowFilters(!showFilters); vibrate(); }} 
                className={`p-3 rounded-xl border transition-all active:scale-95 flex items-center justify-center aspect-square ${showFilters ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] border-[var(--accent-color)] shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)]'}`}
                aria-label="Filtros"
            >
                <FilterIcon className="w-5 h-5" />
            </button>
            <button 
                onClick={handleRefresh} 
                disabled={loading}
                className="p-3 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-95 disabled:opacity-50 border border-[var(--border-color)] flex items-center justify-center aspect-square"
                aria-label={t('refresh_prices')}
            >
                <RefreshIcon className={`w-5 h-5 ${loading ? 'animate-spin text-[var(--accent-color)]' : ''}`} />
            </button>
        </div>
        
        {/* Filter Panel (Collapsible) */}
        {showFilters && (
            <div className="mb-4 animate-fade-in-up bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-color)]">
                <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2">
                    {(['today', 'week', 'month'] as const).map((r) => (
                        <button
                            key={r}
                            onClick={() => handleDateRangeChange(r)}
                            className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-lg border transition-all whitespace-nowrap ${dateRange === r ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] border-[var(--accent-color)]' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-color)]'}`}
                        >
                            {r === 'today' ? 'Hoje' : r === 'week' ? 'Esta Semana' : 'Este Mês'}
                        </button>
                    ))}
                </div>
                <input 
                    type="text"
                    placeholder="Filtrar por Fonte (Ex: Bloomberg)..."
                    value={sourceFilter}
                    onChange={handleSourceChange}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[var(--accent-color)]"
                />
            </div>
        )}
        
        {/* Tab Switcher */}
        <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl mb-6 border border-[var(--border-color)] shrink-0 shadow-sm">
            <button 
              onClick={() => { setActiveTab('all'); vibrate(); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'all' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
                {t('news_tab_all')}
            </button>
             <button 
              onClick={() => { setActiveTab('favorites'); vibrate(); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'favorites' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
                {t('news_tab_favorites')}
                {favorites.size > 0 && <span className="bg-[var(--accent-color)] text-[var(--accent-color-text)] px-1.5 py-0.5 rounded-full text-[9px] min-w-[18px] text-center leading-none">{favorites.size}</span>}
            </button>
        </div>

        {/* Content Area */}
        {loading && <div className="space-y-3">{Array.from({length: 5}).map((_, i) => <NewsCardSkeleton key={i}/>)}</div>}
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-8 rounded-2xl text-center">
            <p className="font-bold mb-1">{t('error')}</p>
            <p className="text-sm opacity-80 mb-4">{error}</p>
            <button onClick={() => loadNews(true, searchQuery, dateRange, sourceFilter)} className="bg-[var(--bg-secondary)] border border-[var(--border-color)] font-bold py-2 px-6 rounded-xl text-xs shadow-sm active:scale-95 transition-transform hover:bg-[var(--bg-tertiary-hover)]">
              {t('try_again')}
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="flex-1 space-y-3">
            {displayedNews.length > 0 ? (
                displayedNews.map((article, index) => (
                  <div 
                      key={`${article.title}-${index}`} 
                      className="animate-fade-in-up" 
                      style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
                  >
                      <NewsCard 
                        article={article}
                        isFavorited={favorites.has(article.title)}
                        onClick={() => setSelectedArticle(article)}
                      />
                  </div>
                ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--text-secondary)] animate-fade-in">
                  <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4 border border-[var(--border-color)]">
                      {activeTab === 'favorites' ? <StarIcon className="w-8 h-8 opacity-30" /> : <NewsIcon className="w-8 h-8 opacity-30" />}
                  </div>
                  <p className="font-bold text-lg text-[var(--text-primary)]">{activeTab === 'favorites' ? t('no_favorites_title') : 'Sem notícias'}</p>
                  <p className="text-sm mt-2 max-w-[250px] opacity-70">{activeTab === 'favorites' ? t('no_favorites_subtitle') : 'Tente buscar por outros termos ou ajustar os filtros.'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedArticle && (
          <NewsDetailModal 
            article={selectedArticle}
            onClose={() => setSelectedArticle(null)}
            isFavorited={favorites.has(selectedArticle.title)}
            onToggleFavorite={() => handleToggleFavorite(selectedArticle.title)}
            addToast={addToast}
          />
      )}
    </div>
  );
};

export default NewsView;