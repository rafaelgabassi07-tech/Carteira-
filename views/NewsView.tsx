
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

// --- Image Helpers ---
const getFallbackImage = (category?: string) => {
    const map: Record<string, string> = {
        'Dividendos': 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=800', // Money/Calculations
        'Macroeconomia': 'https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&q=80&w=800', // Chart/Graph
        'Resultados': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800', // Data analysis
        'Mercado': 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=800', // Stock market
        'Imóveis': 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800', // Skyscraper
        'Geral': 'https://images.unsplash.com/photo-1612178991541-b48cc8e92a4d?auto=format&fit=crop&q=80&w=800', // Coins/Finance
    };
    return map[category || 'Geral'] || map['Geral'];
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
        'Geral': 'bg-slate-500/10 text-slate-500 border-slate-500/20'
    };

    const style = colorMap[category] || colorMap['Geral'];

    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style} uppercase tracking-wider`}>
            {category}
        </span>
    );
};

const ImpactBadge: React.FC<{ level?: string; transparent?: boolean }> = ({ level, transparent }) => {
    if (!level) return null;
    
    const map: Record<string, { color: string, label: string }> = {
        'High': { color: transparent ? 'bg-red-600/90 text-white' : 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Alto Impacto' },
        'Medium': { color: transparent ? 'bg-yellow-500/90 text-black' : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', label: 'Médio' },
        'Low': { color: transparent ? 'bg-slate-600/90 text-white' : 'bg-slate-500/10 text-slate-500 border-slate-500/20', label: 'Baixo' }
    };
    
    const data = map[level];
    if (!data) return null;

    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${transparent ? 'border-transparent' : ''} ${data.color} uppercase tracking-wider`}>
            {data.label}
        </span>
    );
};

const NewsHero: React.FC<{ article: NewsArticle; onClick: () => void }> = ({ article, onClick }) => {
    const bgImage = article.imageUrl || getFallbackImage(article.category);

    return (
        <div onClick={onClick} className="mb-6 relative h-72 sm:h-80 group cursor-pointer rounded-2xl overflow-hidden shadow-lg border border-[var(--border-color)] active:scale-[0.99] transition-transform">
            {/* Background Image */}
            <img 
                src={bgImage} 
                alt="News Background" 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent z-10"></div>
            
            {/* Content */}
            <div className="relative z-20 p-6 flex flex-col h-full justify-end">
                <div className="flex gap-2 mb-3">
                    <ImpactBadge level={article.impactLevel} transparent />
                    <CategoryBadge category={article.category} transparent />
                </div>
                
                <h2 className="text-white text-xl sm:text-2xl font-bold leading-tight mb-2 text-shadow-sm line-clamp-3">
                    {article.title}
                </h2>
                
                {article.impactAnalysis && (
                    <p className="text-gray-300 text-xs sm:text-sm line-clamp-2 mb-4 max-w-2xl">
                        <span className="text-[var(--accent-color)] font-bold">Análise: </span>
                        {article.impactAnalysis}
                    </p>
                )}
                
                <div className="flex justify-between items-center border-t border-white/20 pt-3 mt-1">
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
  const bgImage = article.imageUrl || getFallbackImage(article.category);

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
    <div onClick={handleOpen} className="bg-[var(--bg-secondary)] rounded-xl overflow-hidden border border-[var(--border-color)] shadow-sm hover:border-[var(--accent-color)]/40 transition-all flex flex-col h-full cursor-pointer group">
      {/* Card Image Header */}
      <div className="h-32 relative overflow-hidden">
          <img src={bgImage} alt="News" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-90 group-hover:opacity-100" />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] to-transparent opacity-90"></div>
          
          <div className="absolute top-2 right-2 flex gap-1 z-10">
             <button onClick={handleShare} className="p-1.5 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-[var(--accent-color)] transition-colors">
                <ShareIcon className="w-3 h-3" />
             </button>
             <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} className={`p-1.5 rounded-full bg-black/30 backdrop-blur-md transition-colors ${isFavorited ? 'text-yellow-400' : 'text-white hover:text-yellow-400'}`}>
                <StarIcon filled={isFavorited} className="w-3 h-3" />
             </button>
          </div>
          
          <div className="absolute bottom-2 left-3">
              <CategoryBadge category={article.category} />
          </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-sm font-bold text-[var(--text-primary)] leading-tight mb-2 line-clamp-2 group-hover:text-[var(--accent-color)] transition-colors">{article.title}</h3>
        
        {article.impactAnalysis && (
            <div className="mb-3">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-0.5">Impacto:</p>
                <p className="text-xs text-[var(--text-primary)] italic line-clamp-2 opacity-80">"{article.impactAnalysis}"</p>
            </div>
        )}

        {!article.impactAnalysis && <p className="text-xs text-[var(--text-secondary)] line-clamp-3 mb-3">{article.summary}</p>}
        
        <div className="mt-auto flex justify-between items-center pt-3 border-t border-[var(--border-color)]">
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[var(--accent-color)]">{article.source}</span>
                <span className="text-[9px] text-[var(--text-secondary)]">{article.date}</span>
            </div>
            <span className="text-[10px] font-bold text-[var(--text-primary)] bg-[var(--bg-tertiary-hover)] px-2 py-1 rounded flex items-center gap-1 group-hover:bg-[var(--accent-color)] group-hover:text-white transition-colors">
                Ler notícia ↗
            </span>
        </div>
      </div>
    </div>
  );
};

