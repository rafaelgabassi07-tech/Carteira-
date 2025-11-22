
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { NewsArticle, ToastMessage } from '../types';
import { fetchMarketNews, type NewsFilter } from '../services/geminiService';
import StarIcon from '../components/icons/StarIcon';
import ShareIcon from '../components/icons/ShareIcon';
import RefreshIcon from '../components/icons/RefreshIcon';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { CacheManager, vibrate, debounce } from '../utils';
import { CACHE_TTL } from '../constants';

// --- Assets & Helpers ---

const getFallbackImage = (title: string) => {
    const images = [
        'https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1614028674026-a65e31bfd27c?auto=format&fit=crop&w=400&q=80'
    ];
    let hash = 0;
    for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
    return images[Math.abs(hash) % images.length];
};

const getFavicon = (url: string) => {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch { return ''; }
};

const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "a";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "m";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "min";
    return "Agora";
};

// --- Components ---

const TopicPill: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button
        onClick={() => { vibrate(); onClick(); }}
        className={`relative whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 snap-start ${
            isActive 
                ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-md' 
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary-hover)]'
        }`}
    >
        {label}
    </button>
);

const NewsHero: React.FC<{ article: NewsArticle }> = ({ article }) => {
    const [imgSrc, setImgSrc] = useState(article.imageUrl || getFallbackImage(article.title));

    return (
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="block relative w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-lg mb-6 group">
            <img 
                src={imgSrc} 
                alt={article.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={() => setImgSrc(getFallbackImage(article.title))}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90"></div>
            <div className="absolute bottom-0 left-0 p-4 w-full">
                <div className="flex items-center gap-2 mb-2">
                    <img src={getFavicon(article.url || '')} className="w-4 h-4 rounded bg-white/20" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <span className="text-gray-300 text-xs font-bold uppercase tracking-wider">{article.source}</span>
                    <span className="text-gray-400 text-xs">• {timeAgo(article.date)}</span>
                </div>
                <h2 className="text-xl font-bold text-white leading-snug line-clamp-2">{article.title}</h2>
            </div>
        </a>
    );
};

const NewsListCard: React.FC<{ article: NewsArticle; onToggleFavorite: () => void; isFavorite: boolean }> = ({ article, onToggleFavorite, isFavorite }) => {
    const [imgSrc, setImgSrc] = useState(article.imageUrl || getFallbackImage(article.title));

    return (
        <div className="flex gap-4 py-4 border-b border-[var(--border-color)] group active:bg-[var(--bg-tertiary-hover)] transition-colors -mx-2 px-2 rounded-xl">
            {/* Content Left */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <img src={getFavicon(article.url || '')} className="w-4 h-4 rounded-sm" onError={(e) => e.currentTarget.style.display = 'none'} />
                        <span className="text-xs font-bold text-[var(--text-primary)] opacity-80 truncate">{article.source}</span>
                        <span className="text-xs text-[var(--text-secondary)]">• {timeAgo(article.date)}</span>
                    </div>
                    <a href={article.url} target="_blank" rel="noopener noreferrer">
                        <h3 className="text-sm md:text-base font-bold text-[var(--text-primary)] leading-snug line-clamp-3 group-hover:text-[var(--accent-color)] transition-colors">
                            {article.title}
                        </h3>
                    </a>
                </div>
                
                <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-3">
                        <button onClick={(e) => { e.preventDefault(); onToggleFavorite(); }} className="text-[var(--text-secondary)] hover:text-yellow-400">
                            <StarIcon className="w-4 h-4" filled={isFavorite} />
                        </button>
                        <button 
                            onClick={(e) => { 
                                e.preventDefault(); 
                                if (navigator.share) navigator.share({ title: article.title, url: article.url }); 
                            }} 
                            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                            <ShareIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Image Right (Google News Style) */}
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="relative w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-xl overflow-hidden bg-[var(--bg-tertiary-hover)]">
                <img 
                    src={imgSrc} 
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 opacity-90 group-hover:opacity-100"
                    onError={() => setImgSrc(getFallbackImage(article.title))}
                />
            </a>
        </div>
    );
};

const NewsSkeleton = () => (
    <div className="space-y-6 animate-pulse mt-4">
        {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-4">
                <div className="flex-1 space-y-2">
                    <div className="h-3 bg-[var(--bg-tertiary-hover)] rounded w-1/3"></div>
                    <div className="h-4 bg-[var(--bg-tertiary-hover)] rounded w-full"></div>
                    <div className="h-4 bg-[var(--bg-tertiary-hover)] rounded w-3/4"></div>
                </div>
                <div className="w-24 h-24 bg-[var(--bg-tertiary-hover)] rounded-xl"></div>
            </div>
        ))}
    </div>
);

// --- Main View ---

