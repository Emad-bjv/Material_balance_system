import React, { useContext, useState } from 'react';
import { AuthContext } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import UserProfileModal from '../../components/UserProfileModal';
import TransactionForm from './TransactionForm';
import TransactionList from './TransactionList';
import { SkeletonTable } from '../../components/Skeleton';
import WarehouseInventory from '../../components/WarehouseInventory';
import { useToast } from '../../contexts/ToastContext';
import DownloadManagerDropdown from '../../components/DownloadManagerDropdown';
import { useDownloadManager } from '../../contexts/DownloadContext';
import NotificationBell from '../../components/NotificationBell';


/* ─── SVG Icons ──────────────────────────────────────────────── */
const Icons = {
  download: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
    </svg>
  ),
  dashboard: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/>
    </svg>
  ),
  logout: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1"/>
    </svg>
  ),
  list: (
    <svg width="16" height="16" fill="none" stroke="var(--primary-500)" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/>
    </svg>
  ),
};

const roleLabels = {
  TECHNICAL: 'دفتر فنی',
  WAREHOUSE: 'انباردار',
  ADMIN: 'مدیر سیستم',
};

const Warehouse = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchVal = searchParams.get('search');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showInventory, setShowInventory] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  React.useEffect(() => {
    if (searchVal) {
      setShowInventory(true);
    }
  }, [searchVal]);

  const { showToast } = useToast();
  const { triggerExport } = useDownloadManager();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const downloadReport = () => {
    triggerExport('warehouse_excel', {}, 'خروجی اکسل موجودی انبار');
  };

  const getInitials = (name) => {
    if (!name) return '؟';
    return name.charAt(0).toUpperCase();
  };

  const getRoleClass = (user) => {
    if (!user) return '';
    if (user.is_superuser) return 'role-admin';
    if (user.role === 'TECHNICAL') return 'role-technical';
    if (user.role === 'WAREHOUSE') return 'role-warehouse';
    return '';
  };

  return (
    <div style={{ padding: '1rem 1.25rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Premium Header */}
      <header className="section-panel animate-in" style={{ 
        padding: '1rem 1.25rem', 
        marginBottom: '1rem',
        background: 'var(--bg-surface)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        zIndex: 50,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '1.3rem',
          }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14h0M8 17h0M12 14h0M12 17h0M16 14h0M16 17h0"/>
            </svg>
          </div>
          <div>
            <h1 className="gradient-text" style={{ fontSize: '1.5rem', marginBottom: 0 }}>پرتال انباردار</h1>
            <p style={{ fontSize: '0.82rem', margin: 0 }}>سیستم یکپارچه مدیریت موازنه متریال</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <DownloadManagerDropdown />
          <NotificationBell />
          {/* User Badge */}
          <div 
            className={`sidebar-user ${getRoleClass(user)}`} 
            style={{ margin: 0, padding: '0.5rem 0.75rem', cursor: 'pointer' }}
            onClick={() => setIsProfileModalOpen(true)}
            title="مشاهده اطلاعات حساب کاربری"
          >
            <div className="sidebar-user-avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}>
              {getInitials(user?.full_name || user?.username)}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name" style={{ fontSize: '0.8rem' }}>{user?.full_name || user?.username}</div>
              <div className="sidebar-user-role" style={{ fontSize: '0.68rem' }}>
                {user?.is_superuser ? 'سوپر ادمین' : roleLabels[user?.role] || user?.role}
              </div>
            </div>
          </div>


          {user?.role !== 'WAREHOUSE' && (
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
              {Icons.dashboard}
              داشبورد
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowInventory(true)}>
            {Icons.box}
            موجودی انبار
          </button>
          <button className="btn btn-danger" onClick={handleLogout}>
            {Icons.logout}
            خروج
          </button>
        </div>
      </header>

      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {showInventory && (
          <WarehouseInventory isModal={true} onClose={() => setShowInventory(false)} />
        )}
        <div className="animate-in animate-in-delay-1" style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
          <TransactionForm onSuccess={handleSuccess} />
        </div>
        
        <div className="animate-in animate-in-delay-2" style={{ marginTop: '1.5rem', position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="section-title" style={{ marginBottom: 0 }}>
              <div className="section-title-icon">{Icons.list}</div>
              لیست تراکنش‌های اخیر
            </div>
            <button className="btn btn-excel" onClick={downloadReport}>
              {Icons.download}
              دانلود گزارش انبار
            </button>
          </div>
          <TransactionList refreshTrigger={refreshTrigger} />
        </div>
      </main>

      {/* User Profile Modal */}
      {isProfileModalOpen && (
        <UserProfileModal 
          user={user} 
          onClose={() => setIsProfileModalOpen(false)} 
        />
      )}
    </div>
  );
};

export default Warehouse;
