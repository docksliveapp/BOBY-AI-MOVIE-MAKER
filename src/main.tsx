import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register offline-capable PWA service worker with automatic background updates
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onOfflineReady() {
      console.info('BOBY AI MOVIE MAKER is cached and ready for offline studio use.');
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
