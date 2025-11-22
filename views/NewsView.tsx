
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
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="block relative w-full aspect-[16/9] md:aspect-[21/9] rounded-3xl overflow-hidden shadow-xl mb-8 group cursor-pointer ring-1 ring-white/10">
            <img 
                src={imgSrc} 
                alt={article.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="eager"
                onError={() => setImgSrc(getFallbackImage(article.title))}
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90"></div>
            
            <div className="absolute bottom-0 left-0 p-6 md:p-10 w-full md:w-2/3">
                <div className="flex items-center gap-3 mb-3">
                    <span className="bg-[var(--accent-color)] text-[var(--accent-color-text)] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-[var(--accent-color)]/20">DESTAQUE</span>
                    <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
                        <img src={getFavicon(article.url || '')} className="w-3 h-3 rounded-full" onError={(e) => e.currentTarget.style.display = 'none'} />
                        <span className="text-gray-200 text-xs font-bold uppercase tracking-wider">{article.source}</span>
                    </div>
                </div>
                <h2 className="text-xl md:text-3xl font-extrabold text-white leading-tight line-clamp-3 mb-2 drop-shadow-md">{article.title}</h2>
                <p className="text-gray-300 text-sm md:text-base line-clamp-2 opacity-90 font-medium">
                    Toque para ler a análise completa desta notícia impactante sobre o mercado de FIIs.
                </p>
            </div>
        </a>
    );
};

// Responsive Card: Row on Mobile (Google News Style), Column on Desktop (Card Style)
const NewsCard: React.FC<{ 
  article: NewsArticle;
  isFavorited: boolean;
  onToggleFavorite: () => void;
}> = ({ article, isFavorited, onToggleFavorite }) => {
  const [imgSrc, setImgSrc] = useState(article.imageUrl || getFallbackImage(article.title));

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    vibrate();
    if (navigator.share) {
        try { await navigator.share({ title: article.title, url: article.url }); } catch {}
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
        className="group relative flex flex-row md:flex-col bg-[var(--bg-secondary)] md:bg-[var(--bg-secondary)]/50 rounded-2xl border border-[var(--border-color)] overflow-hidden hover:bg-[var(--bg-tertiary-hover)] transition-all duration-300 active:scale-[0.98] md:hover:-translate-y-1 md:hover:shadow-lg h-full"
    >
        {/* Image Section */}
        {/* Mobile: Right side, Fixed Size. Desktop: Top side, Aspect Ratio */}
        <div className="order-2 md:order-1 w-28 h-28 md:w-full md:h-48 flex-shrink-0 bg-gray-800 relative m-3 md:m-0 rounded-xl md:rounded-none overflow-hidden">
            <img 
                src={imgSrc} 
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-90 group-hover:opacity-100"
                onError={() => setImgSrc(getFallbackImage(article.title))}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 md:opacity-100"></div>
            
            {/* Category Badge (Desktop Only) */}
            <div className="absolute bottom-2 left-2 hidden md:block">
                 <span className="text-[10px] font-bold text-white bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
                    {article.category || 'FIIs'}
                 </span>
            </div>
        </div>

        {/* Content Section */}
        <div className="order-1 md:order-2 flex-1 p-4 flex flex-col justify-between min-w-0">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <img src={getFavicon(article.url || '')} className="w-4 h-4 rounded-sm" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <span className="text-[10px] font-bold text-[var(--accent-color)] uppercase truncate max-w-[100px]">{article.source}</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">• {timeAgo(article.date)}</span>
                </div>
                
                <h3 className="text-sm md:text-base font-bold text-[var(--text-primary)] leading-snug line-clamp-3 md:line-clamp-2 mb-1 group-hover:text-[var(--accent-color)] transition-colors">
                    {article.title}
                </h3>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-3 md:mt-4">
                <button onClick={handleFavorite} className={`transition-colors ${isFavorited ? 'text-yellow-400' : 'text-[var(--text-secondary)] hover:text-yellow-400'}`}>
                    <StarIcon filled={isFavorited} className="w-4 h-4" />
                </button>
                <button onClick={handleShare} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <ShareIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    </a>
  );
};

