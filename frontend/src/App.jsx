import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import UpdateBanner from './components/UpdateBanner';
import { Menu, Wallet, Bell, LayoutDashboard, Users, Activity, User, Plus } from 'lucide-react';

// Code-split all views — each is loaded only when the route is first visited
const Login        = lazy(() => import('./views/Login'));
const Register     = lazy(() => import('./views/Register'));
const Dashboard    = lazy(() => import('./views/Dashboard'));
const Expenses     = lazy(() => import('./views/Expenses'));
const ExpenseForm  = lazy(() => import('./views/ExpenseForm'));
const Squads       = lazy(() => import('./views/Squads'));
const Profile      = lazy(() => import('./views/Profile'));
const Analytics    = lazy(() => import('./views/Analytics'));
const CommandCentre = lazy(() => import('./views/CommandCentre'));
const Landing      = lazy(() => import('./views/Landing'));
const ForgotPassword = lazy(() => import('./views/ForgotPassword'));
const Settlements  = lazy(() => import('./views/Settlements'));
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
  const location = useLocation();
  const { user } = useAuth();

  const currentPath = location.pathname;

  return (
    <div className={`dashboard-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="bg-orb-3"></div>
      
      {/* Sidebar - Desktop Only in new design */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Mobile overlay */}
      <div 
        className={`mobile-sidebar-overlay ${sidebarOpen ? 'active' : ''}`} 
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Mobile Top Navigation Bar (Redesigned) */}
      <div className="mobile-top-nav redesigned">
        <div className="top-nav-avatar">
          {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="top-nav-title">
          Split-Friendly
        </div>
        <button className="top-nav-bell">
          <Bell size={22} />
        </button>
      </div>

      {/* Main Content Pane */}
      <main className="main-content redesigned-main">
        <Outlet />
      </main>

      {/* Mobile FAB */}
      <Link to="/expenses/new" className="mobile-fab">
        <Plus size={24} />
      </Link>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav">
        <Link to="/dashboard" className={`bottom-nav-item ${currentPath === '/dashboard' ? 'active' : ''}`}>
          <div className="nav-icon-container">
            <LayoutDashboard size={20} />
            <span className="nav-label">Dashboard</span>
          </div>
        </Link>
        <Link to="/squads" className={`bottom-nav-item ${currentPath === '/squads' ? 'active' : ''}`}>
          <div className="nav-icon-container">
            <Users size={20} />
            <span className="nav-label">Groups</span>
          </div>
        </Link>
        <Link to="/expenses" className={`bottom-nav-item ${currentPath === '/expenses' ? 'active' : ''}`}>
          <div className="nav-icon-container">
            <Activity size={20} />
            <span className="nav-label">Activity</span>
          </div>
        </Link>
        <Link to="/profile" className={`bottom-nav-item ${currentPath === '/profile' ? 'active' : ''}`}>
          <div className="nav-icon-container">
            <User size={20} />
            <span className="nav-label">Profile</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Global update notification — appears on all pages after a new deploy */}
        <UpdateBanner />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
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

