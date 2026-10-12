import React, { useState, useEffect } from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';
import { RefreshCw, X, Sparkles } from 'lucide-react';

/**
 * Centered floating update popup modal that appears whenever a new version/commit is deployed.
 * Perfectly centered across all screen sizes (desktop, tablet, mobile), with backdrop blur
 * and accessible dismiss controls.
 */
export default function UpdateBanner() {
  const updateAvailable = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!updateAvailable || dismissed) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setDismissed(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [updateAvailable, dismissed]);

  if (!updateAvailable || dismissed) return null;

  const handleUpdate = () => {
    setRefreshing(true);
    // Hard reload with cache bust
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  return (
    <>
      <style>{`
        @keyframes sf-overlay-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes sf-modal-scale {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(12px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes sf-icon-pulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(79, 70, 229, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.4);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 32px rgba(6, 182, 212, 0.6), 0 0 0 3px rgba(129, 140, 248, 0.6);
            transform: scale(1.04);
          }
        }
        @keyframes sf-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* ── Centered Backdrop Overlay ── */
        .sf-update-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(3, 7, 18, 0.65);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
          box-sizing: border-box;
          animation: sf-overlay-fade 0.25s ease-out forwards;
        }

        /* ── Centered Modal Card ── */
        .sf-update-modal-card {
          position: relative;
          width: 100%;
          max-width: 440px;
          background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 60%, #1e293b 100%);
          border: 1px solid rgba(129, 140, 248, 0.35);
          border-radius: 24px;
          padding: 1.85rem 1.85rem 1.5rem;
          box-shadow: 0 25px 65px rgba(0, 0, 0, 0.65), 0 0 35px rgba(79, 70, 229, 0.25);
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          animation: sf-modal-scale 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          box-sizing: border-box;
        }

        /* ── Close Button ── */
        .sf-update-modal-close {
          position: absolute;
          top: 1.15rem;
          right: 1.15rem;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .sf-update-modal-close:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }

        /* ── Header Area ── */
        .sf-update-modal-header {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .sf-update-icon-box {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, #4f46e5, #06b6d4);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: sf-icon-pulse 3s infinite ease-in-out;
        }

        .sf-update-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .sf-update-heading {
          font-size: 1.15rem;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
          letter-spacing: -0.01em;
        }

        .sf-update-badge {
          display: inline-flex;
          align-items: center;
          font-size: 0.7rem;
          font-weight: 700;
          color: #38bdf8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* ── Description ── */
        .sf-update-description {
          font-size: 0.86rem;
          color: rgba(226, 232, 240, 0.8);
          line-height: 1.5;
          margin: 0;
        }

        /* ── Actions ── */
        .sf-update-modal-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.25rem;
        }

        .sf-update-btn-later {
          flex: 1;
          padding: 0.7rem 1rem;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.05);
          color: rgba(226, 232, 240, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.12);
          font-size: 0.84rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sf-update-btn-later:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }

        .sf-update-btn-primary {
          flex: 1.4;
          padding: 0.7rem 1.15rem;
          border-radius: 12px;
          background: linear-gradient(135deg, #4f46e5, #06b6d4);
          color: #ffffff;
          border: none;
          font-size: 0.84rem;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.45);
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
        }

        .sf-update-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(79, 70, 229, 0.6);
          opacity: 0.95;
        }

        .sf-update-btn-primary:active {
          transform: translateY(0);
        }

        .sf-update-btn-primary svg.sf-spinning {
          animation: sf-spin 0.6s linear infinite;
        }

        @media (max-width: 480px) {
          .sf-update-modal-card {
            padding: 1.5rem 1.25rem 1.25rem;
            border-radius: 20px;
            gap: 1rem;
          }
          .sf-update-modal-actions {
            flex-direction: column-reverse;
            gap: 0.5rem;
          }
          .sf-update-btn-later,
          .sf-update-btn-primary {
            width: 100%;
            padding: 0.75rem 1rem;
          }
        }
      `}</style>

      <div 
        className="sf-update-backdrop" 
        onClick={() => setDismissed(true)}
        role="dialog" 
        aria-modal="true"
        aria-labelledby="sf-update-title"
      >
        <div 
          className="sf-update-modal-card" 
          onClick={e => e.stopPropagation()}
        >
          {/* Close X */}
          <button
            className="sf-update-modal-close"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss update popup"
          >
            <X size={16} />
          </button>

          {/* Header */}
          <div className="sf-update-modal-header">
            <div className="sf-update-icon-box">
              <Sparkles size={22} color="#ffffff" />
            </div>
            <div className="sf-update-title-wrap">
              <span className="sf-update-badge">New Version</span>
              <h3 id="sf-update-title" className="sf-update-heading">
                App Update Available
              </h3>
            </div>
          </div>

          {/* Description */}
          <p className="sf-update-description">
            A new build has been deployed to FairShare. Update now to refresh your session and load the latest features and bug fixes.
          </p>

          {/* Action Buttons */}
          <div className="sf-update-modal-actions">
            <button
              className="sf-update-btn-later"
              onClick={() => setDismissed(true)}
            >
              Later
            </button>
            <button
              className="sf-update-btn-primary"
              onClick={handleUpdate}
              disabled={refreshing}
            >
              <RefreshCw size={15} className={refreshing ? 'sf-spinning' : ''} />
              <span>{refreshing ? 'Updating…' : 'Update App Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
