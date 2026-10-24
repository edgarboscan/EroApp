import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeStore {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  initTheme: () => void;
}

const STORAGE_KEY = 'ero_theme';

function getSystemPreference(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeClass(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'system',
  resolvedTheme: 'light',

  initTheme: () => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      const initialTheme: ThemeMode = stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system';
      const resolved = initialTheme === 'system' ? getSystemPreference() : initialTheme;

      applyThemeClass(resolved);
      set({ theme: initialTheme, resolvedTheme: resolved });

      // Escuchar cambios de preferencia del sistema si está en modo 'system'
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleMediaChange = (e: MediaQueryListEvent) => {
        if (get().theme === 'system') {
          const nextResolved: ResolvedTheme = e.matches ? 'dark' : 'light';
          applyThemeClass(nextResolved);
          set({ resolvedTheme: nextResolved });
        }
      };

      mediaQuery.removeEventListener('change', handleMediaChange);
      mediaQuery.addEventListener('change', handleMediaChange);
    } catch {
      applyThemeClass('light');
      set({ theme: 'light', resolvedTheme: 'light' });
    }
  },

  setTheme: (theme: ThemeMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
    const resolved = theme === 'system' ? getSystemPreference() : theme;
    applyThemeClass(resolved);
    set({ theme, resolvedTheme: resolved });
  },

  toggleTheme: () => {
    const current = get().resolvedTheme;
    const nextTheme: ThemeMode = current === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },
}));
