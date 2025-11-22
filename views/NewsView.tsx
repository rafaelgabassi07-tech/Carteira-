
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

// --- Image Helpers (Same as before but ensured import/usage) ---
const FALLBACK_IMAGES: Record<string, string[]> = {
    'Dividendos': [
        'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1628348068343-c6a848d2b6dd?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?auto=format&fit=crop&q=80&w=800'
    ],
    'Macroeconomia': [
        'https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1526304640152-d4619684e484?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1591696205602-2f950c417cb9?auto=format&fit=crop&q=80&w=800'
    ],
    'Resultados': [
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1543286386-713df548e9cc?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=800'
    ],
    'Mercado': [
        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1535320903710-d9cf113d2054?auto=format&fit=crop&q=80&w=800'
    ],
    'Imóveis': [
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1464938050520-ef2270bb8ce8?auto=format&fit=crop&q=80&w=800'
    ],
    'Geral': [
        'https://images.unsplash.com/photo-1612178991541-b48cc8e92a4d?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1604594849809-dfedbc827105?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1621981386829-9b416a95bd3d?auto=format&fit=crop&q=80&w=800', 
        'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=800'
    ]
};

const getFallbackImage = (category?: string, title?: string) => {
    const cat = category && FALLBACK_IMAGES[category] ? category : 'Geral';
    const images = FALLBACK_IMAGES[cat];
    if (!title) return images[0];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % images.length;
    return images[index];
};

// --- Visual Components ---

const CategoryBadge: React.FC<{ category?: string; transparent?: boolean }> = ({ category, transparent }) => {
    if (!category) return null;
    // Transparent version for Hero image overlay
    if (transparent) {
        return (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/40 border border-white/30 text-white uppercase tracking-wider backdrop-blur-md">
                {category}
            </span>
        );
    }
    const colorMap: Record<string, string> = {
        'Dividendos': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        'Macroeconomia': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        'Resultados': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
        'Mercado': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        'Imóveis': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
        'Geral': 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
    };
    const style = colorMap[category] || colorMap['Geral'];
    return (
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${style} uppercase tracking-wider shadow-sm`}>
            {category}
        </span>
    );
};

const ImpactBadge: React.FC<{ level?: string; transparent?: boolean }> = ({ level, transparent }) => {
    if (!level) return null;
    const map: Record<string, { color: string, label: string }> = {
        'High': { color: transparent ? 'bg-red-600/90 text-white' : 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Alto Impacto' },
        'Medium': { color: transparent ? 'bg-yellow-500/90 text-black' : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', label: 'Médio' },
        'Low': { color: transparent ? 'bg-zinc-600/90 text-white' : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20', label: 'Baixo' }
    };
    const data = map[level];
    if (!data) return null;
    return (
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${transparent ? 'border-transparent' : ''} ${data.color} uppercase tracking-wider shadow-sm`}>
            {data.label}
        </span>
    );
};

const NewsHero: React.FC<{ article: NewsArticle; onClick: () => void }> = ({ article, onClick }) => {
    const [imgSrc, setImgSrc] = useState<string>(article.imageUrl || getFallbackImage(article.category, article.title));

    useEffect(() => {
        setImgSrc(article.imageUrl || getFallbackImage(article.category, article.title));
    }, [article]);

    const handleError = () => {
        const fallback = getFallbackImage(article.category, article.title);
        if (imgSrc !== fallback) setImgSrc(fallback);
    };

    return (
        <div onClick={onClick} className="mb-8 relative h-[340px] group cursor-pointer rounded-3xl overflow-hidden shadow-2xl border border-white/5 active:scale-[0.99] transition-transform">
            <img 
                src={imgSrc} 
                onError={handleError}
                alt="News Background" 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent z-10"></div>
            <div className="relative z-20 p-6 sm:p-8 flex flex-col h-full justify-end">
                <div className="flex gap-2 mb-3">
                    <ImpactBadge level={article.impactLevel} transparent />
                    <CategoryBadge category={article.category} transparent />
                </div>
                <h2 className="text-white text-2xl sm:text-3xl font-bold leading-tight mb-3 text-shadow-lg line-clamp-3">
                    {article.title}
                </h2>
                {article.impactAnalysis && (
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 max-w-3xl">
                        <p className="text-gray-200 text-xs sm:text-sm line-clamp-2">
                            <span className="text-[var(--accent-color)] font-bold mr-1">Análise IA:</span>
                            {article.impactAnalysis}
                        </p>
                    </div>
                )}
                <div className="flex justify-between items-center mt-4 pt-2 border-t border-white/10">
                    <span className="text-[10px] font-bold text-[var(--accent-color)] uppercase tracking-wider">{article.source}</span>
                    <span className="text-[10px] text-gray-400">{article.date}</span>
                </div>
            </div>
        </div>
    );
};