const CategoryPill: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button
        onClick={() => { vibrate(); onClick(); }}
        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 snap-start ${
            isActive 
                ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-lg shadow-[var(--accent-color)]/20 scale-105' 
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary-hover)]'
        }`}
    >
        {label}
    </button>
);

const NewsSkeleton = () => (
    <div className="space-y-4 animate-pulse mt-4">
        {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-4 bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-color)]">
                <div className="flex-1 space-y-3 py-1">
                    <div className="h-3 bg-[var(--bg-tertiary-hover)] rounded w-1/3"></div>
                    <div className="h-4 bg-[var(--bg-tertiary-hover)] rounded w-full"></div>
                    <div className="h-4 bg-[var(--bg-tertiary-hover)] rounded w-3/4"></div>
                </div>
                <div className="w-28 h-28 bg-[var(--bg-tertiary-hover)] rounded-xl"></div>
            </div>
        ))}
    </div>
);

const NewsView: React.FC<{addToast: (message: string, type?: ToastMessage['type']) => void}> = ({ addToast }) => {
  const { t } = useI18n();
  const { preferences, assets } = usePortfolio();
  
  const categories = ['Destaques', 'Rendimentos', 'Papel & CRI', 'Logística', 'Shoppings', 'Fiagro', 'Lajes', 'Geral', 'Favoritos'];
  
  const [category, setCategory] = useState('Destaques');
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem('news-favorites');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const assetTickers = useMemo(() => assets.map(a => a.ticker), [assets]);

  useEffect(() => {
    localStorage.setItem('news-favorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  const handleToggleFavorite = (articleTitle: string) => {
    setFavorites(prev => {
        const next = new Set(prev);
        if (next.has(articleTitle)) next.delete(articleTitle);
        else next.add(articleTitle);
        return next;
    });
  };

  const fetchNews = useCallback(async (cat: string, query: string, isRefresh = false) => {
    if (cat === 'Favoritos') {
        setLoading(false);
        return;
    }

    if (!isRefresh) setLoading(true);
    else setIsRefreshing(true);
    
    const cacheKey = `fii_news_v5_${cat}_${query}`; // V5 Cache
    
    if (!isRefresh) {
        const cached = CacheManager.get<NewsArticle[]>(cacheKey, CACHE_TTL.NEWS);
        if (cached) {
            setNews(cached);
            setLoading(false);
            return;
        }
    }

    const filter: NewsFilter = {
        category: cat,
        query: query,
        tickers: cat === 'Destaques' ? assetTickers : undefined,
        dateRange: 'week'
    };

    try {
        const articles = await fetchMarketNews(preferences, filter);
        if (articles && articles.length > 0) {
            setNews(articles);
            CacheManager.set(cacheKey, articles);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
        setIsRefreshing(false);
    }
  }, [preferences, assetTickers]);

  // Debounced search
  useEffect(() => {
      const timer = setTimeout(() => {
          fetchNews(category, searchQuery);
      }, 600);
      return () => clearTimeout(timer);
  }, [category, searchQuery, fetchNews]);

  const displayedNews = useMemo(() => {
      if (category === 'Favoritos') {
          return news.filter(n => favorites.has(n.title));
      }
      return news;
  }, [news, category, favorites]);

  const handleRefresh = () => {
      vibrate();
      fetchNews(category, searchQuery, true);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
        {/* Sticky Glass Header */}
        <div className="sticky top-0 z-40 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-b border-[var(--border-color)] transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 pt-3 pb-2">
                <div className="flex justify-between items-center mb-3">
                    <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--accent-color)] to-blue-500">FII</span>News
                    </h1>
                    <div className="flex gap-2">
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Buscar..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-full py-1.5 pl-3 pr-8 text-xs w-32 focus:w-48 transition-all focus:outline-none focus:border-[var(--accent-color)]"
                            />
                            <FilterIcon className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                        </div>
                        <button 
                            onClick={handleRefresh}
                            className={`p-1.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--accent-color)] border border-[var(--border-color)] active:scale-95 transition-all ${isRefreshing ? 'animate-spin text-[var(--accent-color)]' : ''}`}
                        >
                            <RefreshIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                
                {/* Categories Scroller */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 snap-x mask-linear-fade">
                    {categories.map(cat => (
                        <CategoryPill 
                            key={cat} 
                            label={cat} 
                            isActive={category === cat} 
                            onClick={() => setCategory(cat)} 
                        />
                    ))}
                </div>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-24 md:pb-6">
            <div className="max-w-7xl mx-auto min-h-[50vh]">
                {loading ? (
                    <NewsSkeleton />
                ) : (
                    <div className="animate-fade-in">
                        {displayedNews.length > 0 ? (
                            <>
                                {/* Hero Section (Desktop: Big Impact, Mobile: Compact) */}
                                {category !== 'Favoritos' && !searchQuery && (
                                    <div className="mb-8">
                                        <NewsHero article={displayedNews[0]} />
                                    </div>
                                )}
                                
                                {/* Responsive Grid/List */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {(category !== 'Favoritos' && !searchQuery ? displayedNews.slice(1) : displayedNews).map((article, i) => (
                                        <div 
                                            key={`${article.url}-${i}`} 
                                            className="animate-fade-in-up" 
                                            style={{ animationDelay: `${i * 50}ms` }}
                                        >
                                            <NewsCard 
                                                article={article} 
                                                isFavorited={favorites.has(article.title)}
                                                onToggleFavorite={() => handleToggleFavorite(article.title)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-center text-[var(--text-secondary)] opacity-70">
                                {category === 'Favoritos' ? (
                                    <>
                                        <StarIcon className="w-12 h-12 mb-2 opacity-30" />
                                        <p>Nenhuma notícia favorita.</p>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <p>Não encontramos notícias para esta busca.</p>
                                        <button onClick={handleRefresh} className="text-[var(--accent-color)] font-bold text-sm hover:underline">
                                            Atualizar Agora
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default NewsView;
