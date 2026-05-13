import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { Toaster } from 'sonner';

import App from './App.tsx';

import '@/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={80}>
      <BrowserRouter>
        <App />
        <Toaster richColors theme="dark" position="top-right" toastOptions={{ className: 'font-sans border border-white/10' }} />
      </BrowserRouter>
    </TooltipProvider>
  </StrictMode>,
);
