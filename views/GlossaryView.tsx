import React, { useState, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import { useI18n } from '../contexts/I18nContext';
import { vibrate } from '../utils';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';

const GLOSSARY_TERMS = [
    'fii', 'ticker', 'dy', 'pvp', 'vacancia', 'cota', 'proventos', 
    'subscricao', 'amortizacao', 'ifix', 'tijolo', 'papel', 'fof'
];

interface GlossaryItemProps {
    term: string;
    description: string;
    isOpen: boolean;
    onClick: () => void;
}

const GlossaryItem: React.FC<GlossaryItemProps> = ({ term, description, isOpen, onClick }) => (
    <div className="border-b border-[var(--border-color)]">
        <button
            onClick={() => { onClick(); vibrate(); }}
            className="w-full flex justify-between items-center text-left p-4 hover:bg-[var(--bg-tertiary-hover)] transition-colors"
        >
            <span className="font-bold text-[var(--text-primary)]">{term}</span>
            <ChevronRightIcon className={`w-5 h-5 text-[var(--text-secondary)] transform transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
        </button>
        {isOpen && (
            <div className="px-4 pb-4 text-sm text-[var(--text-secondary)] leading-relaxed animate-fade-in">
                {description}
            </div>
        )}
    </div>
);

const GlossaryView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { t } = useI18n();
    const [openTerm, setOpenTerm] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const glossaryData = useMemo(() => {
        return GLOSSARY_TERMS.map(key => ({
            key,
            term: t(`glossary_term_${key}`),
            description: t(`glossary_desc_${key}`),
        }));
    }, [t]);

    const filteredData = useMemo(() => {
        if (!searchTerm) return glossaryData;
        return glossaryData.filter(item => 
            item.term.toLowerCase().includes(searchTerm.toLowerCase()) || 
            item.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [glossaryData, searchTerm]);
    
    const handleToggle = (key: string) => {
        setOpenTerm(openTerm === key ? null : key);
    };

    return (
        <div>
            <PageHeader title={t('financial_glossary')} onBack={onBack} />
            
            <div className="mb-4">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder={t('glossary_search_placeholder')}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3 text-sm focus:outline-none focus:border-[var(--accent-color)] transition-colors"
                />
            </div>

            <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                {filteredData.length > 0 ? (
                    filteredData.map(item => (
                        <GlossaryItem
                            key={item.key}
                            term={item.term}
                            description={item.description}
                            isOpen={openTerm === item.key}
                            onClick={() => handleToggle(item.key)}
                        />
                    ))
                ) : (
                    <div className="p-8 text-center text-[var(--text-secondary)]">
                        {t('glossary_no_results')}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GlossaryView;
