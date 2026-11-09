import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'light';
const KEY = 'devmate-theme';
const APPEARANCE_VERSION = 'clean-blue-v1';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start the new visual design in light mode once, then preserve subsequent choices.
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem('devmate-appearance-version') === APPEARANCE_VERSION && localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(KEY, theme);
      localStorage.setItem('devmate-appearance-version', APPEARANCE_VERSION);
    } catch {
      /* noop */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
