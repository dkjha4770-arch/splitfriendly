import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, User, Lock, AlertCircle } from 'lucide-react';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login attempt failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'var(--gradient-bg)',
      color: 'var(--text-color)',
      padding: '1rem',
      overflowY: 'auto'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '2.5rem',
        boxShadow: 'var(--shadow)',
        borderRadius: '28px',
        border: '1px solid var(--border-color)',
        background: 'var(--card-bg)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '3rem', filter: 'drop-shadow(0 0 10px var(--primary))' }}>💰</span>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '1rem', letterSpacing: '-1px' }}>
            SPLIT-FRIENDLY
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Secure Expenses Synchronization Subsystem
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '0.8rem 1rem',
            marginBottom: '1.5rem',
            color: '#ef4444',
            fontSize: '0.85rem'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>
              Username handle
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input 
                type="text" 
                placeholder="Username (e.g. deepak)" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{
                  paddingLeft: '2.75rem',
                  fontSize: '0.9rem'
                }}
              />
            </div>
            {username && !username.includes('@') && (
              <p style={{ fontSize: '0.7rem', color: 'var(--text-color)', marginTop: '0.4rem', opacity: 0.8, display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                Will log in as: <strong>{username.trim()}@splitfriendly</strong>
              </p>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>
              Secret Key
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  paddingLeft: '2.75rem',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary"
            style={{
              padding: '1.1rem',
              fontSize: '0.95rem',
              fontWeight: 800,
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}
          >
            {loading ? (
              <div style={{
                width: '18px',
                height: '18px',
                border: '2px solid rgba(255,255,255,0.2)',
                borderTop: '2px solid #fff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : (
              <>
                <KeyRound size={16} />
                <span>Initialize Session</span>
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>New operative? </span>
            <Link to="/register" style={{ color: 'var(--text-color)', textDecoration: 'underline', fontWeight: 700, transition: 'all 0.3s ease' }}>
              Create Account
            </Link>
          </div>
          <div>
            <Link to="/forgot-password" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.8rem', transition: 'all 0.3s ease' }}>
              Forgot Password / Recovery
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Login;
