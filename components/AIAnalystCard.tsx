
import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { askAssetAnalyst } from '../services/geminiService';
import { vibrate } from '../utils';
import SparklesIcon from './icons/SparklesIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import RefreshIcon from './icons/RefreshIcon';

interface AIAnalystCardProps {
    ticker: string;
    assetData: any;
    addToast: (msg: string, type: 'error' | 'success' | 'info') => void;
}

const SUGGESTED_QUESTIONS = [
    "Análise geral do ativo",
    "Quais são os riscos?",
    "O dividendo é sustentável?",
    "O preço está justo (P/VP)?",
    "Perspectivas para o setor"
];

const AIAnalystCard: React.FC<AIAnalystCardProps> = ({ ticker, assetData, addToast }) => {
    const { t } = useI18n();
    const { preferences, logApiUsage } = usePortfolio();
    
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showInput, setShowInput] = useState(false);
    const resultRef = useRef<HTMLDivElement>(null);

    const handleAsk = async (questionText: string) => {
        if (!questionText.trim()) return;
        
        vibrate();
        setIsLoading(true);
        setResponse(null);
        setShowInput(true); // Ensure input area is visible
        setQuery(questionText); // Update input visually if clicked from suggestion

        try {
            const result = await askAssetAnalyst(preferences, ticker, questionText, assetData);
            setResponse(result.answer);
            if (result.stats) {
                logApiUsage('gemini', { requests: 1, ...result.stats });
            }
        } catch (error: any) {
            addToast("O analista está indisponível no momento.", 'error');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatMarkdown = (text: string) => {
        // Basic Markdown formatting for safety
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
            .replace(/\n/g, '<br/>') // Line breaks
            .replace(/- (.*?)(<br\/>|$)/g, '• $1$2'); // Lists
    };

    return (
        <div className="bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] rounded-2xl border border-[var(--border-color)] shadow-lg overflow-hidden animate-fade-in-up mt-6">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-color)]/50 flex justify-between items-center bg-[var(--accent-color)]/5">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-lg shadow-purple-500/20">
                        <SparklesIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-[var(--text-primary)]">IA Analista Pro</h3>
                        <p className="text-[10px] text-[var(--text-secondary)] font-medium">Tire dúvidas sobre {ticker}</p>
                    </div>
                </div>
            </div>

            <div className="p-5">
                {/* Suggestions Chips */}
                {!response && !isLoading && (
                    <div className="mb-6">
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Perguntas Sugeridas</p>
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTED_QUESTIONS.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleAsk(q)}
                                    className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary-hover)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/10 transition-all active:scale-95 text-left"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Response Area */}
                {isLoading && (
                    <div className="py-8 text-center animate-pulse">
                        <div className="inline-block p-3 rounded-full bg-[var(--bg-tertiary-hover)] mb-3">
                            <SparklesIcon className="w-6 h-6 text-[var(--accent-color)] animate-spin" />
                        </div>
                        <p className="text-xs font-medium text-[var(--text-secondary)]">Analisando fundamentos e mercado...</p>
                    </div>
                )}

                {response && (
                    <div ref={resultRef} className="animate-fade-in">
                        <div className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)] text-sm leading-relaxed text-[var(--text-primary)] shadow-inner">
                            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(response) }} />
                        </div>
                        <div className="mt-3 flex justify-end">
                            <button 
                                onClick={() => { setResponse(null); setQuery(''); }} 
                                className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--accent-color)] flex items-center gap-1 transition-colors"
                            >
                                <RefreshIcon className="w-3 h-3" /> Nova Análise
                            </button>
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className={`relative mt-4 transition-all duration-300 ${!showInput && !response && !isLoading ? 'opacity-80 hover:opacity-100' : ''}`}>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setShowInput(true)}
                        placeholder={showInput ? "Digite sua dúvida específica..." : "Ou digite sua pergunta aqui..."}
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] transition-all shadow-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleAsk(query)}
                    />
                    <button
                        onClick={() => handleAsk(query)}
                        disabled={!query.trim() || isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-[var(--accent-color)] text-[var(--accent-color-text)] disabled:opacity-50 disabled:bg-gray-600 transition-all hover:scale-105 active:scale-95 shadow-md"
                    >
                        <ChevronRightIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIAnalystCard;
