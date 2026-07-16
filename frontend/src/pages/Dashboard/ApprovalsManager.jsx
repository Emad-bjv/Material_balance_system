import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useDownloadManager } from '../../contexts/DownloadContext';
import { SkeletonTable } from '../../components/Skeleton';
import JalaliDatePicker from '../../components/JalaliDatePicker';
import { formatPersianNumber, toPersianDigits } from '../../utils/persianNumbers';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

const formatInputValue = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const clean = val.toString().replace(/,/g, '');
  const parts = clean.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

const selectStyles = {
  control: (base) => ({
    ...base,
    background: 'var(--bg-surface-solid)',
    borderColor: 'var(--border-color)',
    borderRadius: 'var(--radius-md)',
    minHeight: '42px',
    boxShadow: 'none',
    '&:hover': { borderColor: 'var(--primary-500)' }
  }),
  menu: (base) => ({
    ...base,
    background: 'var(--bg-surface-solid)',
    border: '1px solid var(--border-color)',
    zIndex: 9999
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? 'var(--bg-body)' : 'transparent',
    color: 'var(--text-main)',
    cursor: 'pointer'
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--input-text-color)'
  }),
  input: (base) => ({
    ...base,
    color: 'var(--input-text-color)'
  })
};

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
  check: (
    <svg width="16" height="16" fill="none" stroke="var(--primary-500)" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
    </svg>
  ),
};

