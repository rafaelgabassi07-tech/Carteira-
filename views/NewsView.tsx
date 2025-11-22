
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

// --- CONFIGURAÇÃO DE IMAGENS ---
const FALLBACK_IMAGES: Record<string, string[]> = {
    Dividendos: [
        'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1565514020176-dbf2277479a2?auto=format&fit=crop&w=800&q=80'
    ],
    Macroeconomia: [
        'https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80'
    ],
    Imóveis: [
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=800&q=80'
    ],
    Mercado: [
        'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80'
    ],
    Geral: [
        'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?auto=format&fit=crop&w=800&q=80'
    ]
};

const getFallbackImage = (category: string = 'Geral', title: string): string => {
    const cat = FALLBACK_IMAGES[category] ? category : 'Geral';
    const images = FALLBACK_IMAGES[cat] || FALLBACK_IMAGES['Geral'];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = ((hash << 5) - hash) + title.charCodeAt(i);
        hash |= 0; 
    }
    return images[Math.abs(hash) % images.length];
};

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

const ImpactBadge: React.FC<{ level: string }> = React.memo(({ level }) => {
    const colors = {
        High: 'bg-red-500 text-white shadow-red-500/30',
        Medium: 'bg-amber-500 text-black shadow-amber-500/30',
        Low: 'bg-blue-500 text-white shadow-blue-500/30'
    };
    const labels = { High: 'Alta Relevância', Medium: 'Médio Impacto', Low: 'Info' };
    return (
        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider shadow-lg ${colors[level as keyof typeof colors] || colors.Low}`}>
            {labels[level as keyof typeof labels] || 'Geral'}
        </span>
    );
});

const NewsCard: React.FC<{ 
  article: NewsArticle;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  addToast: (message: string, type?: ToastMessage['type']) => void;
  isHero?: boolean;
}> = React.memo(({ article, isFavorited, onToggleFavorite, addToast, isHero = false }) => {
  const { t } = useI18n();
  const [imageSrc, setImageSrc] = useState(article.imageUrl || getFallbackImage(article.category, article.title));

  const handleClick = () => {
      vibrate();
      const url = article.url && article.url.startsWith('http') ? article.url : `https://www.google.com/search?q=${encodeURIComponent(article.title)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
  };

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
       // User cancelled
    }
  };

  return (
    <div 
        onClick={handleClick}
        className={`relative overflow-hidden rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] cursor-pointer group hover:shadow-2xl transition-all duration-300 ${isHero ? 'h-72 md:h-80 w-full flex-shrink-0 snap-center' : 'h-64 w-full hover:-translate-y-1'}`}
    >
        {/* Image Layer */}
        <img 
            src={imageSrc} 
            alt={article.title}
            loading={isHero ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={() => setImageSrc(getFallbackImage(article.category, article.title))}
        />
        
        {/* Gradient Overlay - Improved readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-90 transition-opacity group-hover:opacity-100" />

        {/* Actions */}
        <div className="absolute top-3 right-3 z-20 flex gap-2">
             <button
                  onClick={handleShare}
                  className="p-2 rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-colors active:scale-90"
                  aria-label={t('share_news')}
              >
                  <ShareIcon className="w-4 h-4" />
              </button>
            <button 
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                className="p-2 rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-colors active:scale-90"
            >
                <StarIcon filled={isFavorited} className={`w-4 h-4 ${isFavorited ? 'text-yellow-400' : ''}`} />
            </button>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-10 flex flex-col justify-end">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm px-2 py-0.5 rounded border border-white/10">
                    {article.category || 'Mercado'}
                </span>
                {article.impactLevel && <ImpactBadge level={article.impactLevel} />}
            </div>

            <h3 className={`font-bold text-white leading-tight mb-1 drop-shadow-md ${isHero ? 'text-xl md:text-3xl line-clamp-2' : 'text-sm md:text-base line-clamp-3'}`}>
                {article.title}
            </h3>
            
            <p className="text-[10px] md:text-xs text-gray-300 line-clamp-2 leading-relaxed font-medium opacity-90 max-w-3xl">
                {article.summary}
            </p>
            
            <div className="flex items-center gap-2 mt-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                <span className="text-[var(--accent-color)]">{article.source}</span>
                <span>•</span>
                <span>{new Date(article.date).toLocaleDateString()}</span>
            </div>
        </div>
    </div>
  );
});

