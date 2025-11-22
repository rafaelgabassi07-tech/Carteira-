
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

// --- Fallback Images (Deterministic) ---
const FALLBACK_IMAGES = [
    'https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&w=800&q=80', // Stocks
    'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80', // Graph
    'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80', // Money plant
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80', // Newspaper
    'https://images.unsplash.com/photo-1526304640152-d4619684e884?auto=format&fit=crop&w=800&q=80', // Blue graph
    'https://images.unsplash.com/photo-1565514020176-dbf2277479a2?auto=format&fit=crop&w=800&q=80', // Graph on tablet
];

const getFallbackImage = (title: string) => {
    let hash = 0;
    for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
    return FALLBACK_IMAGES[Math.abs(hash) % FALLBACK_IMAGES.length];
};

const getFavicon = (url: string) => {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch { return ''; }
};

// --- Components ---

const CategoryPill: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button
        onClick={() => { vibrate(); onClick(); }}
        className={`relative whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 snap-start overflow-hidden group ${
            isActive 
                ? 'text-[var(--accent-color-text)] shadow-lg shadow-[var(--accent-color)]/25 ring-2 ring-[var(--accent-color)]/50' 
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary-hover)] hover:text-[var(--text-primary)]'
        }`}
    >
        {isActive && <div className="absolute inset-0 bg-[var(--accent-color)]"></div>}
        <span className="relative z-10">{label}</span>
    </button>
);

