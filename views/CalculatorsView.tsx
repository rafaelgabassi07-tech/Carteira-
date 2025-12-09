
import React, { useState, useMemo } from 'react';
import PageHeader from '../components/PageHeader';
import { useI18n } from '../contexts/I18nContext';
import SimulationChart from '../components/charts/SimulationChart';
import LineChartIcon from '../components/icons/LineChartIcon';
import TrendingUpIcon from '../components/icons/TrendingUpIcon';
import RocketIcon from '../components/icons/RocketIcon';
import CountUp from '../components/CountUp';
import PiggyBankIcon from '../components/icons/PiggyBankIcon';
import CalendarPlusIcon from '../components/icons/CalendarPlusIcon';
import PercentIcon from '../components/icons/PercentIcon';
import ClockIcon from '../components/icons/ClockIcon';

const CompactInput: React.FC<{ 
    label: string; 
    value: number; 
    onChange: (v: number) => void; 
    icon: React.ReactNode; 
    suffix?: string;
    prefix?: string;
    step?: number;
}> = ({ label, value, onChange, icon, suffix, prefix, step = 1 }) => (
    <div className="bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-color)] flex flex-col justify-center">
        <div className="flex items-center gap-1.5 mb-1 opacity-70">
            <div className="scale-75 origin-left">{icon}</div>
            <label className="text-[10px] font-bold uppercase tracking-wider">{label}</label>
        </div>
        <div className="flex items-center">
            {prefix && <span className="text-sm font-semibold text-[var(--text-secondary)] mr-1">{prefix}</span>}
            <input
                type="number"
                value={value}
                onChange={e => onChange(parseFloat(e.target.value) || 0)}
                step={step}
                className="w-full bg-transparent font-bold text-[var(--text-primary)] outline-none"
            />
            {suffix && <span className="text-xs font-medium text-[var(--text-secondary)] ml-1">{suffix}</span>}
        </div>
    </div>
);

const ResultBar: React.FC<{ invested: number; interest: number; total: number }> = ({ invested, interest, total }) => {
    const { formatCurrency, t } = useI18n();
    const investedPercent = total > 0 ? (invested / total) * 100 : 0;
    const interestPercent = total > 0 ? (interest / total) * 100 : 0;

    return (
        <div className="mt-4">
            <div className="flex h-3 w-full rounded-full overflow-hidden mb-2">
                <div style={{ width: `${investedPercent}%` }} className="bg-[var(--text-secondary)] opacity-30"></div>
                <div style={{ width: `${interestPercent}%` }} className="bg-[var(--accent-color)]"></div>
            </div>
            <div className="flex justify-between text-xs">
                <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] opacity-50"></div>
                        <span className="text-[var(--text-secondary)] font-medium">Investido</span>
                    </div>
                    <span className="font-bold">{formatCurrency(invested)}</span>
                </div>
                <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5 mb-0.5">
                        <span className="text-[var(--text-secondary)] font-medium">Rendimento</span>
                        <div className="w-2 h-2 rounded-full bg-[var(--accent-color)]"></div>
                    </div>
                    <span className="font-bold text-[var(--accent-color)]">+{formatCurrency(interest)}</span>
                </div>
            </div>
        </div>
    );
};

const CompoundInterestCalculator: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const [initial, setInitial] = useState(1000);
    const [monthly, setMonthly] = useState(500);
    const [rate, setRate] = useState(10);
    const [years, setYears] = useState(10);

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
    const totalInterest = finalData.total - finalData.invested;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)]">
                <CompactInput icon={<PiggyBankIcon />} label="Inicial" value={initial} onChange={setInitial} prefix="R$" />
                <CompactInput icon={<CalendarPlusIcon />} label="Mensal" value={monthly} onChange={setMonthly} prefix="R$" />
                <CompactInput icon={<PercentIcon />} label="Taxa Anual" value={rate} onChange={setRate} suffix="%" step={0.1} />
                <CompactInput icon={<ClockIcon />} label="Tempo" value={years} onChange={setYears} suffix="anos" />
            </div>

            <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm">
                <div className="text-center mb-4">
                    <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-widest mb-1">{t('final_balance')}</p>
                    <p className="text-4xl font-black text-[var(--text-primary)] tracking-tight">
                        <CountUp end={finalData.total} formatter={formatCurrency} />
                    </p>
                </div>
                
                <ResultBar invested={finalData.invested} interest={totalInterest} total={finalData.total} />
            </div>

            <div className="h-48 bg-[var(--bg-secondary)] p-2 rounded-2xl border border-[var(--border-color)]">
                <SimulationChart data={chartData} years={years} type="compound" />
            </div>
        </div>
    );
};

