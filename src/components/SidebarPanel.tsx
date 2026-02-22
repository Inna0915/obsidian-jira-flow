import React, { useEffect, useState, useCallback } from 'react';
import { TFile } from 'obsidian';
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
    
    return (
      <div 
        key={task.key} 
        onClick={() => handleTaskClick(task)}
        onMouseEnter={(e) => onHoverTask(e, task)}
        className="jf-p-2 jf-mb-2 jf-bg-white jf-border jf-border-gray-200 jf-rounded-md jf-shadow-sm hover:jf-border-blue-300 jf-transition-colors jf-cursor-pointer jf-group"
      >
        <div className="jf-flex jf-justify-between jf-items-start jf-mb-1">
          <span className="jf-text-[10px] jf-font-mono jf-bg-blue-50 jf-text-blue-600 jf-px-1 jf-rounded">
            {task.key}
          </span>
          <span className={`jf-text-[10px] jf-px-1 jf-rounded ${isOverdue ? 'jf-bg-red-100 jf-text-red-600 jf-font-semibold' : 'jf-text-gray-400'}`}>
            {dateLabel}
          </span>
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
