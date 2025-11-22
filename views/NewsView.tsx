
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { NewsArticle, ToastMessage } from '../types';
import { fetchMarketNews, type NewsFilter } from '../services/geminiService';
import StarIcon from '../components/icons/StarIcon';
import ShareIcon from '../components/icons/ShareIcon';
import RefreshIcon from '../components/icons/RefreshIcon';
import FilterIcon from '../components/icons/FilterIcon';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { CacheManager, vibrate, debounce } from '../utils';
import { CACHE_TTL } from '../constants';

const SentimentBadge: React.FC<{ sentiment: NewsArticle['sentiment'] }> = ({ sentiment }) => {
    const { t } = useI18n();
    const sentimentMap = {
        Positive: { text: t('sentiment_positive'), color: 'bg-green-500/20 text-green-400' },
        Neutral: { text: t('sentiment_neutral'), color: 'bg-gray-500/20 text-gray-400' },
        Negative: { text: t('sentiment_negative'), color: 'bg-red-500/20 text-red-400' },
    };
    const sentimentData = sentiment ? sentimentMap[sentiment] : null;
    if (!sentimentData) return null;
    return (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sentimentData.color}`}>
            {sentimentData.text}
        </span>
    );
};

const NewsCard: React.FC<{ 
  article: NewsArticle;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  addToast: (message: string, type?: ToastMessage['type']) => void;
}> = ({ article, isFavorited, onToggleFavorite, addToast }) => {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
           addToast(t('toast_share_not_supported'), 'error');
        }
    } catch (err) {
       // addToast(t('toast_share_cancelled'), 'info');
    }
  };

  const handleFavorite = (e: React.MouseEvent) => {
      e.stopPropagation();
      vibrate(20);
      onToggleFavorite();
  }

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg overflow-hidden relative border border-[var(--border-color)] shadow-sm h-full flex flex-col">
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-[var(--accent-color)] font-semibold mb-1">{article.source}</p>
              <h3 className="text-sm font-bold mr-16 leading-tight">{article.title}</h3>
            </div>
             <div className="absolute top-2 right-1 flex flex-row items-center z-10 bg-[var(--bg-secondary)]/80 backdrop-blur-sm rounded-lg p-0.5">
               <button
                  onClick={handleShare}
                  className="p-2 rounded-full text-gray-400 hover:bg-[var(--bg-tertiary-hover)] hover:text-sky-400 transition-colors active:scale-90"
                  aria-label={t('share_news')}
              >
                  <ShareIcon className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-[var(--border-color)] mx-0.5"></div>
              <button
                  onClick={handleFavorite}
                  className={`p-2 rounded-full transition-all active:scale-90 ${isFavorited ? 'text-yellow-400 scale-110' : 'text-gray-400 hover:text-yellow-400 hover:bg-[var(--bg-tertiary-hover)]'}`}
                  aria-label={isFavorited ? t('remove_from_favorites') : t('add_to_favorites')}
              >
                  <StarIcon filled={isFavorited} className="w-4 h-4" />
              </button>
            </div>
        </div>
        
        <p className={`text-xs text-[var(--text-secondary)] mt-3 transition-[max-height] duration-500 ease-in-out overflow-hidden leading-relaxed ${isExpanded ? 'max-h-96' : 'max-h-14'}`}>
          {article.summary}
        </p>

        <div className="flex justify-between items-center mt-auto pt-3 border-t border-[var(--border-color)]">
          <div className="flex items-center space-x-3">
            <SentimentBadge sentiment={article.sentiment} />
             {article.url ? <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-[var(--text-secondary)] hover:text-[var(--accent-color)] text-[10px] font-bold uppercase tracking-wider">{t('view_original')}</a> : <span className="text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-wider opacity-50">{t('view_original')}</span>}
          </div>
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-[var(--accent-color)] text-xs font-bold hover:underline">
                {isExpanded ? t('read_less') : t('read_more')}
            </button>
        </div>
      </div>
    </div>
  );
};

const NewsCardSkeleton: React.FC = () => (
    <div className="bg-[var(--bg-secondary)] p-4 rounded-lg animate-pulse border border-[var(--border-color)]">
        <div className="h-3 bg-gray-700 rounded w-1/4 mb-3"></div>
        <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="h-3 bg-gray-700 rounded w-5/6 mb-2"></div>
        <div className="h-3 bg-gray-700 rounded w-4/6"></div>
        <div className="flex justify-between items-center mt-4">
            <div className="h-3 bg-gray-700 rounded w-1/5"></div>
            <div className="h-2 bg-gray-700 rounded w-1/3"></div>
        </div>
    </div>
);


const NewsView: React.FC<{addToast: (message: string, type?: ToastMessage['type']) => void}> = ({ addToast }) => {
  const { t } = useI18n();
  const { assets, preferences } = usePortfolio();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
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

  const clearFavorites = () => {
      if (window.confirm(t('clear_cache_confirm'))) {
          setFavorites(new Set());
          addToast(t('cache_cleared'), 'success');
          setActiveTab('all');
      }
  }

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

      const articles = await fetchMarketNews(preferences, filter);
      setNews(articles);
      if(articles.length > 0) CacheManager.set(filterKey, articles);

    } catch (err: any) {
      setError(err.message || t('unknown_error'));
    } finally {
      setLoading(false);
      setPullPosition(0);
    }
  }, [t, assetTickers, addToast, preferences]);
  
  // Create a debounced version of the load function for text inputs
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
              if (e.cancelable) e.preventDefault();
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
    loadNews(false, '', 'week', ''); // Initial load
  }, [loadNews]);

  const displayedNews = useMemo(() => {
      return activeTab === 'favorites' 
        ? news.filter(n => favorites.has(n.title))
        : news;
  }, [news, activeTab, favorites]);

  return (
    <div 
        className="p-4 h-full pb-24 md:pb-6 flex flex-col overflow-y-auto custom-scrollbar"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 transition-all duration-300" 
        style={{ top: `${Math.min(pullPosition / 2, 20) - 20}px`, opacity: pullPosition/70 }}
      >
        <RefreshIcon className={`w-6 h-6 text-[var(--accent-color)] ${loading ? 'animate-spin' : ''}`}/>
      </div>
      
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{t('market_news')}</h1>
        <div className="flex gap-2">
             <button 
                onClick={() => { setShowFilters(!showFilters); vibrate(); }} 
                className={`p-2 rounded-full transition-all active:scale-95 border ${showFilters ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] border-[var(--accent-color)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary-hover)]'}`}
                aria-label="Filtros"
            >
                <FilterIcon className="w-5 h-5" />
            </button>
            <button 
                onClick={handleRefresh} 
                disabled={loading}
                className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95 disabled:opacity-50 border border-[var(--border-color)]"
                aria-label={t('refresh_prices')}
            >
                <RefreshIcon className={`w-5 h-5 ${loading ? 'animate-spin text-[var(--accent-color)]' : ''}`} />
            </button>
        </div>
      </div>
      
      {/* Filter Panel */}
      {showFilters && (
          <div className="bg-[var(--bg-secondary)] p-4 rounded-xl mb-4 border border-[var(--border-color)] animate-fade-in-up space-y-4">
               <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2 block">Período</label>
                  <div className="flex bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-color)]">
                    {(['today', 'week', 'month'] as const).map((r) => (
                        <button
                            key={r}
                            onClick={() => handleDateRangeChange(r)}
                            className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${dateRange === r ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            {r === 'today' ? 'Hoje' : r === 'week' ? 'Semana' : 'Mês'}
                        </button>
                    ))}
                  </div>
              </div>
              
               <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2 block">Fontes (Opcional)</label>
                  <input 
                    type="text"
                    placeholder="Ex: InfoMoney, Valor, Brazil Journal"
                    value={sourceFilter}
                    onChange={handleSourceChange}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2 text-sm focus:outline-none focus:border-[var(--accent-color)] transition-colors placeholder:text-[var(--text-secondary)]/50"
                  />
              </div>
          </div>
      )}

      <div className="mb-4">
        <input 
          type="text"
          placeholder={t('search_news_placeholder')}
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3 text-sm focus:outline-none focus:border-[var(--accent-color)] transition-colors shadow-sm"
        />
      </div>
      
      <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl mb-4 border border-[var(--border-color)] shrink-0">
          <button 
            onClick={() => { setActiveTab('all'); vibrate(); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'all' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
              {t('news_tab_all')}
          </button>
           <button 
            onClick={() => { setActiveTab('favorites'); vibrate(); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'favorites' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
              {t('news_tab_favorites')}
              {favorites.size > 0 && <span className="bg-[var(--accent-color)] text-[var(--accent-color-text)] px-1.5 py-0.5 rounded-full text-[9px]">{favorites.size}</span>}
          </button>
      </div>

      {loading && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({length: 5}).map((_, i) => <NewsCardSkeleton key={i}/>)}</div>}
      
      {error && (
        <div className="bg-red-900/50 border border-red-600/50 text-red-200 px-4 py-3 rounded-lg text-center">
          <p className="font-bold">{t('error')}</p>
          <p className="text-sm">{error}</p>
          <button onClick={() => loadNews(true, searchQuery, dateRange, sourceFilter)} className="mt-4 bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-2 px-4 rounded-lg text-sm">
            {t('try_again')}
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="flex-1">
          {displayedNews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedNews.map((article, index) => (
                <div 
                    key={`${article.title}-${index}`} 
                    className="animate-fade-in-up h-full" 
                    style={{ animationDelay: `${index * 70}ms` }}
                >
                    <NewsCard 
                    article={article}
                    isFavorited={favorites.has(article.title)}
                    onToggleFavorite={() => handleToggleFavorite(article.title)}
                    addToast={addToast}
                    />
                </div>
                ))}
                {activeTab === 'favorites' && (
                    <div className="col-span-full text-center pt-4 pb-8">
                        <button onClick={clearFavorites} className="text-xs font-bold text-red-400 hover:underline uppercase tracking-wider">
                            {t('clear_favorites')}
                        </button>
                    </div>
                )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center text-[var(--text-secondary)] animate-fade-in">
                {activeTab === 'favorites' ? (
                    <>
                        <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-[var(--border-color)]">
                            <StarIcon className="w-8 h-8 text-gray-600" />
                        </div>
                        <p className="font-bold text-lg">{t('no_favorites_title')}</p>
                        <p className="text-sm mt-2 max-w-[250px]">{t('no_favorites_subtitle')}</p>
                    </>
                ) : (
                    <p>{t('no_news_found')}</p>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewsView;
