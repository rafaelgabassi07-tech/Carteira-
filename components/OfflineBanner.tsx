import React from 'react';
import { useOnlineStatus } from '../contexts/OnlineStatusContext';
import WifiOffIcon from './icons/WifiOffIcon';

const OfflineBanner: React.FC = () => {
  const { isOnline } = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-zinc-800 text-zinc-300 text-xs font-bold p-2 text-center z-[1000] flex items-center justify-center gap-2 animate-fade-in">
      <WifiOffIcon className="w-4 h-4" />
      <span>Você está off-line. Exibindo dados salvos.</span>
    </div>
  );
};

export default OfflineBanner;
