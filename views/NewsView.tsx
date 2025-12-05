import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { NewsArticle, ToastMessage } from '../types';
import { fetchMarketNews, type NewsFilter } from '../services/geminiService';
import StarIcon from '../components/icons/StarIcon';
import RefreshIcon from '../components/icons/RefreshIcon';
import NewsIcon from '../components/icons/NewsIcon';
import SearchIcon from '../components/icons/SearchIcon';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { CacheManager, vibrate, debounce } from '../utils';
import { CACHE_TTL } from '../constants';

const SentimentBadge: React.FC<{ sentiment: NewsArticle['sentiment'] }> = ({ sentiment }) => {
    const { t } = useI18n();
    const sentimentMap = {
        Positive: { text: t('sentiment_positive'), color: 'bg-green-500/20 text-green-400 border border-green-500/20' },
        Neutral: { text: t('sentiment_neutral'), color: 'bg-gray-500/20 text-gray-400 border border-gray-500/20' },
        Negative: { text: t('sentiment_negative'), color: 'bg-red-500/20 text-red-400 border border-red-500/20' },
    };
    const sentimentData = sentiment ? sentimentMap[sentiment] : null;
    if (!sentimentData) return null;
    return (
        <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${sentimentData.color}`}>
            {sentimentData.text}
        </span>
    );
};

const NewsCard: React.FC<{ 
  article: NewsArticle;
  isFavorited: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
}> = ({ article, isFavorited, onToggleFavorite }) => {
  const { t } = useI18n();

  return (
    <a 
      href={article.url} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="block bg-[var(--bg-secondary)] rounded-2xl h-full flex flex-col transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-xl group border border-[var(--border-color)] overflow-hidden"
    >
        <div className="relative aspect-video w-full overflow-hidden">
            {article.imageUrl && (
                <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
            <button
                onClick={onToggleFavorite}
                className={`absolute top-3 right-3 p-2 rounded-full transition-all duration-300 active:scale-90 z-10 bg-black/30 backdrop-blur-sm group-hover:bg-black/50 ${isFavorited ? 'text-amber-400' : 'text-white/70 hover:text-amber-400'}`}
                aria-label={isFavorited ? t('remove_from_favorites') : t('add_to_favorites')}
            >
                <StarIcon filled={isFavorited} className="w-5 h-5" />
            </button>
            <div className="absolute bottom-4 left-4 right-4">
                 <h3 className="text-base font-bold leading-tight text-white mb-1.5 line-clamp-2 drop-shadow-md group-hover:text-sky-300 transition-colors">{article.title}</h3>
            </div>
        </div>
        
        <div className="p-5 flex flex-col flex-1">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3 flex-1">
              {article.summary}
            </p>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-[var(--border-color)]">
                <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] font-medium">
                    <span className="font-bold text-[var(--text-primary)] truncate max-w-[120px]">{article.source}</span>
                    <span className="opacity-50">•</span>
                    <span>{new Date(article.date).toLocaleDateString()}</span>
                </div>
                 <SentimentBadge sentiment={article.sentiment} />
            </div>
        </div>
    </a>
  );
};

const NewsCardSkeleton: React.FC = () => (
    <div className="bg-[var(--bg-secondary)] rounded-2xl animate-pulse overflow-hidden border border-[var(--border-color)]">
        <div className="bg-[var(--bg-tertiary-hover)] aspect-video w-full"></div>
        <div className="p-5">
            <div className="h-3 bg-[var(--bg-tertiary-hover)] rounded w-full mb-2"></div>
            <div className="h-3 bg-[var(--bg-tertiary-hover)] rounded w-2/3 mb-6"></div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-[var(--border-color)]">
                <div className="h-3 bg-[var(--bg-tertiary-hover)] rounded w-1/3"></div>
                <div className="h-3 bg-[var(--bg-tertiary-hover)] rounded w-1/4"></div>
            </div>
        </div>
    </div>
);

type NewsViewFilter = 'recent' | 'portfolio' | 'favorites';

const NewsView: React.FC<{addToast: (message: string, type?: ToastMessage['type']) => void; isEmbedded?: boolean }> = ({ addToast, isEmbedded = false }) => {
  const { t } = useI18n();
  const { assets, preferences, logApiUsage } = usePortfolio();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<NewsViewFilter>('recent');

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem('news-favorites');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  
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

  const loadNews = useCallback(async (isRefresh = false) => {
    if(!isRefresh) setLoading(true);
    setError(null);
    
    try {
      const cacheKey = `news_general`;
      
      if (!isRefresh) {
          const cachedNews = CacheManager.get<NewsArticle[]>(cacheKey, CACHE_TTL.NEWS);
          if (cachedNews) {
              setNews(cachedNews);
              setLoading(false);
              setPullPosition(0);
              return;
          }
      }

      const filter: NewsFilter = { tickers: assetTickers };
      const { data: articles, stats } = await fetchMarketNews(preferences, filter);

      if (stats && stats.bytesReceived > 0) {
        logApiUsage('gemini', { requests: 1, ...stats });
      }

      setNews(articles || []);
      if(articles && articles.length > 0) CacheManager.set(cacheKey, articles);

    } catch (err: any) {
      setError(err.message || t('unknown_error'));
    } finally {
      setLoading(false);
      setPullPosition(0);
    }
  }, [t, assetTickers, preferences, logApiUsage]);
  
  const handleRefresh = () => {
    vibrate();
    setLoading(true);
    loadNews(true);
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
          loadNews(true);
      } else {
          setPullPosition(0);
      }
      touchStartY.current = 0;
  };

  useEffect(() => {
    loadNews(false); 
  }, [loadNews]);

  const displayedNews = useMemo(() => {
    let filtered = news;

    if (activeFilter === 'favorites') {
        filtered = news.filter(n => favorites.has(n.title));
    } else if (activeFilter === 'portfolio' && assetTickers.length > 0) {
        const portfolioRegex = new RegExp(assetTickers.join('|'), 'i');
        filtered = news.filter(n => portfolioRegex.test(n.title) || portfolioRegex.test(n.summary));
    }
    
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(n => n.title.toLowerCase().includes(query) || n.summary.toLowerCase().includes(query));
    }

    return filtered;
  }, [news, activeFilter, favorites, searchQuery, assetTickers]);

  const filterPills: { id: NewsViewFilter, label: string }[] = [
      { id: 'recent', label: 'Recentes' },
      { id: 'portfolio', label: 'Minha Carteira' },
      { id: 'favorites', label: 'Favoritas' },
  ];

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
            <div className="mb-4 flex justify-between items-center">
                 <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2"><NewsIcon className="w-6 h-6 text-[var(--accent-color)]"/>{t('market_news')}</h1>
                 <button 
                    onClick={handleRefresh} 
                    disabled={loading}
                    className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95 disabled:opacity-50 border border-[var(--border-color)]"
                    aria-label={t('refresh_prices')}
                >
                    <RefreshIcon className={`w-5 h-5 ${loading ? 'animate-spin text-[var(--accent-color)]' : ''}`} />
                </button>
            </div>
        )}
        
        <div className="relative group mb-4">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent-color)] transition-colors pointer-events-none">
                <SearchIcon className="w-5 h-5" />
            </div>
            <input 
                type="text"
                placeholder={t('search_news_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 pl-12 text-sm font-medium focus:outline-none focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] transition-all shadow-sm"
            />
        </div>
        
        <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl mb-6 border border-[var(--border-color)] shrink-0 shadow-inner">
            {filterPills.map((pill) => (
                <button
                    key={pill.id}
                    onClick={() => setActiveFilter(pill.id)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 uppercase tracking-wide ${activeFilter === pill.id ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                    {pill.label}
                </button>
            ))}
        </div>

        {loading && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{Array.from({length: 6}).map((_, i) => <NewsCardSkeleton key={i}/>)}</div>}
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-8 rounded-2xl text-center">
            <p className="font-bold mb-1">{t('error')}</p>
            <p className="text-sm opacity-80 mb-4">{error}</p>
            <button onClick={() => loadNews(true)} className="bg-[var(--bg-secondary)] border border-[var(--border-color)] font-bold py-2 px-6 rounded-xl text-xs shadow-sm active:scale-95 transition-transform hover:bg-[var(--bg-tertiary-hover)]">
              {t('try_again')}
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="flex-1">
            {displayedNews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedNews.map((article, index) => (
                  <div 
                      key={`${article.title}-${index}`} 
                      className="animate-fade-in-up h-full" 
                      style={{ animationDelay: `${index * 50}ms` }}
                  >
                      <NewsCard 
                          article={article}
                          isFavorited={favorites.has(article.title)}
                          onToggleFavorite={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleToggleFavorite(article.title);
                          }}
                      />
                  </div>
                  ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center text-[var(--text-secondary)] animate-fade-in">
                  <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-[var(--border-color)]">
                      {activeFilter === 'favorites' ? <StarIcon className="w-8 h-8 opacity-30"/> : <NewsIcon className="w-8 h-8 opacity-30" />}
                  </div>
                  <p className="font-bold text-lg text-[var(--text-primary)]">
                      {activeFilter === 'favorites' ? t('no_favorites_title') : t('no_news_found')}
                  </p>
                  <p className="text-sm mt-2 max-w-[250px] opacity-70">
                      {activeFilter === 'favorites' ? t('no_favorites_subtitle') : t('no_news_found_subtitle')}
                  </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsView;