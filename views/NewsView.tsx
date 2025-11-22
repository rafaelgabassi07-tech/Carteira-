
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

// --- IMAGENS DE FALLBACK (Expandido para evitar repetição) ---
const FALLBACK_IMAGES: Record<string, string[]> = {
    Dividendos: [
        'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1565514020175-05171375ef22?auto=format&fit=crop&w=800&q=80',
    ],
    Macroeconomia: [
        'https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1526304640152-d4619684e484?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1535320903710-d9cf1158255e?auto=format&fit=crop&w=800&q=80',
    ],
    Imóveis: [
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1479839672679-a46483c0e7c8?auto=format&fit=crop&w=800&q=80',
    ],
    Mercado: [
        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    ],
    Geral: [
        'https://images.unsplash.com/photo-1593672715438-d88a350374ee?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    ]
};

const getFallbackImage = (category: string = 'Geral', title: string): string => {
    const cat = FALLBACK_IMAGES[category] ? category : 'Geral';
    const images = FALLBACK_IMAGES[cat] || FALLBACK_IMAGES['Geral'];
    // Hash determinístico com "salt" para garantir que titulos parecidos não peguem sempre a mesma
    let hash = 0;
    const salt = title.length;
    for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash) + salt;
        hash = hash & hash; 
    }
    const index = Math.abs(hash) % images.length;
    return images[index];
};

const ImpactBadge: React.FC<{ level: string }> = ({ level }) => {
    const colors = {
        High: 'bg-red-500 text-white shadow-lg shadow-red-500/30',
        Medium: 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30',
        Low: 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
    };
    const labels = { High: 'Impacto Alto', Medium: 'Impacto Médio', Low: 'Impacto Baixo' };
    
    return (
        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${colors[level as keyof typeof colors] || colors.Low}`}>
            {labels[level as keyof typeof labels] || 'Info'}
        </span>
    );
};

// --- COMPONENTE CARROSSEL (Novo Hero) ---
const NewsCarousel: React.FC<{ 
    articles: NewsArticle[]; 
    onArticleClick: (article: NewsArticle) => void; 
}> = ({ articles, onArticleClick }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleScroll = () => {
        if (scrollRef.current) {
            const width = scrollRef.current.offsetWidth;
            const scrollLeft = scrollRef.current.scrollLeft;
            const index = Math.round(scrollLeft / width);
            setCurrentIndex(index);
        }
    };

    if (articles.length === 0) return null;

    return (
        <div className="relative w-full mb-8 group">
            {/* Scroll Container */}
            <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="w-full overflow-x-auto flex snap-x snap-mandatory no-scrollbar rounded-3xl shadow-2xl border border-[var(--border-color)]"
            >
                {articles.map((article, idx) => {
                    const imageSrc = article.imageUrl || getFallbackImage(article.category, article.title);
                    return (
                        <div 
                            key={`${article.title}-hero-${idx}`} 
                            onClick={() => onArticleClick(article)}
                            className="w-full flex-shrink-0 snap-center relative h-72 md:h-80 cursor-pointer overflow-hidden"
                        >
                            <img 
                                src={imageSrc} 
                                alt={article.title}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                loading={idx === 0 ? "eager" : "lazy"}
                            />
                            {/* Immersive Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-95" />
                            
                            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex flex-col justify-end">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="bg-[var(--accent-color)] text-[var(--accent-color-text)] text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest shadow-lg">
                                        {article.category || 'Destaque'}
                                    </span>
                                    {article.impactLevel && <ImpactBadge level={article.impactLevel} />}
                                </div>
                                
                                <h2 className="text-xl md:text-3xl font-bold text-white leading-tight mb-2 line-clamp-2 drop-shadow-md">
                                    {article.title}
                                </h2>
                                
                                <p className="text-gray-200 text-xs md:text-sm line-clamp-2 mb-4 max-w-3xl font-medium drop-shadow-sm opacity-90">
                                    {article.summary}
                                </p>

                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    <span>{article.source}</span>
                                    <span>•</span>
                                    <span>{new Date(article.date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Indicators */}
            <div className="absolute bottom-4 right-6 flex gap-1.5 z-10">
                {articles.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${currentIndex === idx ? 'w-6 bg-[var(--accent-color)]' : 'w-1.5 bg-white/30'}`}
                    />
                ))}
            </div>
        </div>
    );
};

