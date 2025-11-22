import React, { useState, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import { useI18n } from '../contexts/I18nContext';
import CompoundInterestChart from '../components/CompoundInterestChart';
import ScaleIcon from '../components/icons/ScaleIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import CountUp from '../components/CountUp';

const SliderInput: React.FC<{ label: string; value: number; setValue: (v: number) => void; min: number; max: number; step: number; format: (v: number) => string; }> = ({ label, value, setValue, min, max, step, format }) => (
    <div>
        <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-bold text-[var(--text-secondary)]">{label}</label>
            <input 
                type="number"
                value={value}
                onChange={e => setValue(parseFloat(e.target.value) || 0)}
                className="w-24 bg-transparent text-right font-bold text-[var(--text-primary)] focus:outline-none"
            />
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => setValue(parseFloat(e.target.value))}
            className="w-full h-2 bg-[var(--bg-primary)] rounded-lg appearance-none cursor-pointer range-thumb"
        />
        <style>{`
            .range-thumb::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                background: var(--accent-color);
                border-radius: 50%;
                cursor: pointer;
            }
            .range-thumb::-moz-range-thumb {
                width: 16px;
                height: 16px;
                background: var(--accent-color);
                border-radius: 50%;
                cursor: pointer;
            }
        `}</style>
    </div>
);

const ResultCard: React.FC<{ label: string; value: number; color?: string; }> = ({ label, value, color = 'text-[var(--text-primary)]' }) => {
    const { formatCurrency } = useI18n();
    return (
        <div className="bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-color)] text-center">
            <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">{label}</p>
            <p className={`font-bold text-lg ${color}`}><CountUp end={value} formatter={formatCurrency} /></p>
        </div>
    );
};

const CompoundInterestCalculator: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const [initial, setInitial] = useState(1000);
    const [monthly, setMonthly] = useState(300);
    const [rate, setRate] = useState(10);
    const [years, setYears] = useState(20);

    const { finalBalance, totalInvested, totalInterest } = useMemo(() => {
        const P = initial;
        const PMT = monthly;
        const r = rate / 100 / 12;
        const n = years * 12;

        const final = P * Math.pow(1 + r, n) + (PMT * ((Math.pow(1 + r, n) - 1) / r));
        const invested = P + (PMT * n);
        const interest = final - invested;

        return { finalBalance: final, totalInvested: invested, totalInterest: interest };
    }, [initial, monthly, rate, years]);

    return (
        <div className="space-y-6">
            <div className="bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)] space-y-4">
                <SliderInput label={t('initial_investment')} value={initial} setValue={setInitial} min={0} max={50000} step={500} format={formatCurrency} />
                <SliderInput label={t('monthly_contribution')} value={monthly} setValue={setMonthly} min={0} max={5000} step={50} format={formatCurrency} />
                <SliderInput label={t('annual_interest_rate')} value={rate} setValue={setRate} min={0} max={25} step={0.5} format={(v) => `${v.toFixed(1)}%`} />
                <SliderInput label={t('period_in_years')} value={years} setValue={setYears} min={1} max={50} step={1} format={(v) => `${v} anos`} />
            </div>

            <div className="grid grid-cols-3 gap-2">
                <ResultCard label={t('total_invested_chart')} value={totalInvested} color="text-[var(--text-secondary)]"/>
                <ResultCard label={t('total_interest_chart')} value={totalInterest} color="text-[var(--green-text)]"/>
                <ResultCard label={t('final_balance')} value={finalBalance} color="text-[var(--accent-color)]"/>
            </div>

            <div className="h-64 bg-[var(--bg-secondary)] p-2 rounded-xl border border-[var(--border-color)]">
                <CompoundInterestChart initial={initial} monthly={monthly} rate={rate} years={years} />
            </div>
        </div>
    );
};

const YieldOnCostCalculator: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const [quantity, setQuantity] = useState(100);
    const [avgPrice, setAvgPrice] = useState(10.50);
    const [dividend, setDividend] = useState(0.11);

    const { yoc, monthlyIncome, totalCost } = useMemo(() => {
        if(avgPrice <= 0) return { yoc: 0, monthlyIncome: 0, totalCost: 0 };
        
        const annualDividend = dividend * 12;
        const yocCalc = (annualDividend / avgPrice) * 100;
        const income = quantity * dividend;
        const cost = quantity * avgPrice;
        
        return { yoc: yocCalc, monthlyIncome: income, totalCost: cost };
    }, [quantity, avgPrice, dividend]);

    return (
         <div className="space-y-4">
            <div className="bg-[var(--bg-secondary)] p-4 rounded-xl border border-[var(--border-color)] space-y-4">
                <div>
                    <label className="text-sm font-bold text-[var(--text-secondary)]">{t('number_of_shares')}</label>
                    <input type="number" value={quantity} onChange={e => setQuantity(parseFloat(e.target.value) || 0)} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2 mt-1 focus:outline-none focus:border-[var(--accent-color)]" />
                </div>
                 <div>
                    <label className="text-sm font-bold text-[var(--text-secondary)]">{t('avg_purchase_price')}</label>
                    <input type="number" value={avgPrice} onChange={e => setAvgPrice(parseFloat(e.target.value) || 0)} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2 mt-1 focus:outline-none focus:border-[var(--accent-color)]" />
                </div>
                 <div>
                    <label className="text-sm font-bold text-[var(--text-secondary)]">{t('dividend_per_share')}</label>
                    <input type="number" value={dividend} onChange={e => setDividend(parseFloat(e.target.value) || 0)} className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2 mt-1 focus:outline-none focus:border-[var(--accent-color)]" />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                 <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)] text-center">
                    <p className="text-sm uppercase font-bold text-[var(--text-secondary)] tracking-wider">{t('yield_on_cost')}</p>
                    <p className="font-bold text-3xl text-[var(--accent-color)] mt-1">{yoc.toFixed(2)}%</p>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                     <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)] text-center">
                        <p className="text-sm uppercase font-bold text-[var(--text-secondary)] tracking-wider">{t('projected_monthly_income_calc')}</p>
                        <p className="font-bold text-2xl text-[var(--green-text)] mt-1">{formatCurrency(monthlyIncome)}</p>
                    </div>
                     <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)] text-center">
                        <p className="text-sm uppercase font-bold text-[var(--text-secondary)] tracking-wider">{t('total_position_cost')}</p>
                        <p className="font-bold text-2xl text-[var(--text-primary)] mt-1">{formatCurrency(totalCost)}</p>
                    </div>
                 </div>
            </div>
        </div>
    );
};

const CalculatorsView: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState('compound');

    return (
        <div className="animate-fade-in">
            <PageHeader title={t('calculators')} onBack={onBack} helpText={t('calculators_help')} />
            
            <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)] mb-6">
                 <button 
                    onClick={() => setActiveTab('compound')} 
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'compound' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                 >
                    <TrendingUpIcon className="w-4 h-4" /> {t('compound_interest')}
                 </button>
                 <button 
                    onClick={() => setActiveTab('yoc')} 
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'yoc' ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)]'}`}
                 >
                    <ScaleIcon className="w-4 h-4" /> {t('yoc_calculator')}
                 </button>
            </div>

            {activeTab === 'compound' && <CompoundInterestCalculator />}
            {activeTab === 'yoc' && <YieldOnCostCalculator />}
        </div>
    );
};


export default CalculatorsView;