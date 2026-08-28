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
          <span className="logo-text">Split<span style={{ color: 'var(--primary)' }}>Friendly</span></span>
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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