const FeaturedNewsCard: React.FC<{ article: NewsArticle }> = ({ article }) => {
    const [imgSrc, setImgSrc] = useState(article.imageUrl || getFallbackImage(article.title));

    return (
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="block group relative h-72 w-full rounded-3xl overflow-hidden mb-8 shadow-2xl border border-[var(--border-color)] active:scale-[0.98] transition-all duration-300 hover:shadow-[var(--accent-color)]/10">
            <div className="absolute inset-0 bg-gray-800 animate-pulse" />
            <img 
                src={imgSrc} 
                alt={article.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={() => setImgSrc(getFallbackImage(article.title))}
                loading="eager"
            />
            {/* Cinematic Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-90"></div>
            
            <div className="absolute bottom-0 left-0 p-6 w-full">
                <div className="flex items-center gap-3 mb-3">
                    <span className="bg-[var(--accent-color)] text-[var(--accent-color-text)] text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide shadow-lg shadow-[var(--accent-color)]/20">
                        Destaque
                    </span>
                    <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                        <img src={getFavicon(article.url || '')} alt="" className="w-3 h-3 rounded-sm" onError={(e) => e.currentTarget.style.display = 'none'} />
                        <span className="text-gray-200 text-[10px] font-bold uppercase tracking-wider">{article.source}</span>
                    </div>
                </div>
                <h2 className="text-2xl font-extrabold text-white leading-tight line-clamp-2 mb-2 drop-shadow-md">{article.title}</h2>
                <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed max-w-xl">{article.summary}</p>
            </div>
        </a>
    );
};

const NewsListItem: React.FC<{ article: NewsArticle, addToast: any }> = ({ article, addToast }) => {
    const [imgSrc, setImgSrc] = useState(article.imageUrl || getFallbackImage(article.title));
    const { t } = useI18n();

    const handleShare = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        vibrate();
        if (navigator.share) {
            navigator.share({ title: article.title, url: article.url }).catch(() => {});
        } else {
            navigator.clipboard.writeText(article.url || '');
            addToast('Link copiado!', 'success');
        }
    };

    // Time elapsed logic
    const getTimeString = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours < 1) return 'Agora';
        if (hours < 24) return `${hours}h`;
        return new Date(dateStr).toLocaleDateString().slice(0, 5);
    };

    return (
        <a 
            href={article.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] group hover:bg-[var(--bg-tertiary-hover)] hover:border-[var(--accent-color)]/30 transition-all duration-300 shadow-sm hover:shadow-lg active:scale-[0.99]"
        >
            <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                            <img src={getFavicon(article.url || '')} alt="" className="w-3.5 h-3.5 rounded-sm bg-white/10" onError={(e) => e.currentTarget.style.display = 'none'} />
                            <span className="text-[10px] font-bold text-[var(--accent-color)] uppercase tracking-wide truncate max-w-[100px]">{article.source}</span>
                        </div>
                        <span className="text-[10px] text-[var(--text-secondary)] opacity-60">• {getTimeString(article.date)}</span>
                    </div>
                    
                    <h3 className="font-bold text-sm md:text-base text-[var(--text-primary)] leading-snug line-clamp-3 group-hover:text-[var(--accent-color)] transition-colors">
                        {article.title}
                    </h3>
                </div>
                
                <div className="mt-3 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-1">
                        Ler notícia <span className="text-[var(--accent-color)]">→</span>
                    </span>
                    <button onClick={handleShare} className="p-1.5 rounded-full hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        <ShareIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            
            <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-xl overflow-hidden bg-[var(--bg-primary)] border border-[var(--border-color)] relative group-hover:shadow-md transition-all">
                <img 
                    src={imgSrc} 
                    alt="" 
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    onError={() => setImgSrc(getFallbackImage(article.title))}
                />
            </div>
        </a>
    );
};

const NewsSkeleton = () => (
    <div className="animate-pulse space-y-6">
        <div className="h-72 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)]"></div>
        {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-4 p-4 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)]">
                <div className="flex-1 space-y-3">
                    <div className="flex gap-2">
                        <div className="h-3 bg-[var(--bg-tertiary-hover)] rounded w-8"></div>
                        <div className="h-3 bg-[var(--bg-tertiary-hover)] rounded w-12"></div>
                    </div>
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
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem('news-favorites');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const categories = ['Destaques', 'Dividendos', 'FIIs', 'Ações', 'Macroeconomia', 'Tech'];
  
  // Pull to Refresh
  const touchStartY = useRef(0);
  const [pullPosition, setPullPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNews = useCallback(async (cat: string, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    
    const cacheKey = `news_v8_${cat}`; // Bump version
    if (!isRefresh) {
        const cached = CacheManager.get<NewsArticle[]>(cacheKey, CACHE_TTL.NEWS);
        if (cached) {
            setNews(cached);
            setLoading(false);
            return;
        }
    }

    const tickers = (cat === 'FIIs' || cat === 'Ações') ? assets.map(a => a.ticker) : undefined;
    const articles = await fetchMarketNews(preferences, { category: cat, tickers });
    
    if (articles && articles.length > 0) {
        setNews(articles);
        CacheManager.set(cacheKey, articles);
    }
    setLoading(false);
  }, [preferences, assets]);

  useEffect(() => {
    fetchNews(category);
  }, [category]);

  useEffect(() => {
    localStorage.setItem('news-favorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  const handleRefresh = () => {
    vibrate();
    fetchNews(category, true);
  };

  const handleToggleFavorite = (articleTitle: string) => {
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleTitle)) newSet.delete(articleTitle);
      else newSet.add(articleTitle);
      return newSet;
    });
    vibrate(20);
  };

  // Filter Logic
  const displayedNews = useMemo(() => {
      let filtered = activeTab === 'favorites' ? news.filter(n => favorites.has(n.title)) : news;
      if (searchQuery) {
          filtered = filtered.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      return filtered;
  }, [news, activeTab, favorites, searchQuery]);

  // --- Touch Handlers ---
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
      if(pullPosition > 60) handleRefresh();
      setPullPosition(0);
      touchStartY.current = 0;
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] relative overflow-hidden">
        {/* Background Aurora Effect for Premium Feel */}
        <div className="absolute top-0 left-0 w-full h-64 bg-[var(--accent-color)] opacity-5 blur-[80px] pointer-events-none" />

        {/* Glass Header */}
        <div className="sticky top-0 z-30 w-full">
            <div className="absolute inset-0 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border-color)] shadow-sm" />
            <div className="relative z-10 max-w-2xl mx-auto px-4 py-3">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-extrabold flex items-center gap-2 tracking-tight">
                        <span className="text-[var(--accent-color)]">Google</span> Notícias
                    </h1>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => { setActiveTab(activeTab === 'all' ? 'favorites' : 'all'); vibrate(); }}
                            className={`p-2 rounded-full transition-all ${activeTab === 'favorites' ? 'bg-yellow-500/20 text-yellow-500' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)]'}`}
                        >
                            <StarIcon filled={activeTab === 'favorites'} className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Modern Search Input */}
                <div className="relative mb-4 group">
                    <input 
                        type="text"
                        placeholder={t('search_news_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/50 focus:bg-[var(--bg-secondary)] transition-all shadow-inner"
                    />
                    <div className="absolute left-3 top-3.5 text-[var(--text-secondary)] group-focus-within:text-[var(--accent-color)] transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </div>
                </div>
                
                {/* Scrollable Categories */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x pb-1">
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

        {/* Pull Refresh Indicator */}
        <div 
            className="absolute left-0 right-0 flex justify-center pointer-events-none z-20 transition-all duration-300"
            style={{ top: `${60 + Math.min(pullPosition / 2, 20)}px`, opacity: pullPosition/70 }}
        >
            <div className="bg-[var(--bg-secondary)] p-2 rounded-full shadow-lg border border-[var(--border-color)]">
                <RefreshIcon className={`w-5 h-5 text-[var(--accent-color)] ${loading ? 'animate-spin' : ''}`}/>
            </div>
        </div>

        {/* Content Area */}
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
                                {/* Hero (Only on 'All' tab and first page) */}
                                {activeTab === 'all' && !searchQuery && <FeaturedNewsCard article={displayedNews[0]} />}
                                
                                {/* List */}
                                <div className="flex flex-col gap-3">
                                    {(activeTab === 'all' && !searchQuery ? displayedNews.slice(1) : displayedNews).map((article, i) => (
                                        <div key={`${article.title}-${i}`} className="animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                                            <NewsListItem article={article} addToast={addToast} />
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="text-center py-8 text-[var(--text-secondary)] text-xs font-medium tracking-wide opacity-50">
                                    {t('all_rights_reserved')} • Google News Powered
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[50vh] text-center text-[var(--text-secondary)]">
                                <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4 border border-[var(--border-color)]">
                                    <FilterIcon className="w-8 h-8 opacity-30" />
                                </div>
                                <p className="font-bold text-lg">{t('no_news_found')}</p>
                                <button onClick={handleRefresh} className="mt-4 text-[var(--accent-color)] font-bold text-sm hover:underline">
                                    {t('try_again')}
                                </button>
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
