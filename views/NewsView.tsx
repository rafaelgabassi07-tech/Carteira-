
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
  // Removed internal state for expansion to keep UI cleaner/faster like Google News
  
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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
      e.preventDefault();
      vibrate(20);
      onToggleFavorite();
  }

  const [imgSrc, setImgSrc] = useState(article.imageUrl || getFallbackImage(article.title));

  return (
    <a 
        href={article.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="bg-[var(--bg-secondary)] rounded-xl overflow-hidden relative border border-[var(--border-color)] shadow-sm hover:bg-[var(--bg-tertiary-hover)] transition-all duration-300 flex flex-col h-full group active:scale-[0.99]"
    >
      {/* Desktop: Image Top. Mobile: Image Right (Handled via Grid in parent or flex here if needed, but kept stack for consistency with "Card" request) */}
      <div className="h-40 overflow-hidden relative">
           <img 
                src={imgSrc} 
                alt=""
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                onError={() => setImgSrc(getFallbackImage(article.title))}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)]/80 to-transparent opacity-60"></div>
            <div className="absolute top-2 right-2 flex gap-1">
                 <button onClick={handleFavorite} className={`p-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 transition-colors ${isFavorited ? 'text-yellow-400' : 'text-gray-300 hover:text-white'}`}>
                    <StarIcon filled={isFavorited} className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="absolute bottom-2 left-2">
                 <span className="text-[10px] font-bold text-white bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
                    {article.category || 'FIIs'}
                 </span>
            </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
            <img src={getFavicon(article.url || '')} className="w-3.5 h-3.5 rounded-sm" onError={(e) => e.currentTarget.style.display = 'none'} />
            <span className="text-[10px] font-bold text-[var(--accent-color)] uppercase truncate">{article.source}</span>
            <span className="text-[10px] text-[var(--text-secondary)]">• {timeAgo(article.date)}</span>
        </div>

        <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug line-clamp-3 mb-2 group-hover:text-[var(--accent-color)] transition-colors">
            {article.title}
        </h3>
        
        <p className="text-xs text-[var(--text-secondary)] line-clamp-3 leading-relaxed mb-3">
          {article.summary}
        </p>

        <div className="mt-auto flex justify-between items-center pt-3 border-t border-[var(--border-color)]">
             <SentimentBadge sentiment={article.sentiment} />
             <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                <button onClick={handleShare} className="hover:text-[var(--text-primary)] transition-colors"><ShareIcon className="w-4 h-4" /></button>
             </div>
        </div>
      </div>
    </a>
  );
};

// --- Helpers ---
const getFavicon = (url: string) => {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch { return ''; }
};

const getFallbackImage = (title: string, category?: string) => {
    const images = [
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80', // Building Glass
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80', // Chart
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80', // Keys
        'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80', // Meeting
        'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=800&q=80', // Model House
        'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80', // Money Plant
        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80', // Stock Screen
        'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=80', // Meeting 2
    ];
    
    let hash = 0;
    for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
    return images[Math.abs(hash) % images.length];
};

const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 3600) return "Recente";
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
};

// --- Components ---

