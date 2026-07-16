import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toPersianDigits, formatPersianNumber } from '../utils/persianNumbers';
import { AuthContext } from '../contexts/AuthContext';

/* ─── SVG Icons ──────────────────────────────────────────────── */
const BellIcon = ({ hasNotif }) => (
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/>
    {hasNotif && <circle cx="17" cy="5" r="3" fill="var(--danger-500)" stroke="none"/>}
  </svg>
);

const WarningIcon = () => (
  <svg width="16" height="16" fill="none" stroke="var(--danger-500)" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
  </svg>
);

const NotificationBell = ({ placement = 'bottom' }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const handleNotifClick = (notif) => {
    setIsOpen(false);
    const searchParam = `?search=${encodeURIComponent(notif.material_name)}`;
    if (window.location.pathname.startsWith('/warehouse') || user?.role === 'WAREHOUSE') {
      navigate(`/warehouse${searchParam}`);
    } else {
      navigate(`/dashboard/inventory${searchParam}`);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('notifications/');
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error('Error fetching notifications', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and every 60 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const count = notifications.length;

  return (
    <div className="notification-bell-wrapper" ref={dropdownRef}>
      <button
        className="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="هشدارها"
        title={count > 0 ? `${toPersianDigits(count)} هشدار فعال` : 'بدون هشدار'}
      >
        <BellIcon hasNotif={count > 0} />
        {count > 0 && (
          <span className="notification-badge">
            {toPersianDigits(count > 9 ? '۹+' : count)}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown" style={{
          ...(placement === 'top' ? { bottom: 'calc(100% + 8px)', top: 'auto' } : { top: 'calc(100% + 8px)' })
        }}>
          <div className="notification-dropdown-header">
            <span>هشدارهای سیستم</span>
            <span className="notification-dropdown-count">
              {toPersianDigits(count)} مورد
            </span>
          </div>

          <div className="notification-dropdown-body">
            {loading ? (
              <div className="notification-empty">در حال بارگذاری...</div>
            ) : count === 0 ? (
              <div className="notification-empty">
                <span style={{ fontSize: '1.5rem' }}>✅</span>
                <p>هشداری وجود ندارد</p>
              </div>
            ) : (
              notifications.map((notif, idx) => (
                <div
                  key={idx}
                  className={`notification-item notification-${notif.severity}`}
                  onClick={() => handleNotifClick(notif)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="notification-item-icon">
                    <WarningIcon />
                  </div>
                  <div className="notification-item-content">
                    <div className="notification-item-title">{notif.title}</div>
                    <div className="notification-item-message">{notif.message}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
