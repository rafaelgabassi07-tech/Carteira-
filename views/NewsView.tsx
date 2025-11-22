
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

// --- IMAGENS DE FALLBACK (Unsplash de Alta Qualidade) ---
const FALLBACK_IMAGES: Record<string, string[]> = {
    Dividendos: [
        'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1604594849809-dfedbc827105?auto=format&fit=crop&w=800&q=80',
    ],
    Macroeconomia: [
        'https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1526304640152-d4619684e484?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80',
    ],
    Imóveis: [
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=800&q=80',
    ],
    Mercado: [
        'https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?auto=format&fit=crop&w=800&q=80',
    ],
    Geral: [
        'https://images.unsplash.com/photo-1593672715438-d88a350374ee?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    ]
};

const getFallbackImage = (category: string = 'Geral', title: string): string => {
    const cat = FALLBACK_IMAGES[category] ? category : 'Geral';
    const images = FALLBACK_IMAGES[cat];
    
    // Hash determinístico do título para escolher sempre a mesma imagem para a mesma notícia
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % images.length;
    
    return images[index];
};

const ImpactBadge: React.FC<{ level: string }> = ({ level }) => {
    const colors = {
        High: 'bg-red-500/90 text-white shadow-red-500/20',
        Medium: 'bg-yellow-500/90 text-white shadow-yellow-500/20',
        Low: 'bg-blue-500/90 text-white shadow-blue-500/20'
    };
    const labels = { High: 'Alto Impacto', Medium: 'Médio Impacto', Low: 'Baixo Impacto' };
    
    return (
        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider shadow-lg ${colors[level as keyof typeof colors] || colors.Low}`}>
            {labels[level as keyof typeof labels] || 'Info'}
        </span>
    );
};

const NewsHero: React.FC<{ article: NewsArticle; onClick: () => void }> = ({ article, onClick }) => {
    const [imgError, setImgError] = useState(false);
    const imageSrc = (!imgError && article.imageUrl) ? article.imageUrl : getFallbackImage(article.category, article.title);

    return (
        <div 
            onClick={onClick}
            className="relative w-full h-64 md:h-80 rounded-3xl overflow-hidden cursor-pointer group shadow-2xl border border-[var(--border-color)] mb-8 animate-scale-in"
        >
            {/* Background Image with Parallax-like effect on hover */}
            <div className="absolute inset-0 bg-[var(--bg-secondary)]">
                <img 
                    src={imageSrc}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90"
                    onError={() => setImgError(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex flex-col justify-end h-full">
                <div className="flex items-center gap-3 mb-3">
                    <span className="bg-[var(--accent-color)] text-[var(--accent-color-text)] text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest shadow-lg shadow-[var(--accent-color)]/20">
                        {article.category || 'Mercado'}
                    </span>
                    {article.impactLevel && <ImpactBadge level={article.impactLevel} />}
                </div>
                
                <h2 className="text-xl md:text-3xl font-bold text-white leading-tight mb-2 line-clamp-3 drop-shadow-lg">
                    {article.title}
                </h2>
                
                <p className="text-gray-200 text-xs md:text-sm line-clamp-2 mb-4 max-w-2xl drop-shadow-md">
                    {article.summary}
                </p>

                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {article.source} • {new Date(article.date).toLocaleDateString()}
                    </span>
                    <span className="text-white text-xs font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Ler destaque <ShareIcon className="w-3 h-3" />
                    </span>
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
  const [imgError, setImgError] = useState(false);
  const imageSrc = (!imgError && article.imageUrl) ? article.imageUrl : getFallbackImage(article.category, article.title);

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

  const openNews = () => {
      vibrate();
      if(article.url) window.open(article.url, '_blank');
  };

  return (
    <div onClick={openNews} className="bg-[var(--bg-secondary)] rounded-2xl overflow-hidden border border-[var(--border-color)] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full group cursor-pointer">
      {/* Image Header */}
      <div className="h-32 w-full relative overflow-hidden bg-[var(--bg-tertiary-hover)]">
          <img 
            src={imageSrc} 
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] to-transparent opacity-80" />
          
          <div className="absolute top-2 right-2 flex gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                className="p-2 rounded-full bg-black/20 backdrop-blur-md hover:bg-white/20 transition-colors text-white"
              >
                  <StarIcon filled={isFavorited} className={`w-4 h-4 ${isFavorited ? 'text-yellow-400' : ''}`} />
              </button>
          </div>
          
          <div className="absolute bottom-2 left-3">
              <span className="text-[9px] font-bold uppercase tracking-wider bg-[var(--bg-primary)]/90 text-[var(--accent-color)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                  {article.category || 'Geral'}
              </span>
          </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-sm font-bold leading-snug mb-2 line-clamp-3 text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors">
            {article.title}
        </h3>
        
        {article.impactAnalysis && (
            <div className="mb-3 p-2 rounded-lg bg-[var(--bg-tertiary-hover)]/50 border-l-2 border-[var(--accent-color)]">
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-0.5">IMPACTO:</p>
                <p className="text-[10px] italic text-[var(--text-secondary)] line-clamp-2">"{article.impactAnalysis}"</p>
            </div>
        )}

        <div className="mt-auto pt-3 flex justify-between items-center border-t border-[var(--border-color)]">
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[var(--accent-color)]">{article.source}</span>
                <span className="text-[9px] text-[var(--text-secondary)]">{new Date(article.date).toLocaleDateString()}</span>
            </div>
            <button 
                onClick={handleShare}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary-hover)] text-[var(--text-secondary)] transition-colors"
            >
                <ShareIcon className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
};

const NewsView: React.FC<{addToast: (message: string, type?: ToastMessage['type']) => void}> = ({ addToast }) => {
  const { t } = useI18n();
  const { assets, preferences } = usePortfolio();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  
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
    vibrate();
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

  const loadNews = useCallback(async (isRefresh = false) => {
    if(!isRefresh) setLoading(true);
    
    try {
      const filterKey = `news_feed_premium_${assetTickers.join('_')}`;
      
      if (!isRefresh) {
          const cachedNews = CacheManager.get<NewsArticle[]>(filterKey, CACHE_TTL.NEWS);
          if (cachedNews) {
              setNews(cachedNews);
              setLoading(false);
              return;
          }
      }

      const filter: NewsFilter = {
          tickers: assetTickers,
          dateRange: 'week',
      };

      const articles = await fetchMarketNews(preferences, filter);
      setNews(articles);
      if(articles.length > 0) CacheManager.set(filterKey, articles);

    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [assetTickers, preferences]);

  useEffect(() => {
    loadNews(false);
  }, [loadNews]);

  const categories = ['Todas', 'Dividendos', 'Macroeconomia', 'Resultados', 'Mercado', 'Imóveis'];

  const filteredNews = useMemo(() => {
      let filtered = activeTab === 'favorites' ? news.filter(n => favorites.has(n.title)) : news;
      
      if (searchQuery) {
          filtered = filtered.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.summary.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      
      if (selectedCategory !== 'Todas') {
          filtered = filtered.filter(n => n.category === selectedCategory);
      }
      
      return filtered;
  }, [news, activeTab, favorites, searchQuery, selectedCategory]);

  const heroArticle = filteredNews.length > 0 && !searchQuery && selectedCategory === 'Todas' && activeTab === 'all' ? filteredNews[0] : null;
  const gridArticles = heroArticle ? filteredNews.slice(1) : filteredNews;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg-primary)]">
        {/* Header Glass */}
        <div className="px-4 py-3 flex justify-between items-center sticky top-0 z-30 glass border-b border-[var(--border-color)]">
            <h1 className="text-xl font-bold">Notícias</h1>
            <button 
                onClick={() => { vibrate(); loadNews(true); addToast('Atualizando...', 'info'); }} 
                className={`p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] transition-all active:scale-95 ${loading ? 'animate-spin text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`}
            >
                <RefreshIcon className="w-5 h-5" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 p-4">
            <div className="max-w-7xl mx-auto">
                
                {/* Search Bar */}
                <div className="relative mb-6 group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[var(--text-secondary)]">
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </div>
                    <input 
                        type="text"
                        placeholder="Buscar notícias..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)]/50 transition-all shadow-sm group-hover:shadow-md"
                    />
                </div>

                {/* Category Pills */}
                <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-2">
                    <button
                        onClick={() => { setActiveTab(activeTab === 'all' ? 'favorites' : 'all'); vibrate(); }}
                        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-2 ${activeTab === 'favorites' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/50' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]'}`}
                    >
                        <StarIcon filled={activeTab === 'favorites'} className="w-3 h-3" /> {activeTab === 'favorites' ? 'Favoritos' : 'Salvos'}
                    </button>
                    <div className="w-px h-6 bg-[var(--border-color)] mx-1 self-center"></div>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setSelectedCategory(cat); vibrate(); }}
                            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${selectedCategory === cat ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] border-[var(--accent-color)] shadow-lg shadow-[var(--accent-color)]/20' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-tertiary-hover)]'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="w-full h-64 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)]"></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1,2,3].map(i => <div key={i} className="h-48 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)]"></div>)}
                        </div>
                    </div>
                ) : (
                    <>
                        {heroArticle && (
                            <NewsHero 
                                article={heroArticle} 
                                onClick={() => heroArticle.url && window.open(heroArticle.url, '_blank')}
                            />
                        )}

                        {gridArticles.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {gridArticles.map((article, index) => (
                                    <div key={index} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
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
                            <div className="flex flex-col items-center justify-center h-64 text-center opacity-50">
                                <p className="font-bold text-lg">Nenhuma notícia encontrada</p>
                                <p className="text-xs">Tente ajustar os filtros ou busque por outro termo.</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    </div>
  );
};

export default NewsView;
