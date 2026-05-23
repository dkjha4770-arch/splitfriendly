import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Intercept fetch calls to prepend VITE_API_URL if defined
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  let url = typeof input === 'string' ? input : (input && input.url);
  if (typeof url === 'string' && url.startsWith('/api/')) {
    const apiBase = import.meta.env.VITE_API_URL || '';
    const newUrl = apiBase + url;
    if (typeof input === 'string') {
      input = newUrl;
    } else if (input) {
      input = new Request(newUrl, input);
    }
  }
  return originalFetch(input, init);
};

// Intercept window.open calls for export routes
const originalOpen = window.open;
window.open = function (url, target, features) {
  if (typeof url === 'string' && url.startsWith('/api/')) {
    const apiBase = import.meta.env.VITE_API_URL || '';
    url = apiBase + url;
  }
  return originalOpen(url, target, features);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
