import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModalPortal from '../components/ModalPortal';
import { getExpensesData, getCachedExpensesData, invalidateExpensesCache } from '../utils/dataCache';
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
  Activity,
  CheckSquare,
  Square,
  Info
} from 'lucide-react';

export const Settlements = () => {
  const { user, token } = useAuth();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  // Instant state restoration from cache
  const initialCache = getCachedExpensesData();
  const [expenses, setExpenses] = useState(() => initialCache?.expenses || []);
  const [squads, setSquads] = useState(() => initialCache?.squads || []);
  const [systemUsers, setSystemUsers] = useState(() => initialCache?.users || []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [error, setError] = useState(null);

  // Month filter – default to current month
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  });

  // Build last-24-months option list
  const monthOptions = [];
  (() => {
    const today = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      monthOptions.push({ value: `${yyyy}-${mm}`, label });
    }
  })();

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

  // Batch Settle Modal state
  const [batchModal, setBatchModal] = useState({
    isOpen: false,
    items: [],
    selected: {}
  });
  const [batchLoading, setBatchLoading] = useState(false);

  const [detailsModal, setDetailsModal] = useState({
    isOpen: false,
    squadName: null,
    username: '',
    displayName: '',
    balance: 0,
    expenses: []
  });

  const myHandle = user?.username ? user.username.split('@')[0].toLowerCase() : '';

  const handleDetailsClick = (squadName, username, displayName, balance) => {
    const contextExpenses = squadName 
      ? monthlyExpenses.filter(e => e.squad_name === squadName)
      : monthlyExpenses.filter(e => !e.squad_name);
      
    const relevantExpenses = contextExpenses.filter(e => {
      const payer = e.payer.toLowerCase();
      if (payer === username && hasMember(e.members, myHandle)) return true;
      if (payer === myHandle && hasMember(e.members, username)) return true;
      return false;
    });

    setDetailsModal({
      isOpen: true,
      squadName,
      username,
      displayName,
      balance,
      expenses: relevantExpenses
    });
  };

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

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      if (!getCachedExpensesData()) {
        setLoading(true);
      }
      const data = await getExpensesData(authHeaders, forceRefresh);
      setExpenses(data.expenses || []);
      setSquads(data.squads || []);
      setSystemUsers(data.users || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, fetchData]);

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

  // Expenses filtered to the selected month
  const monthlyExpenses = expenses.filter(e => e.date.substring(0, 7) === selectedMonth);

  // Calculate Global Net Position (using monthly expenses only)
  let globalSpent = 0;
  let globalShare = 0;
  monthlyExpenses.forEach(e => {
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

    const squadExpenses = monthlyExpenses.filter(e => e.squad_name === squadName);
    
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
    const soloExpenses = monthlyExpenses.filter(e => !e.squad_name);
    
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

      const matchedUser = systemUsers.find(u => u.username === name) || {};
      return {
        username: name,
        displayName: matchedUser.display_name || name,
        avatarColor: matchedUser.avatar_color,
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
      invalidateExpensesCache();
      fetchData(true);
    } catch (err) {
      alert('Settlement failed: ' + err.message);
    }
  };

  // Collect all outstanding balances for the batch modal
  const openBatchSettle = () => {
    const allItems = [];

    // Squad balances
    squads.forEach(s => {
      const { members } = computeSquadBalances(s.name);
      members.filter(m => Math.abs(m.balance) > 0.01).forEach(m => {
        allItems.push({
          key: `${s.name}::${m.username}`,
          squadName: s.name,
          username: m.username,
          displayName: m.displayName,
          balance: m.balance,
          avatarColor: m.avatarColor
        });
      });
    });

    // Solo balances
    const solo = computeSoloBalances();
    solo.members.forEach(m => {
      allItems.push({
        key: `solo::${m.username}`,
        squadName: null,
        username: m.username,
        displayName: m.displayName,
        balance: m.balance,
        avatarColor: m.avatarColor
      });
    });

    if (allItems.length === 0) {
      alert('No outstanding balances to settle in this month.');
      return;
    }

    // Pre-select all
    const selected = {};
    allItems.forEach(item => { selected[item.key] = true; });
    setBatchModal({ isOpen: true, items: allItems, selected });
  };

  const executeBatchSettle = async () => {
    const { items, selected } = batchModal;
    const toSettle = items.filter(item => selected[item.key]);
    if (toSettle.length === 0) {
      alert('Select at least one balance to settle.');
      return;
    }
    setBatchLoading(true);
    try {
      for (const item of toSettle) {
        const { squadName, username, balance } = item;
        const heOwesMe = balance > 0;
        const body = {
          date: new Date().toISOString().split('T')[0],
          amount: Math.abs(balance),
          payer: heOwesMe ? username : myHandle,
          share: Math.abs(balance),
          where: heOwesMe ? `Received settlement from ${username}` : `Paid settlement to ${username}`,
          category: 'settlement',
          app: 'upi',
          members: [heOwesMe ? myHandle : username],
          squad_name: squadName || null
        };
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Settlement failed.');
      }
      setBatchModal({ isOpen: false, items: [], selected: {} });
      invalidateExpensesCache();
      fetchData(true);
    } catch (err) {
      alert('Batch settlement failed: ' + err.message);
    } finally {
      setBatchLoading(false);
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

        {/* Month + Squad Selection + Batch Settle */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Month Picker */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
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
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Squad Selection Dropdown */}
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

          {/* Settlement Details Log Link */}
          <Link
            to="/settlement-details"
            className="btn-glass"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.95rem',
              textDecoration: 'none'
            }}
          >
            <History size={16} />
            Settlement Logs
          </Link>

          {/* Batch Settle Button */}
          <button
            onClick={openBatchSettle}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              border: '1px solid var(--primary)',
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              color: '#fff',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
            }}
          >
            <CheckSquare size={16} />
            Settle Selected
          </button>
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
        <div className="settlement-hero">
          <div style={{ zIndex: 1, position: 'relative' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 800, display: 'block', marginBottom: '0.75rem' }}>
              Operational Status Overview
            </span>
            <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-1px' }}>Global Net Position</h2>
            <div style={{ 
              marginTop: '1rem',
              display: 'inline-flex',
              background: 'rgba(255,255,255,0.1)', 
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', 
              padding: '0.5rem 1rem', 
              borderRadius: '20px', 
              fontSize: '0.85rem', 
              fontWeight: 700, 
              alignItems: 'center', 
              gap: '0.5rem' 
            }}>
              <Calendar size={14} /> Cycle Start: {cycleText}
            </div>
          </div>

          <div className="settlements-overview-stats" style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap', alignItems: 'center', zIndex: 1, position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>Total Deployment</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>₹ {globalSpent.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.4rem' }}>Total Obligation</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>₹ {globalShare.toFixed(2)}</span>
            </div>
            <div className="settlements-net-box" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '1.25rem 2rem', 
              background: 'rgba(0,0,0,0.4)', 
              borderRadius: '24px', 
              border: `1px solid ${globalNet >= 0 ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              boxShadow: globalNet >= 0 ? '0 0 30px rgba(34, 197, 94, 0.15)' : '0 0 30px rgba(239, 68, 68, 0.15)'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Net Balance</span>
              <span className={globalNet >= 0 ? 'balance-positive' : 'balance-negative'} style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 }}>
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
            const activeSquadExpenses = monthlyExpenses.filter(e => e.squad_name === activeSquad);
            const activeMemberCards = members.filter(m => Math.abs(m.balance) > 0.01);
            
            return (
              <div className="settlement-squad-card" style={{ border: '2px solid var(--primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Shield style={{ color: 'var(--primary)', width: 22 }} />
                    <h3 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-color)' }}>
                      {activeSquad}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '2rem', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Volume</span>
                      <b style={{ color: 'var(--text-color)', fontSize: '1rem' }}>₹ {totalSpent.toFixed(2)}</b>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Obligation</span>
                      <b style={{ color: 'var(--text-color)', fontSize: '1rem' }}>₹ {totalShare.toFixed(2)}</b>
                    </div>
                  </div>
                </div>

                <div className="ledger-full" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
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
                          <div 
                            className="user-avatar" 
                            style={{ 
                              width: 38, 
                              height: 38, 
                              fontSize: '0.9rem', 
                              fontWeight: 800,
                              color: '#ffffff',
                              background: m.avatarColor ? `linear-gradient(${m.avatarColor})` : 'linear-gradient(135deg, var(--primary), var(--secondary))', 
                              flexShrink: 0,
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {m.displayName[0].toUpperCase()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.displayName}</span>
                            <span className={m.balance >= 0 ? 'balance-positive' : 'balance-negative'} style={{ fontWeight: 800, fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                              {m.balance >= 0 ? '+' : ''}₹ {Math.abs(m.balance).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button 
                            className="chip btn-glass"
                            onClick={() => handleDetailsClick(activeSquad, m.username, m.displayName, m.balance)}
                            style={{ pointerEvents: 'auto', flexShrink: 0, transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.6rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-color)', borderRadius: '20px' }}
                          >
                            <Info size={12} />
                          </button>
                          {actionBtn}
                        </div>
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
          <>
            <div className="settlement-grid">
              {squads.map(s => {
                const { members, totalSpent, totalShare } = computeSquadBalances(s.name);
                const activeMemberCards = members.filter(m => Math.abs(m.balance) > 0.01);
                
                if (activeMemberCards.length === 0) return null; // Hide squads with no balances

                return (
                  <div key={s.name} className="settlement-squad-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Users style={{ color: 'var(--primary)', width: 22 }} />
                        <h3 style={{ margin: 0, fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-color)', fontWeight: 900 }}>
                          {s.name}
                        </h3>
                      </div>
                      
                      <button 
                        onClick={() => setActiveSquad(s.name)}
                        style={{
                          background: 'var(--input-bg)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-color)',
                          padding: '0.4rem 1rem',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          transition: 'all 0.3s ease'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-color)'; }}
                      >
                        Enter Squad <ChevronRight size={14} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '2rem', fontSize: '0.8rem', padding: '0.5rem 0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Volume</span>
                        <b style={{ color: 'var(--text-color)', fontSize: '1rem' }}>₹ {totalSpent.toFixed(2)}</b>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Obligation</span>
                        <b style={{ color: 'var(--text-color)', fontSize: '1rem' }}>₹ {totalShare.toFixed(2)}</b>
                      </div>
                    </div>

                    <div className="ledger-full" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                            style={{ width: '100%', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.9rem', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                              <div 
                                className="user-avatar" 
                                style={{ 
                                  width: 38, 
                                  height: 38, 
                                  fontSize: '0.9rem', 
                                  fontWeight: 800,
                                  color: '#ffffff',
                                  background: m.avatarColor ? `linear-gradient(${m.avatarColor})` : 'linear-gradient(135deg, var(--primary), var(--secondary))', 
                                  flexShrink: 0,
                                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                {m.displayName[0].toUpperCase()}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.displayName}</span>
                                <span className={m.balance >= 0 ? 'balance-positive' : 'balance-negative'} style={{ fontWeight: 800, fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                                  {m.balance >= 0 ? '+' : ''}₹ {Math.abs(m.balance).toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <button 
                                className="chip btn-glass"
                                onClick={() => handleDetailsClick(s.name, m.username, m.displayName, m.balance)}
                                style={{ pointerEvents: 'auto', flexShrink: 0, transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.6rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-color)', borderRadius: '20px' }}
                              >
                                <Info size={12} />
                              </button>
                              {actionBtn}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Direct / Solo Balances (Outside any Squad) */}
            {soloBalances.members.length > 0 && (
              <div className="settlement-squad-card" style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(0,0,0,0.1)' }}>
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
                <div className="ledger-full" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                        style={{ width: '100%', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.9rem', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                          <div 
                            className="user-avatar" 
                            style={{ 
                              width: 38, 
                              height: 38, 
                              fontSize: '0.9rem', 
                              fontWeight: 800,
                              color: '#ffffff',
                              background: m.avatarColor ? `linear-gradient(${m.avatarColor})` : 'linear-gradient(135deg, var(--primary), var(--secondary))', 
                              flexShrink: 0,
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {m.displayName[0].toUpperCase()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.displayName}</span>
                            <span className={m.balance >= 0 ? 'balance-positive' : 'balance-negative'} style={{ fontWeight: 800, fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                              {m.balance >= 0 ? '+' : ''}₹ {Math.abs(m.balance).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button 
                            className="chip btn-glass"
                            onClick={() => handleDetailsClick('', m.username, m.displayName, m.balance)}
                            style={{ pointerEvents: 'auto', flexShrink: 0, transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.6rem', fontSize: '0.75rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-color)', borderRadius: '20px' }}
                          >
                            <Info size={12} />
                          </button>
                          {actionBtn}
                        </div>
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
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '440px' }}>
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
        </ModalPortal>
      )}

      {/* Batch Settle Modal */}
      {batchModal.isOpen && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => !batchLoading && setBatchModal(prev => ({ ...prev, isOpen: false }))}>
            <div
              className="modal-content"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '520px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            >
              {/* Modal Header */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckSquare size={20} style={{ color: 'var(--primary)' }} />
                  Settle Selected Balances
                </h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                  Choose which balances to settle for <strong>{selectedMonth}</strong>. Each selected item will be recorded as a settlement.
                </p>
              </div>

              {/* Select All / Deselect All */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <button
                  onClick={() => {
                    const all = {};
                    batchModal.items.forEach(i => { all[i.key] = true; });
                    setBatchModal(prev => ({ ...prev, selected: all }));
                  }}
                  style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.3rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)', cursor: 'pointer' }}
                >
                  Select All
                </button>
                <button
                  onClick={() => setBatchModal(prev => ({ ...prev, selected: {} }))}
                  style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.3rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)', cursor: 'pointer' }}
                >
                  Deselect All
                </button>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-dim)', alignSelf: 'center' }}>
                  {Object.values(batchModal.selected).filter(Boolean).length} / {batchModal.items.length} selected
                </span>
              </div>

              {/* Balance List */}
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '0.25rem' }}>
                {batchModal.items.map(item => {
                  const isChecked = !!batchModal.selected[item.key];
                  const isOwed = item.balance > 0;
                  return (
                    <div
                      key={item.key}
                      onClick={() => setBatchModal(prev => ({
                        ...prev,
                        selected: { ...prev.selected, [item.key]: !prev.selected[item.key] }
                      }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.8rem 1rem',
                        borderRadius: '12px',
                        border: `1px solid ${isChecked ? (isOwed ? '#10b98140' : '#f59e0b40') : 'var(--border-color)'}`,
                        background: isChecked ? (isOwed ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)') : 'var(--input-bg)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        userSelect: 'none'
                      }}
                    >
                      {/* Checkbox icon */}
                      <div style={{ flexShrink: 0, color: isChecked ? (isOwed ? '#10b981' : '#f59e0b') : 'var(--text-dim)' }}>
                        {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>

                      {/* Avatar */}
                      <div
                        style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: item.avatarColor ? `linear-gradient(${item.avatarColor})` : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: '0.85rem', color: '#fff'
                        }}
                      >
                        {item.displayName[0].toUpperCase()}
                      </div>

                      {/* Name + context */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.displayName}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                          {item.squadName ? `${item.squadName} Squadron` : 'Direct / Solo'}
                        </div>
                      </div>

                      {/* Amount + direction */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                        <span
                          style={{
                            fontWeight: 800, fontSize: '1rem',
                            color: isOwed ? '#10b981' : '#f59e0b'
                          }}
                        >
                          {isOwed ? '+' : '-'}₹{Math.abs(item.balance).toFixed(2)}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                          {isOwed ? 'they owe you' : 'you owe them'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total + Actions */}
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Total Settlement Amount</span>
                  <span style={{ fontWeight: 900, fontSize: '1.1rem' }}>
                    ₹{batchModal.items
                      .filter(i => batchModal.selected[i.key])
                      .reduce((sum, i) => sum + Math.abs(i.balance), 0)
                      .toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setBatchModal(prev => ({ ...prev, isOpen: false }))}
                    disabled={batchLoading}
                    className="btn-glass"
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', fontWeight: 700, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-color)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeBatchSettle}
                    disabled={batchLoading || Object.values(batchModal.selected).filter(Boolean).length === 0}
                    className="btn-primary"
                    style={{
                      flex: 2, padding: '0.75rem', borderRadius: '12px', fontWeight: 700,
                      background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                      color: '#fff', cursor: 'pointer', opacity: batchLoading ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                    }}
                  >
                    {batchLoading ? (
                      <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Processing...</>
                    ) : (
                      <><CheckSquare size={16} /> Confirm & Settle</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Details Modal */}
      {detailsModal.isOpen && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setDetailsModal(prev => ({ ...prev, isOpen: false }))}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Info size={20} style={{ color: 'var(--primary)' }} />
                    Settlement Details
                  </h3>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: 0 }}>
                    Balance with <strong>{detailsModal.displayName}</strong> {detailsModal.squadName ? `in ${detailsModal.squadName} Squadron` : 'in Direct / Solo'}
                  </p>
                </div>
                <button 
                  onClick={() => setDetailsModal(prev => ({ ...prev, isOpen: false }))}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                {detailsModal.expenses.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {detailsModal.expenses.map(e => {
                      const isIPaid = e.payer.toLowerCase() === myHandle;
                      const otherUserShare = isIPaid ? getShare(e, detailsModal.username) : getShare(e, myHandle);
                      if (otherUserShare === 0) return null;
                      
                      return (
                        <div key={e.id} style={{ 
                          padding: '1rem', 
                          borderRadius: '12px', 
                          border: '1px solid var(--border-color)', 
                          background: 'var(--input-bg)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem'
                        }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--primary)' }}>{e.category}</span>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {e.where_spent}
                            </div>
                          </div>
                          
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '0.2rem', textTransform: 'uppercase' }}>
                              {isIPaid ? 'They Owe You' : 'You Owe Them'}
                            </div>
                            <div style={{ 
                              fontWeight: 900, 
                              fontSize: '1.1rem',
                              color: isIPaid ? '#10b981' : '#f59e0b' 
                            }}>
                              {isIPaid ? '+' : '-'}₹{otherUserShare.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', opacity: 0.5 }}>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>No individual transactions found for this balance.</p>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem', fontWeight: 600 }}>Net Balance</span>
                <span style={{ 
                  fontWeight: 900, 
                  fontSize: '1.4rem',
                  color: detailsModal.balance > 0 ? '#10b981' : (detailsModal.balance < 0 ? '#f59e0b' : 'var(--text-color)')
                }}>
                  {detailsModal.balance > 0 ? '+' : ''}₹{Math.abs(detailsModal.balance).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default Settlements;