// --- COMPONENTE CARD PADRONIZADO (Novo Design) ---
const ImmersiveNewsCard: React.FC<{ 
  article: NewsArticle;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
}> = ({ article, isFavorited, onToggleFavorite, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const imageSrc = (!imgError && article.imageUrl) ? article.imageUrl : getFallbackImage(article.category, article.title);

  return (
    <div 
        onClick={onClick} 
        className="relative h-64 w-full rounded-2xl overflow-hidden cursor-pointer group shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-[var(--border-color)] bg-[var(--bg-secondary)]"
    >
        {/* Full Background Image */}
        <img 
            src={imageSrc} 
            alt={article.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            onError={() => setImgError(true)}
        />
        
        {/* Standard Gradient Overlay (Escuro em baixo, transparente em cima) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Top Actions */}
        <div className="absolute top-3 right-3 z-20 flex gap-2">
             <button 
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-white/20 transition-colors border border-white/10"
            >
                <StarIcon filled={isFavorited} className={`w-4 h-4 ${isFavorited ? 'text-yellow-400' : ''}`} />
            </button>
        </div>

        {/* Content (Bottom) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10 flex flex-col justify-end h-full">
            <div className="mt-auto">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm px-2 py-0.5 rounded border border-white/10">
                        {article.category || 'Geral'}
                    </span>
                    <span className="text-[9px] font-bold text-[var(--accent-color)] uppercase tracking-wider drop-shadow-sm">
                        {article.source}
                    </span>
                </div>

                <h3 className="text-sm md:text-base font-bold text-white leading-snug mb-1 line-clamp-3 drop-shadow-md group-hover:text-[var(--accent-color)] transition-colors">
                    {article.title}
                </h3>
                
                <p className="text-[10px] text-gray-300 line-clamp-2 leading-relaxed font-medium opacity-90">
                    {article.summary}
                </p>
            </div>
        </div>
    </div>
  );
};

// ... (Skeleton component remains similar)
const NewsCardSkeleton: React.FC = () => (
    <div className="h-64 bg-[var(--bg-secondary)] rounded-2xl animate-pulse border border-[var(--border-color)] relative overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
            <div className="h-4 bg-gray-700 rounded w-1/3"></div>
            <div className="h-5 bg-gray-700 rounded w-full"></div>
            <div className="h-5 bg-gray-700 rounded w-2/3"></div>
            <div className="h-3 bg-gray-700 rounded w-5/6"></div>
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

  const handleArticleClick = (article: NewsArticle) => {
      vibrate();
      if (article.url) {
          window.open(article.url, '_blank', 'noopener,noreferrer');
      } else {
          // Fallback search if URL is somehow missing despite backend improvements
          window.open(`https://www.google.com/search?q=${encodeURIComponent(article.title)}`, '_blank');
      }
  };

  const loadNews = useCallback(async (isRefresh = false, currentQuery: string, currentDateRange: 'today' | 'week' | 'month', currentSource: string) => {
    if(!isRefresh) setLoading(true);
    setError(null);
    
    try {
      const filterKey = `news_v2_${currentQuery}_${currentDateRange}_${currentSource}`.toLowerCase().replace(/\s+/g, '_');
      
      if (!isRefresh) {
          const cachedNews = CacheManager.get<NewsArticle[]>(filterKey, CACHE_TTL.NEWS);
          if (cachedNews) {
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

      const articles = await fetchMarketNews(preferences, filter);
      setNews(articles);
      if(articles.length > 0) CacheManager.set(filterKey, articles);

    } catch (err: any) {
      setError(err.message || t('unknown_error'));
    } finally {
      setLoading(false);
    }
  }, [t, assetTickers, preferences]);
  
  // ... (Existing Refresh/Search/Filter Handlers kept same) ...
  const debouncedLoadNews = useCallback(debounce((q: string, d: 'today'|'week'|'month', s: string) => loadNews(true, q, d, s), 800), [loadNews]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setLoading(true);
      debouncedLoadNews(e.target.value, dateRange, sourceFilter);
  };

  const handleRefresh = () => {
    vibrate();
    setLoading(true);
    loadNews(true, searchQuery, dateRange, sourceFilter);
  };

  useEffect(() => {
    loadNews(false, '', 'week', ''); // Initial load
  }, [loadNews]);

  const displayedNews = useMemo(() => {
      return activeTab === 'favorites' 
        ? news.filter(n => favorites.has(n.title))
        : news;
  }, [news, activeTab, favorites]);

  // Logic for Carousel vs Grid
  const carouselArticles = useMemo(() => {
      if (activeTab === 'favorites' || searchQuery || showFilters) return []; // Show simple grid when filtering
      return displayedNews.slice(0, 5); // Top 5 for carousel
  }, [displayedNews, activeTab, searchQuery, showFilters]);

  const gridArticles = useMemo(() => {
      if (activeTab === 'favorites' || searchQuery || showFilters) return displayedNews;
      return displayedNews.slice(5); // Rest for grid
  }, [displayedNews, activeTab, searchQuery, showFilters]);

  return (
    <div className="p-4 h-full pb-24 md:pb-6 flex flex-col overflow-y-auto custom-scrollbar landscape-pb-6">
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
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
        
        {/* Search & Tabs (simplified for brevity, logic kept from original) */}
        <div className="mb-4 space-y-4">
             {showFilters && (
                 /* ... Filter UI ... */
                 <div className="bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)] animate-fade-in-up">
                     <div className="flex gap-2 overflow-x-auto">
                        {(['today', 'week', 'month'] as const).map((r) => (
                            <button key={r} onClick={() => { setDateRange(r); loadNews(true, searchQuery, r, sourceFilter); }} className={`px-4 py-1 text-xs font-bold rounded-lg ${dateRange === r ? 'bg-[var(--accent-color)] text-white' : 'bg-[var(--bg-primary)]'}`}>
                                {r === 'today' ? 'Hoje' : r === 'week' ? 'Semana' : 'Mês'}
                            </button>
                        ))}
                     </div>
                 </div>
             )}
             
             <input 
                type="text" 
                placeholder={t('search_news_placeholder')} 
                value={searchQuery} 
                onChange={handleSearchChange} 
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 text-sm focus:border-[var(--accent-color)] outline-none"
            />

            <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)]">
                <button onClick={() => setActiveTab('all')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'all' ? 'bg-[var(--bg-primary)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{t('news_tab_all')}</button>
                <button onClick={() => setActiveTab('favorites')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'favorites' ? 'bg-[var(--bg-primary)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{t('news_tab_favorites')} ({favorites.size})</button>
            </div>
        </div>

        {loading ? (
            <div className="space-y-4">
                <div className="h-72 bg-[var(--bg-secondary)] rounded-3xl animate-pulse border border-[var(--border-color)]"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1,2,3,4].map(i => <NewsCardSkeleton key={i}/>)}
                </div>
            </div>
        ) : error ? (
             <div className="text-center py-10 text-red-400">{error}</div>
        ) : (
            <div className="animate-fade-in">
                {/* Hero Carousel */}
                {!searchQuery && !showFilters && activeTab === 'all' && (
                    <NewsCarousel articles={carouselArticles} onArticleClick={handleArticleClick} />
                )}

                {/* Standardized Grid */}
                {gridArticles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {gridArticles.map((article, index) => (
                            <div key={`${article.title}-${index}`} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                                <ImmersiveNewsCard 
                                    article={article}
                                    isFavorited={favorites.has(article.title)}
                                    onToggleFavorite={() => handleToggleFavorite(article.title)}
                                    onClick={() => handleArticleClick(article)}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-[var(--text-secondary)]">
                        <p>{activeTab === 'favorites' ? t('no_favorites_subtitle') : t('no_news_found')}</p>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default NewsView;
