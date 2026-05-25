import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  ArrowRight, 
  Download, 
  Trash2, 
  Shield, 
  Calendar, 
  DollarSign, 
  Activity, 
  CreditCard, 
  Search,
  Users,
  Info
} from 'lucide-react';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const CATEGORIES = {
  food: { label: 'Food & Rations', color: '#ffaa00' },
  rent: { label: 'Base Rent', color: '#00d2ff' },
  travel: { label: 'Transport & Travel', color: '#0ea5e9' },
  utility: { label: 'Infrastructure/Utilities', color: '#ff007f' },
  other: { label: 'Unclassified Operations', color: '#868e96' }
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

  // States
  const [expenses, setExpenses] = useState([]);
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [selectedSquadForSettlements, setSelectedSquadForSettlements] = useState(null);

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
  const monthOptions = [];
  const today = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    monthOptions.push({ value: `${yyyy}-${mm}`, label });
  }

  // Fetch Data (combined endpoint)
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/expenses/data', { headers: authHeaders });
      if (!res.ok) throw new Error('Secure connection failed.');
      const data = await res.json();
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
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered expenses for selected month
  const monthlyExpenses = expenses.filter(e => e.date.substring(0, 7) === selectedMonth);

  // Search & category filters
  const filteredExpenses = monthlyExpenses.filter(e => {
    const matchesSearch = 
      e.where_spent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.payer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Volume & entry count (excluding settlements)
  const activeExpenses = monthlyExpenses.filter(e => e.category !== 'settlement');
  const totalVolume = activeExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalEntries = activeExpenses.length;

  // Calculate Net Personal Balance (spent vs share in selected month)
  const myHandle = user?.username ? user.username.split('@')[0].toLowerCase() : '';
  let totalSpent = 0;
  let totalShare = 0;
  const categoryTotals = {};

  monthlyExpenses.forEach(e => {
    const payer = e.payer.toLowerCase();
    
    // User is payer
    if (payer === myHandle) {
      totalSpent += Number(e.amount);
    }
    
    // User share
    let share = 0;
    if (e.members && typeof e.members === 'object' && !Array.isArray(e.members)) {
      if (e.members[myHandle] !== undefined) {
        share = Number(e.members[myHandle]);
      }
    } else if (Array.isArray(e.members)) {
      if (e.members.map(m => m.toLowerCase()).includes(myHandle)) {
        share = Number(e.share);
      }
    }
    totalShare += share;

    // Chart category accumulations
    if (e.category !== 'settlement') {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount);
    }
  });

  const netBalance = totalSpent - totalShare;

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
      // Draw placeholder or no data
      return;
    }

    chartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: 'transparent',
          hoverOffset: 12,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: isDark ? '#fff' : '#0f172a',
              font: { family: 'Outfit', size: 11, weight: '600' },
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          }
        },
        cutout: '72%'
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [categoryTotals, loading, theme]);

  // Compute Squad Settlements (calculated across ALL time)
  const squadSettlements = [];
  if (selectedSquadForSettlements) {
    const squad = squads.find(s => s.name === selectedSquadForSettlements);
    if (squad) {
      const myUid = user?.unique_id?.toLowerCase() || '';
      // Find all members in the squad (excluding myself)
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

      // Convert to display settlements
      for (const [mName, bal] of Object.entries(balances)) {
        if (Math.abs(bal) > 0.05) {
          const matchedMem = squad.members.find(sm => sm.name.toLowerCase() === mName);
          squadSettlements.push({
            name: matchedMem?.display_name || mName,
            handle: mName,
            balance: bal
          });
        }
      }
    }
  }

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
    
    // Settlement entry body
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
      fetchData();
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
      fetchData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  return (
    <div className="view-section">
      {/* Header */}
      <header className="content-header">
        <div className="header-title">
          <h2>Dashboard</h2>
          <p>Operative Command & Ledger status.</p>
        </div>
        <div className="header-actions">
          <div className="search-bar">
            <Search size={16} style={{ color: 'var(--text-dim)' }} />
            <input 
              type="text" 
              placeholder="Search expenses..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          <select 
            className="month-selector"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <Link to="/expenses/new" className="btn-glass" style={{ textDecoration: 'none', background: 'var(--primary)', color: 'var(--btn-text-color)', border: 'none' }}>
            <Plus size={16} />
            <span>Launch Split</span>
          </Link>
        </div>
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Left Column: Stats & Analytics & Recent Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Stats widgets */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-icon total">
                <DollarSign size={24} />
              </div>
              <div>
                <span className="stat-label">Tactical Volume</span>
                <span className="stat-value">₹ {totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon entries">
                <Activity size={24} />
              </div>
              <div>
                <span className="stat-label">Active Missions</span>
                <span className="stat-value">{totalEntries} entries</span>
              </div>
            </div>
          </div>

          {/* Doughnut Chart Card */}
          {Object.keys(categoryTotals).length > 0 ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '320px' }}>
              <h3 style={{ alignSelf: 'flex-start', marginBottom: '1rem', fontSize: '1rem', fontWeight: 800 }}>Category Breakdown</h3>
              <div style={{ position: 'relative', width: '100%', height: '230px' }}>
                <canvas ref={chartRef}></canvas>
              </div>
            </div>
          ) : (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', textAlign: 'center' }}>
              <Info size={36} style={{ color: 'var(--text-dim)', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.25rem' }}>No Data Encoded</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>No operational expenses logged in this monthly segment.</p>
            </div>
          )}

          {/* Recent Activity Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Tactical Ledger</h3>
              <div className="filter-chips">
                <span 
                  className={`chip ${categoryFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setCategoryFilter('all')}
                >
                  All Ops
                </span>
                {Object.keys(CATEGORIES).map(k => (
                  <span 
                    key={k} 
                    className={`chip ${categoryFilter === k ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(k)}
                  >
                    {CATEGORIES[k].label}
                  </span>
                ))}
              </div>
            </div>

            {loading ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>Syncing ledger...</p>
            ) : filteredExpenses.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>No operational logs matching current filters.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Mission Objective</th>
                      <th>Payer</th>
                      <th>Category</th>
                      <th>Execution</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map(e => (
                      <tr key={e.id}>
                        <td>{new Date(e.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{e.where_spent}</div>
                          {e.squad_name && <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800 }}>SQUAD: {e.squad_name.toUpperCase()}</div>}
                        </td>
                        <td><span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{e.payer}</span></td>
                        <td>
                          <span className="cat-badge" style={{ borderColor: CATEGORIES[e.category]?.color + '40', background: CATEGORIES[e.category]?.color + '10' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: CATEGORIES[e.category]?.color || '#868e96' }}></span>
                            {CATEGORIES[e.category]?.label || e.category}
                          </span>
                        </td>
                        <td>
                          <span className={`app-badge ${PAYMENT_APPS[e.payment_app]?.badge || 'badge-green'}`}>
                            {PAYMENT_APPS[e.payment_app]?.label || e.payment_app}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-color)' }}>₹ {e.amount.toFixed(2)}</td>
                        <td>
                          <button 
                            className="btn-delete" 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                            onClick={() => triggerDelete(e.id)}
                          >
                            <Trash2 size={15} style={{ color: '#ff3b30' }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Balance overview & Settlements */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Net balance card */}
          <div className="card personal-summary">
            <h3>Obligation Status</h3>
            <div className="summary-details">
              <div className="summary-row">
                <span className="lbl">Total Disbursed</span>
                <span className="val">₹ {totalSpent.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span className="lbl">System Liability</span>
                <span className="val">₹ {totalShare.toFixed(2)}</span>
              </div>
              <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.5rem 0' }}></div>
              <div className="summary-row" style={{ alignItems: 'center' }}>
                <span style={{ fontWeight: 800 }}>Net Friction</span>
                <span className={`val ${netBalance >= 0 ? 'balance-positive' : 'balance-negative'}`} style={{ fontSize: '1.25rem', fontWeight: 900 }}>
                  {netBalance >= 0 ? '+' : ''}₹ {netBalance.toFixed(2)}
                </span>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                <Calendar size={12} />
                <span>Active Cycle: 5th of Month to Date</span>
              </div>
            </div>
          </div>

          {/* Settlements cycle widget */}
          <div className="card">
            <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Squad settlements</h3>
              
              {squads.length > 0 && (
                <select 
                  className="theme-select"
                  style={{ padding: '0.3rem 0.8rem !important', fontSize: '0.75rem !important' }}
                  value={selectedSquadForSettlements || ''}
                  onChange={e => setSelectedSquadForSettlements(e.target.value)}
                >
                  {squads.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            {squads.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', padding: '1rem 0' }}>
                No active tactical squads found. Establish one in Squad Command.
              </p>
            ) : !selectedSquadForSettlements ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', padding: '1rem 0' }}>
                Select a squad.
              </p>
            ) : squadSettlements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <Shield size={36} style={{ color: '#22c55e', opacity: 0.5, marginBottom: '0.5rem' }} />
                <h4 style={{ color: '#22c55e', fontSize: '0.9rem', fontWeight: 800 }}>Squad Balanced</h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>No operational debts or receivables inside this squad.</p>
              </div>
            ) : (
              <div className="mini-ledger">
                {squadSettlements.map(item => (
                  <div key={item.handle} className={`ledger-item ${item.balance > 0 ? 'receivable' : 'payable'}`}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.name}</div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>@{item.handle}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                      <span className={item.balance > 0 ? 'balance-positive' : 'balance-negative'} style={{ fontWeight: 800 }}>
                        {item.balance > 0 ? 'Owes you' : 'You owe'} ₹ {Math.abs(item.balance).toFixed(2)}
                      </span>
                      <button 
                        className="btn-glass"
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.65rem',
                          borderRadius: '8px',
                          border: '1px solid ' + (item.balance > 0 ? '#22c55e30' : '#ef444430'),
                          background: item.balance > 0 ? '#22c55e10' : '#ef444410',
                          color: item.balance > 0 ? '#22c55e' : '#ef4444',
                          fontWeight: 700
                        }}
                        onClick={() => triggerQuickSettle(item.handle, item.balance)}
                      >
                        {item.balance > 0 ? 'Mark Received' : 'Settle Now'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settle Modal Dialog */}
      {settlementModal.isOpen && (
        <div className="modal-overlay" onClick={() => setSettlementModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>Settle Mutual Balance</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              You are about to record a settlement payment of <br/><br/>
              <strong style={{ color: 'var(--text-color)' }}>₹ {settlementModal.amount.toFixed(2)}</strong>{' '}
              to{' '}
              <strong style={{ color: 'var(--text-color)', textTransform: 'capitalize' }}>{settlementModal.otherUser}</strong> in{' '}
              <strong style={{ color: 'var(--text-color)' }}>{settlementModal.squadName}</strong>.
            </p>
            <div className="flex-row-mobile-stack" style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <button 
                className="btn-glass" 
                style={{ flex: 1 }}
                onClick={() => setSettlementModal(prev => ({ ...prev, isOpen: false }))}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 1, marginTop: 0 }}
                onClick={executeSettlement}
              >
                Log Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal Dialog */}
      {deleteModal.isOpen && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ isOpen: false, id: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: '#ff3b30' }}>Delete Entry?</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              This record will be permanently deleted from the active tactical ledger database. This operation is irreversible.
            </p>
            <div className="flex-row-mobile-stack" style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <button 
                className="btn-glass" 
                style={{ flex: 1 }}
                onClick={() => setDeleteModal({ isOpen: false, id: null })}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 1, marginTop: 0, background: '#ff3b30', boxShadow: 'none' }}
                onClick={executeDelete}
              >
                Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
