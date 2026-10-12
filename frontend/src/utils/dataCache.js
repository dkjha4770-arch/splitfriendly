/**
 * In-memory and sessionStorage cache for expenses & squad data.
 * Enables instant (0ms) view navigation across Dashboard, Expenses, Settlements,
 * Settlement Details, and Analytics without waiting for redundant network requests.
 */

let memoryCache = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds freshness

// Try to hydrate from sessionStorage on initial module load
try {
  const stored = sessionStorage.getItem('sf_expenses_data');
  const storedTime = sessionStorage.getItem('sf_expenses_data_time');
  if (stored && storedTime) {
    const age = Date.now() - Number(storedTime);
    if (age < CACHE_TTL_MS * 5) { // Valid within 5 mins for instant view restoration
      memoryCache = JSON.parse(stored);
      lastFetchTime = Number(storedTime);
    }
  }
} catch {
  // Session storage unavailable or invalid
}

/**
 * Get cached data synchronously if available.
 */
export function getCachedExpensesData() {
  return memoryCache;
}

/**
 * Fetch expenses data with stale-while-revalidate caching.
 * @param {Object} authHeaders - Authorization headers
 * @param {boolean} forceRefresh - If true, bypass cache and fetch fresh from network
 * @returns {Promise<Object>}
 */
export async function getExpensesData(authHeaders, forceRefresh = false) {
  const now = Date.now();
  const isFresh = memoryCache && (now - lastFetchTime < CACHE_TTL_MS);

  // Return fresh cache immediately
  if (!forceRefresh && isFresh) {
    return memoryCache;
  }

  // Fetch from network
  try {
    const res = await fetch('/api/expenses/data', { headers: authHeaders });
    if (!res.ok) {
      // If network fails but we have stale cache, return stale cache as fallback
      if (memoryCache) return memoryCache;
      throw new Error('Secure connection failed.');
    }
    const data = await res.json();
    memoryCache = data;
    lastFetchTime = Date.now();

    try {
      sessionStorage.setItem('sf_expenses_data', JSON.stringify(data));
      sessionStorage.setItem('sf_expenses_data_time', String(lastFetchTime));
    } catch {
      // Ignore quota exceeded errors
    }

    return data;
  } catch (err) {
    if (memoryCache) {
      console.warn('Network fetch failed, serving cached data:', err);
      return memoryCache;
    }
    throw err;
  }
}

/**
 * Invalidate cache whenever an expense is added, deleted, or settled.
 */
export function invalidateExpensesCache() {
  memoryCache = null;
  lastFetchTime = 0;
  try {
    sessionStorage.removeItem('sf_expenses_data');
    sessionStorage.removeItem('sf_expenses_data_time');
  } catch {
    // ignore
  }
}
