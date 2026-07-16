import React, { useState, useEffect, useContext } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useDownloadManager } from '../../contexts/DownloadContext';
import { SkeletonTable } from '../../components/Skeleton';
import { AuthContext } from '../../contexts/AuthContext';
import { toPersianDigits, formatPersianNumber, toPersianDate } from '../../utils/persianNumbers';

/* ─── SVG Icons ──────────────────────────────────────────────── */
const Icons = {
  download: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
    </svg>
  ),
  plus: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 4v16m8-8H4"/>
    </svg>
  ),
  trash: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"/>
    </svg>
  ),
};

const ContractorsManager = () => {
  const { user } = useContext(AuthContext);
  const isReadOnly = !user?.is_superuser;

  const [contractors, setContractors] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ first_name: '', last_name: '' });
  const [submitLoading, setSubmitLoading] = useState(false);
  const { showToast } = useToast();
  const { triggerExport } = useDownloadManager();
  
  // Modal states
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [contractorRequests, setContractorRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const fetchContractors = async () => {
    setLoading(true);
    try {
      const response = await api.get(`contractors/?page=${page}&search=${search}`);
      if (response.data.results) {
        setContractors(response.data.results);
        setTotalCount(response.data.count);
      } else {
        setContractors(response.data);
        setTotalCount(response.data.length);
      }
    } catch (err) {
      console.error("Error fetching contractors", err);
    } finally {
      setLoading(false);
    }
  };

  const handleContractorClick = async (contractor) => {
    setSelectedContractor(contractor);
    setLoadingRequests(true);
    try {
      const response = await api.get(`transactions/?contractor=${contractor.id}`);
      let data = response.data.results || response.data;
      data = [...data].sort((a, b) => b.id - a.id);
      setContractorRequests(data);
    } catch (err) {
      console.error("Error fetching requests", err);
      showToast('خطا در دریافت درخواست‌های پیمانکار', 'error');
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchContractors();
  }, [page, search]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      await api.post('contractors/', formData);
      setFormData({ first_name: '', last_name: '' });
      showToast('پیمانکار با موفقیت ثبت شد', 'success');
      fetchContractors(); // Refresh the list
    } catch (err) {
      showToast(err.response?.data ? JSON.stringify(err.response.data) : 'خطا در ثبت پیمانکار.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('آیا از حذف این پیمانکار اطمینان دارید؟ تمام تراکنش‌های مرتبط ممکن است تحت تاثیر قرار گیرند.')) {
      try {
        await api.delete(`contractors/${id}/`);
        showToast('پیمانکار حذف شد', 'success');
        fetchContractors();
      } catch (err) {
        showToast('امکان حذف پیمانکار وجود ندارد. (شاید دارای تراکنش فعال باشد)', 'error');
      }
    }
  };

  const downloadReport = () => {
    triggerExport('contractors_excel', {}, 'خروجی اکسل لیست پیمانکاران');
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingTop: '0.5rem' }}>
      {/* Header */}
      <div className="page-header animate-in">
        <div>
          <h1 className="gradient-text">مدیریت پیمانکاران</h1>
          <p>افزودن، ویرایش و مشاهده لیست پیمانکاران پروژه</p>
        </div>
      </div>

      {/* Form Section */}
      {!isReadOnly && (
        <div className="section-panel animate-in animate-in-delay-1" style={{ marginBottom: '1.5rem' }}>
          <div className="section-title">
            <div className="section-title-icon">{Icons.plus}</div>
            افزودن پیمانکار جدید
          </div>
          <form onSubmit={handleSubmit} className="flex gap-4 items-center" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '180px' }}>
              <input 
                type="text" 
                name="first_name" 
                placeholder="نام" 
                className="form-control" 
                value={formData.first_name} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '180px' }}>
              <input 
                type="text" 
                name="last_name" 
                placeholder="نام خانوادگی" 
                className="form-control" 
                value={formData.last_name} 
                onChange={handleChange} 
                required 
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitLoading} style={{ height: '46px', minWidth: '140px' }}>
              {submitLoading ? 'در حال ثبت...' : (
                <>{Icons.plus} ثبت پیمانکار</>
              )}
            </button>
          </form>
        </div>
      )}

      {/* List Section */}
      <div className="section-panel animate-in animate-in-delay-2">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 20h5V4H2v16h5M12 20v-8M7 20v-4M17 20v-4" />
            </svg>
            لیست پیمانکاران
          </h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="جستجو..." 
              className="form-control"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ width: '200px', height: '40px' }}
            />
            <button className="btn btn-secondary" onClick={downloadReport} style={{ height: '40px' }}>
              {Icons.download}
              خروجی اکسل
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>شناسه</th>
                  <th>نام و نام خانوادگی</th>
                  <th style={{ textAlign: 'center' }}>تعداد تراکنش‌ها</th>
                  {!isReadOnly && <th style={{ textAlign: 'center' }}>عملیات</th>}
                </tr>
              </thead>
              <tbody>
                {contractors.length === 0 ? (
                  <tr>
                    <td colSpan={isReadOnly ? "3" : "4"}>
                      <div className="empty-state">
                        <div className="empty-state-icon">👷</div>
                        <div className="empty-state-title">هیچ پیمانکاری یافت نشد</div>
                        <div className="empty-state-description">برای شروع، پیمانکار جدید اضافه کنید</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contractors.map(c => (
                    <tr 
                      key={c.id} 
                      onClick={() => handleContractorClick(c)} 
                      style={{ cursor: 'pointer' }}
                      className="hover-row"
                    >
                      <td>
                        <span className="badge badge-primary">#{toPersianDigits(c.id)}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-primary">{toPersianDigits(c.transaction_count || 0)} تراکنش</span>
                      </td>
                      {!isReadOnly && (
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="btn btn-ghost"
                            style={{ color: 'var(--danger-500)', padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(c.id);
                            }}
                          >
                            {Icons.trash}
                            حذف
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {totalCount > 10 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', gap: '10px' }}>
            <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>قبلی</button>
            <span style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>صفحه {toPersianDigits(page)}</span>
            <button className="btn btn-secondary" disabled={page * 10 >= totalCount} onClick={() => setPage(page + 1)}>بعدی</button>
          </div>
        )}
      </div>

      {/* Contractor Details Modal */}
      {selectedContractor && (
        <div 
          className="modal-overlay" 
          style={{ backdropFilter: 'blur(5px)' }} 
          onClick={() => setSelectedContractor(null)}
        >
          <div 
            className="modal-container animate-in" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-header">
              <h2>درخواست‌ها و تراکنش‌های {selectedContractor.full_name}</h2>
              <button className="modal-close-btn" onClick={() => setSelectedContractor(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              {loadingRequests ? (
                <SkeletonTable rows={4} cols={4} />
              ) : contractorRequests.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <div className="empty-state-title">هیچ درخواستی برای این پیمانکار ثبت نشده است</div>
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>نوع</th>
                        <th>متریال / مشخصات</th>
                        <th>مقدار</th>
                        <th>تاریخ</th>
                        <th>حواله / بارنامه</th>
                        <th>شماره قرارداد</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contractorRequests.map(req => {
                        const isOut = req.transaction_type === 'OUT';
                        return (
                          <tr key={req.id}>
                            <td>
                              <span className={`badge ${isOut ? 'badge-danger' : 'badge-success'}`}>
                                {isOut ? 'خروج (دریافتی)' : 'ورود (مرجوعی)'}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontWeight: '600' }}>{req.material_detail?.name || 'نامشخص'}</div>
                              {req.material_detail?.specs && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {req.material_detail.specs}
                                </div>
                              )}
                            </td>
                            <td style={{ fontWeight: '600', direction: 'ltr', textAlign: 'right' }}>
                              {formatPersianNumber(req.quantity)} 
                              <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-muted)', marginRight: '4px' }}>
                                {req.material_detail?.unit_display || req.material_detail?.unit || ''}
                              </span>
                            </td>
                            <td>{toPersianDate(req.date)}</td>
                            <td>
                              {req.receipt_number && (
                                <div style={{ marginBottom: '2px' }}>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>حواله:</span>{' '}
                                  <span className="badge badge-primary">{toPersianDigits(req.receipt_number)}</span>
                                </div>
                              )}
                              {req.bill_of_lading && (
                                <div>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>بارنامه:</span>{' '}
                                  <span className="badge badge-secondary">{toPersianDigits(req.bill_of_lading)}</span>
                                </div>
                              )}
                              {!req.receipt_number && !req.bill_of_lading && '—'}
                            </td>
                            <td>
                              {req.contract_number ? (
                                <span className="badge badge-secondary">{toPersianDigits(req.contract_number)}</span>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ marginTop: 'auto' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedContractor(null)}>بستن</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractorsManager;
