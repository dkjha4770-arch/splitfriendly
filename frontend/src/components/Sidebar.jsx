import React, { useEffect } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
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
  CheckCheck,
  Download,
  X,
  Wallet
} from 'lucide-react';

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout, theme, toggleTheme } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-close sidebar on mobile whenever route/location changes
  useEffect(() => {
    if (isOpen && onClose) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);
  
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

  const handleOptionClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>

      <Link to="/dashboard" className="sidebar-logo" onClick={handleOptionClick}>
        <div className="logo-badge"><Wallet size={20} /></div>
        <h1>Fair<span>Share</span></h1>
      </Link>

      <nav className="sidebar-nav">
        {/* Welcome Page link removed */}

        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={handleOptionClick}
        >
          <LayoutDashboard />
          <span>Dashboard</span>
        </NavLink>

        <NavLink 
          to="/expenses/new" 
          className={({ isActive }) => `nav-item ${isActive || location.pathname.startsWith('/expenses/new') ? 'active' : ''}`}
          onClick={handleOptionClick}
        >
          <PlusCircle />
          <span>Split Expense</span>
        </NavLink>

        <NavLink 
          to="/expenses" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={handleOptionClick}
        >
          <Receipt />
          <span>Expenses Ledger</span>
        </NavLink>

        <NavLink 
          to="/squads" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={handleOptionClick}
        >
          <Users />
          <span>Squads</span>
        </NavLink>

        <NavLink 
          to="/settlements" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={handleOptionClick}
        >
          <ArrowLeftRight />
          <span>Settlements</span>
        </NavLink>

        <NavLink 
          to="/settlement-details" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={handleOptionClick}
        >
          <CheckCheck />
          <span>Settlement Details</span>
        </NavLink>

        <NavLink 
          to="/analytics" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={handleOptionClick}
        >
          <TrendingUp />
          <span>Analytics</span>
        </NavLink>

        {isAdmin && (
          <NavLink 
            to="/admin" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={handleOptionClick}
          >
            <Terminal />
            <span>Command Centre</span>
          </NavLink>
        )}

        <NavLink 
          to="/profile" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={handleOptionClick}
        >
          <User />
          <span>Settings & Profile</span>
        </NavLink>

        <a 
          href={`${import.meta.env.VITE_API_URL || ''}/api/expenses/export`} 
          className="nav-item"
          style={{ textDecoration: 'none' }}
          onClick={handleOptionClick}
        >
          <Download />
          <span>Export CSV</span>
        </a>
      </nav>

      <div className="sidebar-footer">
        <button 
          className="nav-item" 
          onClick={() => {
            toggleTheme();
            handleOptionClick();
          }}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <button 
          className="nav-item" 
          onClick={() => {
            logout();
            handleOptionClick();
          }}
        >
          <LogOut />
          <span>Logout</span>
        </button>

        <div className="user-profile" onClick={() => { navigate('/profile'); handleOptionClick(); }}>
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