const NewsHero: React.FC<{ article: NewsArticle }> = ({ article }) => {
    const [imgSrc, setImgSrc] = useState(article.imageUrl || getFallbackImage(article.title));

    return (
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="block relative w-full aspect-[16/9] md:aspect-[21/9] rounded-3xl overflow-hidden shadow-2xl mb-8 group cursor-pointer ring-1 ring-white/10 transition-transform duration-500 hover:scale-[1.01]">
            <img 
                src={imgSrc} 
                alt={article.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                loading="eager"
                onError={() => setImgSrc(getFallbackImage(article.title))}
            />
            {/* Strong Gradient Overlay for Text Readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-90"></div>
            
            <div className="absolute bottom-0 left-0 p-6 md:p-10 w-full md:w-3/4 lg:w-2/3">
                <div className="flex items-center gap-3 mb-3">
                    <span className="bg-[var(--accent-color)] text-[var(--accent-color-text)] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-[var(--accent-color)]/20 animate-pulse">DESTAQUE</span>
                    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                        <img src={getFavicon(article.url || '')} className="w-3.5 h-3.5 rounded-full bg-white/10" onError={(e) => e.currentTarget.style.display = 'none'} />
                        <span className="text-gray-200 text-xs font-bold uppercase tracking-wider">{article.source}</span>
                    </div>
                </div>
                
                <h2 className="text-xl md:text-3xl lg:text-4xl font-extrabold text-white leading-tight line-clamp-3 mb-3 drop-shadow-lg tracking-tight">
                    {article.title}
                </h2>
                
                <p className="text-gray-300 text-sm md:text-base line-clamp-3 font-medium leading-relaxed drop-shadow-md border-l-2 border-[var(--accent-color)] pl-3">
                    {article.summary}
                </p>
            </div>
        </a>
    );
};

const NewsCardSkeleton: React.FC = () => (
    <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] animate-pulse h-full flex flex-col">
        <div className="h-32 bg-[var(--bg-tertiary-hover)] rounded-lg mb-4 w-full"></div>
        <div className="h-3 bg-[var(--bg-tertiary-hover)] rounded w-1/4 mb-3"></div>
        <div className="h-4 bg-[var(--bg-tertiary-hover)] rounded w-full mb-2"></div>
        <div className="h-4 bg-[var(--bg-tertiary-hover)] rounded w-3/4 mb-3"></div>
        <div className="h-3 bg-[var(--bg-tertiary-hover)] rounded w-full mb-1"></div>
        <div className="h-3 bg-[var(--bg-tertiary-hover)] rounded w-5/6"></div>
    </div>
);

const CategoryPill: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button
        onClick={() => { vibrate(); onClick(); }}
        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 snap-start border ${
            isActive 
                ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] border-[var(--accent-color)] shadow-lg shadow-[var(--accent-color)]/20' 
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary-hover)] hover:text-[var(--text-primary)]'
        }`}
    >
        {label}
    </button>
);

const NewsView: React.FC<{addToast: (message: string, type?: ToastMessage['type']) => void}> = ({ addToast }) => {
  const { t } = useI18n();
  const { preferences, assets } = usePortfolio();
  
  const categories = ['Destaques', 'Rendimentos', 'Papel & CRI', 'Logística', 'Shoppings', 'Fiagro', 'Lajes', 'Geral', 'Favoritos'];
  
  const [category, setCategory] = useState('Destaques');
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
      const filterKey = `news_v6_${currentQuery}_${currentDateRange}_${currentSource}_${category}`.toLowerCase().replace(/\s+/g, '_');
      
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
          sources: currentSource,
          category: category 
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
  }, [t, assetTickers, addToast, preferences, category]);
  
  // Debounced Load
  const debouncedLoadNews = useCallback(debounce((q: string, d: 'today'|'week'|'month', s: string) => loadNews(true, q, d, s), 800), [loadNews]);

  // Reset news when category changes
  useEffect(() => {
      setLoading(true);
      setNews([]);
      loadNews(false, searchQuery, dateRange, sourceFilter);
  }, [category]);

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

  const displayedNews = useMemo(() => {
      return activeTab === 'favorites' 
        ? news.filter(n => favorites.has(n.title))
        : news;
  }, [news, activeTab, favorites]);

  return (
    <div 
        className="p-4 h-full pb-24 md:pb-6 flex flex-col overflow-y-auto custom-scrollbar landscape-pb-6"
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
      
      <div className="w-full max-w-7xl mx-auto">
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
        
        {/* Categories Scroller */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-2 -mx-4 px-4 snap-x mask-linear-fade">
            {categories.map(cat => (
                <CategoryPill 
                    key={cat} 
                    label={cat} 
                    isActive={category === cat} 
                    onClick={() => setCategory(cat)} 
                />
            ))}
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

        {loading && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{Array.from({length: 5}).map((_, i) => <NewsCardSkeleton key={i}/>)}</div>}
        
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
              <>
                 {/* Hero Section (Only for 'All' tab and no search) */}
                 {activeTab === 'all' && !searchQuery && displayedNews.length > 0 && (
                    <div className="mb-8 animate-scale-in">
                        <NewsHero article={displayedNews[0]} />
                    </div>
                 )}

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 landscape-grid-cols-3">
                    {(activeTab === 'all' && !searchQuery ? displayedNews.slice(1) : displayedNews).map((article, index) => (
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
                 </div>
                 
                 {activeTab === 'favorites' && displayedNews.length > 0 && (
                      <div className="col-span-full text-center pt-8 pb-4">
                          <button onClick={clearFavorites} className="text-xs font-bold text-red-400 hover:underline uppercase tracking-wider">
                              {t('clear_favorites')}
                          </button>
                      </div>
                  )}
              </>
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
    </div>
  );
};

export default NewsView;
