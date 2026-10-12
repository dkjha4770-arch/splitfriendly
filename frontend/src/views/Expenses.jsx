import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModalPortal from '../components/ModalPortal';
import { getExpensesData, getCachedExpensesData, invalidateExpensesCache } from '../utils/dataCache';
import './Expenses.css';
import { 
  Plus, 
  Download, 
  Trash2, 
  Search, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
  List,
  LayoutGrid,
  ArrowUpDown,
  Wallet,
  CreditCard,
  PieChart,
  Users,
  X,
  AlertTriangle,
  Receipt,
  Layers,
  Sparkles
} from 'lucide-react';

const CATEGORIES = {
  food: { label: 'Food & Rations', color: '#ffaa00' },
  rent: { label: 'Base Rent', color: '#00d2ff' },
  travel: { label: 'Transport & Travel', color: '#0ea5e9' },
  utility: { label: 'Infrastructure/Utilities', color: '#ff007f' },
  other: { label: 'Unclassified Operations', color: '#868e96' }
};

const PAYMENT_APPS = {
  gpay: { label: 'Google Pay', badge: 'app-badge-purple' },
  phonepe: { label: 'PhonePe', badge: 'app-badge-purple' },
  slice: { label: 'Slice Card', badge: 'app-badge-green' },
  cash: { label: 'Cash Reserve', badge: 'app-badge-green' },
  upi: { label: 'UPI Direct', badge: 'app-badge-purple' }
};

