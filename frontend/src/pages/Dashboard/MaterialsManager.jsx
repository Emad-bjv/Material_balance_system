import React, { useState, useEffect, useContext } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { SkeletonTable } from '../../components/Skeleton';
import { AuthContext } from '../../contexts/AuthContext';
import { toPersianDigits } from '../../utils/persianNumbers';

/* ─── SVG Icons ──────────────────────────────────────────────── */
const Icons = {
  plus: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 4v16m8-8H4"/>
    </svg>
  ),
  folder: (
    <svg width="16" height="16" fill="none" stroke="var(--primary-500)" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"/>
    </svg>
  ),
};

const MaterialsManager = () => {
  const { user } = useContext(AuthContext);
  const isReadOnly = user?.role === 'TECHNICAL' && !user?.is_superuser;

  const [categories, setCategories] = useState([]);
  
  // Forms states
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const catRes = await api.get(`categories/?page=${page}`);
      if (catRes.data.results) {
        setCategories(catRes.data.results);
        setTotalCount(catRes.data.count);
      } else {
        setCategories(catRes.data);
        setTotalCount(catRes.data.length);
      }
    } catch (err) {
      console.error("Error fetching data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page]);

  const handleCatSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('categories/', catForm);
      setCatForm({ name: '', description: '' });
      showToast('رسته کاری با موفقیت ثبت شد', 'success');
      fetchData();
    } catch (err) {
      showToast('خطا در ثبت رسته کاری', 'error');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '0.5rem' }}>
      {/* Header */}
      <div className="page-header animate-in">
        <div>
          <h1 className="gradient-text">مدیریت رسته‌ها</h1>
          <p>تعریف رسته‌های اصلی برای متریال‌ها</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        </div>
      </div>

      <div className="grid grid-cols-1">
        {/* Work Categories Section */}
        <div className="section-panel animate-in animate-in-delay-1">
          {!isReadOnly && (
            <>
              <div className="section-title">
                <div className="section-title-icon">{Icons.plus}</div>
                افزودن رسته کاری
              </div>
              <form onSubmit={handleCatSubmit} style={{ marginBottom: '2rem' }}>
                <div className="form-group">
                  <input type="text" className="form-control" placeholder="نام رسته (مثلا: پایپینگ)" value={catForm.name} onChange={(e) => setCatForm({...catForm, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <input type="text" className="form-control" placeholder="توضیحات (اختیاری)" value={catForm.description} onChange={(e) => setCatForm({...catForm, description: e.target.value})} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  {Icons.plus} ثبت رسته
                </button>
              </form>
            </>
          )}

          <div className="section-title" style={!isReadOnly ? { borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' } : {}}>
            <div className="section-title-icon">{Icons.folder}</div>
            لیست رسته‌ها
            {!loading && <span style={{ marginRight: 'auto', fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 500 }}>{toPersianDigits(totalCount)} رسته</span>}
          </div>
          <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {loading ? <SkeletonTable rows={3} cols={2} /> : (
            <table className="table">
              <thead><tr><th>نام</th><th style={{ textAlign: 'center' }}>تعداد کالا</th></tr></thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr><td colSpan="2">
                    <div className="empty-state">
                      <div className="empty-state-icon">📁</div>
                      <div className="empty-state-title">رسته‌ای یافت نشد</div>
                    </div>
                  </td></tr>
                ) : (
                  categories.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-primary">{c.materials_count || 0}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            )}
          </div>
          {totalCount > 10 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', gap: '10px' }}>
              <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>قبلی</button>
              <span style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>صفحه {toPersianDigits(page)}</span>
              <button className="btn btn-secondary" disabled={page * 10 >= totalCount} onClick={() => setPage(page + 1)}>بعدی</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaterialsManager;
