import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('sf_auth_token') || null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  // Verify session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = localStorage.getItem('sf_auth_token');
        const headers = storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {};
        const response = await fetch('/api/auth/profile', { headers });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setUser(data.user);
          }
          // Store/refresh the token returned by profile endpoint.
          // This covers mobile users with an existing cookie session who
          // don't yet have the token in localStorage.
          if (data.token) {
            setToken(data.token);
            localStorage.setItem('sf_auth_token', data.token);
          }
        } else {
          // Token invalid or expired — clear it
          localStorage.removeItem('sf_auth_token');
          setToken(null);
        }
      } catch (err) {
        console.error('Session check failed:', err);
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
