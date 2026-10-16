import React, { createContext, useContext, useState, useEffect } from 'react';

interface LogoContextType {
  logoUrl: string;
  creatorName: string;
  updateLogo: (newLogoUrl: string) => void;
  resetLogo: () => void;
}

const DEFAULT_LOGO = '/logo.svg';
const DEFAULT_CREATOR = 'លោក ទុយ ចាន់ថន';
const STORAGE_KEY = 'khmer_dubber_custom_logo';

const LogoContext = createContext<LogoContextType>({
  logoUrl: DEFAULT_LOGO,
  creatorName: DEFAULT_CREATOR,
  updateLogo: () => {},
  resetLogo: () => {},
});

export const LogoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logoUrl, setLogoUrl] = useState<string>(DEFAULT_LOGO);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setLogoUrl(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const updateLogo = (newLogoUrl: string) => {
    setLogoUrl(newLogoUrl);
    try {
      localStorage.setItem(STORAGE_KEY, newLogoUrl);
    } catch {
      // ignore storage errors
    }
  };

  const resetLogo = () => {
    setLogoUrl(DEFAULT_LOGO);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <LogoContext.Provider
      value={{
        logoUrl,
        creatorName: DEFAULT_CREATOR,
        updateLogo,
        resetLogo,
      }}
    >
      {children}
    </LogoContext.Provider>
  );
};

export const useLogo = () => useContext(LogoContext);
