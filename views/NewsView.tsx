
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
    ],
    Macroeconomia: [
        'https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1526304640152-d4619684e484?auto=format&fit=crop&w=800&q=80',
    ],
    Imóveis: [
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
    ],
    Mercado: [
        'https://images.unsplash.com/photo-1611974765270-ca1258634369?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=800&q=80',
    ],
    Geral: [
        'https://images.unsplash.com/photo-1593672715438-d88a350374ee?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    ]
};

const getFallbackImage = (category: string = 'Geral', title: string): string => {
    const cat = FALLBACK_IMAGES[category] ? category : 'Geral';
    const images = FALLBACK_IMAGES[cat] || FALLBACK_IMAGES['Geral'];
    // Hash determinístico
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % images.length;
    return images[index];
};

const ImpactBadge: React.FC<{ level: string }> = ({ level }) => {
    const colors = {
        High: 'bg-red-500 text-white shadow-red-500/30',
        Medium: 'bg-yellow-500 text-black shadow-yellow-500/30',
        Low: 'bg-blue-500 text-white shadow-blue-500/30'
    };
    const labels = { High: 'Alto Impacto', Medium: 'Médio Impacto', Low: 'Baixo Impacto' };
    
    return (
        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider shadow-lg ${colors[level as keyof typeof colors] || colors.Low}`}>
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
            className="relative w-full h-64 md:h-80 rounded-3xl overflow-hidden cursor-pointer group shadow-2xl border border-[var(--border-color)] mb-8 animate-scale-in ring-1 ring-white/10"
        >
            {/* Background Image */}
            <div className="absolute inset-0 bg-[var(--bg-secondary)]">
                <img 
                    src={imageSrc}
                    alt={article.title}
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={() => setImgError(true)}
                />
                {/* Strong Gradient for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-90" />
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex flex-col justify-end h-full">
                <div className="flex items-center gap-3 mb-3">
                    <span className="bg-[var(--accent-color)] text-[var(--accent-color-text)] text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest shadow-lg">
                        {article.category || 'Mercado'}
                    </span>
                    {article.impactLevel && <ImpactBadge level={article.impactLevel} />}
                </div>
                
                <h2 className="text-xl md:text-3xl font-bold text-white leading-tight mb-2 line-clamp-3 drop-shadow-md">
                    {article.title}
                </h2>
                
                <p className="text-gray-200 text-xs md:text-sm line-clamp-2 mb-4 max-w-2xl drop-shadow-sm font-medium">
                    {article.summary}
                </p>

                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {article.source} • {new Date(article.date).toLocaleDateString()}
                    </span>
                    <button className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-lg transition-all border border-white/20 flex items-center gap-2 group-hover:bg-[var(--accent-color)] group-hover:border-[var(--accent-color)] group-hover:text-[var(--accent-color-text)]">
                        Ler notícia <ShareIcon className="w-3 h-3" />
                    </button>
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

  const openNews = () => {
      vibrate();
      if(article.url) window.open(article.url, '_blank');
  };

  const handleShare = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Share Logic here...
  }

  return (
    <div onClick={openNews} className="bg-[var(--bg-secondary)] rounded-2xl overflow-hidden border border-[var(--border-color)] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full group cursor-pointer">
      <div className="h-36 w-full relative overflow-hidden bg-[var(--bg-tertiary-hover)]">
          <img 
            src={imageSrc} 
            alt={article.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          <div className="absolute top-2 right-2">
              <button 
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                className="p-2 rounded-full bg-black/20 backdrop-blur-md hover:bg-white/20 transition-colors text-white"
              >
                  <StarIcon filled={isFavorited} className={`w-4 h-4 ${isFavorited ? 'text-yellow-400' : ''}`} />
              </button>
          </div>
          
          <div className="absolute bottom-2 left-3">
              <span className="text-[9px] font-bold uppercase tracking-wider bg-black/50 text-white px-1.5 py-0.5 rounded backdrop-blur-md border border-white/10">
                  {article.category || 'Geral'}
              </span>
          </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
             <span className="text-[10px] font-bold text-[var(--accent-color)] uppercase">{article.source}</span>
             <span className="text-[9px] text-[var(--text-secondary)]">{new Date(article.date).toLocaleDateString()}</span>
        </div>

        <h3 className="text-sm font-bold leading-snug mb-2 line-clamp-3 text-[var(--text-primary)] group-hover:text-[var(--accent-color)] transition-colors">
            {article.title}
        </h3>
        
        {article.impactAnalysis && (
            <div className="mb-3 p-2 rounded-lg bg-[var(--bg-tertiary-hover)] border-l-2 border-[var(--accent-color)]">
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-0.5">IMPACTO:</p>
                <p className="text-[10px] italic text-[var(--text-secondary)] line-clamp-2">"{article.impactAnalysis}"</p>
            </div>
        )}

        <div className="mt-auto pt-3 border-t border-[var(--border-color)] flex justify-end">
            <button className="text-[10px] font-bold text-[var(--text-primary)] hover:text-[var(--accent-color)] flex items-center gap-1 bg-[var(--bg-primary)] px-2 py-1 rounded border border-[var(--border-color)] transition-colors">
                Ler notícia <ShareIcon className="w-3 h-3" />
            </button>
        </div>
      </div>
    </div>
  );
};

// ... (Rest of the file: NewsView Component logic remains similar, ensuring Hero uses NewsHero and list uses NewsCard) ...

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
      const filterKey = `news_feed_${assetTickers.join('_')}`;
      if (!isRefresh) {
          const cachedNews = CacheManager.get<NewsArticle[]>(filterKey, CACHE_TTL.NEWS);
          if (cachedNews) {
              setNews(cachedNews);
              setLoading(false);
              return;
          }
      }
      const filter: NewsFilter = { tickers: assetTickers, dateRange: 'week' };
      const articles = await fetchMarketNews(preferences, filter);
      setNews(articles);
      if(articles.length > 0) CacheManager.set(filterKey, articles);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [assetTickers, preferences]);

  useEffect(() => { loadNews(false); }, [loadNews]);

  const filteredNews = useMemo(() => {
      let filtered = activeTab === 'favorites' ? news.filter(n => favorites.has(n.title)) : news;
      if (searchQuery) filtered = filtered.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()));
      if (selectedCategory !== 'Todas') filtered = filtered.filter(n => n.category === selectedCategory);
      return filtered;
  }, [news, activeTab, favorites, searchQuery, selectedCategory]);

  const heroArticle = filteredNews.length > 0 && !searchQuery && selectedCategory === 'Todas' && activeTab === 'all' ? filteredNews[0] : null;
  const gridArticles = heroArticle ? filteredNews.slice(1) : filteredNews;
  const categories = ['Todas', 'Dividendos', 'Macroeconomia', 'Resultados', 'Mercado', 'Imóveis'];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg-primary)]">
        <div className="px-4 py-3 flex justify-between items-center sticky top-0 z-30 glass border-b border-[var(--border-color)]">
            <h1 className="text-xl font-bold">Notícias</h1>
            <button onClick={() => { vibrate(); loadNews(true); addToast('Atualizando...', 'info'); }} className={`p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] transition-all active:scale-95 ${loading ? 'animate-spin text-[var(--accent-color)]' : 'text-[var(--text-secondary)]'}`}>
                <RefreshIcon className="w-5 h-5" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 p-4">
            <div className="max-w-7xl mx-auto">
                <div className="relative mb-6 group">
                    <input type="text" placeholder="Buscar notícias..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl py-3.5 pl-4 pr-4 text-sm focus:outline-none focus:border-[var(--accent-color)] transition-all shadow-sm" />
                </div>

                <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-2">
                    <button onClick={() => setActiveTab(activeTab === 'all' ? 'favorites' : 'all')} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-2 ${activeTab === 'favorites' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/50' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]'}`}>
                        <StarIcon filled={activeTab === 'favorites'} className="w-3 h-3" /> Favoritos
                    </button>
                    <div className="w-px h-6 bg-[var(--border-color)] mx-1 self-center"></div>
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setSelectedCategory(cat)} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${selectedCategory === cat ? 'bg-[var(--accent-color)] text-[var(--accent-color-text)] border-[var(--accent-color)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]'}`}>
                            {cat}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="w-full h-64 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)]"></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-48 bg-[var(--bg-secondary)] rounded-2xl"></div>)}</div>
                    </div>
                ) : (
                    <>
                        {heroArticle && <NewsHero article={heroArticle} onClick={() => heroArticle.url && window.open(heroArticle.url, '_blank')} />}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {gridArticles.map((article, index) => (
                                <div key={index} className="animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                                    <NewsCard article={article} isFavorited={favorites.has(article.title)} onToggleFavorite={() => handleToggleFavorite(article.title)} addToast={addToast} />
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    </div>
  );
};

export default NewsView;
