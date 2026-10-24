import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './routes/AppRouter';
import { Toaster } from 'sonner';
import { SessionWatcher } from './components/auth/SessionWatcher';
import { useThemeStore } from './stores/themeStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export const App: React.FC = () => {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const initTheme = useThemeStore((s) => s.initTheme);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionWatcher />
        <AppRouter />
        <Toaster position="top-right" richColors theme={resolvedTheme} style={{ zIndex: 99999 }} />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
