import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import JalaliDatePicker from '../../components/JalaliDatePicker';
import Select from 'react-select';
import DocumentScanner, { ScanButton } from '../../components/DocumentScanner';

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
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999
  }),
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
  plus: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 4v16m8-8H4"/>
    </svg>
  ),
  arrowDown: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
    </svg>
  ),
  arrowUp: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
    </svg>
  ),
};

const TransactionForm = ({ onSuccess }) => {
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [liveInventory, setLiveInventory] = useState(null);
  const { showToast } = useToast();

  const [matSizeVal, setMatSizeVal] = useState('');
  const [matSizeUnit, setMatSizeUnit] = useState('"');
  const [matThickVal, setMatThickVal] = useState('');
  const [matThickUnit, setMatThickUnit] = useState('mm');

  // Scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTitle, setScannerTitle] = useState('');
  const [scannerTarget, setScannerTarget] = useState(null); // 'inbound' | 'outbound'
  const [scannedInbound, setScannedInbound] = useState(null);
  const [scannedOutbound, setScannedOutbound] = useState(null);

  const [formData, setFormData] = useState({
    transaction_type: 'OUT',
    material: '',
    quantity: '',
    date: new Date().toISOString().split('T')[0],
    bill_of_lading: '',
    contractor: '',
    contract_number: '',
    contract_subject: '',
    // Fields for Inbound Material Creation
    mat_name: '',
    mat_work_category: '',
    mat_size: '',
    mat_material_type: '',
    mat_thickness: '',
    mat_unit: 'KG',
    mat_waste_percentage: '0.00'
  });

  // Outbound Cascading Dropdowns State
  const [outForm, setOutForm] = useState({
    name: null,
    material_type: null,
    size: null,
    thickness: null,
    unit: null
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matRes, catRes, contRes] = await Promise.all([
          api.get('materials/'),
          api.get('categories/'),
          api.get('contractors/')
        ]);
        setMaterials(matRes.data.results || matRes.data);
        setCategories(catRes.data.results || catRes.data);
        setContractors(contRes.data.results || contRes.data);
      } catch (err) {
        console.error("Error fetching data", err);
      }
    };
    fetchData();
  }, [formData.transaction_type]);

  // Compute cascading options
  const availableNames = [...new Set(materials.map(m => m.name).filter(Boolean))];
  const level1 = materials.filter(m => m.name === outForm.name);
  const availableTypes = outForm.name !== null ? [...new Set(level1.map(m => m.material_type || ''))] : [];
  const level2 = level1.filter(m => (m.material_type || '') === (outForm.material_type || ''));
  const availableSizes = outForm.material_type !== null ? [...new Set(level2.map(m => m.size || ''))] : [];
  const level3 = level2.filter(m => (m.size || '') === (outForm.size || ''));
  const availableThicknesses = outForm.size !== null ? [...new Set(level3.map(m => m.thickness || ''))] : [];
  const level4 = level3.filter(m => (m.thickness || '') === (outForm.thickness || ''));
  const availableUnits = outForm.thickness !== null ? [...new Set(level4.map(m => m.unit || ''))] : [];

  // Auto-select unit if there's only 1 option
  useEffect(() => {
    if (availableUnits.length === 1 && outForm.unit !== availableUnits[0]) {
      setOutForm(prev => ({ ...prev, unit: availableUnits[0] }));
    }
  }, [availableUnits, outForm.unit]);

  const resolvedMaterial = materials.find(m => 
    m.name === outForm.name && 
    (m.material_type || '') === (outForm.material_type || '') &&
    (m.size || '') === (outForm.size || '') &&
    (m.thickness || '') === (outForm.thickness || '') &&
    m.unit === outForm.unit
  );

  useEffect(() => {
    if (formData.transaction_type === 'OUT') {
      if (resolvedMaterial) {
        setFormData(prev => ({ ...prev, material: resolvedMaterial.id }));
      } else {
        setFormData(prev => ({ ...prev, material: '' }));
      }
    }
  }, [resolvedMaterial, formData.transaction_type]);

  useEffect(() => {
    const fetchLiveInventory = async () => {
      if (formData.transaction_type === 'OUT' && formData.material) {
        try {
          const res = await api.get(`balance/material-inventory/?material_id=${formData.material}`);
          setLiveInventory(res.data.current_stock);
        } catch (err) {
          console.error("Error fetching live inventory", err);
          setLiveInventory(null);
        }
      } else {
        setLiveInventory(null);
      }
    };
    fetchLiveInventory();
  }, [formData.transaction_type, formData.material]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'quantity') {
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
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.transaction_type === 'IN') {
      if (!formData.mat_work_category) {
        showToast('لطفا رسته کاری متریال را انتخاب کنید.', 'error');
        return;
      }
      if (!formData.mat_unit) {
        showToast('لطفا واحد اندازه‌گیری متریال را انتخاب کنید.', 'error');
        return;
      }
      if (!scannedInbound) {
        showToast('لطفا تصویر بارنامه را اسکن یا بارگذاری کنید.', 'error');
        return;
      }
    } else if (formData.transaction_type === 'OUT') {
      if (!formData.contractor) {
        showToast('لطفا پیمانکار را انتخاب کنید.', 'error');
        return;
      }
      if (!scannedOutbound) {
        showToast('لطفا تصویر برگه خروج را اسکن یا بارگذاری کنید.', 'error');
        return;
      }
      if (!formData.material) {
        showToast('لطفا تمام مشخصات متریال خروجی را انتخاب کنید.', 'error');
        return;
      }
      if (liveInventory !== null && parseFloat(formData.quantity) > parseFloat(liveInventory)) {
        showToast('مقدار خروجی نمی‌تواند از موجودی انبار بیشتر باشد.', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      let materialIdToUse = formData.material;

      // If INBOUND, first create the material
      if (formData.transaction_type === 'IN') {
        let sizeCombined = '';
        if (matSizeVal.trim() !== '') {
          sizeCombined = matSizeUnit === 'NONE' ? matSizeVal.trim() : `${matSizeVal.trim()} ${matSizeUnit}`;
        }

        let thicknessCombined = '';
        if (matThickVal.trim() !== '') {
          if (matThickUnit === 'SCH') {
            thicknessCombined = `SCH ${matThickVal.trim()}`;
          } else if (matThickUnit === 'BWG') {
            thicknessCombined = `${matThickVal.trim()} BWG`;
          } else if (matThickUnit === 'NONE') {
            thicknessCombined = matThickVal.trim();
          } else {
            thicknessCombined = `${matThickVal.trim()} ${matThickUnit}`;
          }
        }

        const materialData = {
          name: formData.mat_name,
          work_category: formData.mat_work_category,
          size: sizeCombined,
          material_type: formData.mat_material_type,
          thickness: thicknessCombined,
          unit: formData.mat_unit,
          waste_percentage: formData.mat_waste_percentage,
          low_stock_threshold: '0'
        };
        const matRes = await api.post('materials/', materialData);
        materialIdToUse = matRes.data.id;
      }

      // Submit transaction
      const transactionData = {
        transaction_type: formData.transaction_type,
        material: materialIdToUse,
        quantity: formData.quantity,
        date: formData.date,
        bill_of_lading: formData.bill_of_lading,
        bill_of_lading_image: scannedInbound,
        contractor: formData.contractor,
        contract_number: formData.contract_number,
        contract_subject: formData.contract_subject,
        exit_document_image: scannedOutbound
      };

      await api.post('transactions/', transactionData);
      
      // Reset form but keep contractor details
      setFormData({
        ...formData,
        quantity: '',
        bill_of_lading: '',
        contract_number: '',
        contract_subject: '',
        material: '',
        mat_name: '',
        mat_work_category: '',
        mat_size: '',
        mat_material_type: '',
        mat_thickness: '',
        mat_waste_percentage: '0.00'
      });
      setMatSizeVal('');
      setMatSizeUnit('"');
      setMatThickVal('');
      setMatThickUnit('mm');
      setScannedInbound(null);
      setScannedOutbound(null);
      setOutForm({ name: null, material_type: null, size: null, thickness: null, unit: null });
      if (onSuccess) onSuccess();
      showToast('تراکنش با موفقیت ثبت شد', 'success');
    } catch (err) {
      showToast(err.response?.data ? JSON.stringify(err.response.data) : 'خطا در ثبت اطلاعات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isInbound = formData.transaction_type === 'IN';

  return (
    <div className="section-panel">
      {/* Form Header with Type Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div className="section-title" style={{ marginBottom: 0 }}>
          <div className="section-title-icon" style={{ 
            background: isInbound ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)' 
          }}>
            {isInbound ? Icons.arrowDown : Icons.arrowUp}
          </div>
          ثبت تراکنش جدید
        </div>
        {/* Transaction Type Toggle */}
        <div style={{ 
          display: 'flex', 
          background: 'var(--bg-surface-solid)',
          borderRadius: 'var(--radius-full)',
          padding: '3px',
          border: '1px solid var(--border-color)',
        }}>
          <button
            type="button"
            onClick={() => {
              setFormData({...formData, transaction_type: 'OUT', material: ''});
              setOutForm({ name: null, material_type: null, size: null, thickness: null, unit: null });
            }}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.25s',
              background: !isInbound ? 'var(--gradient-warm)' : 'transparent',
              color: !isInbound ? 'white' : 'var(--text-muted)',
              boxShadow: !isInbound ? '0 2px 8px rgba(245, 158, 11, 0.3)' : 'none',
            }}
          >
            خروج متریال
          </button>
          <button
            type="button"
            onClick={() => setFormData({...formData, transaction_type: 'IN', material: ''})}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.25s',
              background: isInbound ? 'var(--gradient-success)' : 'transparent',
              color: isInbound ? 'white' : 'var(--text-muted)',
              boxShadow: isInbound ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
            }}
          >
            ورود متریال
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2">

          {isInbound ? (
            <>
              {/* Order: 1-نوع متریال 2-جنس متریال 3-سایز 4-ضخامت 5-رسته کاری 6-واحد 7-درصد پرتی 8-شماره بارنامه 9-مقدار/تعداد 10-تاریخ */}
              <div className="form-group">
                <label className="form-label">نوع متریال <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="mat_name" className="form-control" placeholder="مثلا: لوله" value={formData.mat_name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">جنس متریال <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="mat_material_type" className="form-control" placeholder="مثلا: Carbon Steel" value={formData.mat_material_type} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">سایز <span style={{color: 'red'}}>*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="مقدار (مثلا: 10 یا 1/2)" 
                    className="form-control" 
                    value={matSizeVal} 
                    onChange={e => setMatSizeVal(e.target.value)} 
                    required 
                  />
                  <Select 
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    options={[
                      { value: '"', label: 'اینچ (")' },
                      { value: 'mm', label: 'میلی‌متر (mm)' },
                      { value: 'NONE', label: 'بدون واحد' }
                    ]}
                    value={{ value: matSizeUnit, label: matSizeUnit === '"' ? 'اینچ (")' : matSizeUnit === 'mm' ? 'میلی‌متر (mm)' : 'بدون واحد' }}
                    onChange={selected => setMatSizeUnit(selected.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">ضخامت <span style={{color: 'red'}}>*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="مقدار (مثلا: 40 یا 80 یا 6)" 
                    className="form-control" 
                    value={matThickVal} 
                    onChange={e => setMatThickVal(e.target.value)} 
                    required 
                  />
                  <Select 
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    options={[
                      { value: 'mm', label: 'میلی‌متر (mm)' },
                      { value: 'SCH', label: 'رده (SCH)' },
                      { value: 'BWG', label: 'گیج (BWG)' },
                      { value: '"', label: 'اینچ (")' },
                      { value: 'NONE', label: 'بدون واحد' }
                    ]}
                    value={{
                      value: matThickUnit,
                      label: matThickUnit === 'mm' ? 'میلی‌متر (mm)' : matThickUnit === 'SCH' ? 'رده (SCH)' : matThickUnit === 'BWG' ? 'گیج (BWG)' : matThickUnit === '"' ? 'اینچ (")' : 'بدون واحد'
                    }}
                    onChange={selected => setMatThickUnit(selected.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">رسته کاری <span style={{color: 'red'}}>*</span></label>
                <Select 
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                  placeholder="انتخاب رسته کاری..."
                  isClearable
                  options={categories.map(c => ({ value: c.id, label: c.name }))}
                  value={formData.mat_work_category ? { value: formData.mat_work_category, label: categories.find(c => c.id === parseInt(formData.mat_work_category))?.name } : null}
                  onChange={selected => setFormData({...formData, mat_work_category: selected ? selected.value : ''})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">واحد اندازه‌گیری <span style={{color: 'red'}}>*</span></label>
                <Select
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                  options={[
                    { value: 'KG', label: 'کیلوگرم (KG)' },
                    { value: 'M', label: 'متر (M)' },
                    { value: 'SQM', label: 'متر مربع (SQM)' },
                    { value: 'PCS', label: 'عدد (PCS)' }
                  ]}
                  value={{
                    value: formData.mat_unit,
                    label: formData.mat_unit === 'KG' ? 'کیلوگرم (KG)' : formData.mat_unit === 'M' ? 'متر (M)' : formData.mat_unit === 'SQM' ? 'متر مربع (SQM)' : 'عدد (PCS)'
                  }}
                  onChange={selected => setFormData({...formData, mat_unit: selected.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">درصد پرتی (%) <span style={{color: 'red'}}>*</span></label>
                <input type="number" step="0.01" name="mat_waste_percentage" className="form-control" value={formData.mat_waste_percentage} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">شماره بارنامه <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="bill_of_lading" className="form-control" value={formData.bill_of_lading} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">اسکن عکس بارنامه</label>
                <ScanButton
                  label="اسکن عکس بارنامه"
                  scannedImage={scannedInbound}
                  onScan={() => {
                    setScannerTitle('اسکن عکس بارنامه');
                    setScannerTarget('inbound');
                    setScannerOpen(true);
                  }}
                  onRemove={() => setScannedInbound(null)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">مقدار / تعداد <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="quantity" className="form-control" value={formatInputValue(formData.quantity)} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">تاریخ ثبت <span style={{color: 'red'}}>*</span></label>
                <JalaliDatePicker name="date" value={formData.date} onChange={handleChange} required />
              </div>
            </>
          ) : (
            <>
              {/* Outbound Fields */}
              <div className="form-group">
                <label className="form-label">تاریخ خروج</label>
                <JalaliDatePicker name="date" value={formData.date} onChange={handleChange} required />
              </div>
              
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">پیمانکار <span style={{color: 'red'}}>*</span></label>
                <Select 
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                  placeholder="انتخاب پیمانکار..."
                  isClearable
                  options={contractors.map(c => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))}
                  value={formData.contractor ? { value: formData.contractor, label: contractors.find(c => c.id === parseInt(formData.contractor))?.first_name + ' ' + contractors.find(c => c.id === parseInt(formData.contractor))?.last_name } : null}
                  onChange={selected => setFormData({...formData, contractor: selected ? selected.value : ''})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">شماره قرارداد <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="contract_number" className="form-control" value={formData.contract_number} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">موضوع قرارداد <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="contract_subject" className="form-control" value={formData.contract_subject} onChange={handleChange} required />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">اسکن برگه خروج</label>
                <ScanButton
                  label="اسکن برگه خروج"
                  scannedImage={scannedOutbound}
                  onScan={() => {
                    setScannerTitle('اسکن برگه خروج');
                    setScannerTarget('outbound');
                    setScannerOpen(true);
                  }}
                  onRemove={() => setScannedOutbound(null)}
                />
              </div>

              {/* OUTBOUND MATERIAL CASCADING DROPDOWNS */}
              <div className="form-group" style={{ gridColumn: 'span 2', marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1rem', paddingBottom: '0.5rem' }}>
                <label className="form-label" style={{ fontSize: '1rem', color: 'var(--primary-600)', marginBottom: 0 }}>مشخصات متریال خروجی</label>
              </div>

              <div className="form-group">
                <label className="form-label">نوع متریال <span style={{color: 'red'}}>*</span></label>
                <Select 
                  styles={selectStyles}
                  menuPortalTarget={document.body}
                  placeholder="-- انتخاب نوع --"
                  isClearable
                  options={availableNames.map(n => ({ value: n, label: n }))}
                  value={outForm.name ? { value: outForm.name, label: outForm.name } : null}
                  onChange={selected => setOutForm({name: selected ? selected.value : null, material_type: null, size: null, thickness: null})}
                />
              </div>

              {outForm.name !== null && (
                <div className="form-group">
                  <label className="form-label">جنس (Material Type) <span style={{color: 'red'}}>*</span></label>
                  <Select 
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder="-- انتخاب جنس --"
                    isClearable
                    options={availableTypes.map(t => ({ value: t || '', label: t || 'بدون مشخصه جنس' }))}
                    value={outForm.material_type !== null ? { value: outForm.material_type || '', label: outForm.material_type || 'بدون مشخصه جنس' } : null}
                    onChange={selected => setOutForm({...outForm, material_type: selected ? selected.value : null, size: null, thickness: null})}
                  />
                </div>
              )}

              {outForm.material_type !== null && (
                <div className="form-group">
                  <label className="form-label">سایز <span style={{color: 'red'}}>*</span></label>
                  <Select 
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder="-- انتخاب سایز --"
                    isClearable
                    options={availableSizes.map(s => ({ value: s || '', label: s || 'بدون سایز' }))}
                    value={outForm.size !== null ? { value: outForm.size || '', label: outForm.size || 'بدون سایز' } : null}
                    onChange={selected => setOutForm({...outForm, size: selected ? selected.value : null, thickness: null})}
                  />
                </div>
              )}

              {outForm.size !== null && (
                <div className="form-group">
                  <label className="form-label">ضخامت <span style={{color: 'red'}}>*</span></label>
                  <Select 
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder="-- انتخاب ضخامت --"
                    isClearable
                    options={availableThicknesses.map(t => ({ value: t || '', label: t || 'بدون ضخامت' }))}
                    value={outForm.thickness !== null ? { value: outForm.thickness || '', label: outForm.thickness || 'بدون ضخامت' } : null}
                    onChange={selected => setOutForm({...outForm, thickness: selected ? selected.value : null})}
                  />
                </div>
              )}

              {outForm.thickness !== null && (
                <div className="form-group">
                  <label className="form-label">واحد اندازه‌گیری <span style={{color: 'red'}}>*</span></label>
                  <Select 
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder="-- انتخاب واحد --"
                    isClearable
                    options={availableUnits.map(u => ({ value: u || '', label: u || 'بدون واحد' }))}
                    value={outForm.unit !== null ? { value: outForm.unit || '', label: outForm.unit || 'بدون واحد' } : null}
                    onChange={selected => setOutForm({...outForm, unit: selected ? selected.value : null})}
                  />
                </div>
              )}

              {outForm.unit !== null && (
                <div className="form-group">
                  <label className="form-label">مقدار / تعداد خروج <span style={{color: 'red'}}>*</span></label>
                  <input type="text" name="quantity" className="form-control" value={formatInputValue(formData.quantity)} onChange={handleChange} required />
                  {liveInventory !== null && formData.material && (
                    <div className="live-indicator live-success" style={{marginTop: '0.8rem'}}>
                      <span className="live-indicator-dot"></span>
                      موجودی فعلی انبار: {parseFloat(liveInventory).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

            </>
          )}

        </div>

        <div style={{ marginTop: '1rem' }}>
          <button 
            type="submit" 
            className={isInbound ? 'btn btn-accent' : 'btn btn-primary'} 
            disabled={loading} 
            style={{ width: '100%', padding: '0.9rem', fontSize: '1rem' }}
          >
            {loading ? 'در حال ثبت...' : (
              <>{Icons.plus} ثبت تراکنش</>
            )}
          </button>
        </div>
      </form>
      {/* Document Scanner Modal */}
      <DocumentScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        title={scannerTitle}
        onSave={(imageData) => {
          if (scannerTarget === 'inbound') {
            setScannedInbound(imageData);
          } else {
            setScannedOutbound(imageData);
          }
        }}
      />
    </div>
  );
};

export default TransactionForm;
