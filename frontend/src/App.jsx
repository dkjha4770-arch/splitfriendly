import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import UpdateBanner from './components/UpdateBanner';
import { Menu, Wallet } from 'lucide-react';

// Code-split all views — each is loaded only when the route is first visited
import Login from './views/Login';
const Register = lazy(() => import('./views/Register'));
const Dashboard = lazy(() => import('./views/Dashboard'));
const Expenses = lazy(() => import('./views/Expenses'));
const ExpenseForm = lazy(() => import('./views/ExpenseForm'));
const Squads = lazy(() => import('./views/Squads'));
const Profile = lazy(() => import('./views/Profile'));
const Analytics = lazy(() => import('./views/Analytics'));
const CommandCentre = lazy(() => import('./views/CommandCentre'));
// Landing removed
const ForgotPassword = lazy(() => import('./views/ForgotPassword'));
const Settlements = lazy(() => import('./views/Settlements'));
const SettlementDetails = lazy(() => import('./views/SettlementDetails'));

// Minimal loading spinner shown while a lazy chunk loads
const PageLoader = () => (
  <div style={{
    display: 'flex',
    height: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--gradient-bg)'
  }}>
    <div style={{
      width: 40,
      height: 40,
      border: '3px solid var(--border-color)',
      borderTopColor: 'var(--primary)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite'
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// Global Error Boundary to prevent full-page blank crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          background: 'var(--bg-color, #0b0f19)',
          color: 'var(--text-color, #fff)'
        }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--text-dim, #94a3b8)', maxWidth: '420px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            An unexpected error occurred while loading this view.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            style={{
              padding: '0.65rem 1.5rem',
              borderRadius: '12px',
              background: 'var(--primary, #4f46e5)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`dashboard-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="bg-orb-3"></div>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile overlay */}
      <div
        className={`mobile-sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Mobile Top Navigation Bar */}
      <div className="mobile-top-nav">
        <button
          className="mobile-menu-toggle-btn"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={20} />
        </button>
        <div className="mobile-nav-logo">
          <div className="logo-badge"><Wallet size={18} /></div>
          <span className="logo-text">Fair<span style={{ color: 'var(--primary)' }}>Share</span></span>
        </div>
      </div>

      {/* Main Content Pane */}
      <main className="main-content">
        {/* Global style to show mobile menu button when width <= 1024px */}
        <style>{`
          @media (max-width: 1024px) {
            .mobile-menu-toggle-btn {
              display: flex !important;
            }
            .main-content {
              padding-top: 5.5rem !important;
            }
          }
        `}</style>

        <Outlet />
      </main>
    </div>
  );
}

const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Global update notification — appears on all pages after a new deploy */}
        <UpdateBanner />
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              {/* Protected Main App Layout */}
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/expenses/new" element={<ExpenseForm />} />
                <Route path="/squads" element={<Squads />} />
                <Route path="/settlements" element={<Settlements />} />
                <Route path="/settlement-details" element={<SettlementDetails />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<ProtectedRoute requireAdmin><CommandCentre /></ProtectedRoute>} />
              </Route>

              {/* Catch-all Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

