import { AppErrorBoundary } from '@/components/monitoring/AppErrorBoundary';
import { initMonitoring } from '@/lib/monitoring';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

initMonitoring();

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
