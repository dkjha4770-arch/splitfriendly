import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import UpdateBanner from './components/UpdateBanner';
import Login from './views/Login';
import Register from './views/Register';
import Dashboard from './views/Dashboard';
import Expenses from './views/Expenses';
import ExpenseForm from './views/ExpenseForm';
import Squads from './views/Squads';
import Profile from './views/Profile';
import Analytics from './views/Analytics';
import CommandCentre from './views/CommandCentre';
import Landing from './views/Landing';
import ForgotPassword from './views/ForgotPassword';
import Settlements from './views/Settlements';
import { Menu } from 'lucide-react';

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
          <span className="logo-icon">💰</span>
          <span className="logo-text">SPLIT-FRIENDLY</span>
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Global update notification — appears on all pages after a new deploy */}
        <UpdateBanner />
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
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<ProtectedRoute requireAdmin><CommandCentre /></ProtectedRoute>} />
          </Route>

          {/* Catch-all Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
