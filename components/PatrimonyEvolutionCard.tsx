import React, { useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import EvolutionChart from './EvolutionChart';
import type { PortfolioEvolutionPoint } from '../types';

const PatrimonyEvolutionCard: React.FC = () => {
    const { t } = useI18n();
    const { portfolioEvolution, assets } = usePortfolio();
    const [timeRange, setTimeRange] = useState('12'); // '6', '12', 'all'
    const [selectedSegment, setSelectedSegment] = useState('all_types');

    const segments = useMemo(() => {
        const uniqueSegments = new Set(assets.map(a => a.segment || 'Outros'));
        return ['all_types', ...Array.from(uniqueSegments)];
    }, [assets]);

    const chartData = useMemo((): PortfolioEvolutionPoint[] => {
        const evolutionData = portfolioEvolution[selectedSegment] || [];
        if (timeRange === 'all') {
            return evolutionData;
        }
        const months = parseInt(timeRange);
        return evolutionData.slice(-months);
    }, [portfolioEvolution, selectedSegment, timeRange]);

    const Select: React.FC<{ value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode; }> = ({ value, onChange, children }) => (
        <div className="relative">
            <select
                value={value}
                onChange={onChange}
                className="appearance-none w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
            >
                {children}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-secondary)]">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
        </div>
    );

    return (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 mb-4 border border-[var(--border-color)] shadow-sm animate-fade-in-up">
            <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">{t('evolution_of_patrimony')}</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
                <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                    <option value="6">{t('analysis_period_6m')}</option>
                    <option value="12">{t('analysis_period_12m')}</option>
                    <option value="all">{t('since_beginning')}</option>
                </Select>
                <Select value={selectedSegment} onChange={(e) => setSelectedSegment(e.target.value)}>
                    {segments.map(seg => {
                        const translationKey = `t${seg.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                        const translatedSegment = t(translationKey, {});
                        const displayLabel = translatedSegment !== translationKey ? translatedSegment : seg;

                        return (
                            <option key={seg} value={seg}>
                                {seg === 'all_types' ? t('all_types') : displayLabel}
                            </option>
                        );
                    })}
                </Select>
            </div>

            <div className="h-72 w-full pt-2">
                <EvolutionChart data={chartData} />
            </div>
        </div>
    );
};

export default PatrimonyEvolutionCard;
