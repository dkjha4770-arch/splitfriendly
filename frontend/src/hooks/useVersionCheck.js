import { useState, useEffect, useRef } from 'react';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Polls /version.json periodically. Returns `true` when a new deploy
 * is detected (i.e. the version stamp has changed since the page loaded).
 */
export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialVersion = useRef(null);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        // Cache-bust so we always get the latest file from the server
        const res = await fetch(`/version.json?_=${Date.now()}`, {
          cache: 'no-store'
        });
        if (!res.ok) return;

        const data = await res.json();
        const incoming = data?.version;

        if (!incoming || incoming === 'dev') return; // ignore dev builds

        if (initialVersion.current === null) {
          // First fetch — record what version the user loaded
          initialVersion.current = incoming;
        } else if (incoming !== initialVersion.current) {
          // Version changed on the server → new deploy available
          setUpdateAvailable(true);
        }
      } catch {
        // Network error — silently ignore
      }
    };

    fetchVersion(); // run immediately on mount
    const timer = setInterval(fetchVersion, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return updateAvailable;
}
