import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, LogOut, UserPlus, LogIn } from 'lucide-react';

export const Landing = () => {
  const { user, logout } = useAuth();
  const isLoggedIn = !!user;

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      padding: '2rem',
      position: 'relative',
      background: 'var(--gradient-bg)',
      overflowY: 'auto',
      color: 'var(--text-color)'
    }}>
      {/* Cinematic Background Layers */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none'
      }}>
        {/* Mesh Grid */}
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.01) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.01) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          perspective: '1000px',
          transform: 'rotateX(60deg) translateY(-200px)',
          maskImage: 'linear-gradient(to bottom, transparent, black, transparent)',
          zIndex: 1
        }}></div>

        {/* Orbs */}
        <div style={{
          position: 'absolute',
          borderRadius: '50%',
          filter: 'blur(120px)',
          opacity: 0.1,
          width: '50vw',
          height: '50vw',
          background: 'var(--primary, #ffffff)',
          top: '-10%',
          left: '-5%'
        }}></div>
        
        <div style={{
          position: 'absolute',
          borderRadius: '50%',
          filter: 'blur(120px)',
          opacity: 0.1,
          width: '60vw',
          height: '60vw',
          background: 'var(--secondary, #a1a1aa)',
          bottom: '-15%',
          right: '-5%'
        }}></div>

        <div style={{
          position: 'absolute',
          borderRadius: '50%',
          filter: 'blur(120px)',
          opacity: 0.05,
          width: '30vw',
          height: '30vw',
          background: 'var(--border-color, #27272a)',
          top: '40%',
          right: '20%'
        }}></div>
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '850px' }}>
        <div style={{
          fontSize: '5rem',
          marginBottom: '2rem',
          display: 'inline-block',
          filter: 'drop-shadow(0 10px 20px var(--border-color))',
          animation: 'float 4s infinite ease-in-out'
        }}>
          💸
        </div>

        <h1 style={{
          fontSize: 'clamp(3rem, 7vw, 5rem)',
          fontWeight: 900,
          letterSpacing: '-3px',
          margin: 0,
          background: 'linear-gradient(135deg, var(--text-color) 0%, var(--text-dim) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Split-Friendly
        </h1>

        <p style={{
          fontSize: '1.25rem',
          color: 'var(--text-dim)',
          maxWidth: '650px',
          margin: '2rem auto 3rem',
          lineHeight: '1.6',
          fontWeight: 400
        }}>
          Financial management redefined. Experience the world's most beautiful expense tracker designed for modern teams.
        </p>

        <div style={{
          display: 'flex',
          gap: '1.5rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {isLoggedIn ? (
            <>
              <Link 
                to="/dashboard" 
                className="btn-primary"
                style={{
                  padding: '1.1rem 2.5rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderRadius: '50px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none',
                  boxShadow: 'var(--shadow)',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
              >
                <LayoutDashboard size={18} />
                <span>Launch Dashboard</span>
              </Link>
              <button 
                onClick={logout}
                className="btn-glass"
                style={{
                  padding: '1.1rem 2.5rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderRadius: '50px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-color)',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <>
              <Link 
                to="/register" 
                className="btn-primary"
                style={{
                  padding: '1.1rem 2.5rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderRadius: '50px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none',
                  boxShadow: 'var(--shadow)',
                  transition: 'all 0.3s'
                }}
              >
                <UserPlus size={18} />
                <span>Get Started</span>
              </Link>
              <Link 
                to="/login" 
                className="btn-glass"
                style={{
                  padding: '1.1rem 2.5rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderRadius: '50px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-color)',
                  textDecoration: 'none',
                  transition: 'all 0.3s'
                }}
              >
                <LogIn size={18} />
                <span>Sign In</span>
              </Link>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
      `}</style>
    </div>
  );
};

export default Landing;
