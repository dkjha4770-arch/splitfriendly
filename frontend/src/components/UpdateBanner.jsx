import React, { useState } from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';
import { RefreshCw, X, Sparkles } from 'lucide-react';

/**
 * Floating update notification that appears at the bottom-right of the screen
 * whenever a new version of the app is deployed to Vercel.
 * Clicking "Update Now" reloads the page to get the fresh bundle.
 */
export default function UpdateBanner() {
  const updateAvailable = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!updateAvailable || dismissed) return null;

  const handleUpdate = () => {
    setRefreshing(true);
    // Small delay so the spin animation is visible
    setTimeout(() => window.location.reload(), 400);
  };

  return (
    <>
      <style>{`
        @keyframes sf-banner-in {
          from { opacity: 0; transform: translateY(24px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes sf-spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        .sf-update-banner {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-radius: 18px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(155, 81, 224, 0.18),
            inset 0 1px 0 rgba(255,255,255,0.06);
          animation: sf-banner-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          max-width: 360px;
          backdrop-filter: blur(12px);
        }
        .sf-update-icon-wrap {
          flex-shrink: 0;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: linear-gradient(135deg, #9b51e0, #4facfe);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(155, 81, 224, 0.4);
        }
        .sf-update-body {
          flex: 1;
          min-width: 0;
        }
        .sf-update-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.01em;
          margin: 0 0 2px;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .sf-update-sub {
          font-size: 0.72rem;
          color: rgba(255,255,255,0.5);
          margin: 0;
        }
        .sf-update-btn {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 1rem;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          font-size: 0.78rem;
          font-weight: 700;
          background: linear-gradient(135deg, #9b51e0, #4facfe);
          color: #fff;
          transition: opacity 0.2s, transform 0.2s;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(155, 81, 224, 0.35);
        }
        .sf-update-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .sf-update-btn:active { transform: translateY(0); }
        .sf-update-btn svg.spinning {
          animation: sf-spin 0.6s linear infinite;
        }
        .sf-update-dismiss {
          flex-shrink: 0;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: rgba(255,255,255,0.35);
          display: flex;
          align-items: center;
          transition: color 0.2s;
          border-radius: 6px;
        }
        .sf-update-dismiss:hover { color: rgba(255,255,255,0.75); }
        @media (max-width: 480px) {
          .sf-update-banner {
            bottom: 1rem;
            right: 1rem;
            left: 1rem;
            max-width: none;
          }
        }
      `}</style>

      <div className="sf-update-banner" role="status" aria-live="polite">
        {/* Icon */}
        <div className="sf-update-icon-wrap">
          <Sparkles size={18} color="#fff" />
        </div>

        {/* Text */}
        <div className="sf-update-body">
          <p className="sf-update-title">New version available</p>
          <p className="sf-update-sub">Refresh to get the latest features &amp; fixes.</p>
        </div>

        {/* Update button */}
        <button
          className="sf-update-btn"
          onClick={handleUpdate}
          aria-label="Refresh to update"
        >
          <RefreshCw size={13} className={refreshing ? 'spinning' : ''} />
          {refreshing ? 'Loading…' : 'Update'}
        </button>

        {/* Dismiss */}
        <button
          className="sf-update-dismiss"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update notification"
        >
          <X size={14} />
        </button>
      </div>
    </>
  );
}
