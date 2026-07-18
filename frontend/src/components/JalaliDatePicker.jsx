import React, { useState, useEffect, useRef } from 'react';
import { g2j, j2g, jDaysInMonth } from '../utils/jalaali';

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const pad = (n) => n.toString().padStart(2, '0');

const JalaliDatePicker = ({ value, onChange, name, placeholder = 'انتخاب تاریخ...', required = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentJalali, setCurrentJalali] = useState({ jy: 1403, jm: 1, jd: 1 });
  const [displayValue, setDisplayValue] = useState('');
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (value) {
      const [gy, gm, gd] = value.split('-').map(Number);
      if (gy && gm && gd) {
        const j = g2j(gy, gm, gd);
        setCurrentJalali(j);
        setDisplayValue(`${j.jy}/${pad(j.jm)}/${pad(j.jd)}`);
      }
    } else {
      const today = new Date();
      const j = g2j(today.getFullYear(), today.getMonth() + 1, today.getDate());
      setCurrentJalali(j);
      setDisplayValue('');
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsMonthDropdownOpen(false);
        setIsYearDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectDate = (d) => {
    const g = j2g(currentJalali.jy, currentJalali.jm, d);
    const gDateString = `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
    if (onChange) {
      onChange({ target: { name, value: gDateString } });
    }
    setIsOpen(false);
    setIsMonthDropdownOpen(false);
    setIsYearDropdownOpen(false);
  };

  const handleMonthChange = (step) => {
    let { jy, jm } = currentJalali;
    jm += step;
    if (jm > 12) {
      jm = 1;
      jy++;
    } else if (jm < 1) {
      jm = 12;
      jy--;
    }
    setCurrentJalali({ ...currentJalali, jy, jm });
    setIsMonthDropdownOpen(false);
    setIsYearDropdownOpen(false);
  };

  const daysInMonth = jDaysInMonth(currentJalali.jy, currentJalali.jm);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getStartPadding = () => {
    try {
      const g = j2g(currentJalali.jy, currentJalali.jm, 1);
      const dateObj = new Date(g.gy, g.gm - 1, g.gd);
      // (JS Day [0: Sun, 1: Mon, ... 6: Sat] + 1) % 7 -> [0: Sat, 1: Sun, ... 6: Fri]
      return (dateObj.getDay() + 1) % 7;
    } catch (e) {
      return 0;
    }
  };

  const paddingSize = getStartPadding();
  const paddingArray = Array.from({ length: paddingSize }, (_, i) => i);
  
  // بازه سال از ۱۴۰۵ تا ۱۰ سال آینده (یا کمتر در صورتی که تاریخ انتخابی قدیمی باشد)
  const minStartYear = 1405;
  const maxEndYear = 1415;
  const startYear = Math.min(minStartYear, currentJalali.jy);
  const endYear = Math.max(maxEndYear, currentJalali.jy);
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        className="form-control"
        readOnly
        value={displayValue}
        placeholder={placeholder}
        onClick={() => setIsOpen(true)}
        required={required}
        style={{ cursor: 'pointer', direction: 'ltr', textAlign: 'right' }}
      />
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 'auto', left: 0, marginTop: '5px',
          width: '290px', backgroundColor: 'var(--bg-surface-solid)',
          border: '1px solid var(--border-color)', borderRadius: '8px',
          boxShadow: 'var(--shadow-lg)', zIndex: 9999, padding: '1rem'
        }}>
          {/* Header with Navigation & Select Dropdowns */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '8px' }}>
            <button 
              type="button" 
              onClick={() => handleMonthChange(-1)} 
              style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-main)', padding: '0 4px' }}
            >
              ▶
            </button>
            
            <div style={{ display: 'flex', gap: '6px', flexGrow: 1, justifyContent: 'center' }}>
              {/* Select Month */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsMonthDropdownOpen(!isMonthDropdownOpen);
                    setIsYearDropdownOpen(false);
                  }}
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'Vazirmatn, sans-serif',
                    outline: 'none'
                  }}
                >
                  {MONTHS[currentJalali.jm - 1]}
                  <span style={{ fontSize: '0.55rem', opacity: 0.7 }}>▼</span>
                </button>
                {isMonthDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    width: '120px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    backgroundColor: 'var(--bg-surface-solid)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 10000,
                    padding: '4px 0'
                  }} className="custom-scroll">
                    {MONTHS.map((m, index) => (
                      <div
                        key={m}
                        onClick={() => {
                          setCurrentJalali({ ...currentJalali, jm: index + 1 });
                          setIsMonthDropdownOpen(false);
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          textAlign: 'right',
                          backgroundColor: currentJalali.jm === index + 1 ? 'rgba(43, 168, 162, 0.15)' : 'transparent',
                          color: currentJalali.jm === index + 1 ? 'var(--primary-500)' : 'var(--text-main)',
                          fontWeight: currentJalali.jm === index + 1 ? 'bold' : 'normal',
                          transition: 'background var(--duration-fast)'
                        }}
                        className="dropdown-item-hover"
                      >
                        {m}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Select Year */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsYearDropdownOpen(!isYearDropdownOpen);
                    setIsMonthDropdownOpen(false);
                  }}
                  style={{
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'Vazirmatn, sans-serif',
                    outline: 'none'
                  }}
                >
                  {currentJalali.jy}
                  <span style={{ fontSize: '0.55rem', opacity: 0.7 }}>▼</span>
                </button>
                {isYearDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    width: '100px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    backgroundColor: 'var(--bg-surface-solid)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 10000,
                    padding: '4px 0'
                  }} className="custom-scroll">
                    {years.map(year => (
                      <div
                        key={year}
                        onClick={() => {
                          setCurrentJalali({ ...currentJalali, jy: year });
                          setIsYearDropdownOpen(false);
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          textAlign: 'center',
                          backgroundColor: currentJalali.jy === year ? 'rgba(43, 168, 162, 0.15)' : 'transparent',
                          color: currentJalali.jy === year ? 'var(--primary-500)' : 'var(--text-main)',
                          fontWeight: currentJalali.jy === year ? 'bold' : 'normal',
                          transition: 'background var(--duration-fast)'
                        }}
                        className="dropdown-item-hover"
                      >
                        {year}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button 
              type="button" 
              onClick={() => handleMonthChange(1)} 
              style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-main)', padding: '0 4px' }}
            >
              ◀
            </button>
          </div>

          {/* Weekdays Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', textAlign: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>
            {WEEKDAYS.map(w => (
              <div key={w} style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', textAlign: 'center' }}>
            {paddingArray.map(p => (
              <div key={`pad-${p}`} />
            ))}
            {daysArray.map(d => {
              const isSelected = currentJalali.jd === d && displayValue;
              return (
                <div 
                  key={d} 
                  onClick={() => handleSelectDate(d)}
                  style={{ 
                    padding: '5px', borderRadius: '4px', cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(14, 165, 233, 0.15)';
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {d}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default JalaliDatePicker;
