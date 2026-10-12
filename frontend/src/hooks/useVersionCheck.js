import { useState, useEffect, useRef } from 'react';

// Poll every 15 seconds so updates are detected almost immediately
const POLL_INTERVAL_MS = 15 * 1000;

/**
 * Polls /version.json periodically and on user activity (tab focus, visibility change, online).
 * Returns `true` when a new deploy/build is detected.
 */
export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialVersion = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const fetchVersion = async () => {
      try {
        // Cache-bust query param to guarantee bypassing browser and CDN caches
        const res = await fetch(`/version.json?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        if (!res.ok) return;

        const data = await res.json();
        const incoming = data?.version;

        if (!incoming) return;

        if (initialVersion.current === null) {
          // Record initial version on page load
          initialVersion.current = incoming;
        } else if (incoming !== initialVersion.current) {
          // Version on server differs from currently loaded version
          if (isMounted) {
            setUpdateAvailable(true);
          }
        }
      } catch {
        // Network error — silently ignore
      }
    };

    // 1. Initial check
    fetchVersion();

    // 2. Periodic poll
    const timer = setInterval(fetchVersion, POLL_INTERVAL_MS);

    // 3. Check immediately when user switches back to the tab or browser window
    const handleActive = () => {
      fetchVersion();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchVersion();
      }
    };

    window.addEventListener('focus', handleActive);
    window.addEventListener('online', handleActive);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      clearInterval(timer);
      window.removeEventListener('focus', handleActive);
      window.removeEventListener('online', handleActive);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return updateAvailable;
}
