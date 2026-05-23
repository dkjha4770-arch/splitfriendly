import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldAlert, 
  Trash2, 
  Key, 
  User,
  Users,
  Check, 
  AlertCircle,
  X
} from 'lucide-react';

export const Admin = () => {
  const { user } = useAuth();
  
  // States
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals/Overlays
  const [resetModal, setResetModal] = useState({
    isOpen: false,
    userId: null,
    username: '',
    newPassword: ''
  });
  
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    userId: null,
    username: ''
  });

  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Fetch Users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/users');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to retrieve operatives roster.');
      }
      const data = await res.json();
      setUsers(data || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Trigger password reset
  const triggerReset = (u) => {
    setResetModal({
      isOpen: true,
      userId: u.id,
      username: u.username,
      newPassword: ''
    });
  };

  const executeReset = async (e) => {
    e.preventDefault();
    const { userId, newPassword } = resetModal;
    
    if (!newPassword.trim() || newPassword.length < 6) {
      alert('Secret key must be at least 6 characters.');
      return;
    }

    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          new_password: newPassword.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset command failed.');

      setResetModal({ isOpen: false, userId: null, username: '', newPassword: '' });
      setStatusMsg({ type: 'success', text: `Secret key for ${resetModal.username} updated successfully.` });
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      alert('Operation failed: ' + err.message);
    }
  };

  // Trigger decommissioning
  const triggerDelete = (u) => {
    setDeleteModal({
      isOpen: true,
      userId: u.id,
      username: u.username
    });
  };

  const executeDelete = async () => {
    const { userId, username } = deleteModal;
    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Decommissioning command failed.');

      setDeleteModal({ isOpen: false, userId: null, username: '' });
      setStatusMsg({ type: 'success', text: `Operative ${username} decommissioned successfully.` });
      fetchUsers();
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      alert('Operation failed: ' + err.message);
      setDeleteModal({ isOpen: false, userId: null, username: '' });
    }
  };

  return (
    <div className="view-section">
      {/* Header */}
      <header className="content-header">
        <div className="header-title">
          <h2>Command Center Operations</h2>
          <p>Administrative control network for decommissioning and key recovery.</p>
        </div>
      </header>

      {/* Roster Panel */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <ShieldAlert size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>System Operatives Roster</h3>
        </div>

        {statusMsg.text && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            background: statusMsg.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid ' + (statusMsg.type === 'success' ? '#22c55e30' : '#ef444430'), 
            color: statusMsg.type === 'success' ? '#22c55e' : '#ef4444', 
            padding: '0.75rem 1rem', 
            borderRadius: '12px', 
            marginBottom: '1.5rem', 
            fontSize: '0.8rem' 
          }}>
            {statusMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>Loading system roster...</p>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#ff3b30' }}>
            <AlertCircle size={32} style={{ marginBottom: '1rem' }} />
            <p>{error}</p>
          </div>
        ) : users.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>No registered operatives in database.</p>
        ) : (
          <div className="table-wrapper">
            <table className="roster-table">
              <thead>
                <tr>
                  <th>Operative Username</th>
                  <th>Display Designation</th>
                  <th>Unique ID Badge</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Security Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isSelf = u.id === user?.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span style={{ fontWeight: 700 }}>{u.username}</span>
                            {isSelf && <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'var(--btn-text-color)', padding: '1px 5px', borderRadius: '4px', marginLeft: '0.5rem', fontWeight: 800 }}>YOU (ADMIN)</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{u.display_name || 'Designation Pending'}</td>
                      <td>
                        <code style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--primary)' }}>
                          {u.uid}
                        </code>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn-glass"
                            style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => triggerReset(u)}
                            title="Reset secret key"
                          >
                            <Key size={12} />
                            <span>Reset Key</span>
                          </button>
                          
                          {!isSelf && (
                            <button 
                              className="btn-delete"
                              style={{ padding: '0.4rem', borderRadius: '8px', background: 'rgba(255,59,48,0.1)', border: '1px solid #ff3b3030' }}
                              onClick={() => triggerDelete(u)}
                              title="Decommission Operative"
                            >
                              <Trash2 size={12} style={{ color: '#ff3b30' }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reset Key Modal */}
      {resetModal.isOpen && (
        <div className="modal-overlay" onClick={() => setResetModal({ isOpen: false, userId: null, username: '', newPassword: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Key size={18} style={{ color: 'var(--primary)' }} />
                <span>Override Secret Key</span>
              </h3>
              <button className="btn-delete" style={{ padding: '4px' }} onClick={() => setResetModal({ isOpen: false, userId: null, username: '', newPassword: '' })}>
                <X size={16} />
              </button>
            </div>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              You are overriding the authentication key for <strong style={{ color: 'var(--text-color)' }}>{resetModal.username}</strong>.
            </p>

            <form onSubmit={executeReset} style={{ display: 'grid', gap: '1rem' }}>
              <div className="form-group">
                <label>New Secret Key (Password)</label>
                <input 
                  type="password" 
                  placeholder="Min 6 characters"
                  value={resetModal.newPassword}
                  onChange={e => setResetModal(prev => ({ ...prev, newPassword: e.target.value }))}
                  required
                />
              </div>
              
              <div className="flex-row-mobile-stack" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-glass" style={{ flex: 1 }} onClick={() => setResetModal({ isOpen: false, userId: null, username: '', newPassword: '' })}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1, marginTop: 0 }}>
                  Override Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decommission Confirm Modal */}
      {deleteModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ isOpen: false, userId: null, username: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ff3b30', marginBottom: '1rem' }}>Confirm Decommissioning</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              Are you sure you want to permanently decommission <strong style={{ color: 'var(--text-color)' }}>{deleteModal.username}</strong>? All access tokens will be invalidated, and their profile will be removed.
            </p>
            <div className="flex-row-mobile-stack" style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-glass" style={{ flex: 1 }} onClick={() => setDeleteModal({ isOpen: false, userId: null, username: '' })}>
                Cancel
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 1, marginTop: 0, background: '#ff3b30', boxShadow: 'none' }}
                onClick={executeDelete}
              >
                Decommission
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Admin;