export const Expenses = () => {
  const { user, token } = useAuth();
  const authHeaders = useMemo(() => (token ? { 'Authorization': `Bearer ${token}` } : {}), [token]);
  
  // Data State — restored instantly from cache if available
  const initialCache = getCachedExpensesData();
  const [expenses, setExpenses] = useState(() => initialCache?.expenses || []);
  const [squads, setSquads] = useState(() => initialCache?.squads || []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [error, setError] = useState(null);

  // Filters State
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [payerFilter, setPayerFilter] = useState('all'); // 'all', 'me', 'others'
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc', 'date-asc', 'amount-desc', 'amount-asc'
  const [viewMode, setViewMode] = useState('grid'); // Default to 'grid' (cards view), or 'table'

  // Modal State for Confirm Delete
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    id: null
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal State for Allocated Members Details Popup
  const [membersModal, setMembersModal] = useState({
    isOpen: false,
    expense: null
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

  // Fetch Expenses + Squads (using SWR dataCache)
  const fetchExpenses = useCallback(async (forceRefresh = false) => {
    try {
      if (!getCachedExpensesData()) {
        setLoading(true);
      }
      const data = await getExpensesData(authHeaders, forceRefresh);
      setExpenses(data.expenses || []);
      setSquads(data.squads || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (token) {
      fetchExpenses();
    }
  }, [token, fetchExpenses]);

  // Handle Month Navigation
  const navigateMonth = (direction) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + direction, 1);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${yyyy}-${mm}`);
  };

  // Derive the current user's handle (username without @domain)
  const myHandle = user?.username ? user.username.split('@')[0].toLowerCase() : '';

  // Build set of squad names the current user belongs to
  const mySquadNames = useMemo(() => {
    return new Set(
      squads
        .filter(s => {
          try {
            const mems = typeof s.members === 'string' ? JSON.parse(s.members || '[]') : s.members;
            if (Array.isArray(mems)) return mems.some(m => String(m).toLowerCase() === myHandle);
            if (mems && typeof mems === 'object') return Object.keys(mems).some(k => k.toLowerCase() === myHandle);
          } catch (_) { /* ignore */ }
          return false;
        })
        .map(s => s.name)
    );
  }, [squads, myHandle]);

  // Helper: check if the current user is relevant to this expense
  const isMyExpense = useCallback((e) => {
    // 1. I am the payer
    if ((e.payer || '').toLowerCase() === myHandle) return true;

    // 2. I am in the members list
    try {
      const mems = typeof e.members === 'string' ? JSON.parse(e.members || '[]') : e.members;
      if (Array.isArray(mems)) {
        if (mems.some(m => String(m).toLowerCase() === myHandle)) return true;
      }
      if (mems && typeof mems === 'object') {
        if (Object.keys(mems).some(k => k.toLowerCase() === myHandle)) return true;
      }
    } catch (_) {
      // ignore parse errors
    }

    // 3. The expense belongs to a squad I am a member of
    if (e.squad_name && mySquadNames.has(e.squad_name)) return true;

    return false;
  }, [myHandle, mySquadNames]);

  // Helper: parse members cleanly
  const parseMembers = (members) => {
    try {
      const parsed = typeof members === 'string' ? JSON.parse(members || '[]') : members;
      if (Array.isArray(parsed)) {
        return parsed.map(m => String(m));
      } else if (parsed && typeof parsed === 'object') {
        return Object.keys(parsed).map(k => String(k));
      }
    } catch (_) {
      return members ? [String(members)] : [];
    }
    return [];
  };

  // Helper: Detailed member breakdown with shares for the popup modal
  const getMembersDetails = useCallback((expense) => {
    if (!expense) return [];
    try {
      const raw = expense.members;
      let parsed = raw;
      if (typeof raw === 'string') {
        try {
          parsed = JSON.parse(raw);
        } catch {
          if (raw.includes(',')) {
            parsed = raw.split(',').map(s => s.trim()).filter(Boolean);
          }
        }
      }

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.entries(parsed).map(([name, shareAmount]) => ({
          name: String(name).trim(),
          share: Number(shareAmount) || 0,
          isCustom: true
        }));
      } else if (Array.isArray(parsed)) {
        const count = parsed.length || 1;
        const equalShare = Number(expense.share) || (Number(expense.amount) / count);
        return parsed.map(m => ({
          name: String(m).trim(),
          share: equalShare,
          isCustom: false
        }));
      } else if (raw) {
        return [{
          name: String(raw).trim(),
          share: Number(expense.amount) || 0,
          isCustom: false
        }];
      }
    } catch (_) {
      if (expense.members) {
        return [{
          name: String(expense.members).trim(),
          share: Number(expense.amount) || 0,
          isCustom: false
        }];
      }
    }
    return [];
  }, []);

  // Handle ESC key to dismiss open modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (membersModal.isOpen) {
          setMembersModal({ isOpen: false, expense: null });
        } else if (deleteModal.isOpen && !isDeleting) {
          setDeleteModal({ isOpen: false, id: null });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [membersModal.isOpen, deleteModal.isOpen, isDeleting]);

  // Helper: Calculate user's share for an expense
  const getMyShare = useCallback((e) => {
    if (!e.members) return 0;
    try {
      const parsed = typeof e.members === 'string' ? JSON.parse(e.members || '[]') : e.members;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (parsed[myHandle] !== undefined) return Number(parsed[myHandle]);
      } else if (Array.isArray(parsed)) {
        if (parsed.some(m => String(m).toLowerCase() === myHandle)) {
          return Number(e.share) || (Number(e.amount) / (parsed.length || 1));
        }
      }
    } catch (_) {
      // ignore parse errors
    }
    return 0;
  }, [myHandle]);

  // Filtered lists (excluding settlements, scoped to current user's expenses)
  const monthlyExpenses = useMemo(() => {
    return expenses.filter(e =>
      e.date.substring(0, 7) === selectedMonth &&
      e.category !== 'settlement' &&
      isMyExpense(e)
    );
  }, [expenses, selectedMonth, isMyExpense]);

  // Apply search, category, payer, and sorting
  const filteredExpenses = useMemo(() => {
    let result = monthlyExpenses.filter(e => {
      const matchesSearch = 
        e.where_spent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.payer.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;

      const payerLower = (e.payer || '').toLowerCase();
      const matchesPayer = 
        payerFilter === 'all' ||
        (payerFilter === 'me' && payerLower === myHandle) ||
        (payerFilter === 'others' && payerLower !== myHandle);
      
      return matchesSearch && matchesCategory && matchesPayer;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.date) - new Date(a.date) || b.id - a.id;
      }
      if (sortBy === 'date-asc') {
        return new Date(a.date) - new Date(b.date) || a.id - b.id;
      }
      if (sortBy === 'amount-desc') {
        return Number(b.amount) - Number(a.amount);
      }
      if (sortBy === 'amount-asc') {
        return Number(a.amount) - Number(b.amount);
      }
      return 0;
    });

    return result;
  }, [monthlyExpenses, searchQuery, categoryFilter, payerFilter, sortBy, myHandle]);

  // Category counts within the current month
  const categoryCounts = useMemo(() => {
    const counts = { all: monthlyExpenses.length };
    Object.keys(CATEGORIES).forEach(k => { counts[k] = 0; });
    monthlyExpenses.forEach(e => {
      if (counts[e.category] !== undefined) {
        counts[e.category] += 1;
      }
    });
    return counts;
  }, [monthlyExpenses]);

  // Aggregate Metrics for Top Stats Cards
  const stats = useMemo(() => {
    let totalSpent = 0;
    let myPaid = 0;
    let myShare = 0;
    const catAmounts = {};

    monthlyExpenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      totalSpent += amt;

      if ((e.payer || '').toLowerCase() === myHandle) {
        myPaid += amt;
      }

      myShare += getMyShare(e);

      catAmounts[e.category] = (catAmounts[e.category] || 0) + amt;
    });

    let topCatKey = null;
    let maxCatAmt = 0;
    for (const [k, v] of Object.entries(catAmounts)) {
      if (v > maxCatAmt) {
        maxCatAmt = v;
        topCatKey = k;
      }
    }

    return {
      totalSpent,
      myPaid,
      myShare,
      count: monthlyExpenses.length,
      topCategory: topCatKey ? CATEGORIES[topCatKey]?.label : 'None'
    };
  }, [monthlyExpenses, myHandle, getMyShare]);

  // Delete Handlers
  const triggerDelete = (id) => {
    setDeleteModal({
      isOpen: true,
      id
    });
  };

  const executeDelete = async () => {
    if (!deleteModal.id) return;
    setIsDeleting(true);
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
      fetchExpenses(true);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    // Standard secure cookie navigation triggers download attachment from browser
    window.open('/api/expenses/export', '_blank');
  };

  // Find expense item being deleted for preview in modal
  const itemToDelete = useMemo(() => {
    if (!deleteModal.id) return null;
    return expenses.find(e => e.id === deleteModal.id);
  }, [deleteModal.id, expenses]);

  // Selected month label
  const currentMonthLabel = useMemo(() => {
    const opt = monthOptions.find(o => o.value === selectedMonth);
    return opt ? opt.label : selectedMonth;
  }, [monthOptions, selectedMonth]);

  return (
    <div className="view-section expenses-container">
      {/* Redesigned Header */}
      <header className="ledger-header">
        <div className="ledger-title-area">
          <div className="ledger-title-badge-row">
            <h2>
              <Receipt size={24} style={{ color: 'var(--primary)' }} />
              Expense Ledger
            </h2>
            <div className="ledger-status-pill">
              <span className="ledger-status-dot"></span>
              <span>{currentMonthLabel}</span>
            </div>
          </div>
          <p className="ledger-subtitle">
            Comprehensive audit record of all operative missions, squad allocations & expenditures.
          </p>
        </div>

        <div className="ledger-header-actions">
          <button className="btn-export-csv" onClick={handleExport} title="Download entire ledger in CSV format">
            <Download size={16} />
            <span>Export CSV</span>
          </button>

          <Link to="/expenses/new" className="btn-log-expense-primary">
            <Plus size={17} />
            <span>Log Expense</span>
          </Link>
        </div>
      </header>

      {/* Quick Summary Metrics Grid */}
      <div className="ledger-metrics-grid">
        <div className="ledger-metric-card">
          <div className="ledger-metric-header">
            <span className="ledger-metric-label">Total Volume</span>
            <div className="ledger-metric-icon-wrap icon-wrap-primary">
              <Wallet size={18} />
            </div>
          </div>
          <div className="ledger-metric-value-wrap">
            <div className="ledger-metric-value">
              ₹ {stats.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="ledger-metric-subtext">Across {stats.count} recorded missions this month</span>
          </div>
        </div>

        <div className="ledger-metric-card">
          <div className="ledger-metric-header">
            <span className="ledger-metric-label">Paid by You</span>
            <div className="ledger-metric-icon-wrap icon-wrap-green">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="ledger-metric-value-wrap">
            <div className="ledger-metric-value" style={{ color: '#10b981' }}>
              ₹ {stats.myPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="ledger-metric-subtext">Direct out-of-pocket fronting</span>
          </div>
        </div>

        <div className="ledger-metric-card">
          <div className="ledger-metric-header">
            <span className="ledger-metric-label">Your Net Share</span>
            <div className="ledger-metric-icon-wrap icon-wrap-cyan">
              <Users size={18} />
            </div>
          </div>
          <div className="ledger-metric-value-wrap">
            <div className="ledger-metric-value" style={{ color: '#0ea5e9' }}>
              ₹ {stats.myShare.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="ledger-metric-subtext">Your allocated obligation</span>
          </div>
        </div>

        <div className="ledger-metric-card">
          <div className="ledger-metric-header">
            <span className="ledger-metric-label">Leading Category</span>
            <div className="ledger-metric-icon-wrap icon-wrap-amber">
              <PieChart size={18} />
            </div>
          </div>
          <div className="ledger-metric-value-wrap">
            <div className="ledger-metric-value" style={{ fontSize: '1.25rem' }}>
              {stats.topCategory}
            </div>
            <span className="ledger-metric-subtext">Primary area of capital allocation</span>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters Panel */}
      <div className="ledger-controls-panel">
        <div className="ledger-controls-top-row">
          {/* Search Box */}
          <div className="ledger-search-box">
            <Search size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            <input 
              type="text" 
              className="ledger-search-input"
              placeholder="Search mission objective or payer..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="ledger-search-clear" 
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="ledger-controls-actions-group">
            {/* Month Stepper */}
            <div className="ledger-month-stepper">
              <button 
                className="month-stepper-btn" 
                onClick={() => navigateMonth(-1)}
                title="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <Calendar size={14} style={{ color: 'var(--text-dim)', marginLeft: '4px' }} />
              <select 
                className="month-stepper-select"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button 
                className="month-stepper-btn" 
                onClick={() => navigateMonth(1)}
                title="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Sort Selector */}
            <select 
              className="ledger-sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              title="Sort entries"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Amount: High to Low</option>
              <option value="amount-asc">Amount: Low to High</option>
            </select>

            {/* View Mode Toggle */}
            <div className="ledger-segment-group">
              <button 
                className={`ledger-segment-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <List size={15} />
                <span>Table</span>
              </button>
              <button 
                className={`ledger-segment-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Card View"
              >
                <LayoutGrid size={15} />
                <span>Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Row: Category Chips & Payer Tabs */}
        <div className="ledger-filter-row">
          <div className="ledger-category-chips">
            <span 
              className={`ledger-chip ${categoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              All Ops
              <span className="ledger-chip-count">{categoryCounts.all}</span>
            </span>
            {Object.keys(CATEGORIES).map(k => (
              <span 
                key={k} 
                className={`ledger-chip ${categoryFilter === k ? 'active' : ''}`}
                onClick={() => setCategoryFilter(k)}
              >
                <span 
                  className="ledger-chip-dot" 
                  style={{ background: CATEGORIES[k].color }}
                />
                {CATEGORIES[k].label}
                <span className="ledger-chip-count">{categoryCounts[k] || 0}</span>
              </span>
            ))}
          </div>

          <div className="ledger-payer-tabs">
            <button 
              className={`ledger-payer-tab ${payerFilter === 'all' ? 'active' : ''}`}
              onClick={() => setPayerFilter('all')}
            >
              All Payers
            </button>
            <button 
              className={`ledger-payer-tab ${payerFilter === 'me' ? 'active' : ''}`}
              onClick={() => setPayerFilter('me')}
            >
              Paid by You
            </button>
            <button 
              className={`ledger-payer-tab ${payerFilter === 'others' ? 'active' : ''}`}
              onClick={() => setPayerFilter('others')}
            >
              Paid by Others
            </button>
          </div>
        </div>
      </div>

      {/* Main Ledger Content */}
      {loading ? (
        <div className="ledger-card-table-wrap">
          <div className="ledger-loading-container">
            <div className="skeleton-row" style={{ width: '40%' }}></div>
            <div className="skeleton-row" style={{ width: '100%' }}></div>
            <div className="skeleton-row" style={{ width: '100%' }}></div>
            <div className="skeleton-row" style={{ width: '100%' }}></div>
            <div className="skeleton-row" style={{ width: '90%' }}></div>
          </div>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="ledger-empty-state">
          <div className="empty-state-icon-circle">
            <Receipt size={32} />
          </div>
          <h4>No Ledger Entries Found</h4>
          <p>
            {searchQuery || categoryFilter !== 'all' || payerFilter !== 'all'
              ? 'No matching expenses found for the active filter set in ' + currentMonthLabel + '.'
              : 'No operational expenses have been recorded for ' + currentMonthLabel + ' yet.'}
          </p>
          <div className="empty-state-actions">
            {(searchQuery || categoryFilter !== 'all' || payerFilter !== 'all') && (
              <button 
                className="btn-export-csv"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setPayerFilter('all');
                }}
              >
                Reset Filters
              </button>
            )}
            <Link to="/expenses/new" className="btn-log-expense-primary">
              <Plus size={16} />
              <span>Log First Expense</span>
            </Link>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* Redesigned Table View */
        <div className="ledger-card-table-wrap no-card-layout">
          <div className="ledger-table-header-info">
            <h3>
              <Layers size={18} style={{ color: 'var(--primary)' }} />
              Operational Ledger Records
            </h3>
            <span className="ledger-count-tag">
              Showing {filteredExpenses.length} of {monthlyExpenses.length} entries
            </span>
          </div>

          <div className="ledger-table-scroll-container">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Mission Objective</th>
                  <th>Payer</th>
                  <th>Category</th>
                  <th>Channel</th>
                  <th>Group Share Details</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  <th style={{ width: '48px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(e => {
                  const membersList = parseMembers(e.members);
                  const isPayerMe = (e.payer || '').toLowerCase() === myHandle;
                  const catColor = CATEGORIES[e.category]?.color || '#868e96';

                  return (
                    <tr key={e.id}>
                      {/* Date & Time */}
                      <td>
                        <div className="cell-date-main">
                          {new Date(e.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="cell-date-sub">
                          {e.created_at ? new Date(e.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </div>
                      </td>

                      {/* Objective & Squad */}
                      <td>
                        <div className="cell-objective-wrap">
                          <span className="cell-objective-title">{e.where_spent}</span>
                          {e.squad_name && (
                            <span className="cell-squad-badge">
                              <Users size={11} />
                              {e.squad_name}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Payer */}
                      <td>
                        <div className="cell-payer-pill">
                          <div className="payer-avatar-circle">
                            {(e.payer || '?')[0].toUpperCase()}
                          </div>
                          <span>{e.payer}</span>
                          {isPayerMe && <span className="payer-self-tag">You</span>}
                        </div>
                      </td>

                      {/* Category */}
                      <td>
                        <span 
                          className="ledger-cat-badge"
                          style={{
                            borderColor: `${catColor}35`,
                            background: `${catColor}12`,
                            color: catColor
                          }}
                        >
                          <span 
                            className="ledger-cat-dot" 
                            style={{ background: catColor, boxShadow: `0 0 6px ${catColor}` }}
                          />
                          {CATEGORIES[e.category]?.label || e.category}
                        </span>
                      </td>

                      {/* Channel */}
                      <td>
                        <span className={`ledger-app-badge ${PAYMENT_APPS[e.payment_app]?.badge || 'app-badge-green'}`}>
                          {PAYMENT_APPS[e.payment_app]?.label || e.payment_app}
                        </span>
                      </td>

                      {/* Members */}
                      <td>
                        <div className="cell-members-wrap">
                          {membersList.slice(0, 3).map((m, idx) => (
                            <button 
                              key={idx} 
                              type="button"
                              className="member-chip"
                              onClick={() => setMembersModal({ isOpen: true, expense: e })}
                              title="Click to view all allocated members"
                            >
                              {m}
                            </button>
                          ))}
                          {membersList.length > 3 && (
                            <button 
                              type="button"
                              className="member-chip-more"
                              onClick={() => setMembersModal({ isOpen: true, expense: e })}
                              title={`Click to view all ${membersList.length} members`}
                              aria-label={`Show all ${membersList.length} members`}
                            >
                              +{membersList.length - 3} more
                            </button>
                          )}
                          {membersList.length === 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>-</span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="cell-amount-text">
                        ₹ {Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Action Delete */}
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn-delete-row"
                          onClick={() => triggerDelete(e.id)}
                          title="Delete record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Redesigned Card / Grid View */
        <div className="ledger-cards-grid">
          {filteredExpenses.map(e => {
            const membersList = parseMembers(e.members);
            const isPayerMe = (e.payer || '').toLowerCase() === myHandle;
            const catColor = CATEGORIES[e.category]?.color || '#868e96';

            return (
              <div key={e.id} className="ledger-expense-card">
                <div className="card-top-bar">
                  <div className="card-date-badge">
                    <Calendar size={12} />
                    <span>{new Date(e.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <span 
                    className="ledger-cat-badge"
                    style={{
                      borderColor: `${catColor}35`,
                      background: `${catColor}12`,
                      color: catColor
                    }}
                  >
                    <span 
                      className="ledger-cat-dot" 
                      style={{ background: catColor }}
                    />
                    {CATEGORIES[e.category]?.label || e.category}
                  </span>
                </div>

                <div className="card-main-info">
                  <h4 className="card-objective-title">{e.where_spent}</h4>
                  <div className="card-amount-large">
                    ₹ {Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  <div className="card-metadata-pills">
                    {e.squad_name && (
                      <span className="cell-squad-badge">
                        <Users size={11} />
                        Squad: {e.squad_name}
                      </span>
                    )}
                    <span className={`ledger-app-badge ${PAYMENT_APPS[e.payment_app]?.badge || 'app-badge-green'}`}>
                      {PAYMENT_APPS[e.payment_app]?.label || e.payment_app}
                    </span>
                  </div>
                </div>

                <div className="card-split-section">
                  <div className="card-split-row">
                    <span className="card-split-label">Payer</span>
                    <div className="cell-payer-pill">
                      <div className="payer-avatar-circle" style={{ width: '20px', height: '20px', fontSize: '0.65rem' }}>
                        {(e.payer || '?')[0].toUpperCase()}
                      </div>
                      <span>{e.payer}</span>
                      {isPayerMe && <span className="payer-self-tag">You</span>}
                    </div>
                  </div>

                  <div className="card-split-row" style={{ alignItems: 'flex-start', marginTop: '0.2rem' }}>
                    <span className="card-split-label">Allocated to</span>
                    <div className="cell-members-wrap" style={{ justifyContent: 'flex-end', maxWidth: '180px' }}>
                      {membersList.slice(0, 3).map((m, idx) => (
                        <button 
                          key={idx} 
                          type="button"
                          className="member-chip"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setMembersModal({ isOpen: true, expense: e });
                          }}
                          title="Click to view all allocated members"
                        >
                          {m}
                        </button>
                      ))}
                      {membersList.length > 3 && (
                        <button 
                          type="button"
                          className="member-chip-more"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setMembersModal({ isOpen: true, expense: e });
                          }}
                          title={`Click to view all ${membersList.length} members`}
                          aria-label={`Show all ${membersList.length} members`}
                        >
                          +{membersList.length - 3}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card-footer">
                  <span>
                    {e.created_at ? 'Logged ' + new Date(e.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Logged'}
                  </span>
                  <button 
                    className="btn-delete-row"
                    onClick={() => triggerDelete(e.id)}
                    title="Delete record"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Allocated Members Popup Modal */}
      {membersModal.isOpen && membersModal.expense && (
        <ModalPortal>
          <div 
            className="members-modal-overlay" 
            onClick={() => setMembersModal({ isOpen: false, expense: null })}
          >
            <div 
              className="members-modal-card" 
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="members-modal-title"
            >
              {/* Modal Header */}
              <div className="members-modal-header">
                <div className="members-modal-title-wrap">
                  <div className="members-modal-icon-badge">
                    <Users size={22} />
                  </div>
                  <div>
                    <h3 id="members-modal-title" className="members-modal-title">
                      Allocated Members
                    </h3>
                    <p className="members-modal-subtitle">
                      {membersModal.expense.where_spent || 'Expense Breakdown'}
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  className="members-modal-btn-close"
                  onClick={() => setMembersModal({ isOpen: false, expense: null })}
                  title="Close dialog"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Expense Summary Strip */}
              <div className="members-modal-summary-strip">
                <div className="summary-strip-main">
                  <span className="summary-strip-amount">
                    ₹ {Number(membersModal.expense.amount).toFixed(2)}
                  </span>
                  <div className="summary-strip-tags">
                    <span className="summary-date-tag">
                      <Calendar size={12} />
                      {new Date(membersModal.expense.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {CATEGORIES[membersModal.expense.category] && (
                      <span 
                        className="summary-cat-tag"
                        style={{
                          borderColor: `${CATEGORIES[membersModal.expense.category].color}40`,
                          color: CATEGORIES[membersModal.expense.category].color,
                          background: `${CATEGORIES[membersModal.expense.category].color}15`
                        }}
                      >
                        <span 
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: CATEGORIES[membersModal.expense.category].color
                          }} 
                        />
                        {CATEGORIES[membersModal.expense.category].label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="summary-payer-box">
                  <span className="summary-payer-label">Paid by</span>
                  <div className="summary-payer-row">
                    <div className="payer-avatar-circle" style={{ width: '22px', height: '22px', fontSize: '0.7rem' }}>
                      {(membersModal.expense.payer || '?')[0].toUpperCase()}
                    </div>
                    <span className="summary-payer-name">{membersModal.expense.payer}</span>
                    {(membersModal.expense.payer || '').toLowerCase() === myHandle && (
                      <span className="payer-self-tag">You</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Members List Section */}
              {(() => {
                const members = getMembersDetails(membersModal.expense);
                const isCustom = members.some(m => m.isCustom);
                const avgShare = Number(membersModal.expense.amount) / (members.length || 1);

                return (
                  <>
                    <div className="members-modal-list-header">
                      <div className="members-count-badge">
                        <Users size={14} />
                        <span>{members.length} {members.length === 1 ? 'Member' : 'Members'}</span>
                      </div>
                      <span className="members-split-type-note">
                        {isCustom ? 'Custom Split' : `Equal Split (~₹ ${avgShare.toFixed(2)} / person)`}
                      </span>
                    </div>

                    <div className="members-modal-list">
                      {members.map((m, idx) => {
                        const isMe = m.name.toLowerCase() === myHandle;
                        const isPayer = m.name.toLowerCase() === (membersModal.expense.payer || '').toLowerCase();

                        return (
                          <div key={idx} className={`members-modal-item ${isMe ? 'is-self' : ''}`}>
                            <div className="members-item-left">
                              <div className="member-avatar-circle">
                                {(m.name || '?')[0].toUpperCase()}
                              </div>
                              <div className="member-name-block">
                                <div className="member-name-row">
                                  <span className="member-display-name">{m.name}</span>
                                  {isMe && <span className="member-badge-you">You</span>}
                                  {isPayer && <span className="member-badge-payer">Payer</span>}
                                </div>
                                <span className="member-role-sub">
                                  {isPayer && isMe ? 'Payer & Contributor' : isPayer ? 'Paid full amount' : 'Split contributor'}
                                </span>
                              </div>
                            </div>

                            <div className="members-item-right">
                              <span className="member-share-val">
                                ₹ {m.share.toFixed(2)}
                              </span>
                              <span className="member-share-sub">share</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              {/* Modal Actions */}
              <div className="members-modal-actions">
                <button 
                  type="button"
                  className="btn-members-modal-done"
                  onClick={() => setMembersModal({ isOpen: false, expense: null })}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Redesigned Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <ModalPortal>
          <div className="delete-modal-overlay" onClick={() => !isDeleting && setDeleteModal({ isOpen: false, id: null })}>
            <div className="delete-modal-card" onClick={e => e.stopPropagation()}>
              <div className="delete-modal-icon-badge">
                <AlertTriangle size={26} />
              </div>

              <div>
                <h3 className="delete-modal-title">Delete Entry Record?</h3>
                <p className="delete-modal-text">
                  This expense entry will be permanently removed from the ledger and recalculate squad settlement balances.
                </p>
              </div>

              {itemToDelete && (
                <div className="delete-item-preview">
                  <div>
                    <div className="preview-objective">{itemToDelete.where_spent}</div>
                    <div className="preview-meta">
                      {new Date(itemToDelete.date).toLocaleDateString()} • Payer: {itemToDelete.payer}
                      {itemToDelete.squad_name ? ` • Squad: ${itemToDelete.squad_name}` : ''}
                    </div>
                  </div>
                  <div className="preview-amount">
                    ₹ {Number(itemToDelete.amount).toFixed(2)}
                  </div>
                </div>
              )}

              <div className="delete-modal-actions">
                <button 
                  className="btn-modal-cancel"
                  disabled={isDeleting}
                  onClick={() => setDeleteModal({ isOpen: false, id: null })}
                >
                  Cancel
                </button>
                <button 
                  className="btn-modal-confirm-delete"
                  disabled={isDeleting}
                  onClick={executeDelete}
                >
                  <Trash2 size={15} />
                  <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default Expenses;
