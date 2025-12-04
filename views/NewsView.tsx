
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { NewsArticle, ToastMessage } from '../types';
import { fetchMarketNews, type NewsFilter } from '../services/geminiService';
import StarIcon from '../components/icons/StarIcon';
import ShareIcon from '../components/icons/ShareIcon';
import RefreshIcon from '../components/icons/RefreshIcon';
import FilterIcon from '../components/icons/FilterIcon';
import NewsIcon from '../components/icons/NewsIcon';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { CacheManager, vibrate, debounce } from '../utils';
import { CACHE_TTL } from '../constants';

const SentimentBadge: React.FC<{ sentiment: NewsArticle['sentiment'] }> = ({ sentiment }) => {
    const { t } = useI18n();
    const sentimentMap = {
        Positive: { text: t('sentiment_positive'), color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
        Neutral: { text: t('sentiment_neutral'), color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
        Negative: { text: t('sentiment_negative'), color: 'bg-red-500/10 text-red-500 border-red-500/20' },
    };
    const sentimentData = sentiment ? sentimentMap[sentiment] : null;
    if (!sentimentData) return null;
    return (
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${sentimentData.color} uppercase tracking-wider`}>
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
    <div className="bg-[var(--bg-secondary)] rounded-2xl overflow-hidden relative border border-[var(--border-color)]/50 shadow-sm h-full flex flex-col hover:border-[var(--border-color)] transition-colors group">
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[var(--accent-color)] bg-[var(--accent-color)]/10 px-2 py-0.5 rounded border border-[var(--accent-color)]/20 uppercase tracking-wide">
                    {article.source}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] opacity-60">
                    {new Date(article.date).toLocaleDateString()}
                </span>
            </div>
             <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
               <button
                  onClick={handleShare}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-[var(--bg-tertiary-hover)] hover:text-[var(--text-primary)] transition-colors active:scale-90"
                  aria-label={t('share_news')}
              >
                  <ShareIcon className="w-4 h-4" />
              </button>
              <button
                  onClick={handleFavorite}
                  className={`p-1.5 rounded-lg transition-all active:scale-90 ${isFavorited ? 'text-amber-400' : 'text-gray-400 hover:text-amber-400 hover:bg-[var(--bg-tertiary-hover)]'}`}
                  aria-label={isFavorited ? t('remove_from_favorites') : t('add_to_favorites')}
              >
                  <StarIcon filled={isFavorited} className="w-4 h-4" />
              </button>
            </div>
        </div>
        
        <h3 className="text-base font-bold leading-snug text-[var(--text-primary)] mb-3">{article.title}</h3>
        
        <p className={`text-xs text-[var(--text-secondary)] leading-relaxed transition-[max-height] duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-96' : 'max-h-16 opacity-80'}`}>
          {article.summary}
        </p>

        <div className="flex justify-between items-center mt-auto pt-4 border-t border-[var(--border-color)]/50">
          <div className="flex items-center gap-3">
            <SentimentBadge sentiment={article.sentiment} />
             {article.url ? <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-[var(--text-secondary)] hover:text-[var(--accent-color)] text-[10px] font-bold uppercase tracking-wider transition-colors">{t('view_original')}</a> : null}
          </div>
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-[var(--accent-color)] text-[10px] font-bold hover:underline uppercase tracking-wider">
                {isExpanded ? t('read_less') : t('read_more')}
            </button>
        </div>
      </div>
    </div>
  );
};

const NewsCardSkeleton: React.FC = () => (
    <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl animate-pulse border border-[var(--border-color)]">
        <div className="flex justify-between mb-4">
            <div className="h-4 bg-[var(--bg-primary)] rounded w-20"></div>
            <div className="h-4 bg-[var(--bg-primary)] rounded w-8"></div>
        </div>
        <div className="h-5 bg-[var(--bg-primary)] rounded w-full mb-2"></div>
        <div className="h-5 bg-[var(--bg-primary)] rounded w-3/4 mb-4"></div>
        <div className="h-3 bg-[var(--bg-primary)] rounded w-full mb-2"></div>
        <div className="h-3 bg-[var(--bg-primary)] rounded w-2/3"></div>
    </div>
);


const NewsView: React.FC<{addToast: (message: string, type?: ToastMessage['type']) => void; isEmbedded?: boolean }> = ({ addToast, isEmbedded = false }) => {
  const { t } = useI18n();
  const { assets, preferences, logApiUsage } = usePortfolio();
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
        className={`p-4 h-full pb-24 md:pb-6 flex flex-col overflow-y-auto custom-scrollbar landscape-pb-6 ${isEmbedded ? 'pt-2' : ''}`}
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      {!isEmbedded && (
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 transition-all duration-300" 
            style={{ top: `${Math.min(pullPosition / 2, 20) - 20}px`, opacity: pullPosition/70 }}
          >
            <RefreshIcon className={`w-6 h-6 text-[var(--accent-color)] ${loading ? 'animate-spin' : ''}`}/>
          </div>
      )}
      
      <div className="w-full max-w-7xl mx-auto">
        {!isEmbedded && (
            <div className="mb-4">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{t('market_news')}</h1>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mt-0.5">Últimas Atualizações</p>
            </div>
        )}
        
        <div className="flex gap-2 mb-4">
            <div className="flex-1">
                <input 
                    type="text"
                    placeholder={t('search_news_placeholder')}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3.5 text-sm font-medium focus:outline-none focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] transition-all shadow-sm"
                />
            </div>
            
            <button 
                onClick={() => { setShowFilters(!showFilters); vibrate(); }} 
                className={`p-3.5 rounded-xl border transition-all active:scale-95 flex items-center justify-center aspect-square ${showFilters ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] border-[var(--accent-color)] shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)]'}`}
                aria-label="Filtros"
            >
                <FilterIcon className="w-5 h-5" />
            </button>
            <button 
                onClick={handleRefresh} 
                disabled={loading}
                className="p-3.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-95 disabled:opacity-50 border border-[var(--border-color)] flex items-center justify-center aspect-square"
                aria-label={t('refresh_prices')}
            >
                <RefreshIcon className={`w-5 h-5 ${loading ? 'animate-spin text-[var(--accent-color)]' : ''}`} />
            </button>
        </div>
        
        {/* Filter Panel (Horizontal Scroll) */}
        {showFilters && (
            <div className="mb-4 animate-fade-in-up">
                <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
                    {(['today', 'week', 'month'] as const).map((r) => (
                        <button
                            key={r}
                            onClick={() => handleDateRangeChange(r)}
                            className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-full border transition-all whitespace-nowrap ${dateRange === r ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-color)] shadow-sm' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--text-secondary)]'}`}
                        >
                            {r === 'today' ? 'Hoje' : r === 'week' ? 'Esta Semana' : 'Este Mês'}
                        </button>
                    ))}
                    <input 
                      type="text"
                      placeholder="Filtrar por Fonte..."
                      value={sourceFilter}
                      onChange={handleSourceChange}
                      className="flex-shrink-0 w-40 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-full px-4 py-2 text-xs focus:outline-none focus:border-[var(--accent-color)]"
                    />
                </div>
            </div>
        )}
        
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
                {favorites.size > 0 && <span className="bg-[var(--accent-color)] text-[var(--accent-color-text)] px-1.5 py-0.5 rounded-full text-[9px] min-w-[18px] text-center">{favorites.size}</span>}
            </button>
        </div>

        {loading && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({length: 4}).map((_, i) => <NewsCardSkeleton key={i}/>)}</div>}
        
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
          <div className="flex-1">
            {displayedNews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayedNews.map((article, index) => (
                  <div 
                      key={`${article.title}-${index}`} 
                      className="animate-fade-in-up h-full" 
                      style={{ animationDelay: `${index * 50}ms` }}
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
                      <div className="col-span-full text-center pt-6 pb-8">
                          <button onClick={clearFavorites} className="text-xs font-bold text-red-400 hover:text-red-500 hover:underline uppercase tracking-wider transition-colors">
                              {t('clear_favorites')}
                          </button>
                      </div>
                  )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center text-[var(--text-secondary)] animate-fade-in">
                  <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4 border border-[var(--border-color)]">
                      <NewsIcon className="w-8 h-8 opacity-30" />
                  </div>
                  <p className="font-bold text-lg text-[var(--text-primary)]">Sem notícias</p>
                  <p className="text-sm mt-2 max-w-[250px] opacity-70">Tente buscar por outros termos ou ajustar os filtros.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsView;
