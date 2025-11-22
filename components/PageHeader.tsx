
import React from 'react';
import Tooltip from './Tooltip';
import HelpIcon from './icons/HelpIcon';
import ChevronLeftIcon from './icons/ChevronLeftIcon';

interface PageHeaderProps {
    title: string;
    helpText?: string;
    onBack: () => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, helpText, onBack }) => {
    return (
        <div className="flex items-center mb-6">
            <button 
                onClick={onBack} 
                className="p-2 -ml-2 mr-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary-hover)] transition-all duration-200 active:scale-95 lg:hidden"
                aria-label="Voltar"
            >
                <ChevronLeftIcon className="w-6 h-6" />
            </button>
            <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-bold">{title}</h2>
                {helpText && (
                    <Tooltip text={helpText}>
                        <HelpIcon className="w-4 h-4 text-[var(--text-secondary)] cursor-help" />
                    </Tooltip>
                )}
            </div>
        </div>
    );
};

export default PageHeader;