const ApprovalsManager = () => {
  const [approvals, setApprovals] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [materials, setMaterials] = useState([]);
  
  const [formData, setFormData] = useState({ 
    contractor: '', material: '', approved_quantity: '', 
    contract_number: '', contract_subject: '', 
    approval_date: new Date().toISOString().split('T')[0] 
  });
  
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [liveReceived, setLiveReceived] = useState(null);
  const [availableContracts, setAvailableContracts] = useState([]);
  const [allowedMaterialIds, setAllowedMaterialIds] = useState(null);
  
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [isListOpen, setIsListOpen] = useState(true);
  
  const { showToast } = useToast();
  const { triggerExport } = useDownloadManager();

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [approvalsLoading, setApprovalsLoading] = useState(false);

  const fetchStaticData = async () => {
    setLoading(true);
    try {
      const [contRes, matRes] = await Promise.all([
        api.get('contractors/'),
        api.get('materials/')
      ]);
      setContractors(contRes.data.results || contRes.data);
      setMaterials(matRes.data.results || matRes.data);
    } catch (err) {
      console.error("Error fetching static data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovals = async (page) => {
    setApprovalsLoading(true);
    try {
      const res = await api.get('approvals/', { params: { page } });
      if (res.data.results) {
        setApprovals(res.data.results);
        setTotalCount(res.data.count);
        setTotalPages(Math.ceil(res.data.count / 50));
      } else {
        setApprovals(res.data);
        setTotalCount(res.data.length);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Error fetching approvals", err);
    } finally {
      setApprovalsLoading(false);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const delta = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  useEffect(() => {
    fetchStaticData();
  }, []);

  useEffect(() => {
    fetchApprovals(currentPage);
  }, [currentPage]);

  useEffect(() => {
    const fetchLiveReceived = async () => {
      if (formData.contractor && formData.material) {
        try {
          const res = await api.get(`balance/contractor-material-received/?contractor_id=${formData.contractor}&material_id=${formData.material}`);
          setLiveReceived(res.data.total_received);
        } catch (err) {
          console.error("Error fetching live received stats", err);
          setLiveReceived(null);
        }
      } else {
        setLiveReceived(null);
      }
    };
    fetchLiveReceived();
  }, [formData.contractor, formData.material]);

  useEffect(() => {
    const fetchContracts = async () => {
      if (formData.contractor && formData.material) {
        try {
          const res = await api.get(`transactions/contractor-contracts/?contractor_id=${formData.contractor}&material_id=${formData.material}`);
          setAvailableContracts(res.data);
        } catch (err) {
          console.error("Error fetching contracts", err);
          setAvailableContracts([]);
        }
      } else {
        setAvailableContracts([]);
      }
    };
    fetchContracts();
  }, [formData.contractor, formData.material]);

  useEffect(() => {
    const fetchAllowedMaterials = async () => {
      if (formData.contractor) {
        try {
          const res = await api.get(`contractors/${formData.contractor}/received-materials/`);
          setAllowedMaterialIds(res.data);
        } catch (err) {
          console.error("Error fetching allowed materials", err);
          setAllowedMaterialIds(null);
        }
      } else {
        setAllowedMaterialIds(null);
      }
    };
    fetchAllowedMaterials();
  }, [formData.contractor]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'approved_quantity') {
      const rawVal = value.replace(/,/g, '');
      if (/^[0-9.]*$/.test(rawVal)) {
        const dots = (rawVal.match(/\./g) || []).length;
        if (dots <= 1) {
          setFormData(prev => ({
            ...prev,
            [name]: rawVal
          }));
        }
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.contractor) {
      showToast('لطفا پیمانکار را انتخاب کنید.', 'error');
      return;
    }
    if (!formData.material) {
      showToast('لطفا متریال / کالا را انتخاب کنید.', 'error');
      return;
    }
    if (!formData.approved_quantity) {
      showToast('لطفا مقدار تایید شده را وارد کنید.', 'error');
      return;
    }
    if (!formData.contract_number) {
      showToast('لطفا شماره قرارداد را وارد یا انتخاب کنید.', 'error');
      return;
    }
    if (!formData.contract_subject) {
      showToast('لطفا موضوع قرارداد را وارد یا انتخاب کنید.', 'error');
      return;
    }
    if (!formData.approval_date) {
      showToast('لطفا تاریخ تایید را انتخاب کنید.', 'error');
      return;
    }
    setSubmitLoading(true);
    try {
      await api.post('approvals/', formData);
      setFormData({ 
        ...formData, 
        material: '', approved_quantity: '', contract_number: '', contract_subject: '' 
      });
      showToast('تاییدیه با موفقیت ثبت شد', 'success');
      fetchApprovals(currentPage);
    } catch (err) {
      showToast(err.response?.data ? JSON.stringify(err.response.data) : 'خطا در ثبت تاییدیه دفتر فنی', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const downloadReport = () => {
    triggerExport('approvals_excel', {}, 'خروجی اکسل لیست تاییدیه‌ها');
  };

  const filteredMaterials = allowedMaterialIds 
    ? materials.filter(m => allowedMaterialIds.includes(m.id))
    : materials;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 2.5rem)' }}>
      {/* Header */}
      <div className="page-header animate-in" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="gradient-text">مدیریت تاییدیه‌های کارکرد</h1>
          <p>ثبت مقادیر تایید شده دفتر فنی برای پیمانکاران جهت محاسبه اتوماتیک پرتی و کسری</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-excel" onClick={downloadReport}>
            {Icons.download}
            دانلود تاییدیه‌ها
          </button>
        </div>
      </div>

      {/* Form Section */}
      <div className="section-panel animate-in animate-in-delay-1" style={{ marginBottom: '1.5rem', position: 'relative', zIndex: 10, flexShrink: 0 }}>
        <div 
          className="section-title" 
          style={{ cursor: 'pointer', userSelect: 'none', marginBottom: isFormOpen ? '1rem' : '0' }}
          onClick={() => setIsFormOpen(!isFormOpen)}
        >
          <div className="section-title-icon">{Icons.plus}</div>
          ثبت تاییدیه جدید
          <svg 
            width="18" height="18" 
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
            style={{ transform: isFormOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease', marginRight: 'auto' }}
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className={`collapse-wrapper ${isFormOpen ? 'open' : 'closed'}`}>
          <div className="collapse-inner">
            <form onSubmit={handleSubmit} className="grid grid-cols-3">
          
          <div className="form-group">
            <label className="form-label">پیمانکار <span style={{color: 'red'}}>*</span></label>
            <Select 
              styles={selectStyles}
              placeholder="انتخاب پیمانکار..."
              isClearable
              menuPortalTarget={document.body}
              options={contractors.map(c => ({ value: c.id, label: c.full_name }))}
              value={formData.contractor ? { value: formData.contractor, label: contractors.find(c => c.id === parseInt(formData.contractor))?.full_name } : null}
              onChange={selected => setFormData({
                ...formData, 
                contractor: selected ? selected.value : '',
                material: '',
                contract_number: '',
                contract_subject: ''
              })}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">متریال / کالا <span style={{color: 'red'}}>*</span></label>
            <Select 
              styles={selectStyles}
              placeholder="انتخاب متریال..."
              isClearable
              menuPortalTarget={document.body}
              options={filteredMaterials.map(m => {
                const specs = [m.size, m.thickness, m.material_type].filter(Boolean).join(' / ');
                const label = specs ? `${m.name} (${specs}) (${m.unit_display})` : `${m.name} (${m.unit_display})`;
                return { value: m.id, label };
              })}
              value={formData.material ? (() => {
                const m = materials.find(x => x.id === parseInt(formData.material));
                if (!m) return null;
                const specs = [m.size, m.thickness, m.material_type].filter(Boolean).join(' / ');
                const label = specs ? `${m.name} (${specs}) (${m.unit_display})` : `${m.name} (${m.unit_display})`;
                return { value: m.id, label };
              })() : null}
              onChange={selected => setFormData({...formData, material: selected ? selected.value : ''})}
            />
            {liveReceived !== null && (
              <div className="live-indicator live-warning">
                <span className="live-indicator-dot"></span>
                مجموع دریافتی پیمانکار: {formatPersianNumber(parseFloat(liveReceived))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">مقدار تایید شده <span style={{color: 'red'}}>*</span></label>
            <input type="text" name="approved_quantity" className="form-control" value={formatInputValue(formData.approved_quantity)} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">شماره قرارداد <span style={{color: 'red'}}>*</span></label>
            <CreatableSelect 
              styles={selectStyles}
              placeholder="انتخاب یا ثبت جدید..."
              isClearable
              menuPortalTarget={document.body}
              options={availableContracts.map(c => ({ value: c.contract_number, label: c.contract_number, subject: c.contract_subject }))}
              value={formData.contract_number ? { value: formData.contract_number, label: formData.contract_number } : null}
              onChange={selected => {
                if (selected) {
                  setFormData({
                    ...formData, 
                    contract_number: selected.value,
                    contract_subject: selected.subject || formData.contract_subject // auto-fill subject if exists
                  });
                } else {
                  setFormData({...formData, contract_number: ''});
                }
              }}
              formatCreateLabel={(inputValue) => `ثبت قرارداد جدید: "${inputValue}"`}
            />
          </div>

          <div className="form-group">
            <label className="form-label">موضوع قرارداد <span style={{color: 'red'}}>*</span></label>
            <CreatableSelect 
              styles={selectStyles}
              placeholder="انتخاب یا ثبت موضوع..."
              isClearable
              menuPortalTarget={document.body}
              options={availableContracts.filter(c => c.contract_subject).map(c => ({ value: c.contract_subject, label: c.contract_subject, number: c.contract_number }))}
              value={formData.contract_subject ? { value: formData.contract_subject, label: formData.contract_subject } : null}
              onChange={selected => {
                if (selected) {
                  setFormData({
                    ...formData, 
                    contract_subject: selected.value,
                    contract_number: selected.number || formData.contract_number
                  });
                } else {
                  setFormData({...formData, contract_subject: ''});
                }
              }}
              formatCreateLabel={(inputValue) => `ثبت موضوع جدید: "${inputValue}"`}
            />
          </div>

          <div className="form-group">
            <label className="form-label">تاریخ تایید <span style={{color: 'red'}}>*</span></label>
            <JalaliDatePicker 
              name="approval_date" 
              value={formData.approval_date} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={submitLoading} style={{ width: '100%', padding: '0.85rem' }}>
              {submitLoading ? 'در حال ثبت...' : (
                <>{Icons.plus} ثبت تاییدیه کارکرد</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

      {/* List Section */}
      <div className="section-panel animate-in animate-in-delay-2" style={{ position: 'relative', zIndex: 1, flex: isListOpen ? 1 : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <div 
          className="section-title" 
          style={{ flexShrink: 0, cursor: 'pointer', userSelect: 'none', marginBottom: isListOpen ? '1rem' : '0' }}
          onClick={() => setIsListOpen(!isListOpen)}
        >
          <div className="section-title-icon">{Icons.check}</div>
          لیست تاییدیه‌ها
          {!loading && <span style={{ marginRight: '1rem', fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 500 }}>{toPersianDigits(totalCount)} تاییدیه</span>}
          <svg 
            width="18" height="18" 
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
            style={{ transform: isListOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease', marginRight: 'auto' }}
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        
        <div className={`collapse-wrapper ${isListOpen ? 'open' : 'closed'}`} style={{ flex: 1, minHeight: 0 }}>
          <div className="collapse-inner" style={{ height: '100%' }}>
            {loading || approvalsLoading ? (
              <SkeletonTable rows={4} cols={6} />
            ) : (
              <div className="table-container" style={{ flex: 1, maxHeight: '600px', overflowY: 'auto' }}>
                <table className="table table-lg">
                  <thead>
                <tr>
                  <th>پیمانکار</th>
                  <th>متریال</th>
                  <th>مقدار تایید شده</th>
                  <th>شماره قرارداد</th>
                  <th>پرتی مجاز</th>
                </tr>
              </thead>
              <tbody>
                {approvals.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <div className="empty-state">
                        <div className="empty-state-icon">✅</div>
                        <div className="empty-state-title">تاییدیه‌ای یافت نشد</div>
                        <div className="empty-state-description">برای شروع، تاییدیه جدید ثبت کنید</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  approvals.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.contractor_detail?.full_name}</td>
                      <td>
                        {a.material_detail?.name}
                        {a.material_detail?.specs && a.material_detail.specs !== '—' && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginRight: '6px', fontWeight: 400 }}>
                            ({a.material_detail.specs})
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--primary-500)' }}>
                          {formatPersianNumber(a.approved_quantity)} {a.material_detail?.unit_display}
                        </span>
                      </td>
                      <td style={{ direction: 'ltr', textAlign: 'right' }}>{a.contract_number || '-'}</td>
                      <td><span className="badge badge-warning">{formatPersianNumber(a.allowed_waste)}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="balance-pagination-container" style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface-solid)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', marginTop: 'auto', flexShrink: 0 }}>
            <div className="pagination-info">
              نمایش ردیف‌های {formatPersianNumber((currentPage - 1) * 50 + 1)} تا {formatPersianNumber(Math.min(currentPage * 50, totalCount))} از {formatPersianNumber(totalCount)} تاییدیه
            </div>
            <div className="pagination-buttons">
              <button 
                className="pagination-btn" 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                <span>قبلی</span>
              </button>
              
              {getPageNumbers().map((pageNum, idx) => {
                if (pageNum === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} style={{ color: 'var(--text-dim)', padding: '0 0.5rem', alignSelf: 'center', userSelect: 'none' }}>
                      ...
                    </span>
                  );
                }
                return (
                  <button
                    key={pageNum}
                    className={`pagination-btn-number ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {formatPersianNumber(pageNum)}
                  </button>
                );
              })}

              <button 
                className="pagination-btn" 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <span>بعدی</span>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
    </div>
  );
};

export default ApprovalsManager;
