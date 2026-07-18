import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, ReferenceLine
} from 'recharts';
import './DashboardCharts.css';

/* ─── Constants & Helpers ─────────────────────────────────────────── */
const UNIT_LABELS = {
  KG: 'کیلوگرم',
  M: 'متر',
  SQM: 'متر مربع',
  PCS: 'عدد',
};

const PERIOD_OPTIONS = [
  { value: 'week', label: 'هفته اخیر' },
  { value: 'month', label: 'ماه اخیر' },
  { value: '3months', label: '۳ ماه اخیر' },
  { value: 'year', label: 'سال جاری' },
];

const CHART_COLORS = {
  inbound: '#60a5fa',   // Blue
  outbound: '#f59e0b',  // Amber
  approved: '#34d399',  // Green
  danger: '#ef4444',    // Red
  primary: '#818cf8',   // Indigo
};

const PIE_COLORS = [
  '#60a5fa', '#34d399', '#f59e0b', '#a78bfa', '#f472b6',
  '#38bdf8', '#4ade80', '#fbbf24', '#c084fc', '#fb7185',
  '#22d3ee', '#86efac', '#fcd34d', '#e879f9', '#fda4af',
];

const TABS = [
  { id: 'trends', label: 'روند زمانی', icon: '📈' },
  { id: 'contractors', label: 'عملکرد پیمانکاران', icon: '👷' },
  { id: 'materials', label: 'توزیع متریال', icon: '📊' },
  { id: 'inventory', label: 'موجودی انبار', icon: '📦' },
];

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

// تبدیل تمام اعداد به کاراکترهای فارسی به صورت ایمن
const toPersianDigits = (input) => {
  if (input == null) return '';
  const idMap = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/[0-9]/g, (w) => idMap[+w]);
};

// فرمت‌کننده هزارگان با تبدیل نهایی به حروف فارسی
const formatNum = (num) => {
  if (num === null || num === undefined || isNaN(num)) return toPersianDigits('0');
  const formatted = Number(num).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return toPersianDigits(formatted);
};

