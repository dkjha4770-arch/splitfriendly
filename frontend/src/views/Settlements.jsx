import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModalPortal from '../components/ModalPortal';
import { getExpensesData, getCachedExpensesData, invalidateExpensesCache } from '../utils/dataCache';
import './Settlements.css';
import { 
  Calendar, 
  DollarSign, 
  Users, 
  CheckCircle, 
  Send, 
  ArrowLeft, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown,
  History, 
  Shield, 
  Activity, 
  CheckSquare, 
  Square, 
  Info,
  Search,
  CheckCircle2,
  Wallet,
  Sparkles
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

  // Search & Direction Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState('ALL'); // 'ALL' | 'RECEIVABLE' | 'PAYABLE'

  // Build last-24-months option list
  const monthOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      options.push({ value: `${yyyy}-${mm}`, label });
    }
    return options;
  }, []);

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

  // Helper: format squad name cleanly without duplicate "Squadron"
  const formatSquadName = (name) => {
    if (!name) return '';
    return /squad(ron)?$/i.test(name.trim()) ? name : `${name} Squadron`;
  };

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
  const monthlyExpenses = useMemo(() => {
    return expenses.filter(e => e.date && e.date.substring(0, 7) === selectedMonth);
  }, [expenses, selectedMonth]);

  const handleDetailsClick = (squadName, username, displayName, balance) => {
    const contextExpenses = squadName 
      ? monthlyExpenses.filter(e => e.squad_name === squadName)
      : monthlyExpenses.filter(e => !e.squad_name);
      
    const relevantExpenses = contextExpenses.filter(e => {
      const payer = (e.payer || '').toLowerCase();
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

  // Calculate Global Net Position (using monthly expenses only)
  let globalSpent = 0;
  let globalShare = 0;
  monthlyExpenses.forEach(e => {
    if (e.payer && e.payer.toLowerCase() === myHandle) {
      globalSpent += Number(e.amount);
    }
    globalShare += getShare(e, myHandle);
  });
  const globalNet = globalSpent - globalShare;

  // Calculate Squad Wise Balances
  const computeSquadBalances = useCallback((squadName) => {
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
        const payer = (e.payer || '').toLowerCase();
        
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
      if ((e.payer || '').toLowerCase() === myHandle) {
        totalSpent += Number(e.amount);
      }
      totalShare += getShare(e, myHandle);
    });

    return {
      members: memberBalances,
      totalSpent,
      totalShare
    };
  }, [squads, monthlyExpenses, myHandle]);

  // Compute Solo Balances
  const computeSoloBalances = useCallback(() => {
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
        const payer = (e.payer || '').toLowerCase();
        
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
      if ((e.payer || '').toLowerCase() === myHandle) {
        totalSpent += Number(e.amount);
      }
      totalShare += getShare(e, myHandle);
    });

    return {
      members: memberBalances.filter(m => Math.abs(m.balance) > 0.01),
      totalSpent,
      totalShare
    };
  }, [monthlyExpenses, myHandle, systemUsers]);

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

  // Count total pending balances
  const allPendingBalancesCount = useMemo(() => {
    let count = 0;
    squads.forEach(s => {
      const { members } = computeSquadBalances(s.name);
      count += members.filter(m => Math.abs(m.balance) > 0.01).length;
    });
    const solo = computeSoloBalances();
    count += solo.members.length;
    return count;
  }, [squads, computeSquadBalances, computeSoloBalances]);

  // Filter members by search and direction
  const filterMemberList = (membersList) => {
    return membersList.filter(m => {
      if (Math.abs(m.balance) <= 0.01) return false;

      // Direction Filter
      if (directionFilter === 'RECEIVABLE' && m.balance <= 0.01) return false;
      if (directionFilter === 'PAYABLE' && m.balance >= -0.01) return false;

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = m.displayName.toLowerCase().includes(q);
        const handleMatch = m.username.toLowerCase().includes(q);
        if (!nameMatch && !handleMatch) return false;
      }

      return true;
    });
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
    <div className="settlements-container">
      
      {/* Executive Header Section */}
      <header className="settlements-header">
        <div className="settlements-title-area">
          <div className="settlements-title-badge-row">
            <h1>
              <DollarSign size={30} style={{ color: 'var(--primary)' }} />
              Settlement Operations
            </h1>
            <span className="settlements-status-pill">
              <span className="settlements-status-dot"></span>
              RECONCILED ENGINE
            </span>
          </div>
          <p className="settlements-subtitle">
            Bilateral balances, mutual obligations synchronization & instant batch settlements
          </p>
        </div>

        {/* Header Controls */}
        <div className="settlements-header-actions">
          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="settlements-select"
            aria-label="Select billing month"
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* Squad Filter Dropdown */}
          <select 
            value={activeSquad || ''}
            onChange={(e) => setActiveSquad(e.target.value || null)}
            className="settlements-select"
            aria-label="Select squadron focus"
          >
            <option value="">Global Overview (All Squads)</option>
            {squads.map(s => (
              <option key={s.id || s.name} value={s.name}>{formatSquadName(s.name)}</option>
            ))}
          </select>

          {/* Settlement Logs Link */}
          <Link
            to="/settlement-details"
            className="btn-settlements-glass"
          >
            <History size={16} />
            Settlement Logs
          </Link>

          {/* Batch Settle Action */}
          <button
            onClick={openBatchSettle}
            className="btn-settle-batch"
            disabled={allPendingBalancesCount === 0}
          >
            <CheckSquare size={16} />
            <span>Settle Selected</span>
            {allPendingBalancesCount > 0 && (
              <span className="settle-count-badge">{allPendingBalancesCount}</span>
            )}
          </button>
        </div>
      </header>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Cycle Banner */}
      <div className="settlements-cycle-banner">
        <div className="settlements-cycle-info">
          <div className="settlements-cycle-icon-wrap">
            <Calendar size={20} />
          </div>
          <div className="settlements-cycle-text">
            <span className="settlements-cycle-title">Active Accounting Cycle</span>
            <span className="settlements-cycle-desc">
              Operational expenses and split shares are automatically reconciled from <strong>{cycleText}</strong>.
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
            Pending Obligations:
          </span>
          <span style={{ 
            fontSize: '0.85rem', 
            fontWeight: 800, 
            padding: '0.2rem 0.65rem', 
            borderRadius: '9999px',
            background: allPendingBalancesCount > 0 ? 'rgba(var(--primary-rgb, 79, 70, 229), 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: allPendingBalancesCount > 0 ? 'var(--primary)' : '#10b981'
          }}>
            {allPendingBalancesCount} Unsettled
          </span>
        </div>
      </div>

      {/* Metric Cards Grid (Matching Expense Ledger) */}
      <section className="settlements-metrics-grid">
        {/* Total Deployed */}
        <div className="settlements-metric-card">
          <div className="settlements-metric-header">
            <span className="settlements-metric-label">Total Outflow (Paid)</span>
            <div className="settlements-metric-icon-wrap icon-wrap-cyan">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="settlements-metric-value-wrap">
            <span className="settlements-metric-value">₹ {globalSpent.toFixed(2)}</span>
            <span className="settlements-metric-subtext">Total capital you spent this month</span>
          </div>
        </div>

        {/* Total Obligation */}
        <div className="settlements-metric-card">
          <div className="settlements-metric-header">
            <span className="settlements-metric-label">Total Consumption (Share)</span>
            <div className="settlements-metric-icon-wrap icon-wrap-amber">
              <Users size={18} />
            </div>
          </div>
          <div className="settlements-metric-value-wrap">
            <span className="settlements-metric-value">₹ {globalShare.toFixed(2)}</span>
            <span className="settlements-metric-subtext">Your computed share of all expenses</span>
          </div>
        </div>

        {/* Net Balance */}
        <div className="settlements-metric-card">
          <div className="settlements-metric-header">
            <span className="settlements-metric-label">Net Balance Position</span>
            <div className={`settlements-metric-icon-wrap ${globalNet >= 0 ? 'icon-wrap-emerald' : 'icon-wrap-rose'}`}>
              {globalNet >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            </div>
          </div>
          <div className="settlements-metric-value-wrap">
            <span className={`settlements-metric-value ${globalNet >= 0 ? 'positive' : 'negative'}`}>
              {globalNet >= 0 ? '+' : '-'}₹ {Math.abs(globalNet).toFixed(2)}
            </span>
            <span className="settlements-metric-subtext">
              {globalNet >= 0 ? '🎉 Overall you are owed money' : '⚠️ Overall you owe money'}
            </span>
          </div>
        </div>

        {/* Active Squads Status */}
        <div className="settlements-metric-card">
          <div className="settlements-metric-header">
            <span className="settlements-metric-label">Squad Synchronizations</span>
            <div className="settlements-metric-icon-wrap icon-wrap-primary">
              <Shield size={18} />
            </div>
          </div>
          <div className="settlements-metric-value-wrap">
            <span className="settlements-metric-value">{squads.length} Active</span>
            <span className="settlements-metric-subtext">
              {activeSquad ? `Focused on ${activeSquad}` : 'Aggregating across all squadrons'}
            </span>
          </div>
        </div>
      </section>

      {/* Filter & Control Bar */}
      <div className="settlements-control-bar">
        {/* Search */}
        <div className="settlements-search-box">
          <Search size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            type="text"
            className="settlements-search-input"
            placeholder="Search member by name or handle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Direction Tabs */}
        <div className="settlements-tabs">
          <button
            onClick={() => setDirectionFilter('ALL')}
            className={`settlements-tab-btn ${directionFilter === 'ALL' ? 'active' : ''}`}
          >
            All Balances
          </button>
          <button
            onClick={() => setDirectionFilter('RECEIVABLE')}
            className={`settlements-tab-btn ${directionFilter === 'RECEIVABLE' ? 'active' : ''}`}
          >
            Owed to You
          </button>
          <button
            onClick={() => setDirectionFilter('PAYABLE')}
            className={`settlements-tab-btn ${directionFilter === 'PAYABLE' ? 'active' : ''}`}
          >
            You Owe
          </button>
        </div>
      </div>

      {/* Main Content: Focused View or Global Squad Grid */}
      {activeSquad ? (
        (() => {
          const { members, totalSpent, totalShare } = computeSquadBalances(activeSquad);
          const activeSquadExpenses = monthlyExpenses.filter(e => e.squad_name === activeSquad);
          const visibleMembers = filterMemberList(members);

          return (
            <div className="settlements-focused-hero">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <button
                  onClick={() => setActiveSquad(null)}
                  className="btn-back-breadcrumb"
                >
                  <ArrowLeft size={16} />
                  <span>Back to Global Overview</span>
                </button>

                <div className="settlements-squad-stats">
                  <div className="settlements-stat-item">
                    <span className="settlements-stat-label">Squad Deployment</span>
                    <span className="settlements-stat-val">₹ {totalSpent.toFixed(2)}</span>
                  </div>
                  <div className="settlements-stat-item">
                    <span className="settlements-stat-label">Squad Obligation</span>
                    <span className="settlements-stat-val">₹ {totalShare.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div className="settlements-squad-avatar">
                  <Shield size={22} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                    {formatSquadName(activeSquad)} Ledger
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                    Focused bilateral mutual obligations for {activeSquad}
                  </p>
                </div>
              </div>

              {/* Members Bilateral Cards Grid */}
              <div className="settlements-members-grid">
                {visibleMembers.map(m => {
                  const isOwed = m.balance > 0.01;
                  return (
                    <div 
                      key={m.username} 
                      className={`settlement-member-card ${isOwed ? 'receivable' : 'payable'}`}
                    >
                      <div className="settlement-member-top">
                        <div className="settlement-member-user">
                          <div 
                            className="settlement-user-avatar"
                            style={{ 
                              background: m.avatarColor 
                                ? `linear-gradient(${m.avatarColor})` 
                                : 'linear-gradient(135deg, var(--primary), #6366f1)' 
                            }}
                          >
                            {m.displayName[0].toUpperCase()}
                          </div>
                          <div className="settlement-user-meta">
                            <span className="settlement-user-name">{m.displayName}</span>
                            <span className="settlement-user-handle">@{m.username}</span>
                          </div>
                        </div>

                        <span className={`settlement-direction-badge ${isOwed ? 'badge-owes-you' : 'badge-you-owe'}`}>
                          {isOwed ? 'Owes You' : 'You Owe'}
                        </span>
                      </div>

                      <div className="settlement-member-amount-row">
                        <span className="settlement-amount-label">Reconciled Net</span>
                        <span className={`settlement-amount-val ${isOwed ? 'positive' : 'negative'}`}>
                          {isOwed ? '+' : '-'}₹ {Math.abs(m.balance).toFixed(2)}
                        </span>
                      </div>

                      <div className="settlement-member-actions">
                        <button
                          className="btn-settle-info"
                          title="View transaction breakdown"
                          onClick={() => handleDetailsClick(activeSquad, m.username, m.displayName, m.balance)}
                        >
                          <Info size={16} />
                        </button>
                        {isOwed ? (
                          <button
                            className="btn-action-collect"
                            onClick={() => handleSettleClick(activeSquad, m.username, m.balance)}
                          >
                            <CheckCircle size={15} />
                            <span>Mark Received</span>
                          </button>
                        ) : (
                          <button
                            className="btn-action-pay"
                            onClick={() => handleSettleClick(activeSquad, m.username, m.balance)}
                          >
                            <Send size={15} />
                            <span>Pay Now</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {visibleMembers.length === 0 && (
                <div className="settlements-empty-state">
                  <div className="settlements-empty-icon">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="settlements-empty-title">All Balances Settled</h3>
                  <p className="settlements-empty-desc">
                    {searchQuery.trim() 
                      ? 'No members match your search criteria in this squadron.' 
                      : 'No outstanding debt or receivable balances found in this squadron for the selected period.'}
                  </p>
                </div>
              )}

              {/* Archive for this squad */}
              <div className="settlements-archive-wrapper">
                <div className="settlements-archive-title">
                  <History size={16} />
                  <span>Squad Tactical Split History</span>
                </div>
                <div className="settlements-table-container">
                  <table className="settlements-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Where Spent</th>
                        <th>Payer</th>
                        <th>Amount</th>
                        <th>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSquadExpenses.map(e => (
                        <tr key={e.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </td>
                          <td style={{ fontWeight: 600 }}>{e.where_spent}</td>
                          <td>
                            <span style={{ fontWeight: 700, color: 'var(--text-color)' }}>{e.payer}</span>
                          </td>
                          <td style={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                            ₹ {Number(e.amount).toFixed(2)}
                          </td>
                          <td>
                            <span className={`badge-archive-cat ${e.category === 'settlement' ? 'settlement' : ''}`}>
                              {e.category}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {activeSquadExpenses.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '2.5rem', opacity: 0.5 }}>
                            No squad expense records discovered for this billing period.
                          </td>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* List of Squad Sections */}
          {squads.map(s => {
            const { members, totalSpent, totalShare } = computeSquadBalances(s.name);
            const visibleMembers = filterMemberList(members);
            
            // If no active member balances match filter, hide squad section
            if (visibleMembers.length === 0 && !searchQuery.trim() && directionFilter === 'ALL') {
              if (members.filter(m => Math.abs(m.balance) > 0.01).length === 0) return null;
            }
            if (visibleMembers.length === 0 && (searchQuery.trim() || directionFilter !== 'ALL')) {
              return null;
            }

            return (
              <section key={s.name} className="settlements-squad-section">
                <div className="settlements-squad-header">
                  <div className="settlements-squad-info">
                    <div className="settlements-squad-avatar">
                      <Users size={20} />
                    </div>
                    <div>
                      <h3 className="settlements-squad-name">{formatSquadName(s.name)}</h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        {visibleMembers.length} active obligation{visibleMembers.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div className="settlements-squad-stats">
                      <div className="settlements-stat-item">
                        <span className="settlements-stat-label">Total Volume</span>
                        <span className="settlements-stat-val">₹ {totalSpent.toFixed(2)}</span>
                      </div>
                      <div className="settlements-stat-item">
                        <span className="settlements-stat-label">Obligation</span>
                        <span className="settlements-stat-val">₹ {totalShare.toFixed(2)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveSquad(s.name)}
                      className="btn-focus-squad"
                    >
                      <span>Focus Squad</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="settlements-members-grid">
                  {visibleMembers.map(m => {
                    const isOwed = m.balance > 0.01;
                    return (
                      <div 
                        key={m.username} 
                        className={`settlement-member-card ${isOwed ? 'receivable' : 'payable'}`}
                      >
                        <div className="settlement-member-top">
                          <div className="settlement-member-user">
                            <div 
                              className="settlement-user-avatar"
                              style={{ 
                                background: m.avatarColor 
                                  ? `linear-gradient(${m.avatarColor})` 
                                  : 'linear-gradient(135deg, var(--primary), #6366f1)' 
                              }}
                            >
                              {m.displayName[0].toUpperCase()}
                            </div>
                            <div className="settlement-user-meta">
                              <span className="settlement-user-name">{m.displayName}</span>
                              <span className="settlement-user-handle">@{m.username}</span>
                            </div>
                          </div>

                          <span className={`settlement-direction-badge ${isOwed ? 'badge-owes-you' : 'badge-you-owe'}`}>
                            {isOwed ? 'Owes You' : 'You Owe'}
                          </span>
                        </div>

                        <div className="settlement-member-amount-row">
                          <span className="settlement-amount-label">Reconciled Net</span>
                          <span className={`settlement-amount-val ${isOwed ? 'positive' : 'negative'}`}>
                            {isOwed ? '+' : '-'}₹ {Math.abs(m.balance).toFixed(2)}
                          </span>
                        </div>

                        <div className="settlement-member-actions">
                          <button
                            className="btn-settle-info"
                            title="View transaction breakdown"
                            onClick={() => handleDetailsClick(s.name, m.username, m.displayName, m.balance)}
                          >
                            <Info size={16} />
                          </button>
                          {isOwed ? (
                            <button
                              className="btn-action-collect"
                              onClick={() => handleSettleClick(s.name, m.username, m.balance)}
                            >
                              <CheckCircle size={15} />
                              <span>Mark Received</span>
                            </button>
                          ) : (
                            <button
                              className="btn-action-pay"
                              onClick={() => handleSettleClick(s.name, m.username, m.balance)}
                            >
                              <Send size={15} />
                              <span>Pay Now</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Direct / Solo Balances Section */}
          {(() => {
            const visibleSoloMembers = filterMemberList(soloBalances.members);
            if (visibleSoloMembers.length === 0 && !searchQuery.trim() && directionFilter === 'ALL' && soloBalances.members.length === 0) {
              return null;
            }
            if (visibleSoloMembers.length === 0 && (searchQuery.trim() || directionFilter !== 'ALL')) {
              return null;
            }

            return (
              <section className="settlements-squad-section">
                <div className="settlements-squad-header">
                  <div className="settlements-squad-info">
                    <div className="settlements-squad-avatar" style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}>
                      <Activity size={20} />
                    </div>
                    <div>
                      <h3 className="settlements-squad-name">Direct & Solo Splits</h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        Individual peer-to-peer balances outside any squad
                      </span>
                    </div>
                  </div>

                  <div className="settlements-squad-stats">
                    <div className="settlements-stat-item">
                      <span className="settlements-stat-label">Solo Volume</span>
                      <span className="settlements-stat-val">₹ {soloBalances.totalSpent.toFixed(2)}</span>
                    </div>
                    <div className="settlements-stat-item">
                      <span className="settlements-stat-label">Solo Obligation</span>
                      <span className="settlements-stat-val">₹ {soloBalances.totalShare.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="settlements-members-grid">
                  {visibleSoloMembers.map(m => {
                    const isOwed = m.balance > 0.01;
                    return (
                      <div 
                        key={m.username} 
                        className={`settlement-member-card ${isOwed ? 'receivable' : 'payable'}`}
                      >
                        <div className="settlement-member-top">
                          <div className="settlement-member-user">
                            <div 
                              className="settlement-user-avatar"
                              style={{ 
                                background: m.avatarColor 
                                  ? `linear-gradient(${m.avatarColor})` 
                                  : 'linear-gradient(135deg, var(--primary), #6366f1)' 
                              }}
                            >
                              {m.displayName[0].toUpperCase()}
                            </div>
                            <div className="settlement-user-meta">
                              <span className="settlement-user-name">{m.displayName}</span>
                              <span className="settlement-user-handle">@{m.username}</span>
                            </div>
                          </div>

                          <span className={`settlement-direction-badge ${isOwed ? 'badge-owes-you' : 'badge-you-owe'}`}>
                            {isOwed ? 'Owes You' : 'You Owe'}
                          </span>
                        </div>

                        <div className="settlement-member-amount-row">
                          <span className="settlement-amount-label">Reconciled Net</span>
                          <span className={`settlement-amount-val ${isOwed ? 'positive' : 'negative'}`}>
                            {isOwed ? '+' : '-'}₹ {Math.abs(m.balance).toFixed(2)}
                          </span>
                        </div>

                        <div className="settlement-member-actions">
                          <button
                            className="btn-settle-info"
                            title="View transaction breakdown"
                            onClick={() => handleDetailsClick(null, m.username, m.displayName, m.balance)}
                          >
                            <Info size={16} />
                          </button>
                          {isOwed ? (
                            <button
                              className="btn-action-collect"
                              onClick={() => handleSettleClick('', m.username, m.balance)}
                            >
                              <CheckCircle size={15} />
                              <span>Mark Received</span>
                            </button>
                          ) : (
                            <button
                              className="btn-action-pay"
                              onClick={() => handleSettleClick('', m.username, m.balance)}
                            >
                              <Send size={15} />
                              <span>Pay Now</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })()}

          {/* Global Empty State if all squads are fully reconciled */}
          {allPendingBalancesCount === 0 && (
            <div className="settlements-empty-state">
              <div className="settlements-empty-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', width: 56, height: 56 }}>
                <Sparkles size={28} />
              </div>
              <h3 className="settlements-empty-title">Zero Pending Obligations</h3>
              <p className="settlements-empty-desc">
                All accounts across all squadrons and direct splits are perfectly balanced and reconciled for this cycle.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {modal.isOpen && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '440px', width: '100%' }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '16px',
                background: modal.heOwesMe ? 'rgba(16, 185, 129, 0.15)' : 'rgba(var(--primary-rgb, 79, 70, 229), 0.15)',
                color: modal.heOwesMe ? '#10b981' : 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem auto'
              }}>
                {modal.heOwesMe ? <CheckCircle size={28} /> : <Wallet size={28} />}
              </div>

              <h3 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '0.4rem', letterSpacing: '-0.02em', color: 'var(--text-color)' }}>
                {modal.heOwesMe ? 'Record Receipt' : 'Record Payment'}
              </h3>
              
              <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                Confirm settlement of <strong style={{ color: 'var(--text-color)' }}>₹ {modal.amount.toFixed(2)}</strong> {modal.heOwesMe ? `received from @${modal.otherUser}` : `paid to @${modal.otherUser}`}.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button 
                  onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}
                  className="btn-settlements-glass" 
                  style={{ flex: 1, padding: '0.75rem', justifyContent: 'center' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeSettlement}
                  className="btn-settle-batch" 
                  style={{ 
                    flex: 1.5, 
                    padding: '0.75rem', 
                    justifyContent: 'center',
                    background: modal.heOwesMe ? 'linear-gradient(135deg, #10b981, #059669)' : undefined
                  }}
                >
                  {modal.heOwesMe ? '✓ Confirm Receipt' : '✓ Confirm Payment'}
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
              style={{ maxWidth: '540px', width: '100%', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}
            >
              {/* Modal Header */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <CheckSquare size={22} style={{ color: 'var(--primary)' }} />
                  Reconcile Selected Obligations
                </h3>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.825rem', marginTop: '0.4rem', margin: 0 }}>
                  Choose which bilateral balances to settle for <strong>{selectedMonth}</strong>.
                </p>
              </div>

              {/* Select All / Deselect All */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
                <button
                  onClick={() => {
                    const all = {};
                    batchModal.items.forEach(i => { all[i.key] = true; });
                    setBatchModal(prev => ({ ...prev, selected: all }));
                  }}
                  className="btn-settlements-glass"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                >
                  Select All
                </button>
                <button
                  onClick={() => setBatchModal(prev => ({ ...prev, selected: {} }))}
                  className="btn-settlements-glass"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                >
                  Deselect All
                </button>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
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
                        padding: '0.85rem 1rem',
                        borderRadius: '14px',
                        border: `1px solid ${isChecked ? (isOwed ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)') : 'var(--border-color)'}`,
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
                          width: 38, height: 38, borderRadius: '12px', flexShrink: 0,
                          background: item.avatarColor ? `linear-gradient(${item.avatarColor})` : 'linear-gradient(135deg, var(--primary), #6366f1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: '0.9rem', color: '#fff'
                        }}
                      >
                        {item.displayName[0].toUpperCase()}
                      </div>

                      {/* Name + context */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.displayName}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                          {item.squadName ? formatSquadName(item.squadName) : 'Direct / Solo'}
                        </div>
                      </div>

                      {/* Amount + direction */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                        <span
                          style={{
                            fontWeight: 900, fontSize: '1.05rem',
                            fontFamily: 'Outfit, sans-serif',
                            color: isOwed ? '#10b981' : '#f59e0b'
                          }}
                        >
                          {isOwed ? '+' : '-'}₹ {Math.abs(item.balance).toFixed(2)}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
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
                  <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Total Reconciled Volume</span>
                  <span style={{ fontWeight: 900, fontSize: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>
                    ₹ {batchModal.items
                      .filter(i => batchModal.selected[i.key])
                      .reduce((sum, i) => sum + Math.abs(i.balance), 0)
                      .toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setBatchModal(prev => ({ ...prev, isOpen: false }))}
                    disabled={batchLoading}
                    className="btn-settlements-glass"
                    style={{ flex: 1, padding: '0.75rem', justifyContent: 'center' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeBatchSettle}
                    disabled={batchLoading || Object.values(batchModal.selected).filter(Boolean).length === 0}
                    className="btn-settle-batch"
                    style={{
                      flex: 2, padding: '0.75rem', justifyContent: 'center',
                      opacity: batchLoading ? 0.7 : 1
                    }}
                  >
                    {batchLoading ? (
                      <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Processing...</>
                    ) : (
                      <><CheckSquare size={16} /> Confirm Reconciliations</>
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
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Info size={20} style={{ color: 'var(--primary)' }} />
                    Obligation Itemized Breakdown
                  </h3>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.825rem', marginTop: '0.25rem', marginBottom: 0 }}>
                    Mutual ledger with <strong>{detailsModal.displayName}</strong> {detailsModal.squadName ? `in ${formatSquadName(detailsModal.squadName)}` : 'in Direct Splits'}
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
                      const isIPaid = (e.payer || '').toLowerCase() === myHandle;
                      const otherUserShare = isIPaid ? getShare(e, detailsModal.username) : getShare(e, myHandle);
                      if (otherUserShare === 0) return null;
                      
                      return (
                        <div key={e.id} style={{ 
                          padding: '1rem', 
                          borderRadius: '14px', 
                          border: '1px solid var(--border-color)', 
                          background: 'var(--input-bg)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem'
                        }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                                {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)' }}>{e.category}</span>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {e.where_spent}
                            </div>
                          </div>
                          
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginBottom: '0.15rem', textTransform: 'uppercase' }}>
                              {isIPaid ? 'They Owe You' : 'You Owe Them'}
                            </div>
                            <div style={{ 
                              fontWeight: 900, 
                              fontSize: '1.05rem',
                              fontFamily: 'Outfit, sans-serif',
                              color: isIPaid ? '#10b981' : '#f59e0b' 
                            }}>
                              {isIPaid ? '+' : '-'}₹ {otherUserShare.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', opacity: 0.5 }}>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>No individual transactions found for this balance.</p>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.875rem', fontWeight: 600 }}>Reconciled Net Balance</span>
                <span style={{ 
                  fontWeight: 900, 
                  fontSize: '1.35rem',
                  fontFamily: 'Outfit, sans-serif',
                  color: detailsModal.balance > 0 ? '#10b981' : (detailsModal.balance < 0 ? '#f59e0b' : 'var(--text-color)')
                }}>
                  {detailsModal.balance > 0 ? '+' : ''}₹ {Math.abs(detailsModal.balance).toFixed(2)}
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
