
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { NewsArticle, ToastMessage } from '../types';
import { fetchMarketNews } from '../services/geminiService';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { CacheManager, vibrate, debounce } from '../utils';
import { CACHE_TTL } from '../constants';
import RefreshIcon from '../components/icons/RefreshIcon';
import ShareIcon from '../components/icons/ShareIcon';

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
        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 snap-start ${
            isActive 
                ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-md' 
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary-hover)]'
        }`}
    >
        {label}
    </button>
);

const FeaturedNewsCard: React.FC<{ article: NewsArticle }> = ({ article }) => {
    const [imgSrc, setImgSrc] = useState(article.imageUrl || getFallbackImage(article.title));

    return (
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="block group relative h-64 w-full rounded-2xl overflow-hidden mb-6 shadow-lg active:scale-[0.98] transition-transform duration-200">
            <img 
                src={imgSrc} 
                alt={article.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={() => setImgSrc(getFallbackImage(article.title))}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90"></div>
            <div className="absolute bottom-0 left-0 p-5 w-full">
                <div className="flex items-center gap-2 mb-2">
                    <span className="bg-[var(--accent-color)] text-[var(--accent-color-text)] text-[10px] font-bold px-2 py-0.5 rounded uppercase">Destaque</span>
                    <span className="text-gray-300 text-xs font-medium">{article.source}</span>
                </div>
                <h2 className="text-xl font-bold text-white leading-tight line-clamp-2 mb-1 drop-shadow-sm">{article.title}</h2>
                <p className="text-sm text-gray-300 line-clamp-1">{article.summary}</p>
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
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex gap-4 py-4 border-b border-[var(--border-color)] group active:bg-[var(--bg-tertiary-hover)] transition-colors -mx-2 px-2 rounded-lg">
            <div className="flex-1 flex flex-col justify-between min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                    <img src={getFavicon(article.url || '')} alt="" className="w-4 h-4 rounded-sm bg-white/10" onError={(e) => e.currentTarget.style.display = 'none'} />
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wide truncate">{article.source}</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">• {getTimeString(article.date)}</span>
                </div>
                
                <h3 className="font-bold text-sm md:text-base text-[var(--text-primary)] leading-snug line-clamp-3 group-hover:text-[var(--accent-color)] transition-colors">
                    {article.title}
                </h3>
                
                <div className="mt-2 flex items-center gap-4">
                    <button onClick={handleShare} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        <ShareIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            <div className="w-24 h-24 md:w-32 md:h-28 flex-shrink-0 rounded-xl overflow-hidden bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)]">
                <img 
                    src={imgSrc} 
                    alt="" 
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={() => setImgSrc(getFallbackImage(article.title))}
                />
            </div>
        </a>
    );
};

const NewsSkeleton = () => (
    <div className="animate-pulse space-y-6">
        <div className="h-64 bg-[var(--bg-secondary)] rounded-2xl"></div>
        {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex gap-4">
                <div className="flex-1 space-y-2">
                    <div className="h-3 bg-[var(--bg-secondary)] rounded w-1/4"></div>
                    <div className="h-4 bg-[var(--bg-secondary)] rounded w-full"></div>
                    <div className="h-4 bg-[var(--bg-secondary)] rounded w-3/4"></div>
                </div>
                <div className="w-24 h-24 bg-[var(--bg-secondary)] rounded-xl"></div>
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
    
    const categories = ['Destaques', 'Dividendos', 'FIIs', 'Ações', 'Macroeconomia', 'Tech'];
    
    const fetchNews = useCallback(async (cat: string, isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        
        const cacheKey = `news_v6_${cat}`;
        if (!isRefresh) {
            const cached = CacheManager.get<NewsArticle[]>(cacheKey, CACHE_TTL.NEWS);
            if (cached) {
                setNews(cached);
                setLoading(false);
                return;
            }
        }

        // Auto-inject tickers if category is FIIs or Ações
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

    const handleRefresh = () => {
        vibrate();
        fetchNews(category, true);
    };

    return (
        <div className="h-full flex flex-col bg-[var(--bg-primary)]">
            {/* Header & Tabs */}
            <div className="bg-[var(--bg-primary)]/80 backdrop-blur-md sticky top-0 z-20 border-b border-[var(--border-color)]">
                <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <span className="text-[var(--accent-color)]">Google</span> Notícias
                    </h1>
                    <button onClick={handleRefresh} className={`p-2 rounded-full hover:bg-[var(--bg-tertiary-hover)] ${loading ? 'animate-spin text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`}>
                        <RefreshIcon className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Scrollable Categories */}
                <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar snap-x">
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-24 md:pb-6">
                <div className="max-w-2xl mx-auto">
                    {loading ? (
                        <NewsSkeleton />
                    ) : (
                        <div className="animate-fade-in">
                            {news.length > 0 && (
                                <>
                                    {/* Hero Article (First one) */}
                                    <FeaturedNewsCard article={news[0]} />
                                    
                                    {/* List */}
                                    <div className="flex flex-col gap-2">
                                        {news.slice(1).map((article, i) => (
                                            <div key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                                                <NewsListItem article={article} addToast={addToast} />
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div className="text-center py-8 text-[var(--text-secondary)] text-xs">
                                        <p>Fim dos resultados para "{category}"</p>
                                    </div>
                                </>
                            )}
                            
                            {news.length === 0 && !loading && (
                                <div className="text-center py-20 opacity-50">
                                    <p>Não foi possível carregar as notícias.</p>
                                    <button onClick={handleRefresh} className="mt-4 text-[var(--accent-color)] font-bold">Tentar Novamente</button>
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