/* ─── Custom Tooltip ─────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label, names }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="charts-custom-tooltip">
      <div className="charts-tooltip-title">{toPersianDigits(label)}</div>
      {payload.map((entry, i) => (
        <div key={i} className="charts-tooltip-row">
          <span className="charts-tooltip-label">
            <span className="charts-tooltip-dot" style={{ background: entry.color }} />
            {names?.[entry.dataKey] || entry.dataKey}
          </span>
          <span className="charts-tooltip-value">{formatNum(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0];
  return (
    <div className="charts-custom-tooltip">
      <div className="charts-tooltip-title">{data.name}</div>
      <div className="charts-tooltip-row">
        <span className="charts-tooltip-label">
          <span className="charts-tooltip-dot" style={{ background: data.payload.fill }} />
          مقدار
        </span>
        <span className="charts-tooltip-value">
          {formatNum(data.value)} {UNIT_LABELS[data.payload.unit] || ''}
        </span>
      </div>
      {data.payload.percent !== undefined && (
        <div className="charts-tooltip-row">
          <span className="charts-tooltip-label">سهم</span>
          <span className="charts-tooltip-value">{toPersianDigits((data.payload.percent * 100).toFixed(1))}%</span>
        </div>
      )}
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────────────── */
const DashboardCharts = ({ contractors = [], materials = [] }) => {
  const [activeTab, setActiveTab] = useState('trends');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [contractorFilter, setContractorFilter] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const refreshTimerRef = useRef(null);

  // States for interactive features
  const [visibleSeries, setVisibleSeries] = useState({
    inbound: true,
    outbound: true,
    approved: true,
  });
  const [showAllContractors, setShowAllContractors] = useState(false);

  const fetchChartData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const params = { period };
      if (contractorFilter) params.contractor_id = contractorFilter;
      if (materialFilter) params.material_id = materialFilter;
      if (unitFilter) params.unit = unitFilter;

      const response = await api.get('dashboard/charts/', { params });
      setData(response.data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  }, [period, contractorFilter, materialFilter, unitFilter]);

  // Initial load and filter change
  useEffect(() => {
    fetchChartData(true);
  }, [fetchChartData]);

  // Auto-refresh
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      fetchChartData(false);
    }, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(refreshTimerRef.current);
  }, [fetchChartData]);

  /* ─── Tab: Time Trends ──────────────────────────────────────── */
  const renderTimeTrends = () => {
    if (!data?.time_trends?.labels?.length) {
      return <EmptyState message="داده‌ای برای نمایش روند زمانی یافت نشد." />;
    }

    const { labels, inbound, outbound, approved } = data.time_trends;
    const chartData = labels.map((label, i) => ({
      date: label,
      inbound: inbound[i] || 0,
      outbound: outbound[i] || 0,
      approved: approved[i] || 0,
    }));

    return (
      <div className="chart-card chart-card-full">
        <div className="chart-card-title">
          روند ورودی، خروجی و تاییدیه
          <span className="chart-badge">{toPersianDigits(labels.length)} روز</span>
        </div>
        <ResponsiveContainer width="100%" height={320} style={{ direction: 'ltr' }}>
          <ComposedChart data={chartData} margin={{ top: 15, right: 15, left: 20, bottom: 15 }}>
            <defs>
              <linearGradient id="gradInbound" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.inbound} stopOpacity={0.3} />
                <stop offset="100%" stopColor={CHART_COLORS.inbound} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradOutbound" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.outbound} stopOpacity={0.3} />
                <stop offset="100%" stopColor={CHART_COLORS.outbound} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.approved} stopOpacity={0.3} />
                <stop offset="100%" stopColor={CHART_COLORS.approved} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-dim)', fontSize: 10, angle: -45, textAnchor: 'end', dy: 10 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
              tickLine={false}
              tickFormatter={(t) => toPersianDigits(t)}
              interval="preserveStartEnd"
              height={60}
            />
            <YAxis
              tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatNum}
              width={80}
            />
            <Tooltip content={<CustomTooltip names={{ inbound: 'ورودی', outbound: 'خروجی', approved: 'تاییدیه' }} />} />
            {visibleSeries.inbound && (
              <Area type="monotone" dataKey="inbound" stroke={CHART_COLORS.inbound} fill="url(#gradInbound)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
            )}
            {visibleSeries.outbound && (
              <Area type="monotone" dataKey="outbound" stroke={CHART_COLORS.outbound} fill="url(#gradOutbound)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
            )}
            {visibleSeries.approved && (
              <Area type="monotone" dataKey="approved" stroke={CHART_COLORS.approved} fill="url(#gradApproved)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        <div className="charts-legend">
          <span
            className={`charts-legend-item interactive-legend ${visibleSeries.inbound ? '' : 'inactive'}`}
            onClick={() => setVisibleSeries(prev => ({ ...prev, inbound: !prev.inbound }))}
          >
            <span className="charts-legend-dot" style={{ background: CHART_COLORS.inbound }} />
            ورودی انبار
          </span>
          <span
            className={`charts-legend-item interactive-legend ${visibleSeries.outbound ? '' : 'inactive'}`}
            onClick={() => setVisibleSeries(prev => ({ ...prev, outbound: !prev.outbound }))}
          >
            <span className="charts-legend-dot" style={{ background: CHART_COLORS.outbound }} />
            خروجی انبار
          </span>
          <span
            className={`charts-legend-item interactive-legend ${visibleSeries.approved ? '' : 'inactive'}`}
            onClick={() => setVisibleSeries(prev => ({ ...prev, approved: !prev.approved }))}
          >
            <span className="charts-legend-dot" style={{ background: CHART_COLORS.approved }} />
            تاییدیه دفتر فنی
          </span>
        </div>
      </div>
    );
  };

  /* ─── Tab: Contractor Performance ───────────────────────────── */
  const renderContractorPerformance = () => {
    if (!data?.contractor_performance?.length) {
      return <EmptyState message="داده‌ای برای عملکرد پیمانکاران یافت نشد." />;
    }

    const maxLimit = showAllContractors ? 25 : 8;
    const barData = data.contractor_performance.slice(0, maxLimit);
    const { balance_status } = data;

    const statusPieData = [
      { name: 'بدهکار', value: balance_status?.debtor || 0, color: CHART_COLORS.danger },
      { name: 'بستانکار', value: balance_status?.creditor || 0, color: CHART_COLORS.outbound },
      { name: 'تسویه', value: balance_status?.cleared || 0, color: CHART_COLORS.approved },
      { name: 'در حال بررسی', value: balance_status?.under_review || 0, color: CHART_COLORS.inbound },
    ].filter(d => d.value > 0);

    return (
      <div className="charts-grid-2">
        {/* Bar Chart: Outbound vs Approved */}
        <div className="chart-card chart-card-full">
          <div className="chart-card-title-container">
            <div className="chart-card-title">مقایسه خروجی و تاییدیه پیمانکاران</div>
            {data.contractor_performance.length > 8 && (
              <button
                className="charts-show-more-btn"
                onClick={() => setShowAllContractors(prev => !prev)}
              >
                {showAllContractors ? 'مشاهده کمتر' : `مشاهده همه (${toPersianDigits(data.contractor_performance.length)})`}
              </button>
            )}
          </div>
          <ResponsiveContainer width="100%" height={Math.max(250, barData.length * 80)} style={{ direction: 'ltr' }}>
            <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 35, left: 15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatNum} />
              <YAxis dataKey="name" type="category" tick={{ fill: 'var(--text-main)', fontSize: 11 }} axisLine={false} tickLine={false} width={150} />
              <Tooltip content={<CustomTooltip names={{ outbound: 'خروجی', approved: 'تاییدیه' }} />} />
              <Bar dataKey="outbound" fill={CHART_COLORS.outbound} radius={[0, 4, 4, 0]} barSize={14} name="خروجی" />
              <Bar dataKey="approved" fill={CHART_COLORS.approved} radius={[0, 4, 4, 0]} barSize={14} name="تاییدیه" />
            </BarChart>
          </ResponsiveContainer>
          <div className="charts-legend">
            <span className="charts-legend-item">
              <span className="charts-legend-dot" style={{ background: CHART_COLORS.outbound }} />
              خروجی انبار
            </span>
            <span className="charts-legend-item">
              <span className="charts-legend-dot" style={{ background: CHART_COLORS.approved }} />
              تاییدیه دفتر فنی
            </span>
          </div>
        </div>

        {/* Balance Status Summary */}
        <div className="chart-card">
          <div className="chart-card-title">وضعیت کلی موازنه پیمانکاران</div>
          <div className="balance-status-grid">
            <div className="balance-status-card debtor">
              <div className="balance-status-count">{toPersianDigits(balance_status?.debtor || 0)}</div>
              <div className="balance-status-label">بدهکار</div>
            </div>
            <div className="balance-status-card creditor">
              <div className="balance-status-count">{toPersianDigits(balance_status?.creditor || 0)}</div>
              <div className="balance-status-label">بستانکار</div>
            </div>
            <div className="balance-status-card cleared">
              <div className="balance-status-count">{toPersianDigits(balance_status?.cleared || 0)}</div>
              <div className="balance-status-label">تسویه</div>
            </div>
            <div className="balance-status-card review">
              <div className="balance-status-count">{toPersianDigits(balance_status?.under_review || 0)}</div>
              <div className="balance-status-label">در حال بررسی</div>
            </div>
          </div>
        </div>

        {/* Pie Chart: Balance Distribution */}
        {statusPieData.length > 0 && (
          <div className="chart-card">
            <div className="chart-card-title">توزیع موازنه پیمانکاران</div>
            <ResponsiveContainer width="100%" height={240} style={{ direction: 'ltr' }}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {statusPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="charts-legend">
              {statusPieData.map((entry, i) => (
                <span key={i} className="charts-legend-item">
                  <span className="charts-legend-dot" style={{ background: entry.color }} />
                  {entry.name} ({toPersianDigits(entry.value)})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ─── Tab: Material Distribution ────────────────────────────── */
  const renderMaterialDistribution = () => {
    if (!data?.material_distribution?.length) {
      return <EmptyState message="داده‌ای برای توزیع متریال یافت نشد." />;
    }

    const pieData = data.material_distribution.slice(0, 12).map((item, i) => ({
      ...item,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));

    // Group remaining as "سایر"
    if (data.material_distribution.length > 12) {
      const otherTotal = data.material_distribution.slice(12).reduce((sum, m) => sum + m.value, 0);
      pieData.push({ name: 'سایر متریال‌ها', value: otherTotal, unit: '', fill: '#64748b' });
    }

    const total = pieData.reduce((s, d) => s + d.value, 0);
    const enrichedData = pieData.map(d => ({ ...d, percent: total > 0 ? d.value / total : 0 }));

    // Bar chart for top materials
    const barData = data.material_distribution.slice(0, 15);

    return (
      <div className="charts-grid-2">
        {/* Donut Chart */}
        <div className="chart-card">
          <div className="chart-card-title">
            سهم هر متریال از کل مصرف
            <span className="chart-badge">{toPersianDigits(data.material_distribution.length)} نوع</span>
          </div>
          <ResponsiveContainer width="100%" height={400} style={{ direction: 'ltr' }}>
            <PieChart>
              <Pie
                data={enrichedData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                strokeWidth={0}
              >
                {enrichedData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="charts-legend" style={{ maxHeight: '120px', overflowY: 'auto', flexWrap: 'wrap' }}>
            {enrichedData.map((entry, i) => (
              <span key={i} className="charts-legend-item">
                <span className="charts-legend-dot" style={{ background: entry.fill }} />
                {entry.name}
              </span>
            ))}
          </div>
        </div>

        {/* Horizontal Bar */}
        <div className="chart-card">
          <div className="chart-card-title">رتبه‌بندی مصرف متریال</div>
          <ResponsiveContainer width="100%" height={Math.max(300, barData.length * 48)} style={{ direction: 'ltr' }}>
            <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 25, left: 15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatNum} />
              <YAxis dataKey="name" type="category" tick={{ fill: 'var(--text-main)', fontSize: 12 }} axisLine={false} tickLine={false} width={200} />
              <Tooltip content={<CustomTooltip names={{ value: 'مقدار مصرف' }} />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  /* ─── Tab: Inventory Status ─────────────────────────────────── */
  const renderInventoryStatus = () => {
    if (!data?.inventory_status?.length) {
      return <EmptyState message="داده‌ای برای موجودی انبار یافت نشد." />;
    }

    const maxStock = Math.max(...data.inventory_status.map(m => m.current_stock), 1);

    // Separate critical and safe items
    const criticalItems = data.inventory_status.filter(m => m.is_critical);
    const safeItems = data.inventory_status.filter(m => !m.is_critical);

    const renderBarItem = (item) => {
      const pct = (item.current_stock / maxStock) * 100;
      const thresholdPct = item.threshold > 0 ? (item.threshold / maxStock) * 100 : 0;

      let fillClass = 'safe';
      if (item.is_critical) fillClass = 'critical';
      else if (item.threshold > 0 && item.current_stock < item.threshold * 1.5) fillClass = 'warning';

      return (
        <div key={item.id} className={`inventory-bar-item ${item.is_critical ? 'critical' : ''}`}>
          <span className="inventory-bar-name" title={item.name}>{item.name}</span>
          <div className="inventory-bar-track">
            <div className={`inventory-bar-fill ${fillClass}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            {thresholdPct > 0 && (
              <div className="inventory-bar-threshold" style={{ left: `${Math.min(thresholdPct, 100)}%` }} />
            )}
          </div>
          <div className="inventory-bar-values">
            <span className="inventory-bar-stock">{formatNum(item.current_stock)}</span>
            <span className="inventory-bar-unit">{UNIT_LABELS[item.unit] || item.unit}</span>
          </div>
        </div>
      );
    };

    return (
      <div>
        {criticalItems.length > 0 && (
          <div className="chart-card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(239, 108, 74, 0.2)' }}>
            <div className="chart-card-title" style={{ color: CHART_COLORS.danger }}>
              ⚠️ موجودی بحرانی (پایین‌تر از حد آستانه)
              <span className="chart-badge" style={{ color: CHART_COLORS.danger, background: 'rgba(239, 108, 74, 0.1)' }}>
                {toPersianDigits(criticalItems.length)} مورد
              </span>
            </div>
            <div className="inventory-bar-wrapper">
              {criticalItems.map(renderBarItem)}
            </div>
          </div>
        )}

        <div className="chart-card">
          <div className="chart-card-title">
            وضعیت موجودی انبار
            <span className="chart-badge">{toPersianDigits(safeItems.length)} متریال</span>
          </div>
          <div className="inventory-bar-wrapper">
            {safeItems.slice(0, 25).map(renderBarItem)}
          </div>
          <div className="charts-legend" style={{ marginTop: '1.5rem' }}>
            <span className="charts-legend-item">
              <span className="charts-legend-dot" style={{ background: CHART_COLORS.approved }} />
              موجودی کافی
            </span>
            <span className="charts-legend-item">
              <span className="charts-legend-dot" style={{ background: CHART_COLORS.outbound }} />
              نزدیک به آستانه
            </span>
            <span className="charts-legend-item">
              <span className="charts-legend-dot" style={{ background: CHART_COLORS.danger }} />
              بحرانی
            </span>
            <span className="charts-legend-item" style={{ gap: '0.2rem' }}>
              <span style={{ width: '2px', height: '12px', background: CHART_COLORS.danger, borderRadius: '1px' }} />
              آستانه هشدار
            </span>
          </div>
        </div>
      </div>
    );
  };

  /* ─── Empty State ───────────────────────────────────────────── */
  const EmptyState = ({ message }) => (
    <div className="charts-empty-state">
      <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
      <span>{message}</span>
    </div>
  );

  /* ─── Loading Skeleton ──────────────────────────────────────── */
  const renderSkeleton = () => (
    <div className="charts-skeleton-wrapper animate-pulse-skeleton">
      <div className="charts-skeleton-header">
        <div className="skeleton-bar skeleton-title" />
        <div className="skeleton-bar skeleton-badge" />
      </div>
      <div className="charts-skeleton-content">
        <div className="skeleton-chart-line" />
        <div className="skeleton-chart-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-chart-bar" style={{ height: `${20 + (i % 3) * 25}%` }} />
          ))}
        </div>
      </div>
      <div className="charts-skeleton-legend">
        <div className="skeleton-dot-label" />
        <div className="skeleton-dot-label" />
        <div className="skeleton-dot-label" />
      </div>
    </div>
  );

  /* ─── Render Active Tab ─────────────────────────────────────── */
  const renderActiveTab = () => {
    if (loading) {
      return renderSkeleton();
    }

    switch (activeTab) {
      case 'trends': return renderTimeTrends();
      case 'contractors': return renderContractorPerformance();
      case 'materials': return renderMaterialDistribution();
      case 'inventory': return renderInventoryStatus();
      default: return null;
    }
  };

  return (
    <div className="dashboard-charts-section">
      {/* Header */}
      <div className="charts-header">
        <div className="charts-header-right">
          <h3 className="charts-header-title">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            تحلیل بصری
          </h3>
        </div>
        {lastRefresh && (
          <div className="charts-refresh-indicator">
            <span className="charts-refresh-dot" />
            آخرین بروزرسانی: {toPersianDigits(lastRefresh.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="charts-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`charts-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setShowAllContractors(false); // Reset contractor collapse state
            }}
          >
            <span className="charts-tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="charts-filter-bar">
        <div className="charts-filter-group">
          <span className="charts-filter-label">بازه زمانی:</span>
          <div className="charts-period-buttons">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`charts-period-btn ${period === opt.value ? 'active' : ''}`}
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="charts-filter-divider" />

        {/* Contractor filter */}
        <div className="charts-filter-group">
          <span className="charts-filter-label">پیمانکار:</span>
          <select
            className="charts-filter-select"
            value={contractorFilter}
            onChange={e => setContractorFilter(e.target.value)}
          >
            <option value="">همه پیمانکاران</option>
            {contractors.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>
        </div>

        {/* Material filter dropdown (optimized and added) */}
        <div className="charts-filter-group">
          <span className="charts-filter-label">متریال:</span>
          <select
            className="charts-filter-select"
            value={materialFilter}
            onChange={e => setMaterialFilter(e.target.value)}
          >
            <option value="">همه متریال‌ها</option>
            {materials.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} {m.size ? `(${m.size})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Unit filter */}
        <div className="charts-filter-group">
          <span className="charts-filter-label">واحد:</span>
          <select
            className="charts-filter-select"
            value={unitFilter}
            onChange={e => setUnitFilter(e.target.value)}
          >
            <option value="">همه واحدها</option>
            {Object.entries(UNIT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart Body */}
      <div className="charts-body" key={activeTab}>
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default DashboardCharts;
