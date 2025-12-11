import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress non-critical Google Maps API errors (commonly blocked by ad blockers)
// These errors don't affect map functionality - they're just analytics/tracking requests

// Intercept console.error to suppress ERR_BLOCKED_BY_CLIENT for Google Maps analytics
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = String(args.join(' '));
  // Suppress ERR_BLOCKED_BY_CLIENT errors for Google Maps analytics endpoint (gen_204)
  if (
    message.includes('ERR_BLOCKED_BY_CLIENT') &&
    (message.includes('maps.googleapis.com') || 
     message.includes('gen_204') ||
     message.includes('maps/api/mapsjs'))
  ) {
    return; // Suppress this non-critical error
  }
  originalConsoleError.apply(console, args);
};

// Also catch window error events
window.addEventListener('error', (event) => {
  const message = event.message || '';
  const filename = event.filename || '';
  // Suppress ERR_BLOCKED_BY_CLIENT errors for Google Maps analytics endpoint
  if (
    message.includes('ERR_BLOCKED_BY_CLIENT') ||
    filename.includes('maps.googleapis.com') ||
    filename.includes('gen_204')
  ) {
    event.preventDefault();
    return false;
  }
});

// Catch unhandled promise rejections for network errors
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason?.message || (typeof reason === 'string' ? reason : '');
  if (
    message.includes('ERR_BLOCKED_BY_CLIENT') ||
    message.includes('gen_204') ||
    message.includes('maps.googleapis.com')
  ) {
    event.preventDefault();
    return false;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
