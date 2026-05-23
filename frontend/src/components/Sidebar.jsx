import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  Terminal, 
  User, 
  LogOut, 
  Sun, 
  Moon,
  TrendingUp,
  Globe,
  PlusCircle,
  Percent,
  ArrowLeftRight,
  Download,
  X
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout, theme, toggleTheme } = useAuth();
  const location = useLocation();
  
  if (!user) return null;

  const handle = user.username ? user.username.split('@')[0].toLowerCase() : '';
  const isAdmin = handle === 'deepak' || handle === 'admin';
  const displayName = user.display_name || handle;

  // Custom colors avatar
  const avatarStyle = user.avatar_color ? {
    background: `linear-gradient(${user.avatar_color})`
  } : {};

  // Check if specific expense form mode is active
  const isFormModeActive = (mode) => {
    const params = new URLSearchParams(location.search);
    return location.pathname === '/expenses/new' && params.get('mode') === mode;
  };

  return (
    <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
      <button className="sidebar-close-btn" onClick={onClose}>
        <X size={18} />
      </button>

      <Link to="/dashboard" className="sidebar-logo" onClick={onClose}>
        <span className="icon">💰</span>
        <h1>SPLIT-FRIENDLY</h1>
      </Link>

      <nav className="sidebar-nav">
        <NavLink 
          to="/" 
          end
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <Globe />
          <span>Welcome Page</span>
        </NavLink>

        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <LayoutDashboard />
          <span>Dashboard</span>
        </NavLink>

        <NavLink 
          to="/expenses/new" 
          className={({ isActive }) => `nav-item ${isActive || location.pathname.startsWith('/expenses/new') ? 'active' : ''}`}
          onClick={onClose}
        >
          <PlusCircle />
          <span>Split Expense</span>
        </NavLink>

        <NavLink 
          to="/expenses" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <Receipt />
          <span>Expenses Ledger</span>
        </NavLink>

        <NavLink 
          to="/squads" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <Users />
          <span>Squads</span>
        </NavLink>

        <NavLink 
          to="/settlements" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <ArrowLeftRight />
          <span>Settlements</span>
        </NavLink>

        <NavLink 
          to="/analytics" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <TrendingUp />
          <span>Analytics</span>
        </NavLink>

        {isAdmin && (
          <NavLink 
            to="/admin" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <Terminal />
            <span>Command Centre</span>
          </NavLink>
        )}

        <NavLink 
          to="/profile" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <User />
          <span>Settings & Profile</span>
        </NavLink>

        <a 
          href={`${import.meta.env.VITE_API_URL || ''}/api/expenses/export`} 
          className="nav-item"
          style={{ textDecoration: 'none' }}
        >
          <Download />
          <span>Export CSV</span>
        </a>
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun /> : <Moon />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <button className="nav-item" onClick={logout}>
          <LogOut />
          <span>Logout</span>
        </button>

        <div className="user-profile" onClick={onClose}>
          <div className="user-avatar" style={avatarStyle}>
            {handle.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <span className="name">{displayName}</span>
            <span className="role">{isAdmin ? 'Command Administrator' : 'Operative'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
