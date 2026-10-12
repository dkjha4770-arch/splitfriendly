import React, { useState, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  KeyRound, 
  User, 
  Lock, 
  AlertCircle, 
  Wallet, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import './Login.css';

export const Login = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Send a request to wake/pre-warm database connection pool in the background
    fetch('/api/auth/wake').catch(err => {
      console.warn('Background database pre-warm failed/timed out:', err);
    });
  }, []);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-executive-card">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="login-brand-icon-wrap">
            <Wallet size={36} color="#ffffff" strokeWidth={2.4} />
          </div>
          <h1 className="login-brand-title">FAIRSHARE</h1>
          <p className="login-brand-subtitle">Financial Ledger & Expense Intelligence</p>
          <div className="login-security-badge">
            <span className="login-security-dot"></span>
            <span>256-BIT ENCRYPTED SESSION</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="login-error-alert" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Username Field */}
          <div className="login-form-group">
            <label className="login-form-label">
              <span>Username Handle</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'none' }}>Unique identifier</span>
            </label>
            <div className="login-input-wrapper">
              <User size={18} className="login-input-icon" />
              <input 
                type="text" 
                className="login-input-field"
                placeholder="e.g. deepak" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoFocus
              />
            </div>
            {username && !username.includes('@') && (
              <div className="login-username-hint">
                <Sparkles size={12} style={{ color: 'var(--primary)' }} />
                <span>Signing in as: <strong>{username.trim()}@fairshare</strong></span>
              </div>
            )}
          </div>

          {/* Password Field */}
          <div className="login-form-group" style={{ marginBottom: '1.75rem' }}>
            <div className="login-form-label">
              <span>Secret Key / Password</span>
              <Link to="/forgot-password" className="login-recovery-link" tabIndex={-1}>
                Forgot?
              </Link>
            </div>
            <div className="login-input-wrapper">
              <Lock size={18} className="login-input-icon" />
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="login-input-field"
                placeholder="••••••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: '2.85rem' }}
              />
              <button
                type="button"
                className="login-toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <button 
            type="submit" 
            disabled={loading}
            className="btn-login-submit"
          >
            {loading ? (
              <>
                <div className="login-spinner-sm" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <KeyRound size={18} />
                <span>Sign In To Ledger</span>
                <ArrowRight size={16} style={{ marginLeft: '0.2rem' }} />
              </>
            )}
          </button>
        </form>

        {/* Footer Navigation Links */}
        <div className="login-footer-links">
          <div className="login-footer-row">
            <span className="login-footer-text">New to FairShare?</span>
            <Link to="/register" className="login-footer-link">
              Create Account
            </Link>
          </div>
          <div>
            <Link to="/forgot-password" className="login-recovery-link">
              Need account recovery assistance?
            </Link>
          </div>
        </div>

        {/* Feature Highlights Pill */}
        <div className="login-features-pill">
          <span><ShieldCheck size={13} style={{ color: 'var(--primary)' }} /> Auto-Reconciliation</span>
          <span className="login-features-divider"></span>
          <span>Bilateral Ledgers</span>
          <span className="login-features-divider"></span>
          <span>Squad Split Engine</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
