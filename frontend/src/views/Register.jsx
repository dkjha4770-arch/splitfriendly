import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, User, Lock, Calendar, AlertCircle } from 'lucide-react';

export const Register = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dobDay, setDobDay] = useState('1');
  
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch count of users to estimate serial
  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        const res = await fetch('/api/auth/profile'); // Just a probe to see if server is online, or fetch list
        // Since we can fetch all users or query health, let's just make a fast call to fetch all users to count
        const usersRes = await fetch('/api/users');
        if (usersRes.ok) {
          const list = await usersRes.json();
          setTotalUsersCount(list.length || 0);
        }
      } catch (e) {
        console.error('Failed to probe user count', e);
      }
    };
    fetchUserCount();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const dayNum = parseInt(dobDay);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      setError('Birth date day must be between 1 and 31.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          confirm_password: confirmPassword,
          dob_day: dayNum
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  // Generate Unique ID preview
  const serialEst = String(totalUsersCount + 1).padStart(2, '0');
  const dobEst = String(parseInt(dobDay || 1) || 1).padStart(2, '0');
  const estimatedUid = `SPT-FLY-S${serialEst}${dobEst}`;

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
        maxWidth: '440px',
        padding: '2.5rem',
        boxShadow: 'var(--shadow)',
        borderRadius: '28px',
        border: '1px solid var(--border-color)',
        background: 'var(--card-bg)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '3rem', filter: 'drop-shadow(0 0 10px var(--primary))' }}>📝</span>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '1rem', letterSpacing: '-1px' }}>
            CREATE ACCOUNT
          </h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Register New operative credentials
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

        {success && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '12px',
            padding: '0.8rem 1rem',
            marginBottom: '1.5rem',
            color: '#22c55e',
            fontSize: '0.85rem',
            textAlign: 'center'
          }}>
            Operative registered! Redirecting to terminal log...
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>
              Username Handle
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input 
                type="text" 
                placeholder="Username (3-30 letters/numbers)" 
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                required
                style={{
                  paddingLeft: '2.75rem',
                  fontSize: '0.9rem'
                }}
              />
            </div>
            {username && (
              <p style={{ fontSize: '0.7rem', color: 'var(--text-color)', marginTop: '0.4rem', opacity: 0.8 }}>
                Your complete username: <strong>{username.trim()}@splitfriendly</strong>
              </p>
            )}
          </div>

          <div className="register-password-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>
                Key
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input 
                  type="password" 
                  placeholder="••••••" 
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

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>
                Confirm
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input 
                  type="password" 
                  placeholder="••••••" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{
                    paddingLeft: '2.75rem',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>
              Day of Birth (1-31)
            </label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input 
                type="number" 
                min="1" 
                max="31"
                placeholder="21" 
                value={dobDay}
                onChange={(e) => setDobDay(e.target.value)}
                required
                style={{
                  paddingLeft: '2.75rem',
                  fontSize: '0.9rem'
                }}
              />
            </div>
            <div style={{
              background: 'var(--input-bg)',
              border: '1px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              marginTop: '1rem',
              fontSize: '0.75rem',
              color: 'var(--text-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>ESTIMATED UNIQUE ID:</span>
              <strong style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{estimatedUid}</strong>
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
                <UserPlus size={16} />
                <span>Enlist Operative</span>
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-dim)' }}>Already enroled? </span>
          <Link to="/login" style={{ color: 'var(--text-color)', textDecoration: 'underline', fontWeight: 700, transition: 'all 0.3s ease' }}>
            Initialize Terminal
          </Link>
        </div>
      </div>
    </div>
  );
};
export default Register;
