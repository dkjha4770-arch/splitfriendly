import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModalPortal from '../components/ModalPortal';
import { getExpensesData, getCachedExpensesData, invalidateExpensesCache } from '../utils/dataCache';
import {
  Plus,
  Search,
  Trash2,
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

const CATEGORIES = {
  food: { label: 'Food & Rations', color: '#f59e0b' },
  rent: { label: 'Base Rent', color: '#06b6d4' },
  travel: { label: 'Transport & Travel', color: '#3b82f6' },
  utility: { label: 'Infrastructure & Bills', color: '#ec4899' },
  other: { label: 'Unclassified / Other', color: '#8b5cf6' }
};

const PAYMENT_APPS = {
  gpay: { label: 'Google Pay', badge: 'badge-purple' },
  phonepe: { label: 'PhonePe', badge: 'badge-purple' },
  slice: { label: 'Slice Card', badge: 'badge-green' },
  cash: { label: 'Cash Reserve', badge: 'badge-green' },
  upi: { label: 'UPI Direct', badge: 'badge-purple' }
};

export const Dashboard = () => {
  const { user, token, theme } = useAuth();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  const navigate = useNavigate();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
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

  // Modal State for Confirm Delete
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    id: null
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
    return expenses.filter(e => e.date.substring(0, 7) === selectedMonth);
  }, [expenses, selectedMonth]);

  // Search & category filters (settlements are always excluded from the ledger table)
  const filteredExpenses = useMemo(() => {
    return monthlyExpenses.filter(e => {
      if (e.category === 'settlement') return false;

      const matchesSearch =
        e.where_spent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.payer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.squad_name && e.squad_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [monthlyExpenses, searchQuery, categoryFilter]);

  // Volume & entry count (excluding settlements)
  const activeExpenses = useMemo(() => {
    return monthlyExpenses.filter(e => e.category !== 'settlement');
  }, [monthlyExpenses]);

  const totalVolume = useMemo(() => {
    return activeExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [activeExpenses]);

  const totalEntries = activeExpenses.length;
  const myHandle = user?.username ? user.username.split('@')[0].toLowerCase() : '';

  // Calculate Net Personal Balance (spent vs share in selected month)
  const { totalSpent, totalShare, categoryTotals, netBalance } = useMemo(() => {
    let spent = 0;
    let share = 0;
    const catTotals = {};

    monthlyExpenses.forEach(e => {
      const payer = e.payer.toLowerCase();
      if (payer === myHandle) spent += Number(e.amount);

      let myShare = 0;
      if (e.members && typeof e.members === 'object' && !Array.isArray(e.members)) {
        if (e.members[myHandle] !== undefined) myShare = Number(e.members[myHandle]);
      } else if (Array.isArray(e.members)) {
        if (e.members.map(m => m.toLowerCase()).includes(myHandle)) myShare = Number(e.share);
      }
      share += myShare;

      if (e.category !== 'settlement') {
        catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount);
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

    const squad = squads.find(s => s.name === selectedSquadForSettlements);
    if (!squad) return [];

    const myUid = user?.unique_id?.toLowerCase() || '';
    const otherMembers = squad.members.filter(m => {
      const mName = m.name.split('@')[0].toLowerCase();
      const mUid = (m.uid || '').toLowerCase();
      const isSelf = mName === myHandle || (myUid !== '' && mUid.includes(myUid)) || (myUid !== '' && myUid.includes(mUid));
      return !isSelf;
    });

    const balances = {};
    otherMembers.forEach(m => {
      balances[m.name.toLowerCase()] = 0;
    });

    // Filter expenses belonging to this squad
    const squadExpenses = expenses.filter(e => e.squad_name === selectedSquadForSettlements);

    squadExpenses.forEach(e => {
      const payer = e.payer.toLowerCase();

      if (payer === myHandle) {
        // I paid. Others owe me
        if (e.members && typeof e.members === 'object' && !Array.isArray(e.members)) {
          for (const [mem, amt] of Object.entries(e.members)) {
            const ml = mem.toLowerCase();
            if (balances[ml] !== undefined) {
              balances[ml] += Number(amt);
            }
          }
        } else if (Array.isArray(e.members)) {
          e.members.forEach(mem => {
            const ml = mem.toLowerCase();
            if (balances[ml] !== undefined) {
              balances[ml] += Number(e.share);
            }
          });
        }
      } else if (balances[payer] !== undefined) {
        // Someone in the balances paid. Do I owe them?
        if (e.members && typeof e.members === 'object' && !Array.isArray(e.members)) {
          if (e.members[myHandle] !== undefined) {
            balances[payer] -= Number(e.members[myHandle]);
          }
        } else if (Array.isArray(e.members)) {
          if (e.members.map(m => m.toLowerCase()).includes(myHandle)) {
            balances[payer] -= Number(e.share);
          }
        }
      }
    });

    const list = [];
    for (const [mName, bal] of Object.entries(balances)) {
      if (Math.abs(bal) > 0.05) {
        const matchedMem = squad.members.find(sm => sm.name.toLowerCase() === mName);
        list.push({
          name: matchedMem?.display_name || mName,
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

  // Delete Action
  const triggerDelete = (id) => {
    setDeleteModal({
      isOpen: true,
      id
    });
  };

  const executeDelete = async () => {
    try {
      const res = await fetch('/api/expenses/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({ id: deleteModal.id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Delete failed.');

      setDeleteModal({ isOpen: false, id: null });
      invalidateExpensesCache();
      fetchData(true);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const displayName = user?.display_name || myHandle || 'Operative';

  return (
    <div className="view-section" style={{ maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* ── TOP HERO BAR ── */}
      <header className="content-header" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div className="header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(79, 70, 229, 0.12)',
              color: 'var(--primary)',
              border: '1px solid rgba(79, 70, 229, 0.25)'
            }}>
              <Sparkles size={12} />
              FairShare HQ
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>
              Cycle: 5th to Date
            </span>
          </div>
          <h2 style={{ fontSize: '2.1rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
            Welcome back, {displayName}
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.88rem', color: 'var(--text-dim)', fontWeight: 500 }}>
            Here is your financial snapshot and squad expense ledger for this cycle.
          </p>
        </div>

        <div className="header-actions" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Quick Search */}
          <div className="search-bar" style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '0.55rem 0.9rem',
            gap: '0.5rem',
            boxShadow: 'var(--shadow)'
          }}>
            <Search size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search expenses, payers..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-color)',
                fontSize: '0.85rem',
                minWidth: '180px',
                padding: 0
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-dim)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Month Selector */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Calendar size={16} style={{ position: 'absolute', left: '0.85rem', color: 'var(--text-dim)', pointerEvents: 'none' }} />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{
                appearance: 'none',
                padding: '0.55rem 2rem 0.55rem 2.3rem',
                borderRadius: '12px',
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-color)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: 'var(--shadow)'
              }}
            >
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronRight size={14} style={{ position: 'absolute', right: '0.75rem', transform: 'rotate(90deg)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
          </div>

          {/* New Expense Button */}
          <Link
            to="/expenses/new"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              color: '#ffffff',
              padding: '0.6rem 1.15rem',
              borderRadius: '12px',
              fontSize: '0.88rem',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Split Expense</span>
          </Link>
        </div>
      </header>

      {/* ── 4-CARD EXECUTIVE KPI STRIP ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem'
      }}>
        {/* Metric 1: Monthly Total Volume */}
        <div className="card" style={{
          padding: '1.25rem 1.4rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          background: 'var(--card-bg)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Monthly Volume
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <DollarSign size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-color)', letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
            ₹ {totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Receipt size={13} />
            <span>{totalEntries} transactions recorded</span>
          </div>
        </div>

        {/* Metric 2: You Paid Out */}
        <div className="card" style={{
          padding: '1.25rem 1.4rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          background: 'var(--card-bg)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              You Paid Out
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ArrowUpRight size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-color)', letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
            ₹ {totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Wallet size={13} />
            <span>Disbursed out of pocket</span>
          </div>
        </div>

        {/* Metric 3: Your Fair Share */}
        <div className="card" style={{
          padding: '1.25rem 1.4rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          background: 'var(--card-bg)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Your Fair Share
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(139, 92, 246, 0.12)',
              color: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={18} strokeWidth={2.5} />
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-color)', letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
            ₹ {totalShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <CreditCard size={13} />
            <span>Your personal liability</span>
          </div>
        </div>

        {/* Metric 4: Net Balance Position */}
        <div className="card" style={{
          padding: '1.25rem 1.4rem',
          borderRadius: '16px',
          border: `1px solid ${netBalance >= 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
          background: netBalance >= 0 ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)',
          boxShadow: 'var(--shadow)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Net Position
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: netBalance >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: netBalance >= 0 ? '#10b981' : '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {netBalance >= 0 ? <TrendingUp size={18} strokeWidth={2.5} /> : <ArrowDownRight size={18} strokeWidth={2.5} />}
            </div>
          </div>
          <div style={{
            fontSize: '1.65rem',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            marginBottom: '0.35rem',
            color: netBalance >= 0 ? '#10b981' : '#ef4444'
          }}>
            {netBalance >= 0 ? '+' : ''}₹ {Math.abs(netBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: netBalance >= 0 ? '#10b981' : '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}>
            <span>{netBalance >= 0 ? '● You are owed overall' : '● You owe overall'}</span>
          </div>
        </div>
      </div>

      {/* ── 2-COLUMN MAIN WORKSPACE GRID ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)',
        gap: '1.75rem',
        alignItems: 'start'
      }}>

        {/* ── LEFT COLUMN: LEDGER / RECENT ACTIVITY ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          
          <div className="card" style={{
            borderRadius: '20px',
            padding: '1.5rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow)'
          }}>
            
            {/* Header + Filter Chips */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-color)' }}>
                  Tactical Ledger
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 500 }}>
                  Showing {filteredExpenses.length} of {activeExpenses.length} expenses
                </span>
              </div>

              {/* Category Filter Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                <button
                  onClick={() => setCategoryFilter('all')}
                  style={{
                    border: '1px solid',
                    borderColor: categoryFilter === 'all' ? 'var(--primary)' : 'var(--border-color)',
                    background: categoryFilter === 'all' ? 'rgba(79, 70, 229, 0.12)' : 'transparent',
                    color: categoryFilter === 'all' ? 'var(--primary)' : 'var(--text-dim)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  All Ops ({activeExpenses.length})
                </button>
                {Object.keys(CATEGORIES).map(k => {
                  const count = activeExpenses.filter(e => e.category === k).length;
                  const isActive = categoryFilter === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setCategoryFilter(k)}
                      style={{
                        border: '1px solid',
                        borderColor: isActive ? CATEGORIES[k].color : 'var(--border-color)',
                        background: isActive ? `${CATEGORIES[k].color}18` : 'transparent',
                        color: isActive ? CATEGORIES[k].color : 'var(--text-dim)',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {CATEGORIES[k].label} {count > 0 && `(${count})`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Table or Empty State */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-dim)' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid var(--border-color)',
                  borderTopColor: 'var(--primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 1rem auto'
                }} />
                <p style={{ fontSize: '0.88rem', fontWeight: 600 }}>Syncing tactical ledger...</p>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3.5rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.01)',
                borderRadius: '16px',
                border: '1px dashed var(--border-color)'
              }}>
                <Receipt size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 0.75rem auto', opacity: 0.6 }} />
                <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>No Expenses Found</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', maxWidth: '300px', margin: '0 auto 1.25rem auto' }}>
                  {searchQuery || categoryFilter !== 'all'
                    ? 'No records match your active search or category filters.'
                    : 'No operational expenses logged for this monthly segment yet.'}
                </p>
                <Link
                  to="/expenses/new"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'var(--primary)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    textDecoration: 'none'
                  }}
                >
                  <Plus size={15} />
                  <span>Log First Expense</span>
                </Link>
              </div>
            ) : (
              <div className="table-wrapper" style={{ overflowX: 'auto', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{
                      borderBottom: '1px solid var(--border-color)',
                      color: 'var(--text-dim)',
                      fontSize: '0.72rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px'
                    }}>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>Date</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>Description</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>Payer</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>Category</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800 }}>Payment</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800, textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '0.85rem 0.5rem', width: '36px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((e, idx) => {
                      const isEven = idx % 2 === 0;
                      return (
                        <tr
                          key={e.id}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            background: isEven ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '0.9rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-dim)', fontWeight: 600, fontSize: '0.82rem' }}>
                            {new Date(e.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                          </td>
                          <td style={{ padding: '0.9rem 1rem', minWidth: '160px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-color)', marginBottom: '0.15rem' }}>
                              {e.where_spent}
                            </div>
                            {e.squad_name && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                fontSize: '0.68rem',
                                color: 'var(--primary)',
                                fontWeight: 800,
                                background: 'rgba(79, 70, 229, 0.1)',
                                padding: '0.1rem 0.45rem',
                                borderRadius: '4px'
                              }}>
                                <Users size={10} />
                                {e.squad_name.toUpperCase()}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.9rem 1rem', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                              color: 'var(--text-color)'
                            }}>
                              <span style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '6px',
                                background: 'var(--primary)',
                                color: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.68rem',
                                fontWeight: 800
                              }}>
                                {e.payer.charAt(0).toUpperCase()}
                              </span>
                              {e.payer}
                            </span>
                          </td>
                          <td style={{ padding: '0.9rem 1rem', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              border: `1px solid ${CATEGORIES[e.category]?.color || '#868e96'}35`,
                              background: `${CATEGORIES[e.category]?.color || '#868e96'}12`,
                              color: CATEGORIES[e.category]?.color || 'var(--text-dim)'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: CATEGORIES[e.category]?.color || '#868e96' }} />
                              {CATEGORIES[e.category]?.label || e.category}
                            </span>
                          </td>
                          <td style={{ padding: '0.9rem 1rem', whiteSpace: 'nowrap' }}>
                            <span className={`app-badge ${PAYMENT_APPS[e.payment_app]?.badge || 'badge-purple'}`} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '8px' }}>
                              {PAYMENT_APPS[e.payment_app]?.label || e.payment_app}
                            </span>
                          </td>
                          <td style={{ padding: '0.9rem 1rem', textAlign: 'right', fontWeight: 900, fontSize: '0.95rem', color: 'var(--text-color)', whiteSpace: 'nowrap' }}>
                            ₹ {Number(e.amount).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.9rem 0.5rem', textAlign: 'center' }}>
                            <button
                              onClick={() => triggerDelete(e.id)}
                              title="Delete entry"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-dim)',
                                padding: '6px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={el => el.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={el => el.currentTarget.style.color = 'var(--text-dim)'}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: CHARTS & SQUAD QUICK SETTLEMENTS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>

          {/* Widget 1: Category Breakdown Doughnut Chart */}
          <div className="card" style={{
            borderRadius: '20px',
            padding: '1.5rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-color)' }}>
                Spending Distribution
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {activeExpenses.length} Ops
              </span>
            </div>

            {Object.keys(categoryTotals).length > 0 ? (
              <div>
                <div style={{ position: 'relative', width: '100%', height: '200px', marginBottom: '1.25rem' }}>
                  <canvas ref={chartRef}></canvas>
                </div>

                {/* Custom Category List with Percentages */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
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
                          padding: '0.45rem 0.65rem',
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.02)',
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
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                <Info size={32} style={{ color: 'var(--text-dim)', margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>No Expense Categories</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: 0 }}>
                  Log an expense to visualize category distributions.
                </p>
              </div>
            )}
          </div>

          {/* Widget 2: Squad Quick Settlements Card */}
          <div className="card" style={{
            borderRadius: '20px',
            padding: '1.5rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-color)' }}>
                  Squad Settlements
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                  Active balances calculated all-time
                </span>
              </div>

              {/* Squad Selector */}
              {squads.length > 0 && (
                <select
                  value={selectedSquadForSettlements || ''}
                  onChange={e => setSelectedSquadForSettlements(e.target.value)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-color)',
                    cursor: 'pointer'
                  }}
                >
                  {squads.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
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
                        padding: '0.75rem 0.9rem',
                        borderRadius: '12px',
                        background: heOwesMe ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                        border: `1px solid ${heOwesMe ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: heOwesMe ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: heOwesMe ? '#10b981' : '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.8rem'
                        }}>
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-color)' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: heOwesMe ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {heOwesMe ? `Owes you ₹${item.balance.toFixed(2)}` : `You owe ₹${Math.abs(item.balance).toFixed(2)}`}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => triggerQuickSettle(item.handle, item.balance)}
                        style={{
                          background: heOwesMe ? '#10b981' : 'var(--primary)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
                          transition: 'transform 0.15s ease'
                        }}
                      >
                        <span>Settle</span>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '2rem 1rem',
                background: 'rgba(16, 185, 129, 0.03)',
                borderRadius: '12px',
                border: '1px dashed rgba(16, 185, 129, 0.25)'
              }}>
                <CheckCircle2 size={32} style={{ color: '#10b981', margin: '0 auto 0.5rem auto' }} />
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-color)', margin: '0 0 0.25rem 0' }}>
                  All Clear in {selectedSquadForSettlements || 'Squad'}
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: 0 }}>
                  No pending balances or unsettled liabilities.
                </p>
              </div>
            )}
          </div>

        </div>

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
              className="modal-content"
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '420px',
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '24px',
                padding: '2rem',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
              }}
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

      {/* Delete Confirmation Modal Dialog */}
      {deleteModal.isOpen && (
        <ModalPortal>
          <div
            className="modal-overlay"
            onClick={() => setDeleteModal({ isOpen: false, id: null })}
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
              className="modal-content"
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '420px',
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '24px',
                padding: '2rem',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-color)' }}>
                    Delete Expense?
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>
                    Irreversible Operation
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1.75rem', lineHeight: '1.5' }}>
                This expense record will be permanently deleted from the active tactical ledger. All associated calculations and member balances will be updated immediately.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setDeleteModal({ isOpen: false, id: null })}
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
                  onClick={executeDelete}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: '#ef4444',
                    color: '#ffffff',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  Delete Record
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