// --- HOOK ---
const useMarketNews = (addToast: (msg: string, type?: any) => void) => {
    const { t } = useI18n();
    const { assets, preferences } = usePortfolio();
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week');
    const [sourceFilter, setSourceFilter] = useState('');

    const assetTickers = useMemo(() => assets.map(a => a.ticker), [assets]);

    const fetchNews = useCallback(async (isRefresh = false, query = '', range = 'week', source = '') => {
        if(!isRefresh) setLoading(true);
        setError(null);
        
        try {
            const filterKey = `news_cache_v5_${query}_${range}_${source}_${assetTickers.join('-')}`.toLowerCase().replace(/\s+/g, '_');
            
            if (!isRefresh) {
                const cached = CacheManager.get<NewsArticle[]>(filterKey, CACHE_TTL.NEWS);
                if (cached) {
                    setNews(cached);
                    setLoading(false);
                    return;
                }
            }

            const filter: NewsFilter = {
                query: query,
                tickers: assetTickers,
                dateRange: range as any,
                sources: source
            };

            const articles = await fetchMarketNews(preferences, filter);
            
            // New Behavior: Never error on empty news, as fetchMarketNews now returns fallbacks.
            // We only set error if something truly catastrophic happens (which shouldn't with the new service).
            setNews(articles);
            CacheManager.set(filterKey, articles);
            
        } catch (err: any) {
            console.error(err);
            // Fallback just in case the service itself crashes
            setError(t('unknown_error')); 
        } finally {
            setLoading(false);
        }
    }, [assetTickers, preferences, t]);

    const debouncedFetch = useCallback(debounce((q, r, s) => fetchNews(true, q, r, s), 800), [fetchNews]);

    useEffect(() => {
        fetchNews(false, searchQuery, dateRange, sourceFilter);
    }, []);

    const handleRefresh = () => {
        vibrate();
        setLoading(true);
        fetchNews(true, searchQuery, dateRange, sourceFilter);
    };

    const handleSearch = (val: string) => {
        setSearchQuery(val);
        setLoading(true);
        debouncedFetch(val, dateRange, sourceFilter);
    }

    const handleFilterChange = (range: any, source: string) => {
        setDateRange(range);
        setSourceFilter(source);
        setLoading(true);
        fetchNews(true, searchQuery, range, source);
    }

    return {
        news, loading, error,
        searchQuery, dateRange, sourceFilter,
        handleSearch, handleFilterChange, handleRefresh
    };
};

