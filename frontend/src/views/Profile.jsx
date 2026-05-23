import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Shield, 
  Key, 
  Calendar, 
  Check, 
  AlertCircle,
  Copy,
  Sun,
  Moon
} from 'lucide-react';

export const Profile = () => {
  const { user, theme, toggleTheme, refreshProfile } = useAuth();
  
  // State
  const [displayName, setDisplayName] = useState('');
  const [dobDay, setDobDay] = useState(1);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  // Initialize fields
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setDobDay(user.dob_day || 1);
    }
  }, [user]);

  const handleCopyId = () => {
    if (user?.unique_id) {
      navigator.clipboard.writeText(user.unique_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          dob_day: dobDay,
          new_password: newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profile update failed.');

      setSuccessMsg('Tactical profile reconfigured successfully.');
      setNewPassword('');
      setConfirmPassword('');
      await refreshProfile();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleThemeToggle = () => {
    toggleTheme();
  };

  const handleSwatchClick = async (color) => {
    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          dob_day: dobDay,
          avatar_color: color
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profile update failed.');

      setSuccessMsg('Avatar color updated successfully.');
      await refreshProfile();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Google Charts QR URL
  const qrUrl = user?.unique_id 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(user.unique_id)}&color=9d00ff&bgcolor=ffffff`
    : '';

  return (
    <div className="view-section">
      {/* Header */}
      <header className="content-header">
        <div className="header-title">
          <h2>Operative Profile</h2>
          <p>Manage credentials, scanning ID badges, and active keys.</p>
        </div>
      </header>

      {/* Profile Split Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* Left Side: Avatar Card & QR code */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Identity Telemetry Card */}
          <div className="card" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '80px',
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              opacity: 0.2,
              zIndex: 0
            }}></div>
            
            <div className="user-avatar" style={{ 
              width: '80px', 
              height: '80px', 
              fontSize: '2rem', 
              margin: '30px auto 1rem', 
              position: 'relative', 
              zIndex: 1,
              boxShadow: 'var(--clay-shadow)',
              background: user?.avatar_color ? `linear-gradient(${user.avatar_color})` : 'linear-gradient(135deg, var(--primary), var(--secondary))'
            }}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'capitalize', zIndex: 1, position: 'relative' }}>
              {user?.display_name || user?.username?.split('@')[0]}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.5rem', zIndex: 1, position: 'relative' }}>
              {user?.username}
            </p>

            {/* Color Swatch Picker */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', margin: '0 auto 1.5rem', maxWidth: '280px', zIndex: 1, position: 'relative' }}>
              {[
                '135deg,#9d00ff,#00d2ff',
                '135deg,#ff3b30,#ff9500',
                '135deg,#00d68f,#00b5d8',
                '135deg,#f7b731,#fd9644',
                '135deg,#ee00ff,#9d00ff',
                '135deg,#0099ff,#00d2ff',
                '135deg,#2ecc71,#1abc9c',
                '135deg,#e74c3c,#c0392b'
              ].map(color => {
                const isActive = user?.avatar_color === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleSwatchClick(color)}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: `linear-gradient(${color})`,
                      border: isActive ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                      boxShadow: isActive ? '0 0 10px rgba(255,255,255,0.5)' : 'none',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'all 0.2s',
                      transform: isActive ? 'scale(1.15)' : 'none'
                    }}
                    title={color}
                  />
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '1.5rem' }}>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Operative ID</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <b style={{ fontSize: '0.9rem', color: 'var(--text-color)' }}>{user?.unique_id}</b>
                  <button 
                    onClick={handleCopyId}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '2px' }}
                    title="Copy Operative ID"
                  >
                    <Copy size={12} style={{ color: copied ? '#22c55e' : 'var(--text-dim)' }} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Badge QR scan Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <h3 style={{ alignSelf: 'flex-start', fontSize: '1rem', fontWeight: 800, marginBottom: '1rem' }}>Operative QR Badge</h3>
            {qrUrl ? (
              <div style={{
                background: 'white',
                padding: '1rem',
                borderRadius: '16px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                marginBottom: '1rem',
                display: 'inline-block'
              }}>
                <img 
                  src={qrUrl} 
                  alt="Operative Unique ID QR" 
                  style={{ width: '180px', height: '180px', display: 'block' }}
                />
              </div>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Generating QR ID...</p>
            )}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', maxWidth: '250px', margin: '0 auto', lineHeight: '1.4' }}>
              Let another team member scan this QR badge in order to invite you to custom operational squads instantly.
            </p>
          </div>

          {/* Theme Control Card */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Interface Mode</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '0.2rem 0 0' }}>Adjust lighting parameters.</p>
            </div>
            <button 
              className="btn-glass"
              style={{
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                padding: 0,
                background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                borderColor: 'var(--border-color)'
              }}
              onClick={handleThemeToggle}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

        </div>

        {/* Right Side: Reconfigure Profile Form */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={18} style={{ color: 'var(--primary)' }} />
            <span>Reconfigure Parameters</span>
          </h3>

          {successMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e30', color: '#22c55e', padding: '0.75rem 1rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
              <Check size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef444430', color: '#ef4444', padding: '0.75rem 1rem', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label>Operative Display Name</label>
              <input 
                type="text" 
                placeholder="e.g. Deepak Kumar"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Birth Date Day (UID anchor)</label>
              <select 
                value={dobDay} 
                onChange={e => setDobDay(parseInt(e.target.value))}
                required
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'block', marginTop: '0.3rem' }}>
                Note: Updating this day generates a new ID suffix automatically.
              </span>
            </div>

            <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.5rem 0' }}></div>

            <div className="form-group">
              <label>New Secret Key (Password)</label>
              <input 
                type="password" 
                placeholder="Leave blank to retain current key"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Confirm Secret Key</label>
              <input 
                type="password" 
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              style={{ width: '100%', marginTop: '1rem' }}
              disabled={loading}
            >
              {loading ? 'Committing Changes...' : 'Commit Configurations'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Profile;
