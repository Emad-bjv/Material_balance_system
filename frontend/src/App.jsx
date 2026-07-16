import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { DownloadProvider } from './contexts/DownloadContext';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login/Login'));
const DashboardLayout = lazy(() => import('./pages/Dashboard/DashboardLayout'));
const DashboardOverview = lazy(() => import('./pages/Dashboard/DashboardOverview'));
const ContractorsManager = lazy(() => import('./pages/Dashboard/ContractorsManager'));
const MaterialsManager = lazy(() => import('./pages/Dashboard/MaterialsManager'));
const ApprovalsManager = lazy(() => import('./pages/Dashboard/ApprovalsManager'));
const AuditLog = lazy(() => import('./pages/Dashboard/AuditLog'));
const Warehouse = lazy(() => import('./pages/Warehouse/Warehouse'));
const WarehouseInventory = lazy(() => import('./components/WarehouseInventory'));
import './index.css';

// تم کنترلر به صورت یک کامپوننت پوششی
const ThemeController = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <>
      {/* پس‌زمینه انیمیت‌شده با بلاب‌ها و ذرات شناور */}
      <div className="animated-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="particle particle-1"></div>
        <div className="particle particle-2"></div>
        <div className="particle particle-3"></div>
        <div className="particle particle-4"></div>
        <div className="particle particle-5"></div>
        <div className="particle particle-6"></div>
      </div>

      {/* دکمه تغییر تم */}
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label="تغییر تم"
        title={theme === 'light' ? 'حالت تاریک' : 'حالت روشن'}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      {children}
    </>
  );
};

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)', padding: '20px', fontFamily: 'Vazirmatn, sans-serif', direction: 'rtl' }}>
          <h2>خطایی در بارگذاری بخش‌های سیستم رخ داده است</h2>
          <p style={{ color: 'var(--text-muted)', margin: '10px 0' }}>{this.state.error?.message || String(this.state.error)}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>تلاش مجدد و بارگذاری صفحه</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <DownloadProvider>
          <ThemeController>
            <BrowserRouter>
              <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-main)' }}>در حال بارگذاری...</div>}>
                <ErrorBoundary>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    
                    {/* روت‌های دفتر فنی (مدیریتی) */}
                    <Route element={<ProtectedRoute allowedRoles={['TECHNICAL', 'ADMIN']} />}>
                      <Route path="/dashboard" element={<DashboardLayout />}>
                        <Route index element={<DashboardOverview />} />
                        <Route path="contractors" element={<ContractorsManager />} />
                        <Route path="materials" element={<MaterialsManager />} />
                        <Route path="inventory" element={<WarehouseInventory />} />
                        <Route path="approvals" element={<ApprovalsManager />} />
                        <Route path="audit-log" element={<AuditLog />} />
                      </Route>
                    </Route>
                    
                    {/* روت‌های انباردار */}
                    <Route element={<ProtectedRoute allowedRoles={['WAREHOUSE']} />}>
                      <Route path="/warehouse" element={<Warehouse />} />
                    </Route>

                    {/* در صورت مسیر اشتباه، اگر لاگین نبود برود به لاگین */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                  </Routes>
                </ErrorBoundary>
              </Suspense>
            </BrowserRouter>
          </ThemeController>
        </DownloadProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
