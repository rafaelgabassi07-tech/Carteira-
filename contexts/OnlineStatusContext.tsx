import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface OnlineStatusContextType {
  isOnline: boolean;
}

const OnlineStatusContext = createContext<OnlineStatusContextType>({ isOnline: true });

export const useOnlineStatus = () => useContext(OnlineStatusContext);

export const OnlineStatusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <OnlineStatusContext.Provider value={{ isOnline }}>
      {children}
    </OnlineStatusContext.Provider>
  );
};
