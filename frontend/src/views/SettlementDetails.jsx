import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModalPortal from '../components/ModalPortal';
import { 
  ArrowLeftRight, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Users, 
  UserCheck, 
  Download, 
  Calendar, 
  CheckCircle2, 
  ShieldAlert, 
  Info,
  ArrowRight,
  Plus
} from 'lucide-react';

const PAYMENT_APPS = {
  gpay: { label: 'Google Pay', badge: 'badge-purple' },
  phonepe: { label: 'PhonePe', badge: 'badge-purple' },
  slice: { label: 'Slice Card', badge: 'badge-green' },
  cash: { label: 'Cash Reserve', badge: 'badge-green' },
  upi: { label: 'UPI Direct', badge: 'badge-purple' }
};

export const SettlementDetails = () => {
  const { user, token } = useAuth();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  const myHandle = user?.username ? user.username.split('@')[0].toLowerCase() : '';

  // Data State
  const [expenses, setExpenses] = useState([]);
  const [squads, setSquads] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter State
  const [selectedSquad, setSelectedSquad] = useState('ALL'); // 'ALL' or squad_name or 'DIRECT'
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' or 'month'
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/expenses/data', { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to load transaction data.');
      const data = await res.json();
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

  // Navigate Month
  const navigateMonth = (direction) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + direction, 1);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${yyyy}-${mm}`);
  };

  // Helper to extract receiver string from members
  const getReceiverHandle = (exp) => {
    try {
      const mems = typeof exp.members === 'string' ? JSON.parse(exp.members || '[]') : exp.members;
      if (Array.isArray(mems) && mems.length > 0) {
        return String(mems[0]).toLowerCase();
      }
      if (mems && typeof mems === 'object') {
        const keys = Object.keys(mems);
        if (keys.length > 0) return String(keys[0]).toLowerCase();
      }
    } catch (e) {
      // fallback
    }
    return '';
  };

  // All settlements across all time
  const allSettlements = useMemo(() => {
    return expenses.filter(e => e.category === 'settlement');
  }, [expenses]);

  // Group calculations (squads + direct)
  const groupStats = useMemo(() => {
    const map = {};

    // Initialize squads
    squads.forEach(s => {
      map[s.name] = {
        key: s.name,
        name: s.name,
        isDirect: false,
        totalAmount: 0,
        count: 0,
        latestDate: null
      };
    });

    // Initialize direct
    map['DIRECT'] = {
      key: 'DIRECT',
      name: 'Direct / Peer Settlements',
      isDirect: true,
      totalAmount: 0,
      count: 0,
      latestDate: null
    };

    allSettlements.forEach(st => {
      const gKey = st.squad_name ? st.squad_name : 'DIRECT';
      if (!map[gKey]) {
        map[gKey] = {
          key: gKey,
          name: gKey,
          isDirect: false,
          totalAmount: 0,
          count: 0,
          latestDate: null
        };
      }
      map[gKey].totalAmount += parseFloat(st.amount || 0);
      map[gKey].count += 1;
      if (!map[gKey].latestDate || new Date(st.date) > new Date(map[gKey].latestDate)) {
        map[gKey].latestDate = st.date;
      }
    });

    return Object.values(map);
  }, [squads, allSettlements]);

  // Filtered settlements according to squad, month, and search query
  const filteredSettlements = useMemo(() => {
    return allSettlements.filter(st => {
      // Group filter
      if (selectedSquad !== 'ALL') {
        if (selectedSquad === 'DIRECT') {
          if (st.squad_name) return false;
        } else {
          if (st.squad_name !== selectedSquad) return false;
        }
      }

      // Time filter
      if (timeFilter === 'month') {
        if (st.date.substring(0, 7) !== selectedMonth) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const payer = (st.payer || '').toLowerCase();
        const receiver = getReceiverHandle(st).toLowerCase();
        const where = (st.where_spent || '').toLowerCase();
        const squad = (st.squad_name || '').toLowerCase();
        const amount = String(st.amount || '');
        const match = payer.includes(q) || receiver.includes(q) || where.includes(q) || squad.includes(q) || amount.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [allSettlements, selectedSquad, timeFilter, selectedMonth, searchQuery]);

  // Summary stats for currently displayed records
  const totalFilteredAmount = useMemo(() => {
    return filteredSettlements.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  }, [filteredSettlements]);

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
      fetchData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Export Filtered Settlements to CSV
  const handleExportCSV = () => {
    if (filteredSettlements.length === 0) {
      alert('No settlements to export.');
      return;
    }
    const headers = ['Date', 'Squad', 'Payer (From)', 'Receiver (To)', 'Amount (INR)', 'Payment App', 'Note'];
    const rows = filteredSettlements.map(st => [
      st.date,
      st.squad_name || 'Direct / Solo',
      st.payer || '',
      getReceiverHandle(st),
      st.amount.toFixed(2),
      st.payment_app || 'upi',
      `"${(st.where_spent || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `settlements_${selectedSquad.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="view-section">
      {/* Header */}
      <header className="content-header">
        <div className="header-title">
          <h2>Settlement Details</h2>
          <p>Group-wise audit trail of all recorded settlements and transfers.</p>
        </div>
        <div className="header-actions">
          <div className="search-bar">
            <Search size={16} style={{ color: 'var(--text-dim)' }} />
            <input 
              type="text" 
              placeholder="Search member, group, amount..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '50px', padding: '3px 6px' }}>
            <button 
              className={`chip ${timeFilter === 'all' ? 'active' : ''}`}
              style={{ margin: 0, padding: '0.3rem 0.8rem', fontSize: '0.75rem', borderRadius: '50px' }}
              onClick={() => setTimeFilter('all')}
            >
              All Time
            </button>
            <button 
              className={`chip ${timeFilter === 'month' ? 'active' : ''}`}
              style={{ margin: 0, padding: '0.3rem 0.8rem', fontSize: '0.75rem', borderRadius: '50px' }}
              onClick={() => setTimeFilter('month')}
            >
              Monthly
            </button>
          </div>

          {timeFilter === 'month' && (
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '50px', padding: '2px 8px' }}>
              <button className="btn-delete" style={{ padding: '6px' }} onClick={() => navigateMonth(-1)}>
                <ChevronLeft size={16} />
              </button>
              <select 
                className="month-selector"
                style={{ border: 'none !important', background: 'none !important', padding: '0.4rem 0.8rem !important', margin: 0, fontSize: '0.82rem' }}
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
          )}

          <button className="btn-glass" onClick={handleExportCSV} title="Export CSV of current settlements">
            <Download size={16} />
            <span>Export CSV</span>
          </button>

          <Link to="/settlements" className="btn-glass" style={{ textDecoration: 'none', background: 'var(--primary)', color: 'var(--btn-text-color)', border: 'none' }}>
            <ArrowLeftRight size={16} />
            <span>Settle Balances</span>
          </Link>
        </div>
      </header>

      {/* Group Navigation Cards */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={16} style={{ color: 'var(--primary)' }} />
            Select Group / Squad to View Details
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Tap any group card below to inspect its settlements
          </span>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
          gap: '1rem' 
        }}>
          {/* ALL GROUPS CARD */}
          <div 
            onClick={() => setSelectedSquad('ALL')}
            style={{
              cursor: 'pointer',
              padding: '1.1rem 1.25rem',
              borderRadius: '16px',
              border: selectedSquad === 'ALL' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
              background: selectedSquad === 'ALL' ? 'rgba(14, 165, 233, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              boxShadow: selectedSquad === 'ALL' ? '0 0 20px rgba(14, 165, 233, 0.2)' : 'none',
              transition: 'all 0.25s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: selectedSquad === 'ALL' ? 'var(--primary)' : 'var(--text-color)' }}>
                  All Groups
                </span>
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', fontWeight: 700 }}>
                  {allSettlements.length} logs
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>
                Combined archives across all squads & direct transfers.
              </p>
            </div>
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Settled</span>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary)' }}>
                ₹ {allSettlements.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* SQUAD & DIRECT CARDS */}
          {groupStats.map(grp => {
            const isSelected = selectedSquad === grp.key;
            return (
              <div 
                key={grp.key}
                onClick={() => setSelectedSquad(grp.key)}
                style={{
                  cursor: 'pointer',
                  padding: '1.1rem 1.25rem',
                  borderRadius: '16px',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: isSelected ? 'rgba(14, 165, 233, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  boxShadow: isSelected ? '0 0 20px rgba(14, 165, 233, 0.2)' : 'none',
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: isSelected ? 'var(--primary)' : 'var(--text-color)' }}>
                      {grp.isDirect ? 'Direct (Peer-to-Peer)' : grp.name}
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: grp.count > 0 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.06)', color: grp.count > 0 ? '#34d399' : 'var(--text-dim)', fontWeight: 700 }}>
                      {grp.count} {grp.count === 1 ? 'record' : 'records'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>
                    {grp.latestDate ? `Last settled: ${new Date(grp.latestDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : 'No settlements recorded yet'}
                  </p>
                </div>
                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Settled</span>
                  <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-color)' }}>
                    ₹ {grp.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Settlements Table / List */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
              {selectedSquad === 'ALL' ? 'All Settlements Ledger' : selectedSquad === 'DIRECT' ? 'Direct Settlements' : `Squad: ${selectedSquad} Settlements`}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Showing {filteredSettlements.length} {filteredSettlements.length === 1 ? 'transaction' : 'transactions'} {timeFilter === 'month' ? `for ${selectedMonth}` : '(All Time)'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Segment Total:</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary)' }}>
              ₹ {totalFilteredAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>Loading settlements...</p>
        ) : filteredSettlements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <Info size={40} style={{ color: 'var(--text-dim)', marginBottom: '1rem', opacity: 0.5 }} />
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.25rem' }}>No Settlement Records Found</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
              {selectedSquad !== 'ALL' 
                ? `No recorded settlements exist for ${selectedSquad === 'DIRECT' ? 'Direct transfers' : selectedSquad} under the current filter.`
                : 'No settlement records have been registered yet.'}
            </p>
            <Link to="/settlements" className="btn-glass" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'var(--btn-text-color)', border: 'none' }}>
              <ArrowLeftRight size={15} />
              <span>Go to Settlements & Settle</span>
            </Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Execution Date</th>
                  <th>Settlement Flow</th>
                  <th>Group / Squad</th>
                  <th>Payment Channel</th>
                  <th>Mission Note</th>
                  <th style={{ textAlign: 'right' }}>Amount Settled</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredSettlements.map(st => {
                  const receiver = getReceiverHandle(st);
                  const isPayerMe = st.payer.toLowerCase() === myHandle;
                  const isReceiverMe = receiver.toLowerCase() === myHandle;

                  return (
                    <tr key={st.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(st.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ 
                            fontWeight: 700, 
                            textTransform: 'capitalize',
                            color: isPayerMe ? 'var(--primary)' : 'var(--text-color)',
                            background: isPayerMe ? 'rgba(14, 165, 233, 0.12)' : 'rgba(255,255,255,0.05)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.85rem'
                          }}>
                            {st.payer} {isPayerMe && '(You)'}
                          </span>
                          <ArrowRight size={13} style={{ color: 'var(--text-dim)' }} />
                          <span style={{ 
                            fontWeight: 700, 
                            textTransform: 'capitalize',
                            color: isReceiverMe ? '#34d399' : 'var(--text-color)',
                            background: isReceiverMe ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255,255,255,0.05)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.85rem'
                          }}>
                            {receiver || 'Member'} {isReceiverMe && '(You)'}
                          </span>
                        </div>
                      </td>
                      <td>
                        {st.squad_name ? (
                          <span style={{ 
                            fontSize: '0.75rem', 
                            background: 'rgba(14, 165, 233, 0.1)', 
                            color: 'var(--primary)', 
                            fontWeight: 800, 
                            padding: '3px 8px', 
                            borderRadius: '6px' 
                          }}>
                            SQUAD: {st.squad_name}
                          </span>
                        ) : (
                          <span style={{ 
                            fontSize: '0.75rem', 
                            background: 'rgba(255, 255, 255, 0.05)', 
                            color: 'var(--text-dim)', 
                            fontWeight: 700, 
                            padding: '3px 8px', 
                            borderRadius: '6px' 
                          }}>
                            Direct Peer
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`app-badge ${PAYMENT_APPS[st.payment_app]?.badge || 'badge-purple'}`}>
                          {PAYMENT_APPS[st.payment_app]?.label || st.payment_app || 'UPI Direct'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-dim)', maxWidth: '220px', lineHeight: 1.4, wordBreak: 'break-word' }}>
                        {st.where_spent || 'Settlement Transaction'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#34d399', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                        ₹ {st.amount.toFixed(2)}
                      </td>
                      <td>
                        <button 
                          className="btn-delete" 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                          onClick={() => triggerDelete(st.id)}
                          title="Delete settlement entry"
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
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: '#ff3b30' }}>Delete Settlement Log?</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                This settlement record will be permanently deleted from the active database. This operation is irreversible and will restore the corresponding member balances.
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

export default SettlementDetails;
