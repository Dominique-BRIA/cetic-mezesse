import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import './styles.css';
import { FournisseurApp } from './lib/contexte';
import { App } from './App';

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <FournisseurApp>
          <App />
          <Toaster position="bottom-right" toastOptions={{ className: 'font-sans text-sm' }} richColors closeButton />
        </FournisseurApp>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