const NewsCard: React.FC<{ 
  article: NewsArticle;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  addToast: (message: string, type?: ToastMessage['type']) => void;
}> = ({ article, isFavorited, onToggleFavorite, addToast }) => {
  const { t } = useI18n();
  const [imgSrc, setImgSrc] = useState<string>(article.imageUrl || getFallbackImage(article.category, article.title));

  useEffect(() => {
      setImgSrc(article.imageUrl || getFallbackImage(article.category, article.title));
  }, [article]);

  const handleError = () => {
      const fallback = getFallbackImage(article.category, article.title);
      if (imgSrc !== fallback) setImgSrc(fallback);
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
        if (navigator.share) await navigator.share(shareData);
        else addToast(t('toast_share_not_supported'), 'error');
    } catch (err) { }
  };

  const handleOpen = () => {
      if (article.url) window.open(article.url, '_blank');
  };

  return (
    <div onClick={handleOpen} className="glass-card rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-[var(--accent-color)]/30 transition-all duration-300 flex flex-col h-full cursor-pointer group relative">
      {/* Image Container */}
      <div className="h-40 relative overflow-hidden">
          <img 
            src={imgSrc} 
            onError={handleError}
            alt="News" 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] via-transparent to-transparent opacity-80"></div>
          
          <div className="absolute top-2 right-2 flex gap-1 z-10">
             <button onClick={handleShare} className="p-2 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-[var(--accent-color)] transition-colors">
                <ShareIcon className="w-3.5 h-3.5" />
             </button>
             <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} className={`p-2 rounded-full bg-black/40 backdrop-blur-md transition-colors ${isFavorited ? 'text-yellow-400' : 'text-white hover:text-yellow-400'}`}>
                <StarIcon filled={isFavorited} className="w-3.5 h-3.5" />
             </button>
          </div>
          <div className="absolute bottom-2 left-3">
              <CategoryBadge category={article.category} />
          </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
             <span className="text-[10px] font-bold text-[var(--accent-color)] uppercase tracking-wider">{article.source}</span>
             <span className="w-1 h-1 rounded-full bg-gray-500"></span>
             <span className="text-[10px] text-[var(--text-secondary)]">{article.date}</span>
        </div>

        <h3 className="text-base font-bold text-[var(--text-primary)] leading-snug mb-3 line-clamp-2 group-hover:text-[var(--accent-color)] transition-colors">{article.title}</h3>
        
        {article.impactAnalysis ? (
            <div className="mt-auto bg-[var(--bg-tertiary-hover)]/50 rounded-lg p-3 border border-[var(--border-color)]">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)]"></span>
                    Impacto
                </p>
                <p className="text-xs text-[var(--text-primary)] italic line-clamp-2 opacity-90">"{article.impactAnalysis}"</p>
            </div>
        ) : (
            <p className="text-xs text-[var(--text-secondary)] line-clamp-3 mb-3 leading-relaxed">{article.summary}</p>
        )}
      </div>
    </div>
  );
};

const NewsCardSkeleton: React.FC = () => (
    <div className="bg-[var(--bg-secondary)] rounded-2xl overflow-hidden animate-pulse border border-[var(--border-color)] h-[300px]">
        <div className="h-36 bg-zinc-800"></div>
        <div className="p-5 space-y-3">
            <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
            <div className="h-4 bg-zinc-800 rounded w-1/2"></div>
            <div className="h-20 bg-zinc-800/50 rounded-lg mt-4"></div>
        </div>
    </div>
);

