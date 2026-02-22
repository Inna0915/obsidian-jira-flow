import React, { useEffect, useState, useCallback } from 'react';
import { TFile, Notice } from 'obsidian';
import type JiraFlowPlugin from '../main';
import type { TaskFrontmatter } from '../types';

interface SidebarTask {
  key: string;
  summary: string;
  dueDate: string;
  status: string;
  priority: string;
  issuetype: string;
  filePath: string;
  sprint_state: string;
}

export const SidebarPanel = ({ plugin }: { plugin: JiraFlowPlugin }) => {
  const [tasks, setTasks] = useState<SidebarTask[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Pomodoro Timer State ---
  const [defaultMinutes, setDefaultMinutes] = useState(35);
  const [activeTask, setActiveTask] = useState<SidebarTask | null>(null);
  const [timeLeft, setTimeLeft] = useState(35 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // Track actual time spent

  const loadTasks = useCallback(async () => {
    const files = plugin.fileManager.getAllTaskFiles();
    const loadedTasks: SidebarTask[] = [];

    for (const file of files) {
      const fm = plugin.fileManager.getTaskFrontmatter(file);
      if (!fm) continue;
      
      // Skip archived tasks
      if (fm.archived) continue;
      
      // Skip tasks without due date
      if (!fm.due_date) continue;

      loadedTasks.push({
        key: fm.jira_key,
        summary: fm.summary,
        dueDate: fm.due_date,
        status: fm.status,
        priority: fm.priority,
        issuetype: fm.issuetype,
        filePath: file.path,
        sprint_state: fm.sprint_state || '',
      });
    }

    setTasks(loadedTasks);
    setLoading(false);
  }, [plugin]);

  useEffect(() => {
    loadTasks();
    
    // Listen for file changes to keep sidebar updated
    const eventRef = plugin.app.metadataCache.on('changed', (file: TFile) => {
      if (file.path.startsWith(plugin.settings.tasksFolder)) {
        loadTasks();
      }
    });
    
    // Also listen for vault changes (create/delete)
    const createRef = plugin.app.vault.on('create', loadTasks);
    const deleteRef = plugin.app.vault.on('delete', loadTasks);
    
    return () => {
      plugin.app.metadataCache.offref(eventRef);
      plugin.app.vault.offref(createRef);
      plugin.app.vault.offref(deleteRef);
    };
  }, [loadTasks, plugin]);

  // --- Pomodoro Timer Effect ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
        setElapsedSeconds((prev) => prev + 1); // Track actual time spent
      }, 1000);
    } else if (isTimerRunning && timeLeft === 0) {
      setIsTimerRunning(false);
      handlePomodoroComplete();
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  // --- Log Focus Time to File ---
  const logFocusTime = async (taskKey: string, seconds: number) => {
    if (seconds < 60) return; // Do not log if less than 1 minute
    
    const minutes = Math.round(seconds / 60);
    const file = plugin.app.metadataCache.getFirstLinkpathDest(taskKey, '');
    
    if (file && file instanceof TFile) {
      try {
        // 1. Update Frontmatter (Cumulative Total)
        await plugin.app.fileManager.processFrontMatter(file, (fm: any) => {
          fm.focused_minutes = (fm.focused_minutes || 0) + minutes;
        });

        // 2. Wait a brief moment to avoid EBUSY lock from frontmatter update
        await new Promise(resolve => setTimeout(resolve, 300));

        // 3. Append to Body
        const content = await plugin.app.vault.read(file);
        const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
        const logEntry = `\n> 🍅 **专注记录**: [${timestamp}] 耗时 \`${minutes} 分钟\`\n`;
        
        await plugin.app.vault.modify(file, content + logEntry);
      } catch (error) {
        console.error(`[Jira Flow] Failed to log focus time for ${taskKey}:`, error);
      }
    }
  };

  const handlePomodoroComplete = async () => {
    // 1. Show Obsidian Notice
    new Notice(
      `🍅 时间到！你在 ${activeTask?.key} 上的专注已完成。`,
      5000
    );
    
    // 2. Try HTML5 Notification if permitted
    if (Notification.permission === 'granted') {
      new Notification('🍅 番茄钟完成！', { 
        body: `在 ${activeTask?.key} 上的专注已结束。` 
      });
    }
    
    // 3. Log the time
    if (activeTask) {
      await logFocusTime(activeTask.key, elapsedSeconds);
    }

    // Reset
    setActiveTask(null);
    setTimeLeft(defaultMinutes * 60);
    setElapsedSeconds(0);
  };

  const startTimer = async (e: React.MouseEvent, task: SidebarTask) => {
    e.stopPropagation(); // Prevent triggering hover preview or opening file
    if (isTimerRunning && activeTask?.key !== task.key) {
      if (!window.confirm('当前已有专注任务，是否放弃当前进度并切换？')) return;
      // Log the previous task's time when switching
      if (activeTask) {
        await logFocusTime(activeTask.key, elapsedSeconds);
      }
    }
    setActiveTask(task);
    setTimeLeft(defaultMinutes * 60);
    setElapsedSeconds(0); // Reset for new session
    setIsTimerRunning(true);
  };

  const stopTimer = async () => {
    setIsTimerRunning(false);
    
    // Log the time if stopped manually
    if (activeTask) {
      await logFocusTime(activeTask.key, elapsedSeconds);
    }

    setActiveTask(null);
    setTimeLeft(defaultMinutes * 60);
    setElapsedSeconds(0);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Get current moment for date comparisons
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  // Get end of week (Sunday)
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  const todayTasks = tasks.filter(t => {
    // STRICT SPRINT FILTER: Must be an ACTIVE sprint
    if (t.sprint_state.toUpperCase() !== 'ACTIVE') return false;
    if (!t.dueDate) return false;
    
    const due = new Date(t.dueDate);
    due.setHours(0, 0, 0, 0);
    // FIX: Check if the date is exactly today OR before today (overdue)
    return due.getTime() <= now.getTime() && !isDone(t.status);
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const weekTasks = tasks.filter(t => {
    // STRICT SPRINT FILTER: Must be an ACTIVE sprint
    if (t.sprint_state.toUpperCase() !== 'ACTIVE') return false;
    if (!t.dueDate) return false;
    
    const due = new Date(t.dueDate);
    due.setHours(0, 0, 0, 0);
    // FIX: Strictly AFTER today, and BEFORE OR ON the end of the week
    return due.getTime() > now.getTime() && due <= endOfWeek && !isDone(t.status);
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  function isDone(status: string): boolean {
    const doneStatuses = ['done', 'closed', 'resolved', '完成', '已解决'];
    return doneStatuses.some(s => status.toLowerCase().includes(s));
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    if (date < now) {
      return '已逾期';
    }
    if (date.getTime() === now.getTime()) {
      return '今日';
    }
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  function getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      'Highest': 'jf-bg-red-100 jf-text-red-700',
      'High': 'jf-bg-orange-100 jf-text-orange-700',
      'Medium': 'jf-bg-yellow-100 jf-text-yellow-700',
      'Low': 'jf-bg-green-100 jf-text-green-700',
      'Lowest': 'jf-bg-gray-100 jf-text-gray-600',
    };
    return colors[priority] || 'jf-bg-gray-100 jf-text-gray-600';
  }

  const handleTaskClick = async (task: SidebarTask) => {
    const file = plugin.app.vault.getAbstractFileByPath(task.filePath);
    if (file && file instanceof TFile) {
      const leaf = plugin.app.workspace.getLeaf('tab');
      await leaf.openFile(file);
    }
  };

  // Trigger Obsidian native hover preview
  const onHoverTask = (e: React.MouseEvent, task: SidebarTask) => {
    if (plugin?.app) {
      plugin.app.workspace.trigger('hover-link', {
        event: e.nativeEvent,
        source: 'jira-flow-sidebar',
        hoverParent: e.currentTarget,
        targetEl: e.currentTarget,
        linktext: task.filePath,
        sourcePath: '',
      });
    }
  };

  // Render a compact task item
  const renderTask = (task: SidebarTask) => {
    const dateLabel = formatDate(task.dueDate);
    const isOverdue = dateLabel === 'Overdue';
    const isActive = activeTask?.key === task.key;
    
    return (
      <div 
        key={task.key} 
        onClick={() => handleTaskClick(task)}
        onMouseEnter={(e) => onHoverTask(e, task)}
        className={`jf-p-2 jf-mb-2 jf-bg-white jf-border ${isActive ? 'jf-border-blue-500 jf-ring-1 jf-ring-blue-500' : 'jf-border-gray-200'} jf-rounded-md jf-shadow-sm hover:jf-border-blue-300 jf-transition-all jf-cursor-pointer jf-group`}
      >
        <div className="jf-flex jf-justify-between jf-items-start jf-mb-1">
          <span className="jf-text-[10px] jf-font-mono jf-bg-blue-50 jf-text-blue-600 jf-px-1 jf-rounded">
            {task.key}
          </span>
          <div className="jf-flex jf-items-center jf-gap-2">
            <span className={`jf-text-[10px] jf-px-1 jf-rounded ${isOverdue ? 'jf-bg-red-100 jf-text-red-600 jf-font-semibold' : 'jf-text-gray-400'}`}>
              {dateLabel}
            </span>
            {/* PLAY BUTTON */}
            <button 
              onClick={(e) => startTimer(e, task)}
              title={`开始专注 (${defaultMinutes}分钟)`}
              className={`${isActive ? 'jf-text-blue-500' : 'jf-text-gray-300 hover:jf-text-blue-500'} jf-transition-colors`}
            >
              <svg className="jf-w-5 jf-h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </button>
          </div>
        </div>
        <div className="jf-text-xs jf-font-medium jf-text-gray-700 jf-line-clamp-2 jf-mb-1">
          {task.summary}
        </div>
        <div className="jf-flex jf-gap-1">
          <span className={`jf-text-[9px] jf-px-1 jf-py-0.5 jf-rounded ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </span>
          <span className="jf-text-[9px] jf-px-1 jf-py-0.5 jf-rounded jf-bg-gray-100 jf-text-gray-500">
            {task.issuetype}
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="jf-h-full jf-bg-gray-50 jf-p-3 jf-flex jf-items-center jf-justify-center">
        <span className="jf-text-xs jf-text-gray-400">加载中...</span>
      </div>
    );
  }

  return (
    <div className="jf-h-full jf-bg-gray-50 jf-p-3 jf-overflow-y-auto">
      <div className="jf-flex jf-justify-between jf-items-center jf-mb-4">
        <h2 className="jf-text-sm jf-font-bold jf-text-gray-800 jf-flex jf-items-center jf-gap-2">
          <span className="jf-text-blue-500">📅</span> 专注视图
        </h2>
        
        {/* Global Duration Setting */}
        <div className="jf-flex jf-items-center jf-gap-1 jf-text-xs jf-font-medium jf-text-gray-500 jf-bg-white jf-px-2 jf-py-1 jf-border jf-border-gray-200 jf-rounded-md jf-shadow-sm">
          <svg className="jf-w-3.5 jf-h-3.5 jf-text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <input 
            type="number" 
            min="1" 
            max="120"
            value={defaultMinutes}
            onChange={(e) => setDefaultMinutes(Number(e.target.value) || 35)}
            className="jf-w-8 jf-p-0 jf-text-center jf-border-none jf-bg-transparent focus:jf-ring-0 jf-text-gray-700 jf-font-bold"
          />
          <span>分钟</span>
        </div>
      </div>
      
      {/* ACTIVE TIMER WIDGET (LIGHT THEME) */}
      {activeTask && (
        <div className="jf-mb-6 jf-p-4 jf-bg-white jf-border jf-border-blue-100 jf-rounded-xl jf-shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          
          {/* Header */}
          <div className="jf-flex jf-justify-between jf-items-center jf-mb-2">
            <span className="jf-text-xs jf-font-bold jf-bg-blue-50 jf-text-blue-600 jf-px-2 jf-py-1 jf-rounded jf-flex jf-items-center jf-gap-1 jf-border jf-border-blue-100">
              🍅 {activeTask.key}
            </span>
            <button 
              onClick={stopTimer} 
              className="jf-text-xs jf-font-medium jf-text-gray-400 hover:jf-text-red-500 hover:jf-bg-red-50 jf-px-2 jf-py-1 jf-rounded jf-transition-colors jf-flex jf-items-center jf-gap-1"
              title="停止计时"
            >
              <svg className="jf-w-3 jf-h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              停止
            </button>
          </div>
          
          {/* Timer Display with Quick Adjustments */}
          <div className="jf-flex jf-justify-center jf-items-center jf-gap-4 jf-my-3">
            {/* -5 Min Button */}
            <button 
              onClick={() => setTimeLeft(prev => Math.max(0, prev - 300))}
              className="jf-text-gray-300 hover:jf-text-blue-500 jf-transition-colors jf-p-1 jf-rounded hover:jf-bg-blue-50"
              title="减少 5 分钟"
            >
              <svg className="jf-w-5 jf-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
            </button>
            
            <div className="jf-text-4xl jf-font-mono jf-font-bold jf-text-center jf-text-slate-800 jf-tracking-wider jf-w-24">
              {formatTime(timeLeft)}
            </div>

            {/* +5 Min Button */}
            <button 
              onClick={() => setTimeLeft(prev => prev + 300)}
              className="jf-text-gray-300 hover:jf-text-blue-500 jf-transition-colors jf-p-1 jf-rounded hover:jf-bg-blue-50"
              title="增加 5 分钟"
            >
              <svg className="jf-w-5 jf-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            </button>
          </div>
          
          {/* Task Summary */}
          <div className="jf-text-xs jf-text-center jf-text-gray-500 jf-truncate jf-mb-4" title={activeTask.summary}>
            {activeTask.summary}
          </div>
          
          {/* Controls */}
          <div className="jf-flex jf-justify-center">
            <button 
              onClick={() => setIsTimerRunning(!isTimerRunning)} 
              className={`jf-text-xs jf-font-bold jf-px-6 jf-py-1.5 jf-rounded-full jf-transition-all jf-shadow-sm jf-border jf-flex jf-items-center jf-gap-1 ${
                isTimerRunning 
                  ? 'jf-bg-amber-50 jf-text-amber-600 jf-border-amber-200 hover:jf-bg-amber-100' 
                  : 'jf-bg-blue-600 jf-text-white jf-border-blue-600 hover:jf-bg-blue-700 hover:jf-shadow-md'
              }`}
            >
              {isTimerRunning ? (
                <>
                  <svg className="jf-w-3.5 jf-h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                  暂停
                </>
              ) : (
                <>
                  <svg className="jf-w-3.5 jf-h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
                  继续
                </>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Today Section */}
      <div className="jf-mb-6">
        <h3 className="jf-text-xs jf-font-bold jf-text-gray-500 jf-uppercase jf-mb-2 jf-border-b jf-border-gray-200 jf-pb-1 jf-flex jf-justify-between">
          <span>今日 / 已逾期</span>
          <span className="jf-bg-red-100 jf-text-red-600 jf-px-1.5 jf-rounded-full">{todayTasks.length}</span>
        </h3>
        <div className="jf-flex jf-flex-col">
          {todayTasks.length > 0 ? (
            todayTasks.map(renderTask)
          ) : (
            <div className="jf-text-xs jf-text-gray-400 jf-italic jf-py-2">今日暂无任务 🎉</div>
          )}
        </div>
      </div>

      {/* This Week Section */}
      <div>
        <h3 className="jf-text-xs jf-font-bold jf-text-gray-500 jf-uppercase jf-mb-2 jf-border-b jf-border-gray-200 jf-pb-1 jf-flex jf-justify-between">
          <span>本周待办</span>
          <span className="jf-bg-blue-100 jf-text-blue-600 jf-px-1.5 jf-rounded-full">{weekTasks.length}</span>
        </h3>
        <div className="jf-flex jf-flex-col">
          {weekTasks.length > 0 ? (
            weekTasks.map(renderTask)
          ) : (
            <div className="jf-text-xs jf-text-gray-400 jf-italic jf-py-2">本周暂无任务 ☕</div>
          )}
        </div>
      </div>
    </div>
  );
};
