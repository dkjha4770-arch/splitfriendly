import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Shield, 
  Activity, 
  PieChart,
  BarChart2,
  DollarSign
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

export const Analytics = () => {
  const { user, token, theme } = useAuth();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  const catChartRef = useRef(null);
  const trendChartRef = useRef(null);
  const catChartInstance = useRef(null);
  const trendChartInstance = useRef(null);

  // Data state
  const [expenses, setExpenses] = useState([]);
  const [squads, setSquads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  });
  const [squadFilter, setSquadFilter] = useState('all');

  // Month options (last 24 months)
  const monthOptions = [];
  const today = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    monthOptions.push({ value: `${yyyy}-${mm}`, label });
  }

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/expenses/data', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
        setSquads(data.squads || []);
      }
    } catch (err) {
      console.error('Failed to fetch analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  // Compute stats for current filters
  const filteredBySquad = expenses.filter(e => squadFilter === 'all' || e.squad_name === squadFilter);
  const monthlyExpenses = filteredBySquad.filter(e => e.date.substring(0, 7) === selectedMonth);
  const activeMonthlyExpenses = monthlyExpenses.filter(e => e.category !== 'settlement');

  // 1. Total spent this month
  const totalVolume = activeMonthlyExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // 2. Average daily spend
  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyAverage = totalVolume / daysInMonth;

  // 3. Category breakdowns
  const categoryTotals = {};
  activeMonthlyExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + Number(e.amount);
  });

  // Highest category
  let highestCategory = 'N/A';
  let highestCategoryVal = 0;
  Object.entries(categoryTotals).forEach(([cat, val]) => {
    if (val > highestCategoryVal) {
      highestCategoryVal = val;
      highestCategory = CATEGORIES[cat]?.label || cat;
    }
  });

  // 4. Payer dominance
  const payerTotals = {};
  activeMonthlyExpenses.forEach(e => {
    const p = e.payer.toLowerCase();
    payerTotals[p] = (payerTotals[p] || 0) + Number(e.amount);
  });

  let dominantPayer = 'N/A';
  let dominantPayerVal = 0;
  Object.entries(payerTotals).forEach(([payer, val]) => {
    if (val > dominantPayerVal) {
      dominantPayerVal = val;
      dominantPayer = payer;
    }
  });

  // Render Charts
  useEffect(() => {
    if (loading || !catChartRef.current || !trendChartRef.current) return;
    const isDark = theme === 'dark';

    // 1. DOUGHNUT CHART (Category allocation)
    const catCtx = catChartRef.current.getContext('2d');
    if (catChartInstance.current) {
      catChartInstance.current.destroy();
    }

    const catLabels = Object.keys(categoryTotals).map(k => CATEGORIES[k]?.label || k);
    const catData = Object.values(categoryTotals);
    const catColors = Object.keys(categoryTotals).map(k => CATEGORIES[k]?.color || '#868e96');

    if (catData.length > 0) {
      catChartInstance.current = new Chart(catCtx, {
        type: 'doughnut',
        data: {
          labels: catLabels,
          datasets: [{
            data: catData,
            backgroundColor: catColors,
            borderColor: 'transparent',
            hoverOffset: 10,
            borderRadius: 6
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
                padding: 12,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            }
          },
          cutout: '70%'
        }
      });
    }

    // 2. LINE CHART (6-Month Spend Trend)
    const trendCtx = trendChartRef.current.getContext('2d');
    if (trendChartInstance.current) {
      trendChartInstance.current.destroy();
    }

    // Compute last 6 months
    const last6Months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('default', { month: 'short' });
      last6Months.push({ key: `${yyyy}-${mm}`, label });
    }

    const trendData = last6Months.map(m => {
      // Filter expenses for this specific month
      const monthlyOps = filteredBySquad.filter(
        e => e.date.substring(0, 7) === m.key && e.category !== 'settlement'
      );
      return monthlyOps.reduce((sum, e) => sum + Number(e.amount), 0);
    });

    const trendLabels = last6Months.map(m => m.label);

    trendChartInstance.current = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: trendLabels,
        datasets: [{
          label: 'Operational Spend (INR)',
          data: trendData,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14, 165, 233, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: '#0ea5e9',
          pointBorderColor: 'transparent'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: isDark ? '#ffffff80' : '#0f172a80',
              font: { family: 'Outfit', size: 11, weight: '600' }
            }
          },
          y: {
            grid: {
              color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
            },
            ticks: {
              color: isDark ? '#ffffff80' : '#0f172a80',
              font: { family: 'Outfit', size: 11, weight: '600' }
            }
          }
        }
      }
    });

    return () => {
      if (catChartInstance.current) {
        catChartInstance.current.destroy();
        catChartInstance.current = null;
      }
      if (trendChartInstance.current) {
        trendChartInstance.current.destroy();
        trendChartInstance.current = null;
      }
    };
  }, [categoryTotals, filteredBySquad, loading, theme]);

  return (
    <div className="view-section">
      {/* Header */}
      <header className="content-header">
        <div className="header-title">
          <h2>Intelligence Analytics</h2>
          <p>Analytical mapping of categorical flows and spending velocity.</p>
        </div>
        <div className="header-actions">
          {/* Squad selector */}
          <select 
            className="theme-select"
            value={squadFilter}
            onChange={e => setSquadFilter(e.target.value)}
          >
            <option value="all">All Squads & Ops</option>
            {squads.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>

          {/* Month selector */}
          <select 
            className="month-selector"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </header>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>Synthesizing analytics telemetry...</p>
      ) : (
        <>
          {/* Analytics Summary Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'rgba(0, 210, 255, 0.1)', color: '#00d2ff', borderRadius: '12px', padding: '0.75rem', display: 'flex', alignItems: 'center' }}>
                <DollarSign size={24} />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Consolidated Cost</span>
                <b style={{ fontSize: '1.2rem', fontWeight: 800 }}>₹ {totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'rgba(14, 165, 233, 0.1)', color: 'var(--primary)', borderRadius: '12px', padding: '0.75rem', display: 'flex', alignItems: 'center' }}>
                <Activity size={24} />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Daily Velocity</span>
                <b style={{ fontSize: '1.2rem', fontWeight: 800 }}>₹ {dailyAverage.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'rgba(255, 170, 0, 0.1)', color: '#ffaa00', borderRadius: '12px', padding: '0.75rem', display: 'flex', alignItems: 'center' }}>
                <TrendingUp size={24} />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Dominant Scope</span>
                <b style={{ fontSize: '1.1rem', fontWeight: 800, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', display: 'block', maxWidth: '170px' }}>{highestCategory}</b>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'rgba(255, 0, 127, 0.1)', color: '#ff007f', borderRadius: '12px', padding: '0.75rem', display: 'flex', alignItems: 'center' }}>
                <Shield size={24} />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Dominant Payer</span>
                <b style={{ fontSize: '1.2rem', fontWeight: 800, textTransform: 'capitalize' }}>{dominantPayer}</b>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
            
            {/* Category Doughnut Chart */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '350px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <PieChart size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Category Allocation</h3>
              </div>
              
              {Object.keys(categoryTotals).length > 0 ? (
                <div style={{ position: 'relative', width: '100%', flex: 1 }}>
                  <canvas ref={catChartRef}></canvas>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', opacity: 0.5 }}>
                  <p style={{ fontSize: '0.85rem' }}>No data available for category mapping in this segment.</p>
                </div>
              )}
            </div>

            {/* Spend Trend Line Chart */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '350px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <BarChart2 size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Consolidated 6-Month Spend Trend</h3>
              </div>
              
              <div style={{ position: 'relative', width: '100%', flex: 1 }}>
                <canvas ref={trendChartRef}></canvas>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
