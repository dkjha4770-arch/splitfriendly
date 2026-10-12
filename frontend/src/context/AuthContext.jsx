import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

// Fast helper to decode JWT payload safely
function decodeJwtPayload(tokenStr) {
  try {
    const parts = tokenStr.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    }
  } catch {
    // ignore malformed token
  }
  return null;
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    try {
      const stored = localStorage.getItem('sf_auth_token');
      if (!stored) return null;
      const payload = decodeJwtPayload(stored);
      if (payload && payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('sf_auth_token');
        localStorage.removeItem('sf_user');
        return null;
      }
      return stored;
    } catch {
      return localStorage.getItem('sf_auth_token') || null;
    }
  });

  const [user, setUser] = useState(() => {
    try {
      const storedToken = localStorage.getItem('sf_auth_token');
      if (!storedToken) return null;
      const storedUser = localStorage.getItem('sf_user');
      if (storedUser) {
        return JSON.parse(storedUser);
      }
      // Reconstruct user identity immediately from valid JWT payload
      const payload = decodeJwtPayload(storedToken);
      if (payload) {
        return {
          id: payload.id,
          username: payload.username,
          unique_id: payload.unique_id,
          display_name: (payload.username || '').split('@')[0],
          avatar_color: '135deg,#9d00ff,#00d2ff'
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  // Zero blocking: if there is no token, or user already restored from cache, loading is instantly false
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  // Background non-blocking session check on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('sf_auth_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/profile', {
          headers: { 'Authorization': `Bearer ${storedToken}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setUser(data.user);
            localStorage.setItem('sf_user', JSON.stringify(data.user));
          }
          if (data.token) {
            setToken(data.token);
            localStorage.setItem('sf_auth_token', data.token);
          }
        } else if (response.status === 401 || response.status === 403) {
          // Token invalid or expired — clear it
          localStorage.removeItem('sf_auth_token');
          localStorage.removeItem('sf_user');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.warn('Silent background session verification skipped/offline:', err);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Update document theme attribute on changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const login = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    if (data.success && data.user) {
      setUser(data.user);
      localStorage.setItem('sf_user', JSON.stringify(data.user));
    }
    if (data.token) {
      setToken(data.token);
      localStorage.setItem('sf_auth_token', data.token);
    }
    return data;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout request failed:', e);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('sf_auth_token');
      localStorage.removeItem('sf_user');
      // Redirect to login page
      window.location.href = '/login';
    }
  };

  const refreshProfile = async () => {
    try {
      const storedToken = localStorage.getItem('sf_auth_token');
      const headers = storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {};
      const response = await fetch('/api/auth/profile', { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem('sf_user', JSON.stringify(data.user));
        }
        if (data.token) {
          setToken(data.token);
          localStorage.setItem('sf_auth_token', data.token);
        }
      }
    } catch (err) {
      console.error('Profile refresh error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, theme, toggleTheme, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
