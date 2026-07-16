import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const BalanceModal = ({ isOpen, onClose, contractorsSummary }) => {
  const [detailsData, setDetailsData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [selectedMaterialGroup, setSelectedMaterialGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && !detailsData) {
      const fetchDetails = async () => {
        setLoading(true);
        try {
          // This endpoint now contains total_delivered, total_approved, and waste_percentage
          const response = await api.get('balance/contractor-approvals/');
          setDetailsData(response.data);
        } catch (error) {
          console.error("Error fetching balance details", error);
        } finally {
          setLoading(false);
        }
      };
      fetchDetails();
    }
  }, [isOpen, detailsData]);

  if (!isOpen) return null;

  // Level 1: Contractors Summary (from props)
  const getFilteredContractors = () => {
    if (!contractorsSummary) return [];
    return contractorsSummary.filter(c => 
      c.contractor_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Level 2: Materials for a specific contractor
  const getContractorMaterials = () => {
    if (!detailsData || !selectedContractor) return [];
    
    // Filter data for the selected contractor
    const contractorRows = detailsData.filter(row => row.contractor_id === selectedContractor.contractor_id);
    
    // Group by material_name
    const grouped = {};
    contractorRows.forEach(row => {
      const name = row.material_name;
      if (!grouped[name]) {
        grouped[name] = {
          name,
          total_delivered: 0,
          total_approved: 0,
          allowed_waste: 0,
          units: new Set(),
        };
      }
      grouped[name].total_delivered += row.total_delivered || 0;
      grouped[name].total_approved += row.total_approved || 0;
      
      const allowedWaste = (row.total_approved || 0) * ((row.waste_percentage || 0) / 100);
      grouped[name].allowed_waste += allowedWaste;
      grouped[name].units.add(row.unit);
    });

    return Object.values(grouped).map(g => ({
      ...g,
      balance: g.total_delivered - (g.total_approved + g.allowed_waste),
      unit_str: Array.from(g.units).join('، '),
    })).filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  // Level 3: Specific Material specs
  const getMaterialSpecs = () => {
    if (!detailsData || !selectedContractor || !selectedMaterialGroup) return [];
    
    return detailsData.filter(row => 
      row.contractor_id === selectedContractor.contractor_id && 
      row.material_name === selectedMaterialGroup.name
    ).map(row => {
      const allowedWaste = (row.total_approved || 0) * ((row.waste_percentage || 0) / 100);
      return {
        ...row,
        allowed_waste: allowedWaste,
        balance: (row.total_delivered || 0) - ((row.total_approved || 0) + allowedWaste),
      };
    });
  };

  const handleClose = () => {
    setSelectedContractor(null);
    setSelectedMaterialGroup(null);
    setSearchQuery('');
    onClose();
  };

  const renderBalanceBadge = (value, unit) => {
    const isPositive = value > 0;
    const isNegative = value < 0;
    let badgeClass = "zero";
    let icon = "✔";
    if (isPositive) {
      badgeClass = "positive";
      icon = "⚠ بدهکار";
    } else if (isNegative) {
      badgeClass = "negative";
      icon = "★ طلبکار";
    } else {
      badgeClass = "zero";
      icon = "✔ تسویه";
    }

    return (
      <div className={`balance-badge ${badgeClass}`}>
        <span dir="ltr">{Number(value).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 1})}</span>
        <span>{unit}</span>
        <span style={{ fontSize: '0.72rem', opacity: 0.85, marginRight: '4px' }}>({icon})</span>
      </div>
    );
  };

  return (
    <div className="luxury-modal-overlay" onClick={handleClose}>
      <div className="luxury-modal-container animate-in" onClick={e => e.stopPropagation()}>
        <div className="luxury-modal-header">
          <h3>جزئیات موازنه متریال</h3>
          <button className="luxury-close-btn" onClick={handleClose}>✕</button>
        </div>

        {/* Breadcrumbs Navigation */}
        {(selectedContractor || selectedMaterialGroup) && (
          <div className="luxury-breadcrumb">
            <span 
              className="luxury-breadcrumb-item" 
              onClick={() => {
                setSelectedContractor(null);
                setSelectedMaterialGroup(null);
                setSearchQuery('');
              }}
            >
              لیست پیمانکاران
            </span>
            {selectedContractor && (
              <>
                <span className="luxury-breadcrumb-separator">←</span>
                <span 
                  className={`luxury-breadcrumb-item ${!selectedMaterialGroup ? 'active' : ''}`}
                  onClick={() => {
                    if (selectedMaterialGroup) {
                      setSelectedMaterialGroup(null);
                      setSearchQuery('');
                    }
                  }}
                >
                  {selectedContractor.contractor_name}
                </span>
              </>
            )}
            {selectedMaterialGroup && (
              <>
                <span className="luxury-breadcrumb-separator">←</span>
                <span className="luxury-breadcrumb-item active">
                  {selectedMaterialGroup.name}
                </span>
              </>
            )}
          </div>
        )}

        {/* Search Wrapper: Level 1 and Level 2 */}
        {!selectedMaterialGroup && (
          <div className="luxury-search-wrapper">
            <input
              type="text"
              className="luxury-search-input"
              placeholder={!selectedContractor ? "جستجوی پیمانکار..." : "جستجوی متریال..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <span className="luxury-search-icon">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
        )}

        <div className="luxury-modal-body">
          {/* Back Button */}
          {(selectedContractor || selectedMaterialGroup) && (
            <button 
              className="luxury-back-btn" 
              onClick={() => {
                if (selectedMaterialGroup) {
                  setSelectedMaterialGroup(null);
                } else if (selectedContractor) {
                  setSelectedContractor(null);
                }
                setSearchQuery('');
              }}
            >
              <span className="luxury-back-icon">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
              {selectedMaterialGroup ? "بازگشت به لیست متریال‌ها" : "بازگشت به لیست پیمانکاران"}
            </button>
          )}

          {/* Level 1: Contractors List */}
          {!selectedContractor && (
            <div className="luxury-view-slide-in">
              {getFilteredContractors().length === 0 ? (
                <div className="luxury-empty-state">پیمانکاری یافت نشد.</div>
              ) : (
                getFilteredContractors().map((item, index) => (
                  <div 
                    key={index} 
                    className="luxury-material-row interactive"
                    onClick={() => {
                      setSelectedContractor(item);
                      setSearchQuery('');
                    }}
                  >
                    <div className="material-primary-info">
                      <div className="material-title-area">
                        <div className="material-icon blue-icon">
                          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div className="material-name-desc">
                          <h4>{item.contractor_name}</h4>
                          <span className="material-desc">موازنه کلی</span>
                        </div>
                      </div>
                    </div>
                    <div className="material-secondary-info" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      {Object.keys(item.balances || {}).length === 0 ? (
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>بدون داده</div>
                      ) : (
                        Object.entries(item.balances).map(([unit, val]) => (
                          <div key={unit}>
                            {renderBalanceBadge(val, unit)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Level 2: Materials Grouped */}
          {selectedContractor && !selectedMaterialGroup && (
            <div className="luxury-view-slide-in">
              {loading ? (
                <div className="luxury-loading-state">
                  <div className="luxury-spinner"></div>
                  <span>در حال محاسبه موازنه متریال...</span>
                </div>
              ) : getContractorMaterials().length === 0 ? (
                <div className="luxury-empty-state">داده‌ای برای این پیمانکار وجود ندارد.</div>
              ) : (
                getContractorMaterials().map((item, index) => (
                  <div 
                    key={index} 
                    className="luxury-material-row interactive"
                    onClick={() => {
                      setSelectedMaterialGroup(item);
                      setSearchQuery('');
                    }}
                  >
                    <div className="material-primary-info">
                      <div className="material-title-area">
                        <div className="material-icon purple-icon">
                          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <div className="material-name-desc">
                          <h4>{item.name}</h4>
                          <span className="material-desc">کلیک برای مشاهده سایز و ضخامت</span>
                        </div>
                      </div>
                    </div>
                    <div className="material-secondary-info">
                      <div className="stat-pill-group">
                        <div className="stat-pill out">
                          <span className="stat-label">تحویلی</span>
                          <span className="stat-value">{Number(item.total_delivered).toLocaleString('en-US', {maximumFractionDigits:0})} {item.unit_str}</span>
                        </div>
                        <div className="stat-pill appr">
                          <span className="stat-label">تاییدی</span>
                          <span className="stat-value">{Number(item.total_approved).toLocaleString('en-US', {maximumFractionDigits:0})} {item.unit_str}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>موازنه</span>
                        {renderBalanceBadge(item.balance, item.unit_str)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Level 3: Material Specs */}
          {selectedMaterialGroup && (
            <div className="luxury-view-slide-in">
              {getMaterialSpecs().map((item, index) => (
                <div key={index} className="luxury-material-row no-hover">
                  <div className="material-primary-info">
                    <div className="material-title-area">
                      <div className="material-icon green-icon">
                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div className="material-name-desc">
                        <h4>{item.material_name}</h4>
                        <div className="material-tags">
                          {item.size && <span className="m-tag">سایز: {item.size}</span>}
                          {item.thickness && <span className="m-tag">ضخامت: {item.thickness}</span>}
                          {item.material_type && <span className="m-tag">جنس: {item.material_type}</span>}
                          <span className="m-tag">پرت مجاز: %{item.waste_percentage || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="material-secondary-info">
                    <div className="stat-pill-group">
                      <div className="stat-pill out">
                        <span className="stat-label">تحویلی</span>
                        <span className="stat-value">{Number(item.total_delivered).toLocaleString('en-US', {maximumFractionDigits:0})} {item.unit}</span>
                      </div>
                      <div className="stat-pill appr">
                        <span className="stat-label">تاییدی</span>
                        <span className="stat-value">{Number(item.total_approved).toLocaleString('en-US', {maximumFractionDigits:0})} {item.unit}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>موازنه دقیق</span>
                      {renderBalanceBadge(item.balance, item.unit)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BalanceModal;
