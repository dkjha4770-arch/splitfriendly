import React, { useState } from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';
import { RefreshCw, X, Sparkles, ArrowRight } from 'lucide-react';

/**
 * Prominent floating update popup that appears across all views
 * whenever a new version/commit is deployed.
 * Clicking "Update Now" reloads the app to get the fresh bundle.
 */
export default function UpdateBanner() {
  const updateAvailable = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
        @keyframes sf-popup-in {
          0% {
            opacity: 0;
            transform: translateY(-20px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes sf-pulse-glow {
          0%, 100% {
            box-shadow: 0 10px 35px rgba(79, 70, 229, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.3);
          }
          50% {
            box-shadow: 0 14px 45px rgba(79, 70, 229, 0.65), 0 0 0 2px rgba(129, 140, 248, 0.6);
          }
        }
        @keyframes sf-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .sf-update-banner-container {
          position: fixed;
          top: 1.5rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 999999;
          width: calc(100% - 2rem);
          max-width: 480px;
          animation: sf-popup-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .sf-update-banner-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.9rem 1.25rem;
          border-radius: 18px;
          background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 60%, #1e293b 100%);
          border: 1px solid rgba(129, 140, 248, 0.4);
          animation: sf-pulse-glow 3s infinite ease-in-out;
          backdrop-filter: blur(16px);
        }
        .sf-update-icon-box {
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: linear-gradient(135deg, #4f46e5, #06b6d4);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.45);
        }
        .sf-update-text-area {
          flex: 1;
          min-width: 0;
        }
        .sf-update-heading {
          font-size: 0.92rem;
          font-weight: 800;
          color: #ffffff;
          margin: 0 0 2px 0;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .sf-update-subtitle {
          font-size: 0.76rem;
          color: rgba(226, 232, 240, 0.75);
          margin: 0;
          line-height: 1.3;
        }
        .sf-update-action-btn {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.55rem 1.1rem;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 800;
          background: linear-gradient(135deg, #4f46e5, #06b6d4);
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
          transition: transform 0.15s ease, opacity 0.15s ease;
          white-space: nowrap;
        }
        .sf-update-action-btn:hover {
          transform: translateY(-1px);
          opacity: 0.92;
        }
        .sf-update-action-btn:active {
          transform: translateY(0);
        }
        .sf-update-action-btn svg.sf-spinning {
          animation: sf-spin 0.6s linear infinite;
        }
        .sf-update-close-btn {
          flex-shrink: 0;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          color: rgba(255, 255, 255, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s ease;
          border-radius: 8px;
        }
        .sf-update-close-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.08);
        }
        @media (max-width: 480px) {
          .sf-update-banner-container {
            top: 1rem;
            width: calc(100% - 1.5rem);
          }
          .sf-update-banner-card {
            padding: 0.8rem 1rem;
            gap: 0.75rem;
          }
          .sf-update-icon-box {
            width: 36px;
            height: 36px;
          }
          .sf-update-action-btn {
            padding: 0.5rem 0.85rem;
            font-size: 0.78rem;
          }
        }
      `}</style>

      <div className="sf-update-banner-container" role="status" aria-live="polite">
        <div className="sf-update-banner-card">
          {/* Glowing Icon */}
          <div className="sf-update-icon-box">
            <Sparkles size={20} color="#ffffff" />
          </div>

          {/* Text Content */}
          <div className="sf-update-text-area">
            <div className="sf-update-heading">
              <span>App Update Available</span>
            </div>
            <p className="sf-update-subtitle">
              A new build has been deployed. Tap to refresh and load the latest features.
            </p>
          </div>

          {/* Update Action Button */}
          <button
            className="sf-update-action-btn"
            onClick={handleUpdate}
            aria-label="Refresh to update app"
          >
            <RefreshCw size={14} className={refreshing ? 'sf-spinning' : ''} />
            <span>{refreshing ? 'Updating…' : 'Update App'}</span>
          </button>

          {/* Dismiss button */}
          <button
            className="sf-update-close-btn"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
