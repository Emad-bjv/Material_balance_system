import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useToast } from './ToastContext';

const DownloadContext = createContext(null);

export const DownloadProvider = ({ children }) => {
  const { showToast } = useToast();
  const [exportTasks, setExportTasks] = useState(() => {
    try {
      const saved = localStorage.getItem('download-manager-tasks');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const exportTasksRef = useRef([]);
  const socketsRef = useRef({});
  useEffect(() => {
    exportTasksRef.current = exportTasks;
    localStorage.setItem('download-manager-tasks', JSON.stringify(exportTasks));
  }, [exportTasks]);

  // Fetch active tasks from backend on mount and merge them
  useEffect(() => {
    const fetchActiveTasks = async () => {
      try {
        const response = await api.get('balance/active-tasks/');
        const activeTasks = response.data; // List of active tasks from Celery
        
        setExportTasks(prev => {
          // Keep completed/failed tasks from local storage
          const nonActiveLocal = prev.filter(t => t.status !== 'PENDING' && t.status !== 'PROCESSING' && t.status !== 'QUEUED');
          
          // Map backend active tasks
          const activeMapped = activeTasks.map(at => {
            const localMatch = prev.find(lt => lt.id === at.task_id);
            let name = localMatch ? localMatch.name : 'گزارش خروجی';
            
            // Try to extract name from backend task description / error_message JSON
            if (at.error_message) {
              try {
                const meta = JSON.parse(at.error_message);
                if (meta.name) name = meta.name;
              } catch (e) {
                // Not JSON
              }
            }
            
            return {
              id: at.task_id,
              status: at.status,
              progress: at.progress || 0,
              eta: at.eta || 0,
              type: at.type,
              file_url: at.file_url,
              error_message: at.error_message,
              name: name,
              created_at: at.created_at || new Date().toISOString()
            };
          });

          // Merge them
          const queuedLocal = prev.filter(t => t.status === 'QUEUED');
          
          return [...activeMapped, ...queuedLocal, ...nonActiveLocal];
        });
      } catch (e) {
        console.error('Error fetching active tasks', e);
      }
    };

    fetchActiveTasks();
  }, []);

  const reconnectAttemptsRef = useRef({});
  const pollingIntervalsRef = useRef({});

  const startHttpPolling = (taskId) => {
    if (pollingIntervalsRef.current[taskId]) return;
    pollingIntervalsRef.current[taskId] = setInterval(async () => {
      try {
        const res = await api.get(`balance/export-status/${taskId}/`);
        const data = res.data;
        setExportTasks(prev => {
          const idx = prev.findIndex(t => t.id === taskId);
          if (idx === -1) return prev;
          const currentItem = prev[idx];
          if (data.status === 'SUCCESS' && currentItem.status !== 'SUCCESS' && !currentItem.downloaded) {
            const link = document.createElement('a');
            link.href = data.file_url;
            link.setAttribute('download', '');
            document.body.appendChild(link);
            link.click();
            link.remove();
            showToast(`${currentItem.name} با موفقیت دانلود شد.`, 'success');
            clearInterval(pollingIntervalsRef.current[taskId]);
            delete pollingIntervalsRef.current[taskId];
            const updated = [...prev];
            updated[idx] = { ...currentItem, status: 'SUCCESS', progress: 100, file_url: data.file_url, downloaded: true };
            return updated;
          }
          if (data.status === 'FAILURE' && currentItem.status !== 'FAILURE') {
            clearInterval(pollingIntervalsRef.current[taskId]);
            delete pollingIntervalsRef.current[taskId];
            const updated = [...prev];
            updated[idx] = { ...currentItem, status: 'FAILURE', progress: 0, error_message: data.error_message };
            return updated;
          }
          const updated = [...prev];
          updated[idx] = { ...currentItem, status: data.status, progress: data.progress || currentItem.progress, eta: data.eta, phase: data.phase };
          return updated;
        });
      } catch (e) { /* silent */ }
    }, 3000);
  };

  // WebSocket logic for running tasks
  useEffect(() => {
    const runningTasks = exportTasks.filter(t => t.status === 'PENDING' || t.status === 'PROCESSING');
    
    const runningTaskIds = new Set(runningTasks.map(t => t.id));
    Object.keys(socketsRef.current).forEach(id => {
      if (!runningTaskIds.has(id)) {
        socketsRef.current[id].close();
        delete socketsRef.current[id];
        delete reconnectAttemptsRef.current[id];
        if (pollingIntervalsRef.current[id]) {
          clearInterval(pollingIntervalsRef.current[id]);
          delete pollingIntervalsRef.current[id];
        }
      }
    });

    if (runningTasks.length === 0) return;

    const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api/`;
    const wsBaseUrl = API_BASE.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api/', '/ws/');

    const connectWs = (task) => {
      if (socketsRef.current[task.id]) return;

      const token = localStorage.getItem('access_token');
      const wsUrl = `${wsBaseUrl}tasks/${task.id}/?token=${token || ''}`;
      const socket = new WebSocket(wsUrl);
      socketsRef.current[task.id] = socket;

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          reconnectAttemptsRef.current[task.id] = 0;
          setExportTasks(prev => {
            const idx = prev.findIndex(t => t.id === task.id);
            if (idx === -1) return prev;
            
            const currentItem = prev[idx];
            let newStatus = data.status || currentItem.status;
            let newProgress = data.progress !== undefined ? data.progress : currentItem.progress;
            let fileUrl = data.file_url || currentItem.file_url;
            let errorMsg = data.error_message || currentItem.error_message;
            let eta = data.eta !== undefined ? data.eta : currentItem.eta;
            let phase = data.phase || currentItem.phase;

            if (data.status === 'SUCCESS' && currentItem.status !== 'SUCCESS' && !currentItem.downloaded) {
              const link = document.createElement('a');
              link.href = fileUrl;
              link.setAttribute('download', '');
              document.body.appendChild(link);
              link.click();
              link.remove();
              showToast(`${currentItem.name} با موفقیت دانلود شد.`, 'success');
              const updated = [...prev];
              updated[idx] = { ...currentItem, status: 'SUCCESS', progress: 100, file_url: fileUrl, downloaded: true, phase: 'تکمیل شد' };
              return updated;
            } else if (data.status === 'FAILURE' && currentItem.status !== 'FAILURE') {
              showToast(`خطا در تولید فایل ${currentItem.name}: ${errorMsg}`, 'error');
              const updated = [...prev];
              updated[idx] = { ...currentItem, status: 'FAILURE', progress: 0, error_message: errorMsg };
              return updated;
            }

            const updated = [...prev];
            updated[idx] = { ...currentItem, status: newStatus, progress: newProgress, file_url: fileUrl, error_message: errorMsg, eta, phase };
            return updated;
          });
        } catch (err) {
          console.error("Error parsing websocket message", err);
        }
      };

      socket.onclose = () => {
        delete socketsRef.current[task.id];
        const attempts = (reconnectAttemptsRef.current[task.id] || 0) + 1;
        reconnectAttemptsRef.current[task.id] = attempts;
        
        const currentTask = exportTasksRef.current.find(t => t.id === task.id);
        if (!currentTask || currentTask.status === 'SUCCESS' || currentTask.status === 'FAILURE' || currentTask.status === 'CANCELLED') return;

        if (attempts <= 5) {
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 8000);
          setTimeout(() => connectWs(task), delay);
        } else {
          startHttpPolling(task.id);
        }
      };

      socket.onerror = () => {};
    };

    runningTasks.forEach(task => connectWs(task));
  }, [exportTasks]);

  // Clean up all connections on unmount
  useEffect(() => {
    return () => {
      Object.values(socketsRef.current).forEach(s => s.close());
      Object.values(pollingIntervalsRef.current).forEach(id => clearInterval(id));
    };
  }, []);

  // Queue scheduler logic
  useEffect(() => {
    const queuedTasks = exportTasks.filter(t => t.status === 'QUEUED');
    const runningTasks = exportTasks.filter(t => t.status === 'PENDING' || t.status === 'PROCESSING');
    
    if (runningTasks.length === 0 && queuedTasks.length > 0) {
      const nextTask = queuedTasks[0];
      startQueuedTask(nextTask);
    }
  }, [exportTasks]);

  const startQueuedTask = async (task) => {
    // Mark as PENDING locally first
    setExportTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'PENDING' } : t));
    
    try {
      let endpoint = '';
      const params = new URLSearchParams();
      
      if (task.options) {
        Object.entries(task.options).forEach(([k, v]) => {
          if (v !== null && v !== undefined && v !== '') {
            params.append(k, v);
          }
        });
      }

      if (task.type === 'global_excel') {
        endpoint = 'balance/download-global/';
      } else if (task.type === 'global_pdf') {
        endpoint = 'balance/download-global-pdf/';
      } else if (task.type === 'balance_excel') {
        endpoint = 'balance/download/';
      } else if (task.type === 'balance_pdf') {
        endpoint = 'balance/download-pdf/';
      } else if (task.type === 'warehouse_excel') {
        endpoint = 'balance/download-warehouse/';
      } else if (task.type === 'contractors_excel') {
        endpoint = 'balance/download-contractors/';
      } else if (task.type === 'approvals_excel') {
        endpoint = 'balance/download-approvals/';
      } else if (task.type === 'global_csv') {
        endpoint = 'balance/download-global-csv/';
      }

      const isAsync = task.type === 'global_excel' || task.type === 'global_pdf';

      if (isAsync) {
        const response = await api.get(`${endpoint}?${params.toString()}`);
        const data = response.data;
        
        setExportTasks(prev => prev.map(t => t.id === task.id ? {
          ...t,
          id: data.task_id,
          status: data.status,
          progress: data.progress || 0,
          eta: data.eta || 0
        } : t));
      } else {
        // For synchronous tasks, download as blob
        const response = await api.get(`${endpoint}?${params.toString()}`, { responseType: 'blob' });
        
        // Trigger browser download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        
        let filename = 'report';
        if (task.type === 'balance_excel') filename = 'balance_report.xlsx';
        else if (task.type === 'balance_pdf') filename = 'balance_report.pdf';
        else if (task.type === 'warehouse_excel') filename = 'warehouse_inventory.xlsx';
        else if (task.type === 'contractors_excel') filename = 'contractors_list.xlsx';
        else if (task.type === 'approvals_excel') filename = 'approvals_list.xlsx';
        else if (task.type === 'global_csv') filename = 'global_material_balance.csv';
        
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        showToast(`${task.name} با موفقیت دانلود شد.`, 'success');

        setExportTasks(prev => prev.map(t => t.id === task.id ? {
          ...t,
          status: 'SUCCESS',
          progress: 100,
          downloaded: true
        } : t));
      }
    } catch (err) {
      console.error('Error starting queued task', err);
      setExportTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        status: 'FAILURE',
        error_message: 'خطا در شروع دانلود'
      } : t));
    }
  };

  const getReportDisplayName = (type, options) => {
    if (type === 'global_excel') return 'گزارش موازنه کل (اکسل)';
    if (type === 'global_pdf') return 'گزارش موازنه کل (PDF)';
    if (type === 'warehouse_excel') return 'خروجی اکسل موجودی انبار';
    if (type === 'contractors_excel') return 'خروجی اکسل لیست پیمانکاران';
    if (type === 'approvals_excel') return 'خروجی اکسل لیست تاییدیه‌ها';
    if (type === 'global_csv') return 'خروجی CSV موازنه کل';
    if (type === 'balance_excel') return 'گزارش موازنه (اکسل)';
    if (type === 'balance_pdf') return 'گزارش موازنه (PDF)';
    return 'گزارش خروجی';
  };

  const triggerExport = (type, options = {}, customName = null) => {
    const newTask = {
      id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      status: 'QUEUED',
      type: type,
      progress: 0,
      eta: 0,
      name: customName || getReportDisplayName(type, options),
      options: options,
      created_at: new Date().toISOString()
    };
    setExportTasks(prev => [newTask, ...prev]);
  };

  const handlePauseTask = async (task) => {
    try {
      await api.post(`balance/export-status/${task.id}/cancel/`);
      setExportTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'PAUSED' } : t));
      showToast('دانلود متوقف شد.', 'info');
    } catch (err) {
      console.error('Error pausing task', err);
      showToast('خطا در توقف دانلود', 'error');
    }
  };

  const handleResumeTask = async (task) => {
    setExportTasks(prev => prev.filter(t => t.id !== task.id));
    const options = { ...task.options, resume_from: task.id };
    triggerExport(task.type, options, task.name);
  };

  const handleCancelTask = async (task) => {
    try {
      if (!task.id.startsWith('local_')) {
        await api.post(`balance/export-status/${task.id}/cancel/`);
      }
      setExportTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'CANCELLED', progress: 0, eta: 0 } : t));
      showToast('دانلود لغو شد.', 'info');
    } catch (err) {
      console.error('Error cancelling task', err);
      showToast('خطا در لغو دانلود', 'error');
    }
  };

  const handleClearCompletedTask = (taskId) => {
    setExportTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const activeCount = exportTasks.filter(t => t.status === 'PENDING' || t.status === 'PROCESSING').length;

  return (
    <DownloadContext.Provider value={{
      exportTasks,
      triggerExport,
      handlePauseTask,
      handleResumeTask,
      handleCancelTask,
      handleClearCompletedTask,
      activeCount
    }}>
      {children}
    </DownloadContext.Provider>
  );
};

export const useDownloadManager = () => {
  const context = useContext(DownloadContext);
  if (!context) throw new Error("useDownloadManager must be used within DownloadProvider");
  return context;
};
