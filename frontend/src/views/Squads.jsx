import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Plus, 
  Trash2, 
  UserPlus, 
  X, 
  Shield, 
  Check, 
  AlertCircle,
  Edit2
} from 'lucide-react';

export const Squads = () => {
  const { user, token } = useAuth();
  
  // Build auth headers for every API call (works on live Vercel→Render without cookie dependency)
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  
  // Data State
  const [squads, setSquads] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State for Create / Edit
  const [isEditing, setIsEditing] = useState(false);
  const [squadId, setSquadId] = useState(null); // null for create
  const [squadName, setSquadName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]); // Array of { name, uid }
  const [memberSearch, setMemberSearch] = useState('');

  // Current user info
  const myHandle = user?.username ? user.username.split('@')[0].toLowerCase() : '';
  const myEmail = user?.username || '';
  const myUid = user?.unique_id || '';

  // Fetch squads and system users
  const fetchData = async () => {
    try {
      setLoading(true);
      const [squadsRes, usersRes] = await Promise.all([
        fetch('/api/squads', { headers: authHeaders }),
        fetch('/api/users', { headers: authHeaders })
      ]);

      if (squadsRes.ok) {
        const squadsData = await squadsRes.json();
        setSquads(squadsData || []);
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setSystemUsers(usersData || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  // Form handler: Start creating a squad
  const startCreate = () => {
    setIsEditing(true);
    setSquadId(null);
    setSquadName('');
    // Auto-include current user in new squad
    setSelectedMembers([{ name: myHandle, uid: myUid }]);
    setMemberSearch('');
  };

  // Form handler: Start editing an existing squad
  const startEdit = (squad) => {
    setIsEditing(true);
    setSquadId(squad.id);
    setSquadName(squad.name);
    
    // Squad members are stored as { name, uid }
    setSelectedMembers(squad.members || []);
    setMemberSearch('');
  };

  // Cancel edit/create flow
  const cancelEdit = () => {
    setIsEditing(false);
    setSquadId(null);
    setSquadName('');
    setSelectedMembers([]);
  };

  // Add member to temporary list
  const addMember = (selectedUser) => {
    const isAlreadyMember = selectedMembers.some(
      m => m.name.toLowerCase() === selectedUser.name.toLowerCase()
    );

    if (isAlreadyMember) {
      alert('Operative already enlisted in this squad.');
      return;
    }

    setSelectedMembers(prev => [
      ...prev, 
      { name: selectedUser.name, uid: selectedUser.uid }
    ]);
    setMemberSearch('');
  };

  // Helper to recruit user by direct handle or unique ID matching
  const recruitUserByQuery = () => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return;

    const foundUser = systemUsers.find(u => 
      (u.name || '').toLowerCase() === query || 
      (u.uid || '').toLowerCase() === query || 
      (u.display_name || '').toLowerCase() === query ||
      (u.uid || '').toLowerCase().endsWith(query)
    );

    if (!foundUser) {
      alert('Operative not found in central registry.');
      return;
    }

    addMember(foundUser);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      recruitUserByQuery();
    }
  };

  const handleRecruitClick = (e) => {
    e.preventDefault();
    recruitUserByQuery();
  };

  // Remove member from temporary list
  const removeMemberFromDraft = (uid) => {
    // Current user can't remove themselves
    const mem = selectedMembers.find(m => m.uid === uid);
    if (mem && mem.name.toLowerCase() === myHandle) {
      alert('Security Policy: You cannot remove yourself from the squad.');
      return;
    }
    setSelectedMembers(prev => prev.filter(m => m.uid !== uid));
  };

  // Submit Squad Creation/Update
  const saveSquad = async (e) => {
    e.preventDefault();

    if (!squadName.trim()) {
      alert('Squad name required.');
      return;
    }

    if (selectedMembers.length < 2) {
      alert('A squad requires at least 2 operatives.');
      return;
    }

    // Verify current user is in the list
    const containsMe = selectedMembers.some(m => m.name.toLowerCase() === myHandle);
    let finalMembers = [...selectedMembers];
    if (!containsMe) {
      finalMembers.push({ name: myHandle, uid: myUid });
    }

    const payload = {
      name: squadName.trim(),
      members: finalMembers
    };

    if (squadId) {
      payload.id = squadId;
    }

    try {
      const res = await fetch('/api/squads/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server rejected squad layout.');

      setIsEditing(false);
      setSquadId(null);
      setSquadName('');
      setSelectedMembers([]);
      fetchData();
    } catch (err) {
      alert('Operation failed: ' + err.message);
    }
  };

  // Decommission Squad
  const deleteSquad = async (id, name) => {
    const confirm = window.confirm(`Decommission Squad ${name}? This action will dissolve all active links.`);
    if (!confirm) return;

    try {
      const res = await fetch('/api/squads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server rejected request.');

      fetchData();
    } catch (err) {
      alert('Dissolution failed: ' + err.message);
    }
  };

  // Filter user list for search dropdown
  const filteredUsers = systemUsers.filter(u => {
    const isMatch = 
      (u.name || '').toLowerCase().includes(memberSearch.toLowerCase()) || 
      (u.display_name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
      (u.uid || '').toLowerCase().includes(memberSearch.toLowerCase());
    
    // Exclude already added
    const isAlreadyAdded = selectedMembers.some(m => m.uid === u.uid);
    
    return isMatch && !isAlreadyAdded;
  });

  return (
    <div className="view-section">
      {/* Header */}
      <header className="content-header">
        <div className="header-title">
          <h2>Squad Command</h2>
          <p>Orchestrate tactical squads and operational networks.</p>
        </div>
        {!isEditing && (
          <button className="btn-glass" style={{ background: 'var(--primary)', color: 'var(--btn-text-color)', border: 'none' }} onClick={startCreate}>
            <Plus size={16} />
            <span>Create Squad</span>
          </button>
        )}
      </header>

      {isEditing ? (
        /* Create/Edit Form card */
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
              {squadId ? `Reconfigure Squad (SQD-${squadId.toString().slice(-4)})` : 'Commission New Squad'}
            </h3>
            <button className="btn-glass" style={{ padding: '6px', borderRadius: '8px' }} onClick={cancelEdit}>
              <X size={16} />
            </button>
          </div>

          <form onSubmit={saveSquad} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label>Squad designation name</label>
              <input 
                type="text" 
                placeholder="e.g. Omega Splitters, Flat 402"
                value={squadName}
                onChange={e => setSquadName(e.target.value)}
                required
              />
            </div>

            {/* Recruited members list */}
            <div className="form-group">
              <label>Recruited operatives ({selectedMembers.length})</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', minHeight: '50px', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '14px', background: 'rgba(0,0,0,0.1)' }}>
                {selectedMembers.map(m => {
                  const isMe = m.name.toLowerCase() === myHandle;
                  return (
                    <div key={m.uid || m.name} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '10px',
                      fontSize: '0.8rem'
                    }}>
                      <div className="avatar-mini" style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: 'var(--btn-text-color)' }}>
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{m.name}</span>
                      {!isMe && (
                        <button 
                          type="button" 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', marginLeft: '0.2rem' }}
                          onClick={() => removeMemberFromDraft(m.uid)}
                        >
                          <X size={12} style={{ color: 'var(--text-dim)' }} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Operative recruitment autocomplete search */}
            <div className="form-group" style={{ position: 'relative' }}>
              <label>Recruit new Operatives</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div className="search-bar" style={{ flex: 1 }}>
                  <UserPlus size={16} style={{ color: 'var(--text-dim)' }} />
                  <input 
                    type="text" 
                    placeholder="Search by unique ID or username handle..." 
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                </div>
                <button 
                  type="button" 
                  className="btn-glass"
                  onClick={handleRecruitClick}
                >
                  <Plus size={16} />
                  <span>Recruit</span>
                </button>
              </div>

              {/* Autocomplete list */}
              {memberSearch.trim() && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  boxShadow: 'var(--clay-shadow)',
                  zIndex: 100,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  marginTop: '0.5rem'
                }}>
                  {filteredUsers.length === 0 ? (
                    <p style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center' }}>No available operatives found.</p>
                  ) : (
                    filteredUsers.map(u => (
                      <div 
                        key={u.uid} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onClick={() => addMember(u)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="user-avatar" style={{ width: '28px', height: '28px', fontSize: '0.75rem' }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{u.display_name || u.name}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{u.uid}</div>
                          </div>
                        </div>
                        <Plus size={14} style={{ color: 'var(--primary)' }} />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex-row-mobile-stack" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="button" className="btn-glass" style={{ flex: 1 }} onClick={cancelEdit}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" style={{ flex: 1, marginTop: 0 }}>
                {squadId ? 'Save Configuration' : 'Establish Squad'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* List grid */
        <div className="squads-grid">
          {squads.length === 0 ? (
            <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem' }}>
              <Users size={40} style={{ color: 'var(--text-dim)', marginBottom: '1rem', opacity: 0.5 }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.25rem' }}>No Active Squads</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.5rem' }}>You are not deployed in any operational squads.</p>
              <button className="btn-glass" onClick={startCreate}>Commission Squad</button>
            </div>
          ) : (
            squads.map(s => {
              const creatorHandle = s.creator ? s.creator.split('@')[0].toLowerCase() : '';
              const isOwner = creatorHandle === myHandle || (s.name === 'Splitters' && myHandle === 'deepak');
              
              return (
                <div key={s.id} className="card" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '200px'
                }}>
                  <div>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{s.name}</h3>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 6px', display: 'inline-block', marginTop: '0.2rem' }}>
                          SQD-{s.id.toString().slice(-4)}
                        </span>
                      </div>
                      
                      {isOwner && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button 
                            className="btn-glass" 
                            style={{ padding: '6px', borderRadius: '8px' }}
                            onClick={() => startEdit(s)}
                            title="Edit configuration"
                          >
                            <Edit2 size={12} style={{ color: 'var(--text-color)' }} />
                          </button>
                          <button 
                            className="btn-delete" 
                            style={{ padding: '6px', borderRadius: '8px' }}
                            onClick={() => deleteSquad(s.id, s.name)}
                            title="Decommission Squad"
                          >
                            <Trash2 size={12} style={{ color: '#ff3b30' }} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Meta */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
                      <Shield size={12} style={{ color: 'var(--primary)' }} />
                      <span>Initiator: <b style={{ textTransform: 'capitalize', color: 'var(--text-color)' }}>{creatorHandle}</b></span>
                    </div>

                    {/* Member Avatars Overlap Pile */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                      <div className="avatar-pile" style={{ display: 'flex', marginRight: '0.75rem' }}>
                        {(s.members || []).slice(0, 5).map((m, idx) => (
                          <div 
                            key={m.uid || m.name} 
                            className="user-avatar"
                            style={{
                              width: '28px',
                              height: '28px',
                              fontSize: '0.75rem',
                              border: '2px solid var(--card-bg)',
                              marginLeft: idx > 0 ? '-8px' : 0,
                              zIndex: 10 - idx
                            }}
                            title={m.name}
                          >
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {(s.members || []).length > 5 && (
                          <div 
                            className="user-avatar"
                            style={{
                              width: '28px',
                              height: '28px',
                              fontSize: '0.7rem',
                              border: '2px solid var(--card-bg)',
                              marginLeft: '-8px',
                              background: 'var(--primary)',
                              color: 'var(--btn-text-color)',
                              zIndex: 0
                            }}
                          >
                            +{(s.members || []).length - 5}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {(s.members || []).length} active operatives
                      </span>
                    </div>
                  </div>

                  {/* Footer detail */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    {(s.members || []).map(m => (
                      <span key={m.uid || m.name} style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-dim)',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        textTransform: 'capitalize'
                      }}>
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default Squads;
