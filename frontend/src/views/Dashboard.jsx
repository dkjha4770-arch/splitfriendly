import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ModalPortal from '../components/ModalPortal';
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
  const fetchData = useCallback(async () => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, fetchData]);

  // Filtered expenses for selected month
  const monthlyExpenses = expenses.filter(e => e.date.substring(0, 7) === selectedMonth);

  // Search & category filters (settlements are always excluded from the ledger table)
  const filteredExpenses = monthlyExpenses.filter(e => {
    if (e.category === 'settlement') return false;

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

  const myHandle = user?.username ? user.username.split('@')[0].toLowerCase() : '';

  // Calculate Net Personal Balance (spent vs share in selected month)
  let totalSpent = 0;
  let totalShare = 0;
  const categoryTotals = {};

  monthlyExpenses.forEach(e => {
    const payer = e.payer.toLowerCase();
    if (payer === myHandle) totalSpent += Number(e.amount);

    let share = 0;
    if (e.members && typeof e.members === 'object' && !Array.isArray(e.members)) {
      if (e.members[myHandle] !== undefined) share = Number(e.members[myHandle]);
    } else if (Array.isArray(e.members)) {
      if (e.members.map(m => m.toLowerCase()).includes(myHandle)) share = Number(e.share);
    }
    totalShare += share;

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

  // Calculate Global Balances for the "TOTAL BALANCE" card
  let totalOwedToMe = 0;
  let totalIOwe = 0;
  const globalBalances = {};

  expenses.forEach(e => {
    if (e.category === 'settlement') return;
    
    const payer = e.payer.toLowerCase();
    
    if (payer === myHandle) {
      if (e.members && typeof e.members === 'object' && !Array.isArray(e.members)) {
        for (const [mem, amt] of Object.entries(e.members)) {
          if (mem.toLowerCase() !== myHandle) {
            globalBalances[mem.toLowerCase()] = (globalBalances[mem.toLowerCase()] || 0) + Number(amt);
          }
        }
      } else if (Array.isArray(e.members)) {
        e.members.forEach(mem => {
          if (mem.toLowerCase() !== myHandle) {
            globalBalances[mem.toLowerCase()] = (globalBalances[mem.toLowerCase()] || 0) + Number(e.share);
          }
        });
      }
    } else {
      if (e.members && typeof e.members === 'object' && !Array.isArray(e.members)) {
        if (e.members[myHandle] !== undefined) {
          globalBalances[payer] = (globalBalances[payer] || 0) - Number(e.members[myHandle]);
        }
      } else if (Array.isArray(e.members)) {
        if (e.members.map(m => m.toLowerCase()).includes(myHandle)) {
          globalBalances[payer] = (globalBalances[payer] || 0) - Number(e.share);
        }
      }
    }
  });

  expenses.filter(e => e.category === 'settlement').forEach(e => {
    const payer = e.payer.toLowerCase();
    if (payer === myHandle && e.members && e.members.length > 0) {
      const receiver = e.members[0].toLowerCase();
      globalBalances[receiver] = (globalBalances[receiver] || 0) + Number(e.amount);
    } else if (e.members && e.members.length > 0 && e.members[0].toLowerCase() === myHandle) {
      globalBalances[payer] = (globalBalances[payer] || 0) - Number(e.amount);
    }
  });

  for (const bal of Object.values(globalBalances)) {
    if (bal > 0.05) totalOwedToMe += bal;
    else if (bal < -0.05) totalIOwe += Math.abs(bal);
  }

  return (
    <div className="view-section dashboard-redesign">
      
      {/* TOTAL BALANCE CARD */}
      <div className="balance-card">
        <h3 className="balance-card-title">TOTAL BALANCE</h3>
        
        <div className="balance-row owed">
          <div className="balance-row-header">
            <span className="icon-arrow down">↓</span> You are owed
          </div>
          <div className="balance-amount positive">${totalOwedToMe.toFixed(2)}</div>
        </div>
        
        <div className="balance-row owe">
          <div className="balance-row-header">
            <span className="icon-arrow up">↑</span> You owe
          </div>
          <div className="balance-amount negative">${totalIOwe.toFixed(2)}</div>
        </div>
      </div>

      {/* RECENT GROUPS */}
      <div className="section-header">
        <h2 className="section-title">Recent Groups</h2>
        <Link to="/squads" className="view-all-link">View All</Link>
      </div>
      
      <div className="recent-groups-container">
        {squads.length > 0 ? squads.slice(0, 4).map(squad => (
          <Link to={`/squads?id=${squad.name}`} key={squad.name} className="group-card" style={{ textDecoration: 'none' }}>
            <div className="group-icon-wrapper">
              <div className="group-icon">
                {squad.name.substring(0, 1).toUpperCase()}
              </div>
            </div>
            <div className="group-info">
              <h4>{squad.name}</h4>
              <p>{squad.members?.length || 0} members</p>
            </div>
          </Link>
        )) : (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>No groups found. Create one to get started.</p>
        )}
      </div>

      {/* RECENT ACTIVITY */}
      <div className="section-header">
        <h2 className="section-title">Recent Activity</h2>
      </div>

      <div className="recent-activity-container">
        {filteredExpenses.slice(0, 10).map((expense, idx) => {
          const payerIsMe = expense.payer.toLowerCase() === myHandle;
          // Determine if this expense involved me
          let myShare = 0;
          if (expense.members && typeof expense.members === 'object' && !Array.isArray(expense.members)) {
             myShare = Number(expense.members[myHandle] || 0);
          } else if (Array.isArray(expense.members)) {
             myShare = expense.members.map(m => m.toLowerCase()).includes(myHandle) ? Number(expense.share) : 0;
          }
          
          let displayAmount = '';
          let amountClass = '';
          
          if (payerIsMe) {
            // I paid, so I am owed (Total amount - my share)
            const owedToMe = Number(expense.amount) - myShare;
            displayAmount = `+$${owedToMe.toFixed(2)}`;
            amountClass = 'positive';
          } else {
            // Someone else paid, I owe my share
            if (myShare > 0) {
              displayAmount = `-$${myShare.toFixed(2)}`;
              amountClass = 'negative';
            } else {
              displayAmount = `$${Number(expense.amount).toFixed(2)}`;
              amountClass = 'neutral';
            }
          }

          const init = expense.payer.substring(0, 2).toUpperCase();

          return (
            <div className="activity-item" key={expense.id || idx}>
              <div className="activity-avatar">{init}</div>
              <div className="activity-details">
                <div className="activity-name">{expense.payer}</div>
                <div className="activity-desc">{expense.where_spent}</div>
              </div>
              <div className="activity-meta">
                <div className={`activity-amount ${amountClass}`}>{displayAmount}</div>
                <div className="activity-date">
                  {new Date(expense.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          )
        })}
        {filteredExpenses.length === 0 && (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', padding: '1rem' }}>No recent activity.</p>
        )}
      </div>

    </div>
  );
};

export default Dashboard;
