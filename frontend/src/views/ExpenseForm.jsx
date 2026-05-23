import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  Users, 
  User, 
  Plus, 
  X, 
  TrendingUp, 
  CreditCard,
  Grid,
  Percent,
  Lock,
  Send
} from 'lucide-react';

const CATEGORIES = [
  { value: 'food', label: 'Food & Rations', icon: '🍲' },
  { value: 'rent', label: 'Base Rent', icon: '🏠' },
  { value: 'travel', label: 'Transport & Travel', icon: '🚀' },
  { value: 'utility', label: 'Infrastructure/Utilities', icon: '🔌' },
  { value: 'other', label: 'Unclassified Operations', icon: '📦' }
];

const PAYMENT_APPS = [
  { value: 'gpay', label: 'Google Pay' },
  { value: 'phonepe', label: 'PhonePe' },
  { value: 'slice', label: 'Slice Card' },
  { value: 'cash', label: 'Cash' }
];

export const ExpenseForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // App state
  const [squads, setSquads] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [mode, setMode] = useState('select'); // 'group' | 'individual' | 'self' | 'select'
  const [selectedSquadName, setSelectedSquadName] = useState('');

  // Set mode from search query if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const m = params.get('mode');
    if (m && ['group', 'individual', 'self'].includes(m)) {
      setMode(m);
    } else {
      setMode('select');
    }
  }, [location.search]);
  
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('food');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentApp, setPaymentApp] = useState('gpay');
  const [payer, setPayer] = useState('');
  
  // Group mode fields
  const [amount, setAmount] = useState('');
  const [draftMembers, setDraftMembers] = useState([]); // list of { name, uid, display_name }
  const [selectedMemberNames, setSelectedMemberNames] = useState([]); // array of handles
  const [extraUserQuery, setExtraUserQuery] = useState('');

  // Individual mode fields
  const [unitPrice, setUnitPrice] = useState('');
  const [quantities, setQuantities] = useState({}); // { [username]: quantity }

  const myHandle = user?.username ? user.username.split('@')[0].toLowerCase() : '';

  // Fetch initial configuration
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        // Fetch squads & system users
        const [squadsRes, usersRes] = await Promise.all([
          fetch('/api/squads'),
          fetch('/api/users')
        ]);
        
        if (squadsRes.ok) {
          const squadsData = await squadsRes.json();
          setSquads(squadsData || []);
          if (squadsData && squadsData.length > 0) {
            // Auto-select first squad
            setSelectedSquadName(squadsData[0].name);
          }
        }
        
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setSystemUsers(usersData || []);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // Update members when squad selection changes
  useEffect(() => {
    if (!selectedSquadName || squads.length === 0) return;
    const squad = squads.find(s => s.name === selectedSquadName);
    if (squad) {
      setDraftMembers(squad.members || []);
      const memberNames = squad.members.map(m => m.name.toLowerCase());
      setSelectedMemberNames(memberNames);
      
      // Default payer to logged-in user if they are in the squad, else first member
      const payerExists = memberNames.includes(myHandle);
      setPayer(payerExists ? myHandle : (memberNames[0] || ''));
      
      // Reset quantities for individual mode
      const initialQtys = {};
      squad.members.forEach(m => {
        initialQtys[m.name.toLowerCase()] = 0;
      });
      setQuantities(initialQtys);
    }
  }, [selectedSquadName, squads]);

  // Set default payer for Self Mode
  useEffect(() => {
    if (mode === 'self') {
      setPayer(myHandle);
    }
  }, [mode, myHandle]);

  // Toggle member inclusion in Group equal split
  const toggleMemberSelection = (name) => {
    const nl = name.toLowerCase();
    setSelectedMemberNames(prev => {
      if (prev.includes(nl)) {
        return prev.filter(n => n !== nl);
      } else {
        return [...prev, nl];
      }
    });
  };

  // Add extra user to current split list
  const addExtraUser = () => {
    const query = extraUserQuery.trim().toLowerCase();
    if (!query) return;

    // Find in system users by handle or unique ID
    const foundUser = systemUsers.find(u => 
      u.name.toLowerCase() === query || 
      u.uid.toLowerCase() === query || 
      u.uid.toLowerCase().endsWith(query)
    );

    if (!foundUser) {
      alert('Operative not found in central registry.');
      return;
    }

    const matchedHandle = foundUser.name.toLowerCase();
    
    // Check if already in draft members
    const isAlreadyMember = draftMembers.some(m => m.name.toLowerCase() === matchedHandle);
    if (isAlreadyMember) {
      // Just ensure they are selected
      if (!selectedMemberNames.includes(matchedHandle)) {
        setSelectedMemberNames(prev => [...prev, matchedHandle]);
      }
      setExtraUserQuery('');
      return;
    }

    // Add to local draft
    const newMember = {
      name: foundUser.name,
      display_name: foundUser.display_name || foundUser.name,
      uid: foundUser.uid
    };

    setDraftMembers(prev => [...prev, newMember]);
    setSelectedMemberNames(prev => [...prev, matchedHandle]);
    
    // Initialize quantity for this member
    setQuantities(prev => ({ ...prev, [matchedHandle]: 0 }));
    setExtraUserQuery('');

    // If I am the creator/owner of this squad, update the squad on the server!
    const activeSquad = squads.find(s => s.name === selectedSquadName);
    if (activeSquad) {
      const creatorHandle = activeSquad.creator ? activeSquad.creator.split('@')[0].toLowerCase() : '';
      const isOwner = creatorHandle === myHandle || (activeSquad.name === 'Splitters' && myHandle === 'deepak');
      if (isOwner) {
        // Sync update back to server
        const updatedMembers = [...activeSquad.members, { name: foundUser.name, uid: foundUser.uid }];
        fetch('/api/squads/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeSquad.id,
            name: activeSquad.name,
            members: updatedMembers
          })
        }).then(res => {
          if (res.ok) {
            // Reload squads to reflect persistent sync
            fetch('/api/squads')
              .then(r => r.json())
              .then(data => setSquads(data || []));
          }
        });
      }
    }
  };

  // Quantity updates for Individual items
  const handleQuantityChange = (name, val) => {
    const qty = Math.max(0, parseFloat(val) || 0);
    setQuantities(prev => ({
      ...prev,
      [name.toLowerCase()]: qty
    }));
  };

  // Live calculations
  const parsedAmount = parseFloat(amount) || 0;
  const groupCount = selectedMemberNames.length;
  const groupShare = groupCount > 0 ? parsedAmount / groupCount : 0;

  const parsedUnitPrice = parseFloat(unitPrice) || 0;
  let totalQty = 0;
  let calculatedIndivTotal = 0;
  Object.entries(quantities).forEach(([_, qty]) => {
    totalQty += qty;
    calculatedIndivTotal += qty * parsedUnitPrice;
  });

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!description.trim()) {
      alert('Operational description required.');
      return;
    }

    let finalAmount = 0;
    let finalShare = 0;
    let finalMembers = null;

    if (mode === 'group') {
      finalAmount = parsedAmount;
      if (finalAmount <= 0) {
        alert('Enter a valid operational cost.');
        return;
      }
      if (selectedMemberNames.length === 0) {
        alert('Select at least one operative for splitting.');
        return;
      }
      finalShare = groupShare;
      finalMembers = selectedMemberNames; // Array of handles
    } else if (mode === 'individual') {
      finalAmount = calculatedIndivTotal;
      if (finalAmount <= 0) {
        alert('Set unit price and quantities to generate balance.');
        return;
      }
      finalShare = 0; // Share calculated dynamically via members object mapping
      
      const memberShares = {};
      Object.entries(quantities).forEach(([mName, qty]) => {
        if (qty > 0) {
          memberShares[mName] = qty * parsedUnitPrice;
        }
      });
      finalMembers = memberShares; // Object mapping handle -> share amount
    } else {
      // Self mode
      finalAmount = parsedAmount;
      if (finalAmount <= 0) {
        alert('Enter a valid spending amount.');
        return;
      }
      finalShare = finalAmount;
      finalMembers = [myHandle]; // private, user is the sole member
    }

    const payload = {
      date,
      amount: finalAmount,
      payer,
      share: finalShare,
      where: description,
      category,
      app: paymentApp,
      members: finalMembers,
      squad_name: mode !== 'self' ? selectedSquadName : null
    };

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server rejected transaction.');
      
      // Navigate to ledger
      navigate('/expenses');
    } catch (err) {
      alert('Transaction failed: ' + err.message);
    }
  };

  const isSelectMode = !mode || mode === 'select';

  return (
    <div className="view-section">
      {/* Back Header */}
      <header className="content-header" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            className="btn-glass" 
            style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0 }}
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="header-title">
            <h2 id="formTitleText">
              {isSelectMode 
                ? 'Choose Split Protocol' 
                : mode === 'group' 
                  ? 'Register Group Split' 
                  : mode === 'individual' 
                    ? 'Itemized Custom Split' 
                    : 'Personal Self-Entry'}
            </h2>
            <p id="viewSubtitle">
              {isSelectMode 
                ? 'Select the operational split mechanism for this ledger entry.' 
                : mode === 'group' 
                  ? 'Equal distribution across selected squad.' 
                  : mode === 'individual' 
                    ? 'Frictionless distribution based on quantities.' 
                    : 'Log personal expenditure.'}
            </p>
          </div>
        </div>
      </header>

      {isSelectMode ? (
        <div className="protocol-grid">
          {/* Card 1: Self Entry */}
          <div 
            className="card select-card" 
            onClick={() => navigate('?mode=self')}
            style={{ 
              padding: '2.5rem 2rem', 
              borderRadius: '24px', 
              cursor: 'pointer', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              textAlign: 'center',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)'
            }}
          >
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '20px',
              background: 'var(--input-bg)',
              color: 'var(--text-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <Lock size={28} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-color)' }}>Self Entry</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.5, flex: 1, marginBottom: '1.5rem' }}>
              Log personal expenditure solely for your private ledger tracking. No active split calculations will be initiated.
            </p>
            <button className="btn-primary" style={{ width: '100%', pointerEvents: 'none', marginTop: 'auto' }}>
              Select Protocol
            </button>
          </div>

          {/* Card 2: Group Split */}
          <div 
            className="card select-card" 
            onClick={() => navigate('?mode=group')}
            style={{ 
              padding: '2.5rem 2rem', 
              borderRadius: '24px', 
              cursor: 'pointer', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              textAlign: 'center',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)'
            }}
          >
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '20px',
              background: 'var(--input-bg)',
              color: 'var(--text-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <Users size={28} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-color)' }}>Group Split</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.5, flex: 1, marginBottom: '1.5rem' }}>
              Split expenses equally with other members of your tactical squads. Automatically updates balances and obligations.
            </p>
            <button className="btn-primary" style={{ width: '100%', pointerEvents: 'none', marginTop: 'auto' }}>
              Select Protocol
            </button>
          </div>

          {/* Card 3: Individual Split */}
          <div 
            className="card select-card" 
            onClick={() => navigate('?mode=individual')}
            style={{ 
              padding: '2.5rem 2rem', 
              borderRadius: '24px', 
              cursor: 'pointer', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              textAlign: 'center',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)'
            }}
          >
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '20px',
              background: 'var(--input-bg)',
              color: 'var(--text-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <Percent size={28} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-color)' }}>Individual Split</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.5, flex: 1, marginBottom: '1.5rem' }}>
              Split expenses unequally based on custom quantities or items. Ideal for precise customized ledger distribution.
            </p>
            <button className="btn-primary" style={{ width: '100%', pointerEvents: 'none', marginTop: 'auto' }}>
              Select Protocol
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Mode Switcher Tabs */}
          <div className="card flex-row-mobile-stack" style={{ padding: '0.8rem', borderRadius: '24px', display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <button 
              className={`btn-glass ${mode === 'group' ? 'active' : ''}`}
              style={{ flex: 1, border: 'none', background: mode === 'group' ? 'var(--primary)' : 'transparent', color: mode === 'group' ? 'var(--btn-text-color)' : 'var(--text-color)' }}
              onClick={() => navigate('?mode=group')}
            >
              <Users size={15} style={{ marginRight: '0.4rem' }} />
              <span>Equal Split</span>
            </button>
            <button 
              className={`btn-glass ${mode === 'individual' ? 'active' : ''}`}
              style={{ flex: 1, border: 'none', background: mode === 'individual' ? 'var(--primary)' : 'transparent', color: mode === 'individual' ? 'var(--btn-text-color)' : 'var(--text-color)' }}
              onClick={() => navigate('?mode=individual')}
            >
              <Percent size={15} style={{ marginRight: '0.4rem' }} />
              <span>Itemized Split</span>
            </button>
            <button 
              className={`btn-glass ${mode === 'self' ? 'active' : ''}`}
              style={{ flex: 1, border: 'none', background: mode === 'self' ? 'var(--primary)' : 'transparent', color: mode === 'self' ? 'var(--btn-text-color)' : 'var(--text-color)' }}
              onClick={() => navigate('?mode=self')}
            >
              <Lock size={15} style={{ marginRight: '0.4rem' }} />
              <span>Personal Entry</span>
            </button>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}>Loading deployment context...</p>
          ) : (
        <form onSubmit={handleSubmit} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', maxWidth: '700px', margin: '0 auto' }}>
          
          {/* Conditional Squad Selection */}
          {mode !== 'self' && (
            <div className="form-group">
              <label>Tactical Squad deployment</label>
              {squads.length === 0 ? (
                <div style={{ padding: '1rem', background: 'rgba(255,59,48,0.1)', border: '1px solid #ff3b3030', borderRadius: '14px', color: '#ff3b30', fontSize: '0.85rem' }}>
                  No active squads established. Create a squad in Squad Command before initiating a split.
                </div>
              ) : (
                <select 
                  value={selectedSquadName} 
                  onChange={e => setSelectedSquadName(e.target.value)}
                  required
                >
                  {squads.map(s => (
                    <option key={s.id} value={s.name}>{s.name} (SQD-{s.id.toString().slice(-4)})</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Amount field (Group & Self only) */}
          {mode !== 'individual' && (
            <div className="form-group">
              <label>Amount (INR)</label>
              <input 
                type="number" 
                placeholder="0.00" 
                step="0.01" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>
          )}

          {/* Individual Split Table Section */}
          {mode === 'individual' && (
            <>
              <div className="form-group">
                <label>Unit price (per item / share)</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  step="0.01" 
                  value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Operatives Quantities Grid</label>
                <div className="table-wrapper" style={{ border: '1px solid var(--border-color)', borderRadius: '18px', background: 'rgba(0,0,0,0.1)' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th style={{ textAlign: 'center' }}>Quantity</th>
                        <th style={{ textAlign: 'right' }}>Calculated Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftMembers.map(m => {
                        const mNameL = m.name.toLowerCase();
                        const qty = quantities[mNameL] || 0;
                        const shareVal = qty * parsedUnitPrice;
                        return (
                          <tr key={m.uid || m.name}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div className="user-avatar" style={{ width: '30px', height: '30px', fontSize: '0.8rem' }}>
                                  {m.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600 }}>{m.display_name || m.name}</div>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{m.uid}</span>
                                </div>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input 
                                type="number" 
                                min="0" 
                                step="1" 
                                style={{ width: '80px', textAlign: 'center', padding: '0.4rem' }}
                                value={qty === 0 ? '' : qty}
                                onChange={e => handleQuantityChange(m.name, e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-color)' }}>
                              ₹ {shareVal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Individual Live Visualizer Summary */}
              <div className="integrated-summary">
                <div className="summary-tile">
                  <span className="s-label">Unit Cost</span>
                  <span className="s-value">₹ {parsedUnitPrice.toFixed(2)}</span>
                </div>
                <div className="summary-tile" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                  <span className="s-label">Total Qty</span>
                  <span className="s-value">{totalQty} units</span>
                </div>
                <div className="summary-tile" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                  <span className="s-label">Consolidated Total</span>
                  <span className="s-value neon-text">₹ {calculatedIndivTotal.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}

          {/* Group Split Selection Section */}
          {mode === 'group' && (
            <>
              <div className="form-group" id="groupSplitSection">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={{ margin: 0 }}>Target Operatives selection</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 800 }} id="selectedMemberCount">
                    {groupCount} selected
                  </span>
                </div>
                
                {/* Members list */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }} id="memberSelection">
                  {draftMembers.map(m => {
                    const isSelected = selectedMemberNames.includes(m.name.toLowerCase());
                    return (
                      <label 
                        key={m.uid || m.name} 
                        className="member-chip"
                        style={{ cursor: 'pointer' }}
                      >
                        <input 
                          type="checkbox" 
                          name="members" 
                          checked={isSelected}
                          onChange={() => toggleMemberSelection(m.name)}
                          style={{ display: 'none' }}
                        />
                        <div className={`member-box ${isSelected ? 'selected' : ''}`} style={{
                          padding: '0.6rem 1rem',
                          background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                          color: isSelected ? 'var(--btn-text-color)' : 'var(--text-color)',
                          border: '1px solid ' + (isSelected ? 'var(--primary)' : 'var(--border-color)'),
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          boxShadow: isSelected ? '0 0 15px rgba(157, 0, 255, 0.2)' : 'none',
                          transition: 'all 0.3s ease'
                        }}>
                          <div className="avatar-mini" style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{m.display_name || m.name}</span>
                          {isSelected && <span style={{ fontSize: '0.8rem' }}>✓</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Add Extra member */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <input 
                    type="text" 
                    placeholder="Enlist Extra Agent ID or Handle..." 
                    style={{ flex: 1 }}
                    value={extraUserQuery}
                    onChange={e => setExtraUserQuery(e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="btn-glass"
                    onClick={addExtraUser}
                  >
                    <Plus size={16} />
                    <span>Enlist</span>
                  </button>
                </div>
              </div>

              {/* Group Live Visualizer Summary */}
              <div className="integrated-summary">
                <div className="summary-tile">
                  <span className="s-label">Total Cost</span>
                  <span className="s-value">₹ {parsedAmount.toFixed(2)}</span>
                </div>
                <div className="summary-tile" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                  <span className="s-label">Operatives Count</span>
                  <span className="s-value">{groupCount} Agents</span>
                </div>
                <div className="summary-tile" style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                  <span className="s-label">Each share</span>
                  <span className="s-value neon-text">₹ {groupShare.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}

          {/* Description */}
          <div className="form-group">
            <label>Operational objective (Description)</label>
            <input 
              type="text" 
              placeholder="e.g. Server Room Energy, Dinner rations"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Payer selector */}
          {mode !== 'self' && (
            <div className="form-group">
              <label>Funding agent (Payer)</label>
              <select 
                value={payer} 
                onChange={e => setPayer(e.target.value)}
                required
              >
                {draftMembers.map(m => (
                  <option key={m.uid || m.name} value={m.name.toLowerCase()}>{m.display_name || m.name} ({m.name.toLowerCase()})</option>
                ))}
              </select>
            </div>
          )}

          {/* Category dropdown */}
          <div className="form-group">
            <label>Operational Category scope</label>
            <select 
              value={category}
              onChange={e => setCategory(e.target.value)}
              required
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
              ))}
            </select>
          </div>

          {/* Execution Date */}
          <div className="form-group">
            <label>Execution Date</label>
            <input 
              type="date" 
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          {/* Execution Channel (Payment Method Grid) */}
          <div className="form-group">
            <label>Funding Channel (Payment App)</label>
            <div className="payment-method-grid">
              {PAYMENT_APPS.map(app => (
                <label key={app.value} className="app-chip">
                  <input 
                    type="radio" 
                    name="paymentApp" 
                    value={app.value}
                    checked={paymentApp === app.value}
                    onChange={() => setPaymentApp(app.value)}
                  />
                  <span className="chip-content">{app.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit button */}
          <button 
            type="submit" 
            className="btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Send size={16} />
            <span>Commit Transaction</span>
          </button>

        </form>
      )}
        </>
      )}
    </div>
  );
};

export default ExpenseForm;
