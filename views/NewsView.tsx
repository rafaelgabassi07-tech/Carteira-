
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

// --- Visual Components ---

const CategoryBadge: React.FC<{ category?: string }> = ({ category }) => {
    if (!category) return null;
    
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
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${style} uppercase tracking-wider`}>
            {category}
        </span>
    );
};

const ImpactBadge: React.FC<{ level?: string }> = ({ level }) => {
    if (!level) return null;
    
    const map: Record<string, { color: string, label: string }> = {
        'High': { color: 'bg-red-500 text-white', label: 'Alto Impacto' },
        'Medium': { color: 'bg-yellow-500 text-black', label: 'Médio' },
        'Low': { color: 'bg-slate-600 text-slate-200', label: 'Baixo' }
    };
    
    const data = map[level];
    if (!data) return null;

    return (
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${data.color} shadow-sm`}>
            {data.label}
        </span>
    );
};

const NewsHero: React.FC<{ article: NewsArticle; onClick: () => void }> = ({ article, onClick }) => {
    return (
        <div onClick={onClick} className="mb-6 relative group cursor-pointer rounded-2xl overflow-hidden shadow-lg border border-[var(--border-color)] active:scale-[0.99] transition-transform">
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10"></div>
            {/* Abstract Background based on source/category */}
            <div className={`absolute inset-0 bg-[var(--bg-tertiary-hover)] opacity-50`}>
                 <div className="w-full h-full bg-gradient-to-br from-[var(--accent-color)]/20 to-purple-900/20"></div>
            </div>
            
            <div className="relative z-20 p-5 pt-24 flex flex-col h-full justify-end">
                <div className="flex gap-2 mb-2">
                    <ImpactBadge level={article.impactLevel} />
                    <CategoryBadge category={article.category} />
                </div>
                <h2 className="text-white text-xl font-bold leading-tight mb-2 line-clamp-3 text-shadow-sm">
                    {article.title}
                </h2>
                <p className="text-gray-300 text-xs line-clamp-2 mb-3">
                    {article.impactAnalysis || article.summary}
                </p>
                <div className="flex justify-between items-center border-t border-white/10 pt-2">
                    <span className="text-[10px] font-bold text-[var(--accent-color)] uppercase">{article.source}</span>
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
  const [isExpanded, setIsExpanded] = useState(false);

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
       // Cancelled
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl overflow-hidden border border-[var(--border-color)] shadow-sm hover:border-[var(--accent-color)]/30 transition-colors flex flex-col h-full">
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
            <div className="flex gap-2">
                {article.impactLevel === 'High' && <ImpactBadge level="High" />}
                <CategoryBadge category={article.category} />
            </div>
            <div className="flex gap-1 -mr-1">
                 <button onClick={handleShare} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary-hover)] hover:text-[var(--accent-color)]">
                    <ShareIcon className="w-4 h-4" />
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} className={`p-1.5 rounded-lg hover:bg-[var(--bg-tertiary-hover)] ${isFavorited ? 'text-yellow-400' : 'text-[var(--text-secondary)] hover:text-yellow-400'}`}>
                    <StarIcon filled={isFavorited} className="w-4 h-4" />
                 </button>
            </div>
        </div>

        <h3 className="text-sm font-bold text-[var(--text-primary)] leading-tight mb-2">{article.title}</h3>
        
        {/* Análise de Impacto (Why it matters) */}
        {article.impactAnalysis && (
            <div className="bg-[var(--bg-primary)] p-2 rounded-lg mb-3 border-l-2 border-[var(--accent-color)]">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-0.5">Impacto no Investidor:</p>
                <p className="text-xs text-[var(--text-primary)] italic">"{article.impactAnalysis}"</p>
            </div>
        )}

        <p className={`text-xs text-[var(--text-secondary)] leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
          {article.summary}
        </p>
        
        {article.summary.length > 100 && (
             <button onClick={() => setIsExpanded(!isExpanded)} className="text-[10px] font-bold text-[var(--accent-color)] mt-1 hover:underline self-start">
                {isExpanded ? t('read_less') : t('read_more')}
            </button>
        )}
      </div>
      
      <div className="bg-[var(--bg-tertiary-hover)]/30 px-4 py-2 flex justify-between items-center border-t border-[var(--border-color)] mt-auto">
          <span className="text-[10px] font-bold text-[var(--text-secondary)]">{article.source} • {article.date}</span>
          {article.url && (
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-[var(--accent-color)] hover:underline flex items-center gap-1">
                  LER NA FONTE <span className="text-[10px]">↗</span>
              </a>
          )}
      </div>
    </div>
  );
};

const NewsCardSkeleton: React.FC = () => (
    <div className="bg-[var(--bg-secondary)] p-4 rounded-xl animate-pulse border border-[var(--border-color)] h-64">
        <div className="flex gap-2 mb-3">
            <div className="h-4 bg-gray-700 rounded w-16"></div>
            <div className="h-4 bg-gray-700 rounded w-20"></div>
        </div>
        <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="h-20 bg-gray-800 rounded-lg mb-2"></div>
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
      // Simplified key for caching
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
          dateRange: 'week', // Default to week to get better context
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

  // Separate Hero item (First High Impact or just first item)
  const heroItem = activeTab === 'all' && activeCategory === 'Todas' && !searchQuery && filteredNews.length > 0 ? filteredNews[0] : null;
  const listItems = heroItem ? filteredNews.slice(1) : filteredNews;

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
          <button 
              onClick={handleRefresh} 
              disabled={loading}
              className="p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-all active:scale-95 disabled:opacity-50 border border-[var(--border-color)]"
          >
              <RefreshIcon className={`w-5 h-5 ${loading ? 'animate-spin text-[var(--accent-color)]' : ''}`} />
          </button>
        </div>

        {/* Search & Tabs */}
        <div className="mb-4 space-y-3">
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

        {loading && <div className="space-y-4"><div className="h-64 bg-[var(--bg-secondary)] rounded-2xl animate-pulse"></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({length: 4}).map((_, i) => <NewsCardSkeleton key={i}/>)}</div></div>}
        
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