const NewsView: React.FC<{addToast: (message: string, type?: ToastMessage['type']) => void}> = ({ addToast }) => {
  const { t } = useI18n();
  const { preferences, assets } = usePortfolio();
  
  const [category, setCategory] = useState('Destaques');
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem('news-favorites');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const topics = ['Destaques', 'Mercado', 'FIIs', 'Dividendos', 'Macroeconomia', 'Tech', 'Crypto', 'Favoritos'];
  
  // Pull to Refresh
  const touchStartY = useRef(0);
  const [pullPosition, setPullPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNews = useCallback(async (cat: string, query: string, isRefresh = false) => {
    if (cat === 'Favoritos') {
        // Filter logic handled in render
        setLoading(false);
        return;
    }

    if (!isRefresh) setLoading(true);
    
    const cacheKey = `news_gn_v1_${cat}_${query}`.toLowerCase();
    
    if (!isRefresh) {
        const cached = CacheManager.get<NewsArticle[]>(cacheKey, CACHE_TTL.NEWS);
        if (cached) {
            setNews(cached);
            setLoading(false);
            return;
        }
    }

    const tickers = (cat === 'FIIs' || cat === 'Destaques') ? assets.map(a => a.ticker) : undefined;
    const articles = await fetchMarketNews(preferences, { category: cat, query, tickers, dateRange: 'week' });
    
    if (articles && articles.length > 0) {
        setNews(articles);
        CacheManager.set(cacheKey, articles);
    }
    setLoading(false);
  }, [preferences, assets]);

  // Debounce Search
  const debouncedFetch = useCallback(debounce((q: string) => fetchNews(category, q), 800), [category, fetchNews]);

  useEffect(() => {
    if (searchQuery) {
        setLoading(true);
        debouncedFetch(searchQuery);
    } else {
        fetchNews(category, '');
    }
  }, [category, searchQuery]);

  useEffect(() => {
    localStorage.setItem('news-favorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  const handleToggleFavorite = (article: NewsArticle) => {
    vibrate(10);
    setFavorites(prev => {
        const next = new Set(prev);
        const key = JSON.stringify(article); // Simple serialization for set storage
        // Store simpler key or handle object storage differently in real app
        // For now, storing titles to match existing logic
        if (next.has(article.title)) next.delete(article.title);
        else next.add(article.title);
        return next;
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      if(containerRef.current && containerRef.current.scrollTop === 0) touchStartY.current = e.targetTouches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
      if(touchStartY.current > 0 && !loading) {
          const dist = e.targetTouches[0].clientY - touchStartY.current;
          if(dist > 0) setPullPosition(Math.min(dist, 100));
      }
  };
  const handleTouchEnd = () => {
      if(pullPosition > 60) {
          vibrate();
          fetchNews(category, searchQuery, true);
      }
      setPullPosition(0);
      touchStartY.current = 0;
  };

  const displayedNews = useMemo(() => {
      if (category === 'Favoritos') {
          // In a real app, we'd need to store full article objects, not just titles
          // For this refactor, we filter the current list or show a message
          return news.filter(n => favorites.has(n.title));
      }
      return news;
  }, [news, category, favorites]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
        {/* Header & Search */}
        <div className="sticky top-0 z-30 bg-[var(--bg-secondary)]/90 backdrop-blur-md border-b border-[var(--border-color)]">
            <div className="max-w-2xl mx-auto px-4 py-2">
                <div className="flex items-center gap-3 mb-3 mt-2">
                    <span className="text-xl font-bold tracking-tight"><span className="text-[var(--accent-color)]">G</span>News</span>
                    <div className="flex-1 relative group">
                        <input 
                            type="text"
                            placeholder="Pesquisar..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 transition-all"
                        />
                        <svg className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-secondary)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
                
                {/* Topics Bar */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
                    {topics.map(topic => (
                        <TopicPill 
                            key={topic} 
                            label={topic} 
                            isActive={category === topic} 
                            onClick={() => setCategory(topic)} 
                        />
                    ))}
                </div>
            </div>
        </div>

        {/* Pull Refresh Indicator */}
        <div className="absolute left-0 right-0 flex justify-center pointer-events-none z-20 transition-all duration-300" style={{ top: `${110 + Math.min(pullPosition / 2, 20)}px`, opacity: pullPosition/70 }}>
            <div className="bg-[var(--bg-secondary)] p-2 rounded-full shadow-lg border border-[var(--border-color)]">
                <RefreshIcon className={`w-5 h-5 text-[var(--accent-color)] ${loading ? 'animate-spin' : ''}`}/>
            </div>
        </div>

        {/* Feed Area */}
        <div 
            className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-24 md:pb-6"
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className="max-w-2xl mx-auto">
                {loading ? (
                    <NewsSkeleton />
                ) : (
                    <div className="animate-fade-in">
                        {displayedNews.length > 0 ? (
                            <>
                                {/* Hero Section (First item) */}
                                {!searchQuery && category !== 'Favoritos' && (
                                    <NewsHero article={displayedNews[0]} />
                                )}
                                
                                {/* News List */}
                                <div className="flex flex-col">
                                    {(!searchQuery && category !== 'Favoritos' ? displayedNews.slice(1) : displayedNews).map((article, i) => (
                                        <NewsListCard 
                                            key={`${article.title}-${i}`} 
                                            article={article} 
                                            isFavorite={favorites.has(article.title)}
                                            onToggleFavorite={() => handleToggleFavorite(article)}
                                        />
                                    ))}
                                </div>
                                
                                {category === 'Favoritos' && displayedNews.length === 0 && (
                                    <div className="text-center py-20 text-[var(--text-secondary)]">
                                        <StarIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                        <p>Você ainda não favoritou nenhuma notícia.</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            !loading && (
                                <div className="text-center py-20">
                                    <p className="text-[var(--text-secondary)] mb-4">Nenhuma notícia encontrada.</p>
                                    <button onClick={() => fetchNews(category, searchQuery, true)} className="text-[var(--accent-color)] font-bold text-sm">
                                        Tentar Novamente
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default NewsView;