const NewsView: React.FC<{addToast: (message: string, type?: ToastMessage['type']) => void}> = ({ addToast }) => {
  const { t } = useI18n();
  const { 
      news, loading, error, 
      searchQuery, dateRange, sourceFilter,
      handleSearch, handleFilterChange, handleRefresh 
  } = useMarketNews(addToast);

  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('news-favorites') || '[]')); } catch { return new Set(); }
  });

  useEffect(() => { localStorage.setItem('news-favorites', JSON.stringify(Array.from(favorites))); }, [favorites]);

  const toggleFavorite = useCallback((title: string) => {
      setFavorites(prev => {
          const next = new Set(prev);
          if (next.has(title)) next.delete(title);
          else next.add(title);
          return next;
      });
      vibrate();
  }, []);

  const displayedNews = useMemo(() => activeTab === 'favorites' ? news.filter(n => favorites.has(n.title)) : news, [news, activeTab, favorites]);
  const heroArticles = useMemo(() => activeTab === 'all' && !searchQuery && !showFilters ? displayedNews.slice(0, 5) : [], [displayedNews, activeTab, searchQuery, showFilters]);
  const listArticles = useMemo(() => activeTab === 'all' && !searchQuery && !showFilters ? displayedNews.slice(5) : displayedNews, [displayedNews, activeTab, searchQuery, showFilters]);

  return (
    <div className="p-4 h-full pb-24 md:pb-6 flex flex-col overflow-y-auto custom-scrollbar landscape-pb-6">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">{t('market_news')}</h1>
          <div className="flex gap-2">
               <button onClick={() => { setShowFilters(!showFilters); vibrate(); }} className={`p-2 rounded-full transition-all active:scale-95 border ${showFilters ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] border-[var(--accent-color)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]'}`}>
                  <FilterIcon className="w-5 h-5" />
              </button>
              <button onClick={handleRefresh} disabled={loading} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95 disabled:opacity-50 border border-[var(--border-color)]">
                  <RefreshIcon className={`w-5 h-5 ${loading ? 'animate-spin text-[var(--accent-color)]' : ''}`} />
              </button>
          </div>
        </div>
        
        {/* Filters UI */}
        {showFilters && (
            <div className="bg-[var(--bg-secondary)] p-4 rounded-xl mb-4 border border-[var(--border-color)] animate-fade-in-up space-y-3">
                 <div className="flex bg-[var(--bg-primary)] p-1 rounded-lg border border-[var(--border-color)]">
                    {(['today', 'week', 'month'] as const).map((r) => (
                        <button key={r} onClick={() => handleFilterChange(r, sourceFilter)} className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${dateRange === r ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>
                            {r === 'today' ? 'Hoje' : r === 'week' ? 'Semana' : 'Mês'}
                        </button>
                    ))}
                 </div>
                 <input type="text" placeholder="Fonte (ex: InfoMoney)" value={sourceFilter} onChange={(e) => handleFilterChange(dateRange, e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2 text-sm focus:border-[var(--accent-color)] outline-none" />
            </div>
        )}

        {/* Search & Tabs */}
        <div className="space-y-4 mb-6">
            <input type="text" placeholder={t('search_news_placeholder')} value={searchQuery} onChange={(e) => handleSearch(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3 text-sm focus:border-[var(--accent-color)] outline-none shadow-sm" />
            
            <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)]">
                <button onClick={() => { setActiveTab('all'); vibrate(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'all' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>{t('news_tab_all')}</button>
                <button onClick={() => { setActiveTab('favorites'); vibrate(); }} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'favorites' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}>{t('news_tab_favorites')} {favorites.size > 0 && `(${favorites.size})`}</button>
            </div>
        </div>

        {/* Content Area */}
        {loading && (
            <div className="space-y-4 animate-pulse">
                <div className="h-72 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)]"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1,2,3,4].map(i => <div key={i} className="h-64 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)]"></div>)}
                </div>
            </div>
        )}
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-6 rounded-xl text-center">
            <p className="font-bold mb-2">Ops!</p>
            <p className="text-sm mb-4">{error}</p>
            <button onClick={handleRefresh} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold py-2 px-6 rounded-lg text-xs uppercase tracking-wide transition-colors">{t('try_again')}</button>
          </div>
        )}

        {!loading && !error && (
          <div className="animate-fade-in space-y-8">
            {/* Carousel (Hero) */}
            {heroArticles.length > 0 && (
                <div className="w-full overflow-x-auto flex snap-x snap-mandatory no-scrollbar gap-4 pb-4">
                    {heroArticles.map((article, idx) => (
                        <NewsCard key={`hero-${idx}`} article={article} isFavorited={favorites.has(article.title)} onToggleFavorite={() => toggleFavorite(article.title)} isHero addToast={addToast} />
                    ))}
                </div>
            )}

            {/* Grid */}
            {listArticles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {listArticles.map((article, index) => (
                      <div key={`${article.title}-${index}`} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                          <NewsCard article={article} isFavorited={favorites.has(article.title)} onToggleFavorite={() => toggleFavorite(article.title)} addToast={addToast} />
                      </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-20 text-[var(--text-secondary)]">
                  <StarIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
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
