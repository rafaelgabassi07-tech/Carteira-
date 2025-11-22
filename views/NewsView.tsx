
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { NewsArticle, ToastMessage } from '../types';
import { fetchMarketNews, type NewsFilter } from '../services/geminiService';
import StarIcon from '../components/icons/StarIcon';
import ShareIcon from '../components/icons/ShareIcon';
import RefreshIcon from '../components/icons/RefreshIcon';
import FilterIcon from '../components/icons/FilterIcon';
import ChevronLeftIcon from '../components/icons/ChevronLeftIcon';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { CacheManager, vibrate, debounce } from '../utils';
import { CACHE_TTL } from '../constants';

const SentimentBadge: React.FC<{ sentiment: NewsArticle['sentiment'] }> = ({ sentiment }) => {
    const { t } = useI18n();
    const sentimentMap = {
        Positive: { text: t('sentiment_positive'), color: 'bg-green-500/20 text-green-400 border-green-500/30' },
        Neutral: { text: t('sentiment_neutral'), color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
        Negative: { text: t('sentiment_negative'), color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    };
    const sentimentData = sentiment ? sentimentMap[sentiment] : null;
    if (!sentimentData) return null;
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-md ${sentimentData.color}`}>
            {sentimentData.text}
        </span>
    );
};

// --- Helpers ---
const getFavicon = (url: string) => {
    try {
        if (!url) return '';
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch { return ''; }
};

const getFallbackImage = (title: string) => {
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
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "Recente";
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        
        if (seconds < 3600) return "Recente";
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        return `${Math.floor(seconds / 86400)}d`;
    } catch { return "Recente"; }
};

const NewsCard: React.FC<{ 
  article: NewsArticle;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  addToast: (message: string, type?: ToastMessage['type']) => void;
}> = ({ article, isFavorited, onToggleFavorite, addToast }) => {
  const { t } = useI18n();
  const [imgSrc, setImgSrc] = useState(article.imageUrl || getFallbackImage(article.title));

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
       // User cancelled
    }
  };

  const handleFavorite = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      vibrate(20);
      onToggleFavorite();
  }

  return (
    <a 
        href={article.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="relative rounded-2xl overflow-hidden block h-72 group shadow-md hover:shadow-2xl transition-all duration-300 border border-[var(--border-color)] active:scale-[0.98]"
    >
        {/* Background Image */}
        <div className="absolute inset-0 bg-[var(--bg-secondary)]">
            <img 
                src={imgSrc} 
                alt={article.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                onError={() => setImgSrc(getFallbackImage(article.title))}
            />
        </div>

        {/* Gradient Overlay - Stronger at bottom for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-90 z-10"></div>

        {/* Content */}
        <div className="absolute inset-0 p-5 flex flex-col justify-between z-20">
            
            {/* Top Row: Source & Actions */}
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 shadow-sm">
                    <img src={getFavicon(article.url || '')} className="w-3.5 h-3.5 rounded-sm bg-white/20" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider max-w-[120px] truncate">{article.source}</span>
                </div>
                
                <div className="flex gap-2">
                    <button onClick={handleFavorite} className={`p-2 rounded-full backdrop-blur-md transition-all ${isFavorited ? 'bg-yellow-500/20 text-yellow-400' : 'bg-black/30 text-white/70 hover:bg-black/50 hover:text-white'}`}>
                        <StarIcon filled={isFavorited} className="w-4 h-4" />
                    </button>
                    <button onClick={handleShare} className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white/70 hover:bg-black/50 hover:text-white transition-all">
                        <ShareIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Bottom Row: Title, Summary, Metadata */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <SentimentBadge sentiment={article.sentiment} />
                    <span className="text-[10px] text-gray-300 font-medium">• {timeAgo(article.date)}</span>
                </div>

                <h3 className="text-lg font-extrabold text-white leading-snug line-clamp-3 drop-shadow-lg tracking-tight">
                    {article.title}
                </h3>
                
                <div className="flex items-center text-[var(--accent-color)] text-xs font-bold group-hover:translate-x-1 transition-transform duration-300 mt-1">
                    {t('read_more')} <ChevronRightIcon className="w-4 h-4" />
                </div>
            </div>
        </div>
    </a>
  );
};

// --- Components ---

const NewsHeroItem: React.FC<{ article: NewsArticle }> = ({ article }) => {
    const [imgSrc, setImgSrc] = useState(article.imageUrl || getFallbackImage(article.title));

    return (
        <a 
            href={article.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="relative w-full flex-shrink-0 rounded-3xl overflow-hidden shadow-lg cursor-pointer group snap-center block h-full border border-[var(--border-color)]"
            style={{ scrollSnapAlign: 'center' }}
        >
            <div className="aspect-[16/10] md:aspect-[21/9] w-full relative">
                <img 
                    src={imgSrc} 
                    alt={article.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="eager"
                    onError={() => setImgSrc(getFallbackImage(article.title))}
                />
                {/* Stronger Gradient Overlay for better text readability on mobile */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-90 z-10"></div>
                
                <div className="absolute bottom-0 left-0 p-5 md:p-8 w-full md:w-3/4 z-20">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md border border-white/10">
                            <img src={getFavicon(article.url || '')} className="w-3 h-3 rounded-full bg-white/10" onError={(e) => e.currentTarget.style.display = 'none'} />
                            <span className="text-gray-200 text-[10px] font-bold uppercase tracking-wider">{article.source}</span>
                        </div>
                        <span className="text-gray-400 text-[10px]">• {timeAgo(article.date)}</span>
                    </div>
                    
                    <h2 className="text-xl md:text-3xl font-extrabold text-white leading-tight line-clamp-2 mb-2 drop-shadow-lg">
                        {article.title}
                    </h2>
                    
                    <p className="text-gray-300 text-xs md:text-sm line-clamp-2 font-medium leading-relaxed drop-shadow-md border-l-2 border-[var(--accent-color)] pl-3">
                        {article.summary}
                    </p>
                </div>
            </div>
        </a>
    );
};

const NewsCarousel: React.FC<{ articles: NewsArticle[] }> = ({ articles }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = scrollRef.current.clientWidth;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    if (!articles || articles.length === 0) return null;

    return (
        <div className="relative group mb-8">
            {/* Desktop Navigation Buttons (Translucent, Show on Hover) */}
            <button 
                onClick={() => scroll('left')}
                className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/30 backdrop-blur-md border border-white/10 text-white rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/60 hover:scale-110"
            >
                <ChevronLeftIcon className="w-6 h-6" />
            </button>
            
            <button 
                onClick={() => scroll('right')}
                className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/30 backdrop-blur-md border border-white/10 text-white rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-black/60 hover:scale-110"
            >
                <ChevronRightIcon className="w-6 h-6" />
            </button>

            {/* Carousel Container */}
            <div 
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-2"
            >
                {articles.map((article, idx) => (
                    <div key={idx} className="w-full min-w-[90%] md:min-w-[80%] lg:min-w-[70%] snap-center">
                        <NewsHeroItem article={article} />
                    </div>
                ))}
            </div>
            
            {/* Mobile Dots Indicator */}
            <div className="flex justify-center gap-1.5 mt-2 md:hidden">
                {articles.map((_, idx) => (
                    <div key={idx} className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] opacity-30"></div>
                ))}
            </div>
        </div>
    );
};

const NewsCardSkeleton: React.FC = () => (
    <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl animate-pulse border border-[var(--border-color)] h-72 flex flex-col justify-end">
        <div className="h-4 bg-gray-700/50 rounded w-1/4 mb-4"></div>
        <div className="h-6 bg-gray-700/50 rounded w-full mb-2"></div>
        <div className="h-6 bg-gray-700/50 rounded w-3/4 mb-4"></div>
        <div className="h-3 bg-gray-700/50 rounded w-full"></div>
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
  const { assets, preferences } = usePortfolio();
  
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
      const filterKey = `news_${currentQuery}_${currentDateRange}_${currentSource}_${category}`.toLowerCase().replace(/\s+/g, '_');
      
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

  // Reset when category changes
  useEffect(() => {
      setLoading(true);
      setNews([]); // Clear current list
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

  // Split news for Carousel vs List
  const { heroNews, listNews } = useMemo(() => {
      if (activeTab === 'favorites' || searchQuery) {
          return { heroNews: [], listNews: displayedNews };
      }
      return {
          heroNews: displayedNews.slice(0, 5),
          listNews: displayedNews.slice(5)
      };
  }, [displayedNews, activeTab, searchQuery]);

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
        <div className="flex justify-between items-center mb-4 sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-md py-2">
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
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4 -mx-4 px-4 snap-x">
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
        
        <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl mb-6 border border-[var(--border-color)] shrink-0">
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
            {heroNews.length > 0 && <NewsCarousel articles={heroNews} />}

            {listNews.length > 0 || heroNews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 landscape-grid-cols-3">
                  {listNews.map((article, index) => (
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
    </div>
  );
};

export default NewsView;