const NewsView: React.FC<{addToast: (message: string, type?: ToastMessage['type']) => void}> = ({ addToast }) => {
  const { t } = useI18n();
  const { assets, preferences } = usePortfolio();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todas');
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem('news-favorites');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const categories = ['Todas', 'Dividendos', 'Macroeconomia', 'Resultados', 'Mercado', 'Imóveis'];
  const assetTickers = useMemo(() => assets.map(a => a.ticker), [assets]);

  useEffect(() => {
    localStorage.setItem('news-favorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  const handleToggleFavorite = (articleTitle: string) => {
    vibrate(10);
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(articleTitle)) newFavorites.delete(articleTitle);
      else newFavorites.add(articleTitle);
      return newFavorites;
    });
  };

  const loadNews = useCallback(async (isRefresh = false, currentQuery: string) => {
    if(!isRefresh) setLoading(true);
    setError(null);
    try {
      const cacheKey = `news_feed_${currentQuery || 'general'}`;
      if (!isRefresh) {
          const cachedNews = CacheManager.get<NewsArticle[]>(cacheKey, CACHE_TTL.NEWS);
          if (cachedNews) {
              setNews(cachedNews);
              setLoading(false);
              return;
          }
      }
      const filter: NewsFilter = { query: currentQuery, tickers: assetTickers, dateRange: 'week' };
      const articles = await fetchMarketNews(preferences, filter);
      const sortedArticles = articles.sort((a, b) => {
          if (a.impactLevel === 'High' && b.impactLevel !== 'High') return -1;
          if (b.impactLevel === 'High' && a.impactLevel !== 'High') return 1;
          return 0;
      });
      setNews(sortedArticles);
      if(sortedArticles.length > 0) CacheManager.set(cacheKey, sortedArticles);
    } catch (err: any) {
      setError(err.message || t('unknown_error'));
    } finally {
      setLoading(false);
    }
  }, [t, assetTickers, preferences]);
  
  const debouncedLoadNews = useCallback(debounce((q: string) => loadNews(true, q), 1000), [loadNews]);

  useEffect(() => {
    loadNews(false, '');
  }, [loadNews]);

  const filteredNews = useMemo(() => {
      let filtered = activeTab === 'favorites' ? news.filter(n => favorites.has(n.title)) : news;
      if (activeCategory !== 'Todas') filtered = filtered.filter(n => n.category === activeCategory);
      return filtered;
  }, [news, activeTab, favorites, activeCategory]);

  const showHero = activeTab === 'all' && activeCategory === 'Todas' && !searchQuery && filteredNews.length > 0;
  const heroItem = showHero ? filteredNews[0] : null;
  const listItems = showHero ? filteredNews.slice(1) : filteredNews;

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Sticky Header with Glass Effect */}
      <div className="sticky top-0 z-30 glass pb-2 pt-safe px-4 shadow-lg shadow-black/5">
          <div className="max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-center py-4">
                <h1 className="text-2xl font-bold tracking-tight">{t('market_news')}</h1>
                <button onClick={() => loadNews(true, searchQuery)} className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95 border border-[var(--border-color)]">
                    <RefreshIcon className={`w-5 h-5 ${loading ? 'animate-spin text-[var(--accent-color)]' : ''}`} />
                </button>
            </div>

            <div className="relative mb-4 group">
                <input 
                    type="text"
                    placeholder={t('search_news_placeholder')}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); debouncedLoadNews(e.target.value); }}
                    className="w-full bg-[var(--bg-secondary)]/80 backdrop-blur-sm border border-[var(--border-color)] rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] transition-all shadow-sm group-hover:border-[var(--border-color)]/80"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-hover:text-[var(--accent-color)] transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <button 
                    onClick={() => setActiveTab('all')}
                    className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${activeTab === 'all' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'}`}
                >
                    {t('news_tab_all')}
                </button>
                <button 
                    onClick={() => setActiveTab('favorites')}
                    className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 active:scale-95 ${activeTab === 'favorites' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'}`}
                >
                    <StarIcon className="w-3 h-3" filled={activeTab === 'favorites'}/>
                    {t('news_tab_favorites')}
                </button>
                <div className="w-px bg-[var(--border-color)] mx-1 h-5 self-center"></div>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${activeCategory === cat ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] shadow-lg shadow-[var(--accent-color)]/20' : 'bg-[var(--bg-secondary)]/80 text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary-hover)]'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6 custom-scrollbar landscape-pb-6">
        <div className="max-w-7xl mx-auto">
            {loading && <div className="space-y-6"><div className="h-[340px] bg-[var(--bg-secondary)] rounded-3xl animate-pulse"></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">{Array.from({length: 6}).map((_, i) => <NewsCardSkeleton key={i}/>)}</div></div>}
            
            {error && (
                <div className="glass border border-red-500/20 text-red-200 px-6 py-10 rounded-3xl text-center max-w-md mx-auto mt-10">
                    <p className="font-bold text-lg mb-2">{t('error')}</p>
                    <p className="text-sm opacity-80 mb-6">{error}</p>
                    <button onClick={() => loadNews(true, searchQuery)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors shadow-lg shadow-red-500/20">
                    {t('try_again')}
                    </button>
                </div>
            )}

            {!loading && !error && (
            <div className="animate-fade-in">
                {heroItem && (
                    <NewsHero 
                        article={heroItem} 
                        onClick={() => heroItem.url && window.open(heroItem.url, '_blank')}
                    />
                )}

                {listItems.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {listItems.map((article, index) => (
                        <div key={`${article.title}-${index}`} style={{ animationDelay: `${index * 50}ms` }} className="animate-fade-in-up h-full">
                            <NewsCard 
                                article={article}
                                isFavorited={favorites.has(article.title)}
                                onToggleFavorite={() => handleToggleFavorite(article.title)}
                                addToast={addToast}
                            />
                        </div>
                    ))}
                </div>
                ) : (
                !heroItem && (
                    <div className="flex flex-col items-center justify-center h-64 text-center text-[var(--text-secondary)]">
                        <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4 border border-[var(--border-color)]">
                            {activeTab === 'favorites' ? <StarIcon className="w-8 h-8 opacity-30" /> : <FilterIcon className="w-8 h-8 opacity-30" />}
                        </div>
                        <p className="font-bold text-lg">{activeTab === 'favorites' ? t('no_favorites_title') : t('no_news_found')}</p>
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
