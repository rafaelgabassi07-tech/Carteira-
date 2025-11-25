import React, { useState, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import { useI18n } from '../contexts/I18nContext';
import SimulationChart from '../components/SimulationChart';
import LineChartIcon from '../components/icons/LineChartIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import RocketIcon from '../components/icons/RocketIcon';
import CountUp from '../components/CountUp';
import PiggyBankIcon from '../components/icons/PiggyBankIcon';
import CalendarPlusIcon from '../components/icons/CalendarPlusIcon';
import PercentIcon from '../components/icons/PercentIcon';
import ClockIcon from '../components/icons/ClockIcon';

const SliderInput: React.FC<{ icon: React.ReactNode; label: string; value: number; setValue: (v: number) => void; min: number; max: number; step: number; format: (v: string) => string; }> = ({ icon, label, value, setValue, min, max, step, format }) => (
    <div>
        <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
                <div className="text-[var(--text-secondary)]">{icon}</div>
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{label}</label>
            </div>
            <span className="font-bold text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] px-2 py-1 rounded-md border border-[var(--border-color)]">{format(String(value))}</span>
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
            .range-thumb::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; background: var(--accent-color); border-radius: 50%; cursor: pointer; border: 3px solid var(--bg-secondary); box-shadow: 0 0 0 2px var(--border-color); }
            .range-thumb::-moz-range-thumb { width: 16px; height: 16px; background: var(--accent-color); border-radius: 50%; cursor: pointer; border: 3px solid var(--bg-secondary); box-shadow: 0 0 0 2px var(--border-color); }
        `}</style>
    </div>
);

const ResultCard: React.FC<{ label: string; children: React.ReactNode; className?: string; }> = ({ label, children, className = '' }) => {
    return (
        <div className={`bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-color)] text-center shadow-sm ${className}`}>
            <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">{label}</p>
            {children}
        </div>
    );
};

const CompoundInterestCalculator: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const [initial, setInitial] = useState(1000);
    const [monthly, setMonthly] = useState(300);
    const [rate, setRate] = useState(10);
    const [years, setYears] = useState(20);

    const chartData = useMemo(() => {
        return Array.from({ length: years + 1 }, (_, i) => {
            const P = initial;
            const PMT = monthly;
            const r = rate / 100 / 12;
            const n = i * 12;
            const futureValue = P * Math.pow(1 + r, n) + (PMT > 0 && r > 0 ? PMT * ((Math.pow(1 + r, n) - 1) / r) : (P + PMT * n));
            const invested = P + PMT * n;
            return { year: i, total: futureValue, invested };
        });
    }, [initial, monthly, rate, years]);

    const finalData = chartData[chartData.length - 1];

    return (
        <div className="space-y-6">
            <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] space-y-5">
                 <h4 className="font-bold text-center text-sm uppercase tracking-wider text-[var(--text-secondary)]">{t('simulation')}</h4>
                <SliderInput icon={<PiggyBankIcon className="w-5 h-5" />} label={t('initial_investment')} value={initial} setValue={setInitial} min={0} max={50000} step={500} format={(v) => formatCurrency(Number(v))} />
                <SliderInput icon={<CalendarPlusIcon className="w-5 h-5" />} label={t('monthly_contribution')} value={monthly} setValue={setMonthly} min={0} max={5000} step={50} format={(v) => formatCurrency(Number(v))} />
                <SliderInput icon={<PercentIcon className="w-5 h-5" />} label={t('annual_interest_rate')} value={rate} setValue={setRate} min={0} max={25} step={0.5} format={(v) => `${Number(v).toFixed(1)}%`} />
                <SliderInput icon={<ClockIcon className="w-5 h-5" />} label={t('period_in_years')} value={years} setValue={setYears} min={1} max={50} step={1} format={(v) => `${v} anos`} />
            </div>
             <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] space-y-4">
                <h4 className="font-bold text-center text-sm uppercase tracking-wider text-[var(--text-secondary)]">{t('result')}</h4>
                 <div className="grid grid-cols-2 gap-3">
                    <ResultCard label={t('total_invested_chart')}>
                        <p className="font-bold text-lg text-[var(--text-secondary)]"><CountUp end={finalData.invested} formatter={formatCurrency} /></p>
                    </ResultCard>
                    <ResultCard label={t('total_interest_chart')}>
                         <p className="font-bold text-lg text-[var(--green-text)]"><CountUp end={finalData.total - finalData.invested} formatter={formatCurrency} /></p>
                    </ResultCard>
                </div>
                 <ResultCard label={t('final_balance')} className="bg-gradient-to-tr from-[var(--accent-color)]/20 to-transparent">
                    <p className="font-extrabold text-3xl text-[var(--accent-color)] tracking-tight"><CountUp end={finalData.total} formatter={formatCurrency} /></p>
                </ResultCard>
            </div>
            <div className="h-64 bg-[var(--bg-secondary)] p-2 rounded-2xl border border-[var(--border-color)]">
                <SimulationChart data={chartData} years={years} type="compound" />
            </div>
        </div>
    );
};

const SimpleInterestCalculator: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const [initial, setInitial] = useState(10000);
    const [rate, setRate] = useState(8);
    const [years, setYears] = useState(10);

    const chartData = useMemo(() => Array.from({ length: years + 1 }, (_, i) => {
        const interest = initial * (rate / 100) * i;
        return { year: i, total: initial + interest, invested: initial };
    }), [initial, rate, years]);
    
    const finalData = chartData[chartData.length - 1];

    return (
        <div className="space-y-6">
            <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] space-y-5">
                <h4 className="font-bold text-center text-sm uppercase tracking-wider text-[var(--text-secondary)]">{t('simulation')}</h4>
                <SliderInput icon={<PiggyBankIcon className="w-5 h-5" />} label={t('initial_investment')} value={initial} setValue={setInitial} min={0} max={100000} step={1000} format={(v) => formatCurrency(Number(v))} />
                <SliderInput icon={<PercentIcon className="w-5 h-5" />} label={t('annual_interest_rate')} value={rate} setValue={setRate} min={0} max={25} step={0.5} format={(v) => `${Number(v).toFixed(1)}%`} />
                <SliderInput icon={<ClockIcon className="w-5 h-5" />} label={t('period_in_years')} value={years} setValue={setYears} min={1} max={50} step={1} format={(v) => `${v} anos`} />
            </div>
             <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] space-y-4">
                <h4 className="font-bold text-center text-sm uppercase tracking-wider text-[var(--text-secondary)]">{t('result')}</h4>
                 <div className="grid grid-cols-2 gap-3">
                    <ResultCard label={t('total_invested_chart')}><p className="font-bold text-lg text-[var(--text-secondary)]"><CountUp end={finalData.invested} formatter={formatCurrency} /></p></ResultCard>
                    <ResultCard label={t('total_interest_chart')}><p className="font-bold text-lg text-[var(--green-text)]"><CountUp end={finalData.total - finalData.invested} formatter={formatCurrency} /></p></ResultCard>
                </div>
                 <ResultCard label={t('final_balance')} className="bg-gradient-to-tr from-[var(--accent-color)]/20 to-transparent">
                    <p className="font-extrabold text-3xl text-[var(--accent-color)] tracking-tight"><CountUp end={finalData.total} formatter={formatCurrency} /></p>
                </ResultCard>
            </div>
            <div className="h-64 bg-[var(--bg-secondary)] p-2 rounded-2xl border border-[var(--border-color)]">
                 <SimulationChart data={chartData} years={years} type="simple" />
            </div>
        </div>
    );
};

const FirstMillionCalculator: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const [initial, setInitial] = useState(10000);
    const [monthly, setMonthly] = useState(500);
    const [rate, setRate] = useState(12);

    const { years, months, totalYears } = useMemo(() => {
        const target = 1000000;
        const P = initial;
        const PMT = monthly;
        const r = rate / 100 / 12;

        if (r <= 0 || (P < target && PMT <= 0)) return { years: 99, months: 0, totalYears: 50 };
        if (P >= target) return { years: 0, months: 0, totalYears: 10 };
        
        const n = Math.log((target * r + PMT) / (P * r + PMT)) / Math.log(1 + r);
        const totalMonths = Math.ceil(n);
        const y = Math.floor(totalMonths / 12);
        const m = totalMonths % 12;

        return { years: y, months: m, totalYears: Math.min(Math.max(y + 2, 10), 50) };
    }, [initial, monthly, rate]);

     const chartData = useMemo(() => Array.from({ length: totalYears + 1 }, (_, i) => {
        const P = initial;
        const PMT = monthly;
        const r = rate / 100 / 12;
        const n = i * 12;
        const futureValue = P * Math.pow(1 + r, n) + (PMT > 0 && r > 0 ? PMT * ((Math.pow(1 + r, n) - 1) / r) : (P + PMT * n));
        const invested = P + PMT * n;
        return { year: i, total: futureValue, invested };
    }), [initial, monthly, rate, totalYears]);
    
    return (
        <div className="space-y-6">
             <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] space-y-5">
                 <h4 className="font-bold text-center text-sm uppercase tracking-wider text-[var(--text-secondary)]">{t('simulation')}</h4>
                <SliderInput icon={<PiggyBankIcon className="w-5 h-5" />} label={t('initial_investment')} value={initial} setValue={setInitial} min={0} max={100000} step={1000} format={(v) => formatCurrency(Number(v))} />
                <SliderInput icon={<CalendarPlusIcon className="w-5 h-5" />} label={t('monthly_contribution')} value={monthly} setValue={setMonthly} min={0} max={5000} step={100} format={(v) => formatCurrency(Number(v))} />
                <SliderInput icon={<PercentIcon className="w-5 h-5" />} label={t('annual_interest_rate')} value={rate} setValue={setRate} min={0} max={25} step={0.5} format={(v) => `${Number(v).toFixed(1)}%`} />
            </div>
             <div className="bg-gradient-to-tr from-[var(--accent-color)]/20 to-transparent p-4 rounded-2xl border border-[var(--border-color)] text-center shadow-lg">
                <p className="text-sm uppercase font-bold text-[var(--text-secondary)] tracking-wider">{t('time_to_million')}</p>
                <p className="font-black text-3xl text-[var(--accent-color)] mt-1 drop-shadow-lg">
                    {t('time_to_million_result', { years, months })}
                </p>
            </div>
            <div className="h-64 bg-[var(--bg-secondary)] p-2 rounded-2xl border border-[var(--border-color)]">
                 <SimulationChart data={chartData} years={totalYears} type="million" />
            </div>
        </div>
    );
};


const CalculatorsView: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState('compound');

    const TABS = [
        { id: 'compound', label: t('compound_interest'), icon: <TrendingUpIcon className="w-5 h-5" /> },
        { id: 'simple', label: t('simple_interest'), icon: <LineChartIcon className="w-5 h-5" /> },
        { id: 'million', label: t('my_first_million'), icon: <RocketIcon className="w-5 h-5" /> },
    ];

    return (
        <div className="animate-fade-in">
            <PageHeader title={t('calculators')} onBack={onBack} helpText={t('calculators_help')} />
            
            <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-color)] mb-6 shadow-inner">
                {TABS.map(tab => (
                     <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)} 
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === tab.id ? 'bg-[var(--bg-secondary)] text-[var(--accent-color)] shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                     >
                        {tab.icon} {tab.label}
                     </button>
                ))}
            </div>

            <div key={activeTab} className="animate-fade-in-up">
                {activeTab === 'compound' && <CompoundInterestCalculator />}
                {activeTab === 'simple' && <SimpleInterestCalculator />}
                {activeTab === 'million' && <FirstMillionCalculator />}
            </div>
        </div>
    );
};

export default CalculatorsView;