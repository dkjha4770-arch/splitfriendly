import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModalPortal from '../components/ModalPortal';
import { 
  Plus, 
  Download, 
  Trash2, 
  Search, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';

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

export const Expenses = () => {
  const { user, token } = useAuth();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  
  // Data State
  const [expenses, setExpenses] = useState([]);
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);
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

  // Fetch Expenses + Squads (using /data endpoint for squad membership)
  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/expenses/data', { headers: authHeaders });
      if (!res.ok) throw new Error('Secure connection failed.');
      const data = await res.json();
      setExpenses(data.expenses || []);
      setSquads(data.squads || []);
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
  const mySquadNames = new Set(
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

  // Helper: check if the current user is relevant to this expense
  // True when:
  //  1. User is the payer, OR
  //  2. User is explicitly in the members list, OR
  //  3. Expense belongs to a squad the user is a member of
  const isMyExpense = (e) => {
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
  };

  // Filtered lists (excluding settlements, scoped to current user's expenses)
  const monthlyExpenses = expenses.filter(e =>
    e.date.substring(0, 7) === selectedMonth &&
    e.category !== 'settlement' &&
    isMyExpense(e)
  );
  const filteredExpenses = monthlyExpenses.filter(e => {
    const matchesSearch = 
      e.where_spent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.payer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Delete Handlers
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
      fetchExpenses();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleExport = () => {
    // Standard secure cookie navigation triggers download attachment from browser
    window.open('/api/expenses/export', '_blank');
  };

  return (
    <div className="view-section">
      {/* Header */}
      <header className="content-header">
        <div className="header-title">
          <h2>Ledger Logs</h2>
          <p>Operative archives of tracking events.</p>
        </div>
        <div className="header-actions">
          <div className="search-bar">
            <Search size={16} style={{ color: 'var(--text-dim)' }} />
            <input 
              type="text" 
              placeholder="Search objective/payer..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '50px', padding: '2px 8px' }}>
            <button className="btn-delete" style={{ padding: '6px' }} onClick={() => navigateMonth(-1)}>
              <ChevronLeft size={16} />
            </button>
            <select 
              className="month-selector"
              style={{ border: 'none !important', background: 'none !important', padding: '0.4rem 1rem !important', margin: 0 }}
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button className="btn-delete" style={{ padding: '6px' }} onClick={() => navigateMonth(1)}>
              <ChevronRight size={16} />
            </button>
          </div>

          <button className="btn-glass" onClick={handleExport}>
            <Download size={16} />
            <span>Export CSV</span>
          </button>

          <Link to="/expenses/new" className="btn-glass" style={{ textDecoration: 'none', background: 'var(--primary)', color: 'var(--btn-text-color)', border: 'none' }}>
            <Plus size={16} />
            <span>Log Expense</span>
          </Link>
        </div>
      </header>

      {/* Main Panel */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Missions Ledger Summary</h3>
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
          <p style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>Loading archives...</p>
        ) : filteredExpenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <Info size={40} style={{ color: 'var(--text-dim)', marginBottom: '1rem', opacity: 0.5 }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.25rem' }}>No Entries Registered</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>No matching operational entries exist for selected segment.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Execution Date</th>
                  <th>Added On</th>
                  <th>Mission Objective</th>
                  <th>Payer</th>
                  <th>Category Scope</th>
                  <th>Pay App Channel</th>
                  <th>Group Share Details</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(e => {
                  let membersText = '';
                  try {
                    const parsedMems = typeof e.members === 'string' ? JSON.parse(e.members || '[]') : e.members;
                    if (Array.isArray(parsedMems)) {
                      membersText = parsedMems.join(', ');
                    } else if (parsedMems && typeof parsedMems === 'object') {
                      membersText = Object.keys(parsedMems).join(', ');
                    }
                  } catch (err) {
                    membersText = String(e.members || '');
                  }

                  return (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(e.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        {e.created_at ? new Date(e.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', year: '2-digit', hour: 'numeric', minute: 'numeric' }) : '-'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{e.where_spent}</div>
                        {e.squad_name && <span style={{ fontSize: '0.65rem', background: 'rgba(14, 165, 233, 0.1)', color: 'var(--primary)', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>SQUAD: {e.squad_name}</span>}
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
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: '1.4' }}>
                        {membersText}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setDeleteModal({ isOpen: false, id: null })}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: '#ff3b30' }}>Delete Entry?</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                This record will be permanently deleted from the active database. This operation is irreversible.
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
        </ModalPortal>
      )}
    </div>
  );
};

export default Expenses;
