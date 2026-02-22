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

// --- Pomodoro Timer Constants ---
const POMODORO_SECONDS = 35 * 60; // 35 minutes

export const SidebarPanel = ({ plugin }: { plugin: JiraFlowPlugin }) => {
  const [tasks, setTasks] = useState<SidebarTask[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Pomodoro Timer State ---
  const [activeTask, setActiveTask] = useState<SidebarTask | null>(null);
  const [timeLeft, setTimeLeft] = useState(POMODORO_SECONDS);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

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
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (isTimerRunning && timeLeft === 0) {
      setIsTimerRunning(false);
      handlePomodoroComplete();
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const handlePomodoroComplete = () => {
    // 1. Show Obsidian Notice
    new Notice(
      `🍅 时间到！你在 ${activeTask?.key} 上的 35 分钟专注已完成。\n请前往看板更新任务状态。`,
      10000
    );
    
    // 2. Try HTML5 Notification if permitted
    if (Notification.permission === 'granted') {
      new Notification('🍅 番茄钟完成！', { 
        body: `在 ${activeTask?.key} 上的专注已结束。` 
      });
    }
    
    // Reset
    setActiveTask(null);
    setTimeLeft(POMODORO_SECONDS);
  };

  const startTimer = (e: React.MouseEvent, task: SidebarTask) => {
    e.stopPropagation(); // Prevent triggering hover preview or opening file
    if (isTimerRunning && activeTask?.key !== task.key) {
      if (!window.confirm('当前已有专注任务，是否放弃当前进度并切换？')) return;
    }
    setActiveTask(task);
    setTimeLeft(POMODORO_SECONDS);
    setIsTimerRunning(true);
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
    setActiveTask(null);
    setTimeLeft(POMODORO_SECONDS);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Get today's date at start of day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get end of week (Sunday)
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  const todayTasks = tasks.filter(t => {
    // STRICT SPRINT FILTER: Must be an ACTIVE sprint
    if (t.sprint_state.toUpperCase() !== 'ACTIVE') return false;
    
    const due = new Date(t.dueDate);
    return due <= today && !isDone(t.status);
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const weekTasks = tasks.filter(t => {
    // STRICT SPRINT FILTER: Must be an ACTIVE sprint
    if (t.sprint_state.toUpperCase() !== 'ACTIVE') return false;
    
    const due = new Date(t.dueDate);
    return due > today && due <= endOfWeek && !isDone(t.status);
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
      return 'Overdue';
    }
    if (date.getTime() === now.getTime()) {
      return 'Today';
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
              title="开始专注 (35分钟)"
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
        <span className="jf-text-xs jf-text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="jf-h-full jf-bg-gray-50 jf-p-3 jf-overflow-y-auto">
      <h2 className="jf-text-sm jf-font-bold jf-text-gray-800 jf-mb-3 jf-flex jf-items-center jf-gap-2">
        <span className="jf-text-blue-500">📅</span> Focus View
      </h2>
      
      {/* ACTIVE TIMER WIDGET */}
      {activeTask && (
        <div className="jf-mb-6 jf-p-4 jf-bg-slate-800 jf-rounded-xl jf-shadow-lg jf-text-white">
          <div className="jf-flex jf-justify-between jf-items-center jf-mb-2">
            <span className="jf-text-xs jf-font-bold jf-bg-white/20 jf-px-2 jf-py-1 jf-rounded jf-flex jf-items-center jf-gap-1">
              🍅 {activeTask.key}
            </span>
            <button 
              onClick={stopTimer} 
              className="jf-text-white/60 hover:jf-text-white jf-transition-colors"
              title="停止计时"
            >
              ✕
            </button>
          </div>
          <div className="jf-text-4xl jf-font-mono jf-font-bold jf-text-center jf-my-3 jf-tracking-wider">
            {formatTime(timeLeft)}
          </div>
          <div className="jf-text-xs jf-text-center jf-text-white/80 jf-truncate jf-mb-4">
            {activeTask.summary}
          </div>
          <div className="jf-flex jf-justify-center">
            <button 
              onClick={() => setIsTimerRunning(!isTimerRunning)} 
              className="jf-text-xs jf-font-bold jf-bg-white/10 hover:jf-bg-white/20 jf-text-white jf-px-6 jf-py-1.5 jf-rounded-full jf-transition-colors jf-border jf-border-white/20"
            >
              {isTimerRunning ? '⏸ 暂停' : '▶ 继续'}
            </button>
          </div>
        </div>
      )}
      
      {/* Today Section */}
      <div className="jf-mb-6">
        <h3 className="jf-text-xs jf-font-bold jf-text-gray-500 jf-uppercase jf-mb-2 jf-border-b jf-border-gray-200 jf-pb-1 jf-flex jf-justify-between">
          <span>Today / Overdue</span>
          <span className="jf-bg-red-100 jf-text-red-600 jf-px-1.5 jf-rounded-full">{todayTasks.length}</span>
        </h3>
        <div className="jf-flex jf-flex-col">
          {todayTasks.length > 0 ? (
            todayTasks.map(renderTask)
          ) : (
            <div className="jf-text-xs jf-text-gray-400 jf-italic jf-py-2">No tasks for today. 🎉</div>
          )}
        </div>
      </div>

      {/* This Week Section */}
      <div>
        <h3 className="jf-text-xs jf-font-bold jf-text-gray-500 jf-uppercase jf-mb-2 jf-border-b jf-border-gray-200 jf-pb-1 jf-flex jf-justify-between">
          <span>Later This Week</span>
          <span className="jf-bg-blue-100 jf-text-blue-600 jf-px-1.5 jf-rounded-full">{weekTasks.length}</span>
        </h3>
        <div className="jf-flex jf-flex-col">
          {weekTasks.length > 0 ? (
            weekTasks.map(renderTask)
          ) : (
            <div className="jf-text-xs jf-text-gray-400 jf-italic jf-py-2">No tasks for this week.</div>
          )}
        </div>
      </div>
    </div>
  );
};
