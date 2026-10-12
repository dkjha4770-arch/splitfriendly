import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModalPortal from '../components/ModalPortal';
import { getExpensesData, getCachedExpensesData, invalidateExpensesCache } from '../utils/dataCache';
import {
  Plus,
  DollarSign,
  Activity,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Users,
  CheckCircle2,
  Info,
  Wallet,
  CreditCard,
  ArrowRight,
  X,
  ChevronRight,
  Receipt,
  Sparkles
} from 'lucide-react';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import './Dashboard.css';

const CATEGORIES = {
  food: { label: 'Food & Rations', color: '#f59e0b' },
  rent: { label: 'Base Rent', color: '#06b6d4' },
  travel: { label: 'Transport & Travel', color: '#3b82f6' },
  utility: { label: 'Infrastructure & Bills', color: '#ec4899' },
  other: { label: 'Unclassified / Other', color: '#8b5cf6' }
};

export const Dashboard = () => {
  const { user, token, theme } = useAuth();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // States — restored instantly from cache if available
  const initialCache = getCachedExpensesData();
  const [expenses, setExpenses] = useState(() => initialCache?.expenses || []);
  const [squads, setSquads] = useState(() => initialCache?.squads || []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [error, setError] = useState(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  });
  const [selectedSquadForSettlements, setSelectedSquadForSettlements] = useState(() => {
    return initialCache?.squads?.[0]?.name || null;
  });

  // Modal State for Confirm Settle
  const [settlementModal, setSettlementModal] = useState({
    isOpen: false,
    squadName: '',
    otherUser: '',
    amount: 0,
    heOwesMe: false
  });

  // Populate month list (last 24 months)
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

  // Fetch Data (combined endpoint with SWR caching)
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      if (!getCachedExpensesData()) {
        setLoading(true);
      }
      const data = await getExpensesData(authHeaders, forceRefresh);
      setExpenses(data.expenses || []);
      setSquads(data.squads || []);

      // Auto-select first squad for settlements if none is selected
      if (data.squads && data.squads.length > 0 && !selectedSquadForSettlements) {
        setSelectedSquadForSettlements(data.squads[0].name);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedSquadForSettlements]);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, fetchData]);

  // Filtered expenses for selected month
  const monthlyExpenses = useMemo(() => {
    return expenses.filter(e => e && e.date && String(e.date).substring(0, 7) === selectedMonth);
  }, [expenses, selectedMonth]);

  // Volume & entry count (excluding settlements)
  const activeExpenses = useMemo(() => {
    return monthlyExpenses.filter(e => e && e.category !== 'settlement');
  }, [monthlyExpenses]);

  const totalVolume = useMemo(() => {
    return activeExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [activeExpenses]);

  const totalEntries = activeExpenses.length;
  const myHandle = user?.username ? user.username.split('@')[0].toLowerCase() : '';

  // Handle ESC key to dismiss settlement modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && settlementModal.isOpen) {
        setSettlementModal(prev => ({ ...prev, isOpen: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settlementModal.isOpen]);

  // Calculate Net Personal Balance (spent vs share in selected month)
  const { totalSpent, totalShare, categoryTotals, netBalance } = useMemo(() => {
    let spent = 0;
    let share = 0;
    const catTotals = {};

    monthlyExpenses.forEach(e => {
      if (!e) return;
      const payer = String(e.payer || '').toLowerCase();
      if (payer === myHandle) spent += Number(e.amount || 0);

      let myShare = 0;
      if (e.members && typeof e.members === 'object' && !Array.isArray(e.members)) {
        if (e.members[myHandle] !== undefined) myShare = Number(e.members[myHandle] || 0);
      } else if (Array.isArray(e.members)) {
        if (e.members.map(m => String(m || '').toLowerCase()).includes(myHandle)) {
          myShare = Number(e.share || 0);
        }
      }
      share += myShare;

      if (e.category !== 'settlement') {
        const catKey = e.category || 'other';
        catTotals[catKey] = (catTotals[catKey] || 0) + Number(e.amount || 0);
      }
    });

    return {
      totalSpent: spent,
      totalShare: share,
      categoryTotals: catTotals,
      netBalance: spent - share
    };
  }, [monthlyExpenses, myHandle]);

  // Render Doughnut Chart
  useEffect(() => {
    if (loading || !chartRef.current) return;
    const ctx = chartRef.current.getContext('2d');

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const labels = Object.keys(categoryTotals).map(k => CATEGORIES[k]?.label || k);
    const data = Object.values(categoryTotals);
    const colors = Object.keys(categoryTotals).map(k => CATEGORIES[k]?.color || '#868e96');
    const isDark = theme === 'dark';

    if (data.length === 0) {
      return;
    }

    chartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: isDark ? '#1e293b' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 8,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false // We render our own premium custom legend with percentage breakdown
          },
          tooltip: {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            titleColor: isDark ? '#f8fafc' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1,
            padding: 10,
            boxPadding: 4,
            usePointStyle: true,
            callbacks: {
              label: (context) => {
                const val = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ₹${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })} (${pct}%)`;
              }
            }
          }
        },
        cutout: '74%'
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [categoryTotals, loading, theme]);

  // Compute Squad Settlements (calculated across ALL time for selected squad)
  const squadSettlements = useMemo(() => {
    if (!selectedSquadForSettlements) return [];

    const squad = squads.find(s => s && s.name === selectedSquadForSettlements);
    if (!squad) return [];

    let squadMembers = [];
    try {
      if (typeof squad.members === 'string') {
        squadMembers = JSON.parse(squad.members || '[]');
      } else if (Array.isArray(squad.members)) {
        squadMembers = squad.members;
      }
    } catch (_) {
      squadMembers = [];
    }

    const myUid = (user?.unique_id || '').toLowerCase();
    const otherMembers = squadMembers.filter(m => {
      const rawName = typeof m === 'object' && m ? (m.name || '') : String(m || '');
      const mName = rawName.split('@')[0].toLowerCase();
      const mUid = (typeof m === 'object' && m ? (m.uid || '') : '').toLowerCase();
      const isSelf = mName === myHandle || (myUid !== '' && mUid.includes(myUid));
      return !isSelf;
    });

    const balances = {};
    otherMembers.forEach(m => {
      const rawName = typeof m === 'object' && m ? (m.name || '') : String(m || '');
      const handle = rawName.split('@')[0].toLowerCase();
      balances[handle] = 0;
    });

    // Filter expenses belonging to this squad
    const squadExpenses = expenses.filter(e => e && e.squad_name === selectedSquadForSettlements);

    squadExpenses.forEach(e => {
      if (!e) return;
      const payer = String(e.payer || '').toLowerCase();

      if (payer === myHandle) {
        // I paid. Others owe me
        if (e.members && typeof e.members === 'object' && !Array.isArray(e.members)) {
          for (const [mem, amt] of Object.entries(e.members)) {
            const ml = String(mem).split('@')[0].toLowerCase();
            if (balances[ml] !== undefined) {
              balances[ml] += Number(amt || 0);
            }
          }
        } else if (Array.isArray(e.members)) {
          e.members.forEach(mem => {
            const ml = String(mem).split('@')[0].toLowerCase();
            if (balances[ml] !== undefined) {
              balances[ml] += Number(e.share || 0);
            }
          });
        }
      } else if (balances[payer] !== undefined) {
        // Someone in the balances paid. Do I owe them?
        if (e.members && typeof e.members === 'object' && !Array.isArray(e.members)) {
          if (e.members[myHandle] !== undefined) {
            balances[payer] -= Number(e.members[myHandle] || 0);
          }
        } else if (Array.isArray(e.members)) {
          if (e.members.map(m => String(m).split('@')[0].toLowerCase()).includes(myHandle)) {
            balances[payer] -= Number(e.share || 0);
          }
        }
      }
    });

    const list = [];
    for (const [mName, bal] of Object.entries(balances)) {
      if (Math.abs(bal) > 0.05) {
        const matchedMem = squadMembers.find(sm => {
          const rawName = typeof sm === 'object' && sm ? (sm.name || '') : String(sm || '');
          return rawName.split('@')[0].toLowerCase() === mName;
        });
        const displayName = typeof matchedMem === 'object' && matchedMem
          ? (matchedMem.display_name || matchedMem.name || mName)
          : String(matchedMem || mName);

        list.push({
          name: displayName,
          handle: mName,
          balance: bal
        });
      }
    }
    return list;
  }, [selectedSquadForSettlements, squads, expenses, myHandle, user?.unique_id]);

  // Quick Settle Action
  const triggerQuickSettle = (handle, balance) => {
    const heOwesMe = balance > 0;
    setSettlementModal({
      isOpen: true,
      squadName: selectedSquadForSettlements,
      otherUser: handle,
      amount: Math.abs(balance),
      heOwesMe
    });
  };

  const executeSettlement = async () => {
    const { squadName, otherUser, amount, heOwesMe } = settlementModal;

    const body = {
      date: new Date().toISOString().split('T')[0],
      amount: amount,
      payer: heOwesMe ? otherUser : myHandle,
      share: amount,
      where: heOwesMe ? `Received settlement from ${otherUser}` : `Paid settlement to ${otherUser}`,
      category: 'settlement',
      app: 'upi',
      members: [heOwesMe ? myHandle : otherUser],
      squad_name: squadName
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
      if (!data.success) throw new Error(data.error || 'Server error.');

      setSettlementModal(prev => ({ ...prev, isOpen: false }));
      invalidateExpensesCache();
      fetchData(true);
    } catch (err) {
      alert('Settlement failed: ' + err.message);
    }
  };

  const displayName = user?.display_name || myHandle || 'Operative';

  return (
    <div className="view-section dashboard-view-container">
      
      {/* ── TOP HERO BAR ── */}
      <header className="content-header dashboard-hero-header">
        <div className="header-title dashboard-hero-title-area">
          <div className="dashboard-badge-row">
            <span className="dashboard-hq-badge">
              <Sparkles size={12} />
              FairShare HQ
            </span>
            <span className="dashboard-cycle-text">
              Cycle: 5th to Date
            </span>
          </div>
          <h2 className="dashboard-title-heading">
            Welcome back, {displayName}
          </h2>
          <p className="dashboard-subtitle-text">
            Executive overview of your cycle spending, category allocations, and squad settlements.
          </p>
        </div>

        <div className="header-actions dashboard-hero-actions">
          {/* Month Selector */}
          <div className="dashboard-month-select-wrap">
            <Calendar size={16} style={{ position: 'absolute', left: '0.85rem', color: 'var(--text-dim)', pointerEvents: 'none' }} />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="dashboard-month-select"
            >
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronRight size={14} style={{ position: 'absolute', right: '0.75rem', transform: 'rotate(90deg)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
          </div>

          {/* Direct Link to Expense Ledger */}
          <Link
            to="/expenses"
            className="dashboard-ledger-btn"
            title="Open expense ledger"
          >
            <Receipt size={16} />
            <span>Expense Ledger</span>
          </Link>

          {/* New Expense Button */}
          <Link
            to="/expenses/new"
            className="dashboard-split-btn"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Split Expense</span>
          </Link>
        </div>
      </header>

      {/* ── 4-CARD EXECUTIVE KPI STRIP ── */}
      <div className="dashboard-kpi-grid">
        {/* Metric 1: Monthly Total Volume */}
        <div className="card dashboard-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">
              Monthly Volume
            </span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
              <DollarSign size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div className="kpi-value-text">
            ₹ {totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="kpi-subtext">
            <Receipt size={13} />
            <span>{totalEntries} transactions recorded</span>
          </div>
        </div>

        {/* Metric 2: You Paid Out */}
        <div className="card dashboard-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">
              You Paid Out
            </span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
              <ArrowUpRight size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div className="kpi-value-text">
            ₹ {totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="kpi-subtext">
            <Wallet size={13} />
            <span>Disbursed out of pocket</span>
          </div>
        </div>

        {/* Metric 3: Your Fair Share */}
        <div className="card dashboard-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-card-label">
              Your Fair Share
            </span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
              <Activity size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div className="kpi-value-text">
            ₹ {totalShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="kpi-subtext">
            <CreditCard size={13} />
            <span>Your personal liability</span>
          </div>
        </div>

        {/* Metric 4: Net Balance Position */}
        <div className="card dashboard-kpi-card" style={{
          borderColor: netBalance >= 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)',
          background: netBalance >= 0 ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)'
        }}>
          <div className="kpi-card-header">
            <span className="kpi-card-label">
              Net Position
            </span>
            <div className="kpi-icon-wrap" style={{
              background: netBalance >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: netBalance >= 0 ? '#10b981' : '#ef4444'
            }}>
              {netBalance >= 0 ? <TrendingUp size={18} strokeWidth={2.5} /> : <ArrowDownRight size={18} strokeWidth={2.5} />}
            </div>
          </div>
          <div className="kpi-value-text" style={{
            color: netBalance >= 0 ? '#10b981' : '#ef4444'
          }}>
            {netBalance >= 0 ? '+' : ''}₹ {Math.abs(netBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="kpi-subtext" style={{
            color: netBalance >= 0 ? '#10b981' : '#ef4444',
            fontWeight: 700
          }}>
            <span>{netBalance >= 0 ? '● You are owed overall' : '● You owe overall'}</span>
          </div>
        </div>
      </div>

      {/* ── 2-COLUMN BALANCED WORKSPACE GRID ── */}
      <div className="dashboard-workspace-grid">

        {/* ── COLUMN 1: SPENDING DISTRIBUTION ── */}
        <div className="card dashboard-workspace-card">
          <div>
            <div className="dashboard-card-header">
              <div className="dashboard-card-title-group">
                <h3 className="dashboard-card-title">Spending Distribution</h3>
                <span className="dashboard-card-subtext">Category breakdown of active operations</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {activeExpenses.length} Ops
              </span>
            </div>

            {Object.keys(categoryTotals).length > 0 ? (
              <div>
                <div style={{ position: 'relative', width: '100%', height: '210px', marginBottom: '1.25rem' }}>
                  <canvas ref={chartRef}></canvas>
                </div>

                {/* Custom Category List with Percentages */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {Object.entries(categoryTotals).map(([catKey, val]) => {
                    const cat = CATEGORIES[catKey] || { label: catKey, color: '#8b5cf6' };
                    const pct = totalVolume > 0 ? ((val / totalVolume) * 100).toFixed(0) : 0;
                    return (
                      <div
                        key={catKey}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '10px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.82rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color }} />
                          <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{cat.label}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontWeight: 800, color: 'var(--text-color)' }}>
                            ₹ {val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            background: `${cat.color}20`,
                            color: cat.color
                          }}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <Info size={32} style={{ color: 'var(--text-dim)', margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-color)' }}>No Expense Categories</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: 0 }}>
                  Log an expense to visualize category distributions.
                </p>
              </div>
            )}
          </div>

          <div className="dashboard-card-footer">
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              Total Volume: <strong style={{ color: 'var(--text-color)' }}>₹{totalVolume.toFixed(2)}</strong>
            </span>
            <Link to="/analytics" className="dashboard-card-footer-link">
              <span>Deep Analytics</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* ── COLUMN 2: SQUAD QUICK SETTLEMENTS ── */}
        <div className="card dashboard-workspace-card">
          <div>
            <div className="dashboard-card-header">
              <div className="dashboard-card-title-group">
                <h3 className="dashboard-card-title">Squad Quick Settlements</h3>
                <span className="dashboard-card-subtext">Zero-out debts with single-click reconciliation</span>
              </div>

              {/* Squad Selector */}
              {squads.length > 0 && (
                <select
                  value={selectedSquadForSettlements || ''}
                  onChange={e => setSelectedSquadForSettlements(e.target.value)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: '10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-color)',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {squads.map(s => (
                    <option key={s.id || s._id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            {squadSettlements.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {squadSettlements.map((item, idx) => {
                  const heOwesMe = item.balance > 0;
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1rem',
                        borderRadius: '14px',
                        background: heOwesMe ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                        border: `1px solid ${heOwesMe ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                        transition: 'transform 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: heOwesMe ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: heOwesMe ? '#10b981' : '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.85rem'
                        }}>
                          {(item.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-color)' }}>
                            {item.name || 'Member'}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: heOwesMe ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {heOwesMe ? `Owes you ₹${Number(item.balance || 0).toFixed(2)}` : `You owe ₹${Math.abs(Number(item.balance || 0)).toFixed(2)}`}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => triggerQuickSettle(item.handle, item.balance)}
                        style={{
                          background: heOwesMe ? '#10b981' : 'var(--primary)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.45rem 0.95rem',
                          borderRadius: '9px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>Settle</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                background: 'rgba(16, 185, 129, 0.03)',
                borderRadius: '14px',
                border: '1px dashed rgba(16, 185, 129, 0.25)'
              }}>
                <CheckCircle2 size={36} style={{ color: '#10b981', margin: '0 auto 0.6rem auto' }} />
                <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-color)', margin: '0 0 0.3rem 0' }}>
                  All Clear in {selectedSquadForSettlements || 'Squad'}
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: 0 }}>
                  No pending balances or unsettled liabilities.
                </p>
              </div>
            )}
          </div>

          <div className="dashboard-card-footer">
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              Active Squad: <strong style={{ color: 'var(--text-color)' }}>{selectedSquadForSettlements || 'None'}</strong>
            </span>
            <Link to="/settlements" className="dashboard-card-footer-link">
              <span>Settlement Archive</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

      </div>

      {/* ── 3-COLUMN QUICK ACCESS NAVIGATION HUB ── */}
      <div className="dashboard-quick-hub">
        <Link to="/expenses" className="dashboard-hub-card">
          <div className="dashboard-hub-top">
            <div className="dashboard-hub-icon-wrap" style={{ background: 'rgba(79, 70, 229, 0.12)', color: 'var(--primary)' }}>
              <Receipt size={22} />
            </div>
            <span className="dashboard-hub-badge">{activeExpenses.length} Records</span>
          </div>
          <div className="dashboard-hub-main">
            <h4>Expense Ledger</h4>
            <p>Access the dedicated high-density ledger with table and card view layouts, advanced filters, and search.</p>
          </div>
          <div className="dashboard-hub-cta">
            <span>Open Full Ledger</span>
            <ArrowRight size={14} />
          </div>
        </Link>

        <Link to="/settlements" className="dashboard-hub-card">
          <div className="dashboard-hub-top">
            <div className="dashboard-hub-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
              <CheckCircle2 size={22} />
            </div>
            <span className="dashboard-hub-badge">Reconciliation</span>
          </div>
          <div className="dashboard-hub-main">
            <h4>Settlement Archive</h4>
            <p>Review past debt reconciliations, verify payment receipts, and audit historical settlement logs.</p>
          </div>
          <div className="dashboard-hub-cta">
            <span>View Archive</span>
            <ArrowRight size={14} />
          </div>
        </Link>

        <Link to="/squads" className="dashboard-hub-card">
          <div className="dashboard-hub-top">
            <div className="dashboard-hub-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
              <Users size={22} />
            </div>
            <span className="dashboard-hub-badge">{squads.length} Squads</span>
          </div>
          <div className="dashboard-hub-main">
            <h4>Squads & Groups</h4>
            <p>Organize squad rosters, invite comrades, and manage member permissions and group split rules.</p>
          </div>
          <div className="dashboard-hub-cta">
            <span>Manage Squads</span>
            <ArrowRight size={14} />
          </div>
        </Link>
      </div>

      {/* ── MODALS (PORTAL RENDERED) ── */}

      {/* Settle Modal Dialog */}
      {settlementModal.isOpen && (
        <ModalPortal>
          <div
            className="modal-overlay"
            onClick={() => setSettlementModal(prev => ({ ...prev, isOpen: false }))}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(6px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <div
              className="modal-content dashboard-modal-card"
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-color)' }}>
                  Confirm Settlement
                </h3>
                <button
                  onClick={() => setSettlementModal(prev => ({ ...prev, isOpen: false }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}
                >
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                {settlementModal.heOwesMe ? (
                  <>Record that <strong>{settlementModal.otherUser}</strong> has paid you <strong>₹{settlementModal.amount.toFixed(2)}</strong> to settle their dues in <em>{settlementModal.squadName}</em>?</>
                ) : (
                  <>Record that you have paid <strong>{settlementModal.otherUser}</strong> <strong>₹{settlementModal.amount.toFixed(2)}</strong> to settle your dues in <em>{settlementModal.squadName}</em>?</>
                )}
              </p>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                marginBottom: '1.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }}>Settlement Amount</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10b981' }}>
                  ₹ {settlementModal.amount.toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setSettlementModal(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-color)',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeSettlement}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--secondary), #059669)',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  Confirm & Settle
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

    </div>
  );
};

export default Dashboard;
