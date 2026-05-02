import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LogtoProvider } from '@logto/react';
import { App } from './app';
import { LocalAuthProvider, LogtoAuthProvider } from './lib/auth';
import { logtoConfig } from './lib/logto';
import './styles.css';

// Handle ChunkLoadError or Failed to fetch dynamically imported module
const handleChunkError = (error: any) => {
  const errorMessage = error?.message || error?.reason?.message || '';
  if (
    errorMessage.includes('Failed to fetch dynamically imported module') ||
    errorMessage.includes('ChunkLoadError')
  ) {
    console.warn('[WhoTube] Chunk loading failed. Reloading page...');
    window.location.reload();
  }
};

window.addEventListener('error', (event) => handleChunkError(event), true);
window.addEventListener('unhandledrejection', (event) => handleChunkError(event));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
    }
  }
});

const app = logtoConfig ? (
  <LogtoProvider config={logtoConfig}>
    <LogtoAuthProvider>
      <App />
    </LogtoAuthProvider>
  </LogtoProvider>
) : (
  <LocalAuthProvider>
    <App />
  </LocalAuthProvider>
);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {app}
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