const SimpleInterestCalculator: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const [initial, setInitial] = useState(5000);
    const [rate, setRate] = useState(12);
    const [years, setYears] = useState(5);

    const chartData = useMemo(() => Array.from({ length: years + 1 }, (_, i) => {
        const interest = initial * (rate / 100) * i;
        return { year: i, total: initial + interest, invested: initial };
    }), [initial, rate, years]);
    
    const finalData = chartData[chartData.length - 1];
    const totalInterest = finalData.total - finalData.invested;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)]">
                <CompactInput icon={<PiggyBankIcon />} label="Valor Inicial" value={initial} onChange={setInitial} prefix="R$" step={100} />
                <div className="hidden"></div> 
                <CompactInput icon={<PercentIcon />} label="Taxa Anual" value={rate} onChange={setRate} suffix="%" step={0.1} />
                <CompactInput icon={<ClockIcon />} label="Tempo" value={years} onChange={setYears} suffix="anos" />
            </div>

             <div className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm">
                <div className="text-center mb-4">
                    <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-widest mb-1">{t('final_balance')}</p>
                    <p className="text-4xl font-black text-[var(--text-primary)] tracking-tight">
                        <CountUp end={finalData.total} formatter={formatCurrency} />
                    </p>
                </div>
                <ResultBar invested={finalData.invested} interest={totalInterest} total={finalData.total} />
            </div>

            <div className="h-48 bg-[var(--bg-secondary)] p-2 rounded-2xl border border-[var(--border-color)]">
                 <SimulationChart data={chartData} years={years} type="simple" />
            </div>
        </div>
    );
};

const FirstMillionCalculator: React.FC = () => {
    const { t, formatCurrency } = useI18n();
    const [initial, setInitial] = useState(0);
    const [monthly, setMonthly] = useState(1000);
    const [rate, setRate] = useState(10);

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
        <div className="space-y-4">
             <div className="grid grid-cols-2 gap-3 bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-color)]">
                <CompactInput icon={<PiggyBankIcon />} label="Já tenho" value={initial} onChange={setInitial} prefix="R$" step={1000} />
                <div className="hidden"></div>
                <CompactInput icon={<CalendarPlusIcon />} label="Aporte Mensal" value={monthly} onChange={setMonthly} prefix="R$" step={100} />
                <CompactInput icon={<PercentIcon />} label="Rentabilidade" value={rate} onChange={setRate} suffix="% a.a." step={0.5} />
            </div>

             <div className="bg-[var(--bg-secondary)] p-6 rounded-2xl border border-[var(--border-color)] text-center shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <RocketIcon className="w-24 h-24 text-[var(--accent-color)]" />
                </div>
                <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-widest mb-2">{t('time_to_million')}</p>
                <div className="flex items-baseline justify-center gap-2">
                    <span className="font-black text-4xl text-[var(--accent-color)]">{years}</span>
                    <span className="text-sm font-bold text-[var(--text-secondary)] uppercase mr-2">Anos</span>
                    {months > 0 && (
                        <>
                            <span className="font-black text-2xl text-[var(--text-primary)]">{months}</span>
                            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase">Meses</span>
                        </>
                    )}
                </div>
            </div>

            <div className="h-48 bg-[var(--bg-secondary)] p-2 rounded-2xl border border-[var(--border-color)]">
                 <SimulationChart data={chartData} years={totalYears} type="million" />
            </div>
        </div>
    );
};


const CalculatorsView: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState('compound');

    const TABS = [
        { id: 'compound', label: t('compound_interest'), icon: <TrendingUpIcon className="w-4 h-4" /> },
        { id: 'simple', label: t('simple_interest'), icon: <LineChartIcon className="w-4 h-4" /> },
        { id: 'million', label: '1 Milhão', icon: <RocketIcon className="w-4 h-4" /> },
    ];

    return (
        <div className="animate-fade-in px-2">
            <PageHeader title={t('calculators')} onBack={onBack} helpText={t('calculators_help')} />
            
            <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-color)] mb-6">
                {TABS.map(tab => (
                     <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)} 
                        className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 uppercase tracking-wide ${activeTab === tab.id ? 'bg-[var(--bg-primary)] text-[var(--accent-color)] shadow-sm border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
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
