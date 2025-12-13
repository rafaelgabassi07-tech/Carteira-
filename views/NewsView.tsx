
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

const SentimentBadge: React.FC<{ sentimentScore?: number }> = ({ sentimentScore }) => {
    const { t } = useI18n();
    const getSentimentFromScore = (score: number | undefined): 'Positive' | 'Neutral' | 'Negative' | null => {
        if (score === undefined) return null;
        if (score > 0.2) return 'Positive';
        if (score < -0.2) return 'Negative';
        return 'Neutral';
    };
    const sentiment = getSentimentFromScore(sentimentScore);

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
    } catch (err) { }
  };

  const handleFavorite = (e: React.MouseEvent) => {
      e.stopPropagation();
      vibrate(20);
      onToggleFavorite();
  }

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg overflow-hidden relative border border-[var(--border-color)] shadow-sm h-full flex flex-col hover:border-[var(--accent-color)]/30 transition-colors">
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start">
            <div className="flex-1 mr-8">
              <p className="text-[10px] text-[var(--accent-color)] font-bold uppercase mb-1">{article.source}</p>
              <h3 className="text-sm font-bold leading-tight line-clamp-3">{article.title}</h3>
            </div>
             <div className="absolute top-2 right-1 flex flex-row items-center z-10 bg-[var(--bg-secondary)]/90 backdrop-blur-sm rounded-lg p-0.5 border border-[var(--border-color)]">
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
        
        <p className={`text-xs text-[var(--text-secondary)] mt-3 transition-[max-height] duration-300 ease-in-out overflow-hidden leading-relaxed ${isExpanded ? 'max-h-96' : 'max-h-16'}`}>
          {article.summary}
        </p>

        <div className="flex justify-between items-center mt-auto pt-3 border-t border-[var(--border-color)]">
          <div className="flex items-center space-x-3">
            <SentimentBadge sentimentScore={article.sentimentScore} />
             {article.url ? <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-[var(--text-secondary)] hover:text-[var(--accent-color)] text-[10px] font-bold uppercase tracking-wider">{t('view_original')}</a> : null}
          </div>
          <button onClick={() => setIsExpanded(!isExpanded)} className="text-[var(--accent-color)] text-[10px] font-bold hover:underline uppercase tracking-wide">
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
  const { assets, preferences, logApiUsage } = usePortfolio();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today'); // Default to Today
  const [sourceFilter, setSourceFilter] = useState('');

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem('news-favorites');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  
  // Touch Handling for Pull-to-Refresh logic is managed by parent container usually, but basic implementation here for standalone feel
  const containerRef = useRef<HTMLDivElement>(null);

  const assetTickers = useMemo(() => assets.map(a => a.ticker), [assets]);

  useEffect(() => {
    localStorage.setItem('news-favorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  const handleToggleFavorite = (articleTitle: string) => {
    setFavorites(prevFavorites => {
      const newFavorites = new Set(prevFavorites);
      if (newFavorites.has(articleTitle)) newFavorites.delete(articleTitle);
      else newFavorites.add(articleTitle);
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
    setLoading(true);
    setError(null);
    
    try {
      const filterKey = `news_v2_${currentQuery}_${currentDateRange}_${currentSource}_${assetTickers.slice(0,3).join('')}`.toLowerCase().replace(/\s+/g, '_');
      
      // Try cache first if not refreshing
      if (!isRefresh) {
          const cachedNews = await CacheManager.get<NewsArticle[]>(filterKey, CACHE_TTL.NEWS);
          if (cachedNews && cachedNews.length > 0) {
              setNews(cachedNews);
              setLoading(false);
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

      if (articles && articles.length > 0) {
          setNews(articles);
          CacheManager.set(filterKey, articles);
      } else {
          setNews([]); // No news found case
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || t('unknown_error'));
    } finally {
      setLoading(false);
    }
  }, [t, assetTickers, addToast, preferences, logApiUsage]);
  
  const debouncedLoadNews = useCallback(debounce((q: string, d: 'today'|'week'|'month', s: string) => loadNews(true, q, d, s), 1000), [loadNews]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearchQuery(val);
      if(!val || val.length > 3) {
          setLoading(true);
          debouncedLoadNews(val, dateRange, sourceFilter);
      }
  };

  // Initial Load
  useEffect(() => {
      loadNews(false, '', 'today', ''); 
  }, []);

  const handleRefresh = () => {
    vibrate();
    loadNews(true, searchQuery, dateRange, sourceFilter);
  };

  const displayedNews = useMemo(() => {
      return activeTab === 'favorites' 
        ? news.filter(n => favorites.has(n.title))
        : news;
  }, [news, activeTab, favorites]);

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col">
        {/* Header Controls */}
        <div className="flex flex-col gap-4 mb-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">{t('market_news')}</h1>
                <div className="flex gap-2">
                    <button 
                        onClick={() => { setShowFilters(!showFilters); vibrate(); }} 
                        className={`p-2 rounded-full transition-all active:scale-95 border ${showFilters ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] border-[var(--accent-color)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary-hover)]'}`}
                    >
                        <FilterIcon className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={handleRefresh} 
                        disabled={loading}
                        className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95 disabled:opacity-50 border border-[var(--border-color)]"
                    >
                        <RefreshIcon className={`w-5 h-5 ${loading ? 'animate-spin text-[var(--accent-color)]' : ''}`} />
                    </button>
                </div>
            </div>

            {showFilters && (
                <div className="bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)] animate-fade-in-up space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2 block">Período</label>
                        <div className="flex bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-color)]">
                        {(['today', 'week', 'month'] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => { setDateRange(r); setLoading(true); loadNews(true, searchQuery, r, sourceFilter); }}
                                className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${dateRange === r ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                {r === 'today' ? 'Hoje' : r === 'week' ? 'Semana' : 'Mês'}
                            </button>
                        ))}
                        </div>
                    </div>
                </div>
            )}

            <input 
                type="text"
                placeholder={t('search_news_placeholder')}
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3 text-sm focus:outline-none focus:border-[var(--accent-color)] transition-colors shadow-sm"
            />
            
            <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)] shrink-0">
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
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-[300px]">
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({length: 6}).map((_, i) => <NewsCardSkeleton key={i}/>)}
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] border-dashed">
                    <p className="font-bold text-red-400 mb-2">{t('error')}</p>
                    <p className="text-sm text-[var(--text-secondary)] mb-4 max-w-md">{error}</p>
                    <button onClick={handleRefresh} className="bg-[var(--accent-color)] text-[var(--accent-color-text)] font-bold py-2 px-6 rounded-lg text-sm shadow-lg hover:opacity-90">
                        {t('try_again')}
                    </button>
                </div>
            ) : displayedNews.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 landscape-grid-cols-3 pb-8">
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
                        <div className="col-span-full text-center pt-8 pb-4">
                            <button onClick={clearFavorites} className="text-xs font-bold text-red-400 hover:underline uppercase tracking-wider border border-red-400/30 px-4 py-2 rounded-lg hover:bg-red-400/10 transition-colors">
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
                        <>
                            <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4 border border-[var(--border-color)]">
                                <RefreshIcon className="w-8 h-8 text-gray-600 opacity-50" />
                            </div>
                            <p className="font-bold">{t('no_news_found')}</p>
                            <p className="text-sm mt-2 max-w-[250px] opacity-70">{t('no_news_found_subtitle')}</p>
                        </>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default NewsView;
