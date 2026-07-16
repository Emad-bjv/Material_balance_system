import React, { useState, useEffect, useRef } from 'react';
import { useDownloadManager } from '../contexts/DownloadContext';

const Icons = {
  download: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  close: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  ),
  pause: (
    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  ),
  play: (
    <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z"/>
    </svg>
  ),
  trash: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 9m-4.78 0L9 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  ),
  excel: (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#107c41' }}>
      <path d="M16.2 1.5H8.2A1.7 1.7 0 0 0 6.5 3.2v3.3h10v10h-10v3.3a1.7 1.7 0 0 0 1.7 1.7h8a1.7 1.7 0 0 0 1.7-1.7V3.2a1.7 1.7 0 0 0-1.7-1.7z M5 8h3v3H5zm0 5h3v3H5zm5-5h3v3h-3zm0 5h3v3h-3zm5-5h3v3h-3zm0 5h3v3h-3z"/>
    </svg>
  ),
  pdf: (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#e01e22' }}>
      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-9.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm4.5 6H10v1.5H8.5V11H14v4z"/>
    </svg>
  )
};

const DownloadManagerDropdown = () => {
  const {
    exportTasks,
    handlePauseTask,
    handleResumeTask,
    handleCancelTask,
    handleClearCompletedTask,
    activeCount
  } = useDownloadManager();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStatusLabel = (status) => {
    switch (status) {
      case 'QUEUED': return 'در صف انتظار...';
      case 'PENDING':
      case 'PROCESSING': return 'در حال دانلود...';
      case 'PAUSED': return 'متوقف شده';
      case 'CANCELLED': return 'لغو شده';
      case 'SUCCESS': return 'کامل شد';
      case 'FAILURE': return 'خطا در دانلود';
      default: return '';
    }
  };

  const getProgressBarClass = (status) => {
    switch (status) {
      case 'PAUSED': return 'progress-bar-paused';
      case 'CANCELLED': return 'progress-bar-cancelled';
      case 'FAILURE': return 'progress-bar-failed';
      case 'SUCCESS': return 'progress-bar-success';
      default: return 'progress-bar-active';
    }
  };

  const formatEta = (seconds) => {
    if (!seconds) return 'نامشخص';
    if (seconds < 60) return `${seconds} ثانیه`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} دقیقه و ${secs} ثانیه`;
  };

  return (
    <div className="download-dropdown-wrapper" ref={dropdownRef}>
      {/* Download Toggle Button */}
      <button 
        className={`download-trigger-btn ${isOpen ? 'active' : ''} ${activeCount > 0 ? 'pulse-glow' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="مدیریت دانلودها"
      >
        {Icons.download}
        {activeCount > 0 && (
          <span className="download-badge">{activeCount}</span>
        )}
      </button>

      {/* Popover list */}
      {isOpen && (
        <div className="download-popover animate-in">
          <div className="download-popover-header">
            <h4>لیست دانلودها</h4>
            {activeCount > 0 && (
              <span className="active-tasks-indicator">
                {activeCount} دانلود در حال اجرا
              </span>
            )}
          </div>

          <div className="download-popover-body">
            {exportTasks.length === 0 ? (
              <div className="download-empty-state">
                <div className="empty-icon">{Icons.download}</div>
                <p>هیچ دانلودی در تاریخچه وجود ندارد</p>
              </div>
            ) : (
              exportTasks.map(task => {
                const isGlobalReport = task.type === 'global_excel' || task.type === 'global_pdf';
                const fileIcon = task.type?.includes('pdf') ? Icons.pdf : Icons.excel;

                return (
                  <div key={task.id} className={`download-task-item ${task.status.toLowerCase()}`}>
                    <div className="task-item-top">
                      <span className="task-file-icon">{fileIcon}</span>
                      <div className="task-item-details">
                        <span className="task-item-name" title={task.name}>{task.name}</span>
                        <div className="task-item-meta">
                          <span className="task-item-status">
                            {(task.status === 'PROCESSING' || task.status === 'PENDING') && task.phase
                              ? task.phase
                              : getStatusLabel(task.status)}
                          </span>
                          {(task.status === 'PROCESSING' || task.status === 'PENDING') && task.eta > 0 && (
                            <span className="task-item-eta"> (زمان باقیمانده: {formatEta(task.eta)})</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="task-item-actions">
                        {/* Pause / Resume Controls (Only for heavy global tasks) */}
                        {isGlobalReport && (task.status === 'PENDING' || task.status === 'PROCESSING') && (
                          <button 
                            className="task-action-btn pause" 
                            onClick={() => handlePauseTask(task)} 
                            title="توقف موقت"
                          >
                            {Icons.pause}
                          </button>
                        )}
                        {isGlobalReport && task.status === 'PAUSED' && (
                          <button 
                            className="task-action-btn play" 
                            onClick={() => handleResumeTask(task)} 
                            title="ادامه دانلود"
                          >
                            {Icons.play}
                          </button>
                        )}

                        {/* Cancel task (for all queued/active/paused tasks) */}
                        {(task.status === 'PENDING' || task.status === 'PROCESSING' || task.status === 'QUEUED' || task.status === 'PAUSED') && (
                          <button 
                            className="task-action-btn cancel" 
                            onClick={() => handleCancelTask(task)} 
                            title="لغو دانلود"
                          >
                            {Icons.close}
                          </button>
                        )}

                        {/* Delete from list / Clear item (for success, failed, cancelled tasks) */}
                        {(task.status === 'SUCCESS' || task.status === 'FAILURE' || task.status === 'CANCELLED') && (
                          <button 
                            className="task-action-btn clear" 
                            onClick={() => handleClearCompletedTask(task.id)} 
                            title="پاک کردن از لیست"
                          >
                            {Icons.trash}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar Container */}
                    {task.status !== 'SUCCESS' && task.status !== 'FAILURE' && task.status !== 'CANCELLED' && (
                      <div className="task-progress-container">
                        <div className="task-progress-track">
                          <div 
                            className={`task-progress-fill ${getProgressBarClass(task.status)}`}
                            style={{ width: `${task.progress || 2}%` }}
                          />
                        </div>
                        <span className="task-progress-percent">{task.progress || 0}%</span>
                      </div>
                    )}

                    {/* Success download button if it failed auto-trigger */}
                    {task.status === 'SUCCESS' && task.file_url && (
                      <div className="task-item-success-row">
                        <a 
                          href={task.file_url} 
                          download 
                          className="btn btn-sm btn-ghost download-link"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                        >
                          {Icons.download}
                          دریافت مستقیم فایل
                        </a>
                      </div>
                    )}

                    {/* Error display */}
                    {task.status === 'FAILURE' && task.error_message && (
                      <span className="task-error-display">{task.error_message}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadManagerDropdown;
