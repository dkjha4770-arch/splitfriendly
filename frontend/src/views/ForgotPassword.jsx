import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Info, MessageSquare, ArrowLeft } from 'lucide-react';

export const ForgotPassword = () => {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'var(--gradient-bg)',
      color: 'var(--text-color)',
      padding: '1rem',
      overflowY: 'auto'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '450px',
        padding: '3rem 2.5rem',
        boxShadow: 'var(--shadow)',
        borderRadius: '28px',
        border: '1px solid var(--border-color)',
        background: 'var(--card-bg)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          borderRadius: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem'
        }}>
          <ShieldAlert size={30} />
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.5px' }}>
          Recovery Protocol
        </h1>
        
        <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)', lineHeight: '1.6', marginBottom: '2rem' }}>
          To ensure maximum security of your financial data, automated password recovery is currently offline.
        </p>

        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '16px',
          padding: '1.25rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          textAlign: 'left'
        }}>
          <Info size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
              Verification Required
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', lineHeight: '1.4' }}>
              Please contact administrator <strong>Deepak Jha</strong> at <strong>+91 7479754628</strong> for manual password restoration.
            </div>
          </div>
        </div>

        <a 
          href="https://wa.me/917479754628?text=Hello%20Admin,%20I%20need%20to%20reset%20my%20Split-Friendly%20password." 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-primary"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '1.1rem',
            fontSize: '0.95rem',
            fontWeight: 800,
            letterSpacing: '0.5px'
          }}
        >
          <MessageSquare size={16} />
          <span>Contact Admin on WhatsApp</span>
        </a>

        <Link 
          to="/login" 
          style={{
            marginTop: '1.75rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--text-dim)',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.85rem',
            transition: 'color 0.2s'
          }}
        >
          <ArrowLeft size={14} />
          <span>Return to Sign In</span>
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