const NewsCardSkeleton: React.FC = () => (
    <div className="bg-[var(--bg-secondary)] rounded-xl overflow-hidden animate-pulse border border-[var(--border-color)] h-72">
        <div className="h-32 bg-gray-700/50"></div>
        <div className="p-4">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-3"></div>
            <div className="h-3 bg-gray-700 rounded w-full mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-5/6 mb-4"></div>
            <div className="h-16 bg-gray-800 rounded-lg"></div>
        </div>
    </div>
);


const NewsView: React.FC<{addToast: (message: string, type?: ToastMessage['type']) => void}> = ({ addToast }) => {
  const { t } = useI18n();
  const { assets, preferences } = usePortfolio();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todas');
  
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem('news-favorites');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  
  const [activeTab, setActiveTab] = useState<'all' | 'favorites'>('all');
  
  // Pull to Refresh
  const touchStartY = useRef(0);
  const [pullPosition, setPullPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const assetTickers = useMemo(() => assets.map(a => a.ticker), [assets]);

  const categories = ['Todas', 'Dividendos', 'Macroeconomia', 'Resultados', 'Mercado', 'Imóveis'];

  useEffect(() => {
    localStorage.setItem('news-favorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  const handleToggleFavorite = (articleTitle: string) => {
    vibrate(10);
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
              setPullPosition(0);
              return;
          }
      }

      const filter: NewsFilter = {
          query: currentQuery,
          tickers: assetTickers,
          dateRange: 'week',
      };

      const articles = await fetchMarketNews(preferences, filter);
      
      // Sort: High Impact first, then by date
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
      setPullPosition(0);
    }
  }, [t, assetTickers, preferences]);
  
  const debouncedLoadNews = useCallback(debounce((q: string) => loadNews(true, q), 1000), [loadNews]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      debouncedLoadNews(e.target.value);
  };
  
  const handleRefresh = () => {
    vibrate();
    setLoading(true);
    loadNews(true, searchQuery);
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
          loadNews(true, searchQuery);
      } else {
          setPullPosition(0);
      }
      touchStartY.current = 0;
  };

  useEffect(() => {
    loadNews(false, '');
  }, [loadNews]);

  const filteredNews = useMemo(() => {
      let filtered = activeTab === 'favorites' ? news.filter(n => favorites.has(n.title)) : news;
      
      if (activeCategory !== 'Todas') {
          filtered = filtered.filter(n => n.category === activeCategory);
      }
      return filtered;
  }, [news, activeTab, favorites, activeCategory]);

  // Separate Hero item (First High Impact or just first item) if searching/filtering is default
  const showHero = activeTab === 'all' && activeCategory === 'Todas' && !searchQuery && filteredNews.length > 0;
  const heroItem = showHero ? filteredNews[0] : null;
  const listItems = showHero ? filteredNews.slice(1) : filteredNews;

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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{t('market_news')}</h1>
          <button 
              onClick={handleRefresh} 
              disabled={loading}
              className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95 disabled:opacity-50 border border-[var(--border-color)]"
          >
              <RefreshIcon className={`w-5 h-5 ${loading ? 'animate-spin text-[var(--accent-color)]' : ''}`} />
          </button>
        </div>

        {/* Search & Tabs */}
        <div className="mb-6 space-y-4">
             <input 
                type="text"
                placeholder={t('search_news_placeholder')}
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--accent-color)] transition-colors shadow-sm"
            />
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button 
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeTab === 'all' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'}`}
                >
                    {t('news_tab_all')}
                </button>
                <button 
                    onClick={() => setActiveTab('favorites')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${activeTab === 'favorites' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'}`}
                >
                    <StarIcon className="w-3 h-3" filled={activeTab === 'favorites'}/>
                    {t('news_tab_favorites')}
                </button>
                <div className="w-px bg-[var(--border-color)] mx-1 h-6 self-center"></div>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary-hover)]'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        {loading && <div className="space-y-4"><div className="h-72 bg-[var(--bg-secondary)] rounded-2xl animate-pulse"></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({length: 4}).map((_, i) => <NewsCardSkeleton key={i}/>)}</div></div>}
        
        {error && (
          <div className="bg-red-900/20 border border-red-500/50 text-red-200 px-6 py-8 rounded-2xl text-center">
            <p className="font-bold mb-2">{t('error')}</p>
            <p className="text-sm mb-4">{error}</p>
            <button onClick={() => loadNews(true, searchQuery)} className="bg-red-500 text-white font-bold py-2 px-6 rounded-lg text-sm hover:bg-red-600 transition-colors">
              {t('try_again')}
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="flex-1 animate-fade-in">
            {heroItem && (
                <NewsHero 
                    article={heroItem} 
                    onClick={() => heroItem.url && window.open(heroItem.url, '_blank')}
                />
            )}

            {listItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {listItems.map((article, index) => (
                    <div key={`${article.title}-${index}`} className="h-full">
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
                      <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4 border border-[var(--border-color)]">
                          {activeTab === 'favorites' ? <StarIcon className="w-8 h-8 opacity-50" /> : <FilterIcon className="w-8 h-8 opacity-50" />}
                      </div>
                      <p className="font-bold text-lg">{activeTab === 'favorites' ? t('no_favorites_title') : t('no_news_found')}</p>
                      <p className="text-sm mt-2 max-w-[250px] opacity-70">
                          {activeTab === 'favorites' ? t('no_favorites_subtitle') : "Tente ajustar os filtros ou buscar por outro termo."}
                      </p>
                  </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsView;
