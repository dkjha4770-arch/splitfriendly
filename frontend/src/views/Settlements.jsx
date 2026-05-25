import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  DollarSign, 
  Users, 
  CheckCircle, 
  Send, 
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  History,
  Shield,
  Activity
} from 'lucide-react';

export const Settlements = () => {
  const { user, token } = useAuth();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  const [expenses, setExpenses] = useState([]);
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Focused Squad view
  const [activeSquad, setActiveSquad] = useState(null);

  // Settlement Modal state
  const [modal, setModal] = useState({
    isOpen: false,
    squadName: '',
    otherUser: '',
    amount: 0,
    heOwesMe: false
  });

  const myHandle = user?.username ? user.username.split('@')[0].toLowerCase() : '';

  // Calculate Billing Cycle Start (5th of every month)
  const calculateCycleStart = () => {
    const now = new Date();
    let cycleStart = new Date(now.getFullYear(), now.getMonth(), 5);
    if (now.getDate() < 5) {
      cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, 5);
    }
    return cycleStart;
  };

  const cycleStart = calculateCycleStart();

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/expenses/data', { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to load transaction data.');
      const data = await res.json();
      setExpenses(data.expenses || []);
      setSquads(data.squads || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  // Helper: check if a user is in expense members
  const hasMember = (mems, name) => {
    if (!mems) return false;
    const target = name.toLowerCase();
    if (Array.isArray(mems)) {
      return mems.some(x => x.toLowerCase() === target);
    }
    if (typeof mems === 'object') {
      return Object.keys(mems).some(x => x.toLowerCase() === target);
    }
    return false;
  };

  // Helper: calculate user's share for an expense
  const getShare = (e, name) => {
    if (!e.members) return 0;
    const target = name.toLowerCase();
    
    if (typeof e.members === 'object' && !Array.isArray(e.members)) {
      const foundKey = Object.keys(e.members).find(k => k.toLowerCase() === target);
      return foundKey ? Number(e.members[foundKey]) : 0;
    }
    
    if (Array.isArray(e.members)) {
      const list = e.members.map(m => m.toLowerCase());
      if (list.includes(target)) {
        return Number(e.share || (e.amount / Math.max(1, list.length)));
      }
    }
    
    return 0;
  };

  // Calculate Global Net Position (using all expenses)
  let globalSpent = 0;
  let globalShare = 0;
  expenses.forEach(e => {
    if (e.payer.toLowerCase() === myHandle) {
      globalSpent += Number(e.amount);
    }
    globalShare += getShare(e, myHandle);
  });
  const globalNet = globalSpent - globalShare;

  // Calculate Squad Wise Balances
  const computeSquadBalances = (squadName) => {
    const squad = squads.find(s => s.name === squadName);
    if (!squad) return { members: [], totalSpent: 0, totalShare: 0 };

    const squadExpenses = expenses.filter(e => e.squad_name === squadName);
    
    let totalSpent = 0;
    let totalShare = 0;

    // Filter members (excluding self)
    const otherMembers = squad.members.filter(m => {
      const name = m.name.split('@')[0].toLowerCase();
      return name !== myHandle;
    });

    const memberBalances = otherMembers.map(m => {
      const name = m.name.split('@')[0].toLowerCase();
      let netRelDebt = 0;

      squadExpenses.forEach(e => {
        const payer = e.payer.toLowerCase();
        
        // Payer is other member, user is member
        if (payer === name && hasMember(e.members, myHandle)) {
          netRelDebt -= getShare(e, myHandle);
        }
        
        // Payer is user, other member is member
        if (payer === myHandle && hasMember(e.members, name)) {
          netRelDebt += getShare(e, name);
        }
      });

      return {
        username: name,
        displayName: m.display_name || name,
        avatarColor: m.avatar_color,
        balance: netRelDebt
      };
    });

    squadExpenses.forEach(e => {
      if (e.payer.toLowerCase() === myHandle) {
        totalSpent += Number(e.amount);
      }
      totalShare += getShare(e, myHandle);
    });

    return {
      members: memberBalances,
      totalSpent,
      totalShare
    };
  };

  // Compute Solo Balances
  const computeSoloBalances = () => {
    const soloExpenses = expenses.filter(e => !e.squad_name);
    
    let totalSpent = 0;
    let totalShare = 0;

    // Extract all unique members from solo expenses
    const soloMemberNames = [...new Set(soloExpenses.flatMap(e => {
      if (Array.isArray(e.members)) return e.members.map(m => m.toLowerCase());
      if (typeof e.members === 'object') return Object.keys(e.members).map(k => k.toLowerCase());
      return [];
    }))].filter(name => name !== myHandle);

    const memberBalances = soloMemberNames.map(name => {
      let netRelDebt = 0;

      soloExpenses.forEach(e => {
        const payer = e.payer.toLowerCase();
        
        if (payer === name && hasMember(e.members, myHandle)) {
          netRelDebt -= getShare(e, myHandle);
        }
        if (payer === myHandle && hasMember(e.members, name)) {
          netRelDebt += getShare(e, name);
        }
      });

      return {
        username: name,
        displayName: name,
        balance: netRelDebt
      };
    });

    soloExpenses.forEach(e => {
      if (e.payer.toLowerCase() === myHandle) {
        totalSpent += Number(e.amount);
      }
      totalShare += getShare(e, myHandle);
    });

    return {
      members: memberBalances.filter(m => Math.abs(m.balance) > 0.01),
      totalSpent,
      totalShare
    };
  };

  const handleSettleClick = (squadName, otherUser, balance) => {
    setModal({
      isOpen: true,
      squadName,
      otherUser,
      amount: Math.abs(balance),
      heOwesMe: balance > 0
    });
  };

  const executeSettlement = async () => {
    const { squadName, otherUser, amount, heOwesMe } = modal;
    
    const body = {
      date: new Date().toISOString().split('T')[0],
      amount: amount,
      payer: heOwesMe ? otherUser : myHandle,
      share: amount,
      where: heOwesMe ? `Received settlement from ${otherUser}` : `Paid settlement to ${otherUser}`,
      category: 'settlement',
      app: 'upi',
      members: [heOwesMe ? myHandle : otherUser],
      squad_name: squadName || null
    };

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Server rejected settlement.');
      
      setModal(prev => ({ ...prev, isOpen: false }));
      fetchData();
    } catch (err) {
      alert('Settlement failed: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const soloBalances = computeSoloBalances();
  const cycleText = cycleStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div className="settlements-view" style={{ padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-color)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="settlements-title" style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, letterSpacing: '-1.5px', background: 'linear-gradient(135deg, var(--text-color) 0%, var(--primary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            TACTICAL SETTLEMENTS
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Operational balances and mutual obligations synchronization
          </p>
        </div>

        {/* Squad Selection Dropdown */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select 
            value={activeSquad || ''}
            onChange={(e) => setActiveSquad(e.target.value || null)}
            style={{
              background: 'var(--card-bg)',
              color: 'var(--text-color)',
              border: '1px solid var(--border-color)',
              padding: '0.6rem 1.2rem',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '0.95rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">Global Overview (All Squads)</option>
            {squads.map(s => (
              <option key={s.id || s.name} value={s.name}>{s.name} Squadron</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '2rem' }}>
          {error}
        </div>
      )}

      <div style={{ 
        background: 'var(--input-bg)', 
        borderLeft: '4px solid var(--text-color)', 
        padding: '1rem 1.25rem', 
        borderRadius: '12px', 
        fontSize: '0.85rem', 
        color: 'var(--text-color)', 
        marginBottom: '2rem', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem' 
      }}>
        <Calendar size={20} style={{ color: 'var(--text-color)', flexShrink: 0 }} />
        <div>
          <strong style={{ display: 'block', color: 'var(--text-color)', fontSize: '1rem' }}>Active Settlement Cycle</strong>
          <span style={{ opacity: 0.85 }}>Balances and entries are automatically aggregated from the billing cycle starting <strong>{cycleText}</strong>.</span>
        </div>
      </div>

      {/* Global overview / Focused view card */}
      {!activeSquad ? (
        <div className="card" style={{
          marginBottom: '2.5rem',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          padding: '2rem',
          boxShadow: 'var(--shadow)',
          borderRadius: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 800, display: 'block', marginBottom: '0.5rem' }}>
                Operational Status Overview
              </span>
              <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-color)' }}>Global Net Position</h2>
            </div>
            <div style={{ 
              background: 'var(--input-bg)', 
              border: '1px solid var(--border-color)',
              color: 'var(--text-color)', 
              padding: '0.55rem 1.1rem', 
              borderRadius: '12px', 
              fontSize: '0.8rem', 
              fontWeight: 800, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem' 
            }}>
              Cycle Start: {cycleText}
            </div>
          </div>

          <div className="settlements-overview-stats" style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>Total Deployment</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹ {globalSpent.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>Total Obligation</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹ {globalShare.toFixed(2)}</span>
            </div>
            <div className="settlements-net-box" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '0.8rem 1.5rem', 
              background: 'var(--input-bg)', 
              borderRadius: '16px', 
              border: '1px solid var(--border-color)'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>Net Settlement Balance</span>
              <span className={globalNet >= 0 ? 'balance-positive' : 'balance-negative'} style={{ fontSize: '1.8rem', fontWeight: 900 }}>
                {globalNet >= 0 ? '+' : ''}₹ {Math.abs(globalNet).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '1.5rem' }}>
          <button 
            onClick={() => setActiveSquad(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-color)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: 0
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Global Overview</span>
          </button>
        </div>
      )}

      {/* Main List of Squads */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* If Active Squad is Selected, Show Focused Squad Detail */}
        {activeSquad ? (
          (() => {
            const { members, totalSpent, totalShare } = computeSquadBalances(activeSquad);
            const activeSquadExpenses = expenses.filter(e => e.squad_name === activeSquad);
            const activeMemberCards = members.filter(m => Math.abs(m.balance) > 0.01);
            
            return (
              <div className="card" style={{ padding: '2rem', border: '2px solid var(--primary)', background: 'var(--card-bg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Shield style={{ color: 'var(--primary)', width: 22 }} />
                    <h3 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '1.1rem', fontWeight: 800 }}>
                      {activeSquad} Squadron
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', marginLeft: 'auto', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem', textTransform: 'uppercase' }}>Squad Spent</span>
                      <b style={{ color: 'var(--text-dim)' }}>₹ {totalSpent.toFixed(2)}</b>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem', textTransform: 'uppercase' }}>My Share</span>
                      <b>₹ {totalShare.toFixed(2)}</b>
                    </div>
                  </div>
                </div>

                <div className="ledger-full" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
                  {activeMemberCards.map(m => {
                    const isOwed = m.balance > 0.01;
                    const isI_Owe = m.balance < -0.01;
                    
                    let actionBtn = null;
                    if (isOwed) {
                      actionBtn = (
                        <button 
                          className="chip btn-collect" 
                          onClick={() => handleSettleClick(activeSquad, m.username, m.balance)}
                          style={{ pointerEvents: 'auto', flexShrink: 0, transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <CheckCircle size={12} /> Received
                        </button>
                      );
                    } else if (isI_Owe) {
                      actionBtn = (
                        <button 
                          className="chip btn-pay" 
                          onClick={() => handleSettleClick(activeSquad, m.username, m.balance)}
                          style={{ pointerEvents: 'auto', flexShrink: 0, transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Send size={12} /> Pay Now
                        </button>
                      );
                    }

                    return (
                      <div 
                        key={m.username} 
                        className={`ledger-item ${isOwed ? 'receivable' : 'payable'}`}
                        style={{ width: '100%', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.9rem', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                          <div className="user-avatar" style={{ width: 35, height: 35, fontSize: '0.8rem', background: m.avatarColor ? `linear-gradient(${m.avatarColor})` : 'var(--card-bg)', flexShrink: 0 }}>
                            {m.displayName[0].toUpperCase()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.displayName}</span>
                            <span className={m.balance >= 0 ? 'balance-positive' : 'balance-negative'} style={{ fontWeight: 800, fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                              {m.balance >= 0 ? '+' : ''}₹ {Math.abs(m.balance).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        {actionBtn}
                      </div>
                    );
                  })}
                  {activeMemberCards.length === 0 && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                      No active balances in this squadron.
                    </div>
                  )}
                </div>

                {/* Archive for this squad */}
                <div style={{ marginTop: '1rem', borderTop: '1px dotted rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <History size={14} /> Tactical Split Archive
                  </h4>
                  <div className="table-wrapper no-card-layout" style={{ maxHeight: '300px', overflowY: 'auto', overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)', marginTop: 0 }}>
                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Where Spent</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Payer</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Amount</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSquadExpenses.map(e => (
                          <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{e.where_spent}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>{e.payer}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>₹ {Number(e.amount).toFixed(2)}</td>
                            <td style={{ padding: '0.75rem 1rem' }}><span style={{ textTransform: 'uppercase', fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: e.category === 'settlement' ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)', color: e.category === 'settlement' ? '#34d399' : 'inherit', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6 }}>{e.category}</span></td>
                          </tr>
                        ))}
                        {activeSquadExpenses.length === 0 && (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No squad-wise split data discovered.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          /* Global Overview: Show all squads' balances */
          <>
            {squads.map(s => {
              const { members, totalSpent, totalShare } = computeSquadBalances(s.name);
              const activeMemberCards = members.filter(m => Math.abs(m.balance) > 0.01);
              
              if (activeMemberCards.length === 0) return null; // Hide squads with no balances

              return (
                <div key={s.name} className="card" style={{ padding: '1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Users style={{ color: 'var(--primary)', width: 18 }} />
                      <h3 style={{ margin: 0, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--primary)', fontWeight: 800 }}>
                        {s.name} Balances
                      </h3>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1.2rem', marginLeft: 'auto', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.55rem', textTransform: 'uppercase' }}>Volume</span>
                        <b style={{ color: 'var(--text-dim)' }}>₹ {totalSpent.toFixed(2)}</b>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.55rem', textTransform: 'uppercase' }}>Obligation</span>
                        <b>₹ {totalShare.toFixed(2)}</b>
                      </div>
                      <button 
                        onClick={() => setActiveSquad(s.name)}
                        style={{
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-color)',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}
                      >
                        Details <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="ledger-full" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {activeMemberCards.map(m => {
                      const isOwed = m.balance > 0.01;
                      const isI_Owe = m.balance < -0.01;
                      
                      let actionBtn = null;
                      if (isOwed) {
                        actionBtn = (
                          <button 
                            className="chip btn-collect" 
                            onClick={() => handleSettleClick(s.name, m.username, m.balance)}
                            style={{ pointerEvents: 'auto', flexShrink: 0, transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <CheckCircle size={12} /> Received
                          </button>
                        );
                      } else if (isI_Owe) {
                        actionBtn = (
                          <button 
                            className="chip btn-pay" 
                            onClick={() => handleSettleClick(s.name, m.username, m.balance)}
                            style={{ pointerEvents: 'auto', flexShrink: 0, transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <Send size={12} /> Pay Now
                          </button>
                        );
                      }

                      return (
                        <div 
                          key={m.username} 
                          className={`ledger-item ${isOwed ? 'receivable' : 'payable'}`}
                          style={{ width: '100%', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.9rem', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                            <div className="user-avatar" style={{ width: 35, height: 35, fontSize: '0.8rem', background: m.avatarColor ? `linear-gradient(${m.avatarColor})` : 'var(--card-bg)', flexShrink: 0 }}>
                              {m.displayName[0].toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <span style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.displayName}</span>
                              <span className={m.balance >= 0 ? 'balance-positive' : 'balance-negative'} style={{ fontWeight: 800, fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                                {m.balance >= 0 ? '+' : ''}₹ {Math.abs(m.balance).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {actionBtn}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Direct / Solo Balances (Outside any Squad) */}
            {soloBalances.members.length > 0 && (
              <div className="card" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Activity style={{ color: 'var(--text-color)', width: 18 }} />
                    <h3 style={{ margin: 0, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-color)', fontWeight: 800 }}>
                      Direct / Solo Balances
                    </h3>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1.2rem', marginLeft: 'auto', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.55rem', textTransform: 'uppercase' }}>Volume</span>
                      <b style={{ color: 'var(--text-dim)' }}>₹ {soloBalances.totalSpent.toFixed(2)}</b>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.55rem', textTransform: 'uppercase' }}>Obligation</span>
                      <b>₹ {soloBalances.totalShare.toFixed(2)}</b>
                    </div>
                  </div>
                </div>

                <div className="ledger-full" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {soloBalances.members.map(m => {
                    const isOwed = m.balance > 0.01;
                    const isI_Owe = m.balance < -0.01;
                    
                    let actionBtn = null;
                    if (isOwed) {
                      actionBtn = (
                        <button 
                          className="chip btn-collect" 
                          onClick={() => handleSettleClick('', m.username, m.balance)}
                          style={{ pointerEvents: 'auto', flexShrink: 0, transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <CheckCircle size={12} /> Received
                        </button>
                      );
                    } else if (isI_Owe) {
                      actionBtn = (
                        <button 
                          className="chip btn-pay" 
                          onClick={() => handleSettleClick('', m.username, m.balance)}
                          style={{ pointerEvents: 'auto', flexShrink: 0, transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Send size={12} /> Pay Now
                        </button>
                      );
                    }

                    return (
                      <div 
                        key={m.username} 
                        className={`ledger-item ${isOwed ? 'receivable' : 'payable'}`}
                        style={{ width: '100%', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.9rem', background: 'rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                          <div className="user-avatar" style={{ width: 35, height: 35, fontSize: '0.8rem', background: 'var(--card-bg)', flexShrink: 0 }}>
                            {m.displayName[0].toUpperCase()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.displayName}</span>
                            <span className={m.balance >= 0 ? 'balance-positive' : 'balance-negative'} style={{ fontWeight: 800, fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                              {m.balance >= 0 ? '+' : ''}₹ {Math.abs(m.balance).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        {actionBtn}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {squads.every(s => computeSquadBalances(s.name).members.filter(m => Math.abs(m.balance) > 0.01).length === 0) && soloBalances.members.length === 0 && (
              <div className="card" style={{ textLeft: 'center', padding: '4rem 2rem', opacity: 0.6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '3rem' }}>🕊️</span>
                <strong style={{ fontSize: '1.1rem' }}>Global Settlement Achieved</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>All operational obligations and balances are fully synced.</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      {modal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.75)'
        }}>
          <div className="card animate-slide-in" style={{
            width: '100%',
            maxWidth: '440px',
            padding: '2rem',
            background: 'rgba(23, 21, 48, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            textAlign: 'center'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', textTransform: 'uppercase', color: modal.heOwesMe ? '#10b981' : '#f59e0b' }}>
              {modal.heOwesMe ? 'Collect Settlement' : 'Record Settlement'}
            </h3>
            
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Confirm settlement of <strong>₹ {modal.amount.toFixed(2)}</strong> {modal.heOwesMe ? `received from ${modal.otherUser}` : `paid to ${modal.otherUser}`}.
            </p>

            <div className="flex-row-mobile-stack" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={executeSettlement}
                className="btn-primary" 
                style={{ 
                  flex: 1, 
                  padding: '0.8rem', 
                  borderRadius: '12px', 
                  fontWeight: 700, 
                  background: modal.heOwesMe ? '#10b981' : 'var(--primary)' 
                }}
              >
                {modal.heOwesMe ? '✓ Mark Received' : '✓ Mark Paid'}
              </button>
              <button 
                onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}
                className="btn-glass" 
                style={{ 
                  flex: 1, 
                  padding: '0.8rem', 
                  borderRadius: '12px', 
                  fontWeight: 700, 
                  border: '1px solid var(--border-color)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-color)'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settlements;
