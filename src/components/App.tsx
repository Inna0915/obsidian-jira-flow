import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Notice, TFile } from "obsidian";
import type JiraFlowPlugin from "../main";
import {
  KANBAN_COLUMNS,
  SWIMLANES,
  classifySwimlane,
  getAllowedTransitions,
  isTransitionAllowed,
} from "../types";
import type { KanbanCard, SwimlaneType } from "../types";
import { Board } from "./Board";
import { IssueListView } from "./IssueListView";
import { TaskDetailPanel, CreateJiraIssueModal, type CreateJiraIssueData, CreateTaskModal } from "./TaskDetailModal";
import type { CreateTaskData } from "./TaskDetailModal";
import { ReportCenter } from "./ReportCenter";

interface AppProps {
  plugin: JiraFlowPlugin;
  searchInputId?: string;
}

export type ViewMode = "sprint" | "all" | "local";
type LayoutMode = "kanban" | "list";

export interface SwimlaneData {
  id: SwimlaneType;
  label: string;
  color: string;
  columns: Map<string, KanbanCard[]>;
}

export const App: React.FC<AppProps> = ({ plugin, searchInputId }) => {
  const [allCards, setAllCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<SwimlaneType>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("sprint");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("kanban");
  const [detailCard, setDetailCard] = useState<KanbanCard | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectionAnchorPath, setSelectionAnchorPath] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ isDragging: boolean; allowedColumns: Set<string>; activePaths: Set<string> }>({
    isDragging: false,
    allowedColumns: new Set(),
    activePaths: new Set(),
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateJiraModal, setShowCreateJiraModal] = useState(false);
  const [showReportCenter, setShowReportCenter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        event.stopPropagation();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, []);

  // Calculate matched cards for navigation
  const matchedCards = searchQuery
    ? allCards.filter((card) =>
        card.jiraKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.assignee?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.reporter?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.priority.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.issuetype.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Reset match index when search query changes
  useEffect(() => {
    setSearchMatchIndex(0);
  }, [searchQuery]);

  // Auto-scroll to matched card when searchMatchIndex changes
  useEffect(() => {
    if (matchedCards.length === 0) return;

    const currentCard = matchedCards[searchMatchIndex];
    if (!currentCard) return;

    // Find the card element and scroll to it
    const cardElement = document.querySelector(`[data-card-path="${CSS.escape(currentCard.filePath)}"]`);
    if (cardElement) {
      cardElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchMatchIndex, matchedCards]);

  // Navigate to previous match
  const goToPrevMatch = useCallback(() => {
    if (matchedCards.length === 0) return;
    setSearchMatchIndex((prev) => (prev - 1 + matchedCards.length) % matchedCards.length);
  }, [matchedCards.length]);

  // Navigate to next match
  const goToNextMatch = useCallback(() => {
    if (matchedCards.length === 0) return;
    setSearchMatchIndex((prev) => (prev + 1) % matchedCards.length);
  }, [matchedCards.length]);

  // Handle keyboard navigation in search input
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (e.shiftKey) {
          goToPrevMatch();
        } else {
          goToNextMatch();
        }
        e.preventDefault();
      } else if (e.key === "Escape") {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    },
    [goToNextMatch, goToPrevMatch]
  );

  // Keep detailCard in sync with allCards after edits
  useEffect(() => {
    if (detailCard) {
      const updated = allCards.find((c) => c.filePath === detailCard.filePath);
      if (updated && updated !== detailCard) setDetailCard(updated);
    }
  }, [allCards]);

  const loadCards = useCallback(() => {
    const files = plugin.fileManager.getAllTaskFiles();
    const cards: KanbanCard[] = [];

    for (const file of files) {
      const fm = plugin.fileManager.getTaskFrontmatter(file);
      if (!fm) continue;

      const mappedColumn = fm.mapped_column;
      const swimlane = classifySwimlane(fm.due_date, mappedColumn);

      // Skip archived tasks on the board
      if (fm.archived) continue;

      cards.push({
        filePath: file.path,
        jiraKey: fm.jira_key,
        source: fm.source,
        status: fm.status,
        mappedColumn,
        issuetype: fm.issuetype,
        priority: fm.priority,
        storyPoints: fm.story_points,
        dueDate: fm.due_date,
        assignee: fm.assignee,
        reporter: fm.reporter,
        reporter_only: fm.reporter_only,
        summary: fm.summary,
        created: fm.created,
        updated: fm.updated,
        tags: fm.tags,
        swimlane,
        sprint: fm.sprint,
        sprint_state: fm.sprint_state,
      });
    }

    startTransition(() => {
      setAllCards(cards);
      setLoading(false);
    });
  }, [plugin]);

  const scheduleLoadCards = useCallback((delay = 120) => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      loadCards();
    }, delay);
  }, [loadCards]);

  // Filter cards by view mode
  const filteredCards = allCards.filter((card) => {
    if (viewMode === "local") return card.source === "LOCAL";
    if (viewMode === "sprint") {
      // Sprint view: only show ACTIVE sprint tasks
      return card.sprint_state === "ACTIVE" && !card.reporter_only;
    }
    return true; // "all" (Backlog) - show all issues without restriction
  });

  const displayCards = layoutMode === "kanban"
    ? filteredCards.filter((card) => !card.reporter_only)
    : [...filteredCards].sort((left, right) => {
        const rightTime = right.created ? new Date(right.created).getTime() : 0;
        const leftTime = left.created ? new Date(left.created).getTime() : 0;
        return rightTime - leftTime;
      });

  const kanbanCards = filteredCards.filter((card) => !card.reporter_only);

  // Build swimlane data from filtered cards
  const swimlanes: SwimlaneData[] = (() => {
    const swimlaneMap = new Map<SwimlaneType, Map<string, KanbanCard[]>>();
    for (const sl of SWIMLANES) {
      const colMap = new Map<string, KanbanCard[]>();
      for (const col of KANBAN_COLUMNS) {
        colMap.set(col.id, []);
      }
      swimlaneMap.set(sl.id, colMap);
    }

    for (const card of kanbanCards) {
      const colMap = swimlaneMap.get(card.swimlane);
      if (colMap) {
        const colCards = colMap.get(card.mappedColumn);
        if (colCards) {
          colCards.push(card);
        } else {
          colMap.get("TO DO")?.push(card);
        }
      }
    }

    return SWIMLANES.map((sl) => ({
      id: sl.id,
      label: sl.label,
      color: sl.color,
      columns: swimlaneMap.get(sl.id)!,
    }));
  })();

  useEffect(() => {
    scheduleLoadCards(0);
    // Use metadataCache "changed" event instead of vault "modify" —
    // vault modify fires before the cache updates, causing stale reads.
    const ref = plugin.app.metadataCache.on("changed", () => scheduleLoadCards());
    const ref2 = plugin.app.vault.on("create", () => scheduleLoadCards());
    const ref3 = plugin.app.vault.on("delete", () => scheduleLoadCards());
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      plugin.app.metadataCache.offref(ref);
      plugin.app.vault.offref(ref2);
      plugin.app.vault.offref(ref3);
    };
  }, [plugin, scheduleLoadCards]);

  const handleCardMove = useCallback(
    async (cardPath: string, targetColumn: string, _targetSwimlane: SwimlaneType) => {
      console.log(`[Jira Flow] handleCardMove: ${cardPath} → ${targetColumn}`);
      try {
        const file = plugin.app.vault.getAbstractFileByPath(cardPath);
        if (!file || !(file instanceof TFile)) {
          console.warn("[Jira Flow] handleCardMove: file not found", cardPath);
          return;
        }

        const fm = plugin.fileManager.getTaskFrontmatter(file);
        if (!fm) {
          console.warn("[Jira Flow] handleCardMove: no frontmatter for", cardPath);
          return;
        }

        const originalColumn = fm.mapped_column;
        console.log(`[Jira Flow] handleCardMove: ${fm.jira_key} from "${originalColumn}" to "${targetColumn}", source=${fm.source}`);

        if (!isTransitionAllowed(fm.issuetype, originalColumn, targetColumn, fm.source)) {
          new Notice(`Jira Flow：无法将 ${fm.issuetype} 从 ${originalColumn} 移动到 ${targetColumn}`);
          return;
        }

        await plugin.fileManager.updateStatus(file, targetColumn);

        if (fm.source === "JIRA" && plugin.settings.jiraHost) {
          const result = await plugin.jiraApi.transitionIssue(fm.jira_key, targetColumn);
          if (!result.success) {
            await plugin.fileManager.updateStatus(file, originalColumn);
            new Notice(`Jira Flow：${fm.jira_key} 状态转换失败，已回滚到 ${originalColumn}`);
            return;
          }
          if (result.actualColumn && result.actualColumn !== targetColumn) {
            await plugin.fileManager.updateStatus(file, result.actualColumn);
          }
        }

        console.log(`[Jira Flow] handleCardMove: checking work log trigger, type="${fm.issuetype}", targetColumn="${targetColumn}", source="${fm.source}"`);
        // Determine if this move constitutes "work done" for logging purposes:
        // - Story/Task: moved to EXECUTED (development done)
        // - Bug: moved to TESTING & REVIEW (fix submitted for verification)
        // - LOCAL tasks: moved to DONE or CLOSED
        // - Also log for DONE/CLOSED/RESOLVED for any type as a catch-all
        const isBug = fm.issuetype.toLowerCase() === "bug";
        const shouldLog =
          (fm.source === "LOCAL" && (targetColumn === "DONE" || targetColumn === "CLOSED")) ||
          (!isBug && targetColumn === "EXECUTED") ||
          (isBug && targetColumn === "TESTING & REVIEW") ||
          targetColumn === "DONE" || targetColumn === "CLOSED" || targetColumn === "RESOLVED";

        if (shouldLog) {
          console.log(`[Jira Flow] handleCardMove: calling logWork for ${fm.jira_key}`);
          await plugin.workLogger.logWork(file, { jiraKey: fm.jira_key, summary: fm.summary });
        }
      } catch (e) {
        console.error("[Jira Flow] handleCardMove error:", e);
        new Notice(`Jira Flow：拖拽操作出错: ${e instanceof Error ? e.message : String(e)}`);
      }
      // Board refreshes automatically via metadataCache "changed" event
    },
    [plugin]
  );

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await plugin.syncJira();
    } finally {
      setIsSyncing(false);
      scheduleLoadCards(0);
    }
  }, [plugin, scheduleLoadCards]);

  const handleOpenFile = useCallback(
    (filePath: string) => {
      const file = plugin.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        const leaf = plugin.app.workspace.getLeaf("tab");
        leaf.openFile(file);
      }
    },
    [plugin]
  );

  const visibleBoardCardPaths = useMemo(() => {
    const ordered: string[] = [];
    swimlanes.forEach((swimlane) => {
      if (collapsedSwimlanes.has(swimlane.id)) {
        return;
      }

      KANBAN_COLUMNS.forEach((column) => {
        const cards = swimlane.columns.get(column.id) || [];
        cards.forEach((card) => ordered.push(card.filePath));
      });
    });
    return ordered;
  }, [collapsedSwimlanes, swimlanes]);

  const handleCardOpen = useCallback((card: KanbanCard) => {
    setDetailCard(card);
  }, []);

  const handleCardSelect = useCallback((card: KanbanCard, options: { additive: boolean; range: boolean }) => {
    setSelectedPaths((previous) => {
      const { additive, range } = options;

      if (range) {
        const anchorPath = selectionAnchorPath ?? card.filePath;
        const anchorIndex = visibleBoardCardPaths.indexOf(anchorPath);
        const currentIndex = visibleBoardCardPaths.indexOf(card.filePath);

        if (anchorIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(anchorIndex, currentIndex);
          const end = Math.max(anchorIndex, currentIndex);
          const rangePaths = visibleBoardCardPaths.slice(start, end + 1);
          const next = additive ? new Set(previous) : new Set<string>();
          rangePaths.forEach((path) => next.add(path));
          return next;
        }
      }

      if (additive) {
        const next = new Set(previous);
        if (next.has(card.filePath)) {
          next.delete(card.filePath);
        } else {
          next.add(card.filePath);
        }
        return next;
      }

      return new Set([card.filePath]);
    });

    setSelectionAnchorPath(card.filePath);
    setDetailCard((current) => (current?.filePath === card.filePath ? current : null));
  }, [selectionAnchorPath, visibleBoardCardPaths]);

  const buildAllowedColumnsForCards = useCallback((cards: KanbanCard[]) => {
    if (cards.length === 0) return new Set<string>();
    const intersections = cards.map((card) => new Set(getAllowedTransitions(card.issuetype, card.mappedColumn, card.source)));
    const [first, ...rest] = intersections;
    const allowed = new Set(Array.from(first).filter((columnId) => rest.every((set) => set.has(columnId))));
    return allowed;
  }, []);

  const handleCardDragStart = useCallback((card: KanbanCard) => {
    setSelectedPaths((previous) => {
      const activePaths = previous.has(card.filePath) ? new Set(previous) : new Set([card.filePath]);
      const activeCards = kanbanCards.filter((item) => activePaths.has(item.filePath));
      const allowedColumns = buildAllowedColumnsForCards(activeCards);
      setDragState({
        isDragging: true,
        allowedColumns,
        activePaths,
      });
      return activePaths;
    });
  }, [buildAllowedColumnsForCards, kanbanCards]);

  const handleCardDragEnd = useCallback(() => {
    setDragState({
      isDragging: false,
      allowedColumns: new Set(),
      activePaths: new Set(),
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedPaths(new Set());
    setSelectionAnchorPath(null);
  }, []);

  useEffect(() => {
    if (selectedPaths.size === 0 && dragState.activePaths.size === 0) {
      setDragState((previous) => previous.isDragging ? { isDragging: false, allowedColumns: new Set(), activePaths: new Set() } : previous);
    }
  }, [selectedPaths, dragState.activePaths.size]);

  const handleCreateTask = useCallback(
    async (data: CreateTaskData) => {
      const key = `LOCAL-${Date.now()}`;
      const now = new Date().toISOString();
      const frontmatter = {
        jira_key: key,
        source: "LOCAL" as const,
        status: data.mappedColumn,
        mapped_column: data.mappedColumn,
        issuetype: data.issuetype,
        priority: data.priority,
        story_points: data.storyPoints,
        due_date: data.dueDate,
        assignee: data.assignee,
        reporter: "",
        reporter_only: false,
        sprint: "",
        sprint_state: "",
        tags: ["jira/source/local", data.issuetype === "Personal" ? "jira/type/personal" : "jira/type/work"],
        summary: data.summary,
        created: now,
        updated: now,
      };
      await plugin.fileManager.createTaskFile(key, data.summary, frontmatter, "");
      new Notice("Jira Flow：本地任务已创建。");
      loadCards();
    },
    [plugin, loadCards]
  );

  const handleCreateJiraIssue = useCallback(
    async (data: CreateJiraIssueData) => {
      setIsSyncing(true);
      try {
        const created = await plugin.jiraApi.createIssue(data);
        new Notice(`Jira Flow：已创建 Jira 任务 ${created.key}，正在同步。`);
        await plugin.syncJira();
        scheduleLoadCards(0);
      } finally {
        setIsSyncing(false);
      }
    },
    [plugin, scheduleLoadCards]
  );

  const handleArchive = useCallback(
    async (card: KanbanCard) => {
      const file = plugin.app.vault.getAbstractFileByPath(card.filePath);
      if (!file || !(file instanceof TFile)) return;
      await plugin.fileManager.archiveTask(file);
      new Notice(`Jira Flow：${card.jiraKey} 已归档。`);
      setDetailCard(null);
      loadCards();
    },
    [plugin, loadCards]
  );

  const handleDeleteLocal = useCallback(
    async (card: KanbanCard) => {
      const file = plugin.app.vault.getAbstractFileByPath(card.filePath);
      if (!file || !(file instanceof TFile)) return;
      await plugin.app.vault.delete(file);
      new Notice(`Jira Flow：${card.jiraKey} 已删除。`);
      setDetailCard(null);
      loadCards();
    },
    [plugin, loadCards]
  );

  const toggleSwimlane = useCallback((id: SwimlaneType) => {
    setCollapsedSwimlanes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="jf-flex jf-items-center jf-justify-center jf-h-full jf-text-lg">
        Loading board...
      </div>
    );
  }

  // Report Center full-screen view
  if (showReportCenter) {
    return <ReportCenter plugin={plugin} onBack={() => setShowReportCenter(false)} />;
  }

  const viewModes: { id: ViewMode; label: string }[] = [
    { id: "sprint", label: "当前迭代" },
    { id: "all", label: "待办列表" },
    { id: "local", label: "本地任务" },
  ];

  const boardTitle = viewMode === "sprint" ? "当前迭代" : viewMode === "all" ? "待办列表" : "本地任务";

  const layoutModes: { id: LayoutMode; label: string }[] = [
    { id: "kanban", label: "看板" },
    { id: "list", label: "列表" },
  ];

  return (
    <div className="jf-flex jf-flex-col jf-h-full jf-bg-[#F7F8FA]">
      {/* Header */}
      <div className="jf-flex jf-items-center jf-justify-between jf-px-4 jf-py-3 jf-border-b jf-border-[#DFE1E6] jf-bg-[#FAFBFC]">
        <div className="jf-flex jf-items-center jf-gap-3">
          <h2 className="jf-text-xl jf-font-semibold jf-m-0 jf-text-[#172B4D]">Jira Flow</h2>
          {isSyncing && (
            <div className="jf-flex jf-items-center jf-gap-2 jf-px-2 jf-py-1 jf-rounded-md jf-bg-[#DEEBFF] jf-text-[#0747A6] jf-text-xs jf-font-medium">
              <span className="jf-inline-block jf-w-2 jf-h-2 jf-rounded-full jf-bg-[#0052CC] jf-animate-pulse" />
              正在同步
            </div>
          )}
          {/* View Mode Tabs - Segmented Control */}
          <div className="jf-flex jf-bg-white jf-p-1 jf-rounded-lg jf-border jf-border-[#DFE1E6] jf-shadow-[0_1px_1px_rgba(9,30,66,0.08)]">
            {viewModes.map((vm) => (
              <button
                key={vm.id}
                onClick={() => setViewMode(vm.id)}
                className={`jf-px-3 jf-py-1 jf-text-xs jf-rounded-md jf-transition-all ${
                  viewMode === vm.id
                    ? "jf-bg-[#0052CC] jf-text-white jf-shadow-sm jf-font-semibold"
                    : "jf-text-[#42526E] hover:jf-text-[#172B4D] hover:jf-bg-[#F4F5F7] jf-font-medium"
                }`}
              >
                {vm.label}
              </button>
            ))}
          </div>
          <div className="jf-flex jf-bg-white jf-p-1 jf-rounded-lg jf-border jf-border-[#DFE1E6] jf-shadow-[0_1px_1px_rgba(9,30,66,0.08)]">
            {layoutModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setLayoutMode(mode.id)}
                className={`jf-px-3 jf-py-1 jf-text-xs jf-rounded-md jf-transition-all ${
                  layoutMode === mode.id
                    ? "jf-bg-[#E9F2FF] jf-text-[#0747A6] jf-font-semibold"
                    : "jf-text-[#42526E] hover:jf-text-[#172B4D] hover:jf-bg-[#F4F5F7] jf-font-medium"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {/* Search Input - Chrome Style */}
          <div className="jf-flex jf-items-center jf-gap-1 jf-relative">
            <div className="jf-relative jf-flex jf-items-center">
              <input
                ref={searchInputRef}
                id={searchInputId}
                type="text"
                placeholder="搜索任务... (Ctrl+F)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="jf-w-56 jf-px-3 jf-py-1.5 jf-text-sm jf-border jf-border-[#C1C7D0] jf-rounded-md jf-bg-white focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500 focus:jf-border-transparent jf-transition-all jf-placeholder-gray-400"
              />
              {/* Match count and navigation */}
              {searchQuery && matchedCards.length > 0 && (
                <div className="jf-absolute jf-right-20 jf-flex jf-items-center jf-gap-1 jf-text-xs jf-text-gray-500">
                  <span className="jf-font-medium">
                    {searchMatchIndex + 1}/{matchedCards.length}
                  </span>
                  <button
                    onClick={goToPrevMatch}
                    className="jf-p-1 jf-hover:bg-gray-100 jf-rounded jf-transition-colors"
                    title="上一个 (Shift+Enter)"
                  >
                    <svg className="jf-w-3 jf-h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={goToNextMatch}
                    className="jf-p-1 jf-hover:bg-gray-100 jf-rounded jf-transition-colors"
                    title="下一个 (Enter)"
                  >
                    <svg className="jf-w-3 jf-h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              )}
              {/* Clear button */}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="jf-absolute jf-right-2 jf-top-1/2 jf-transform jf--translate-y-1/2 jf-text-gray-400 hover:jf-text-gray-600 jf-p-0.5"
                >
                  <svg className="jf-w-4 jf-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="jf-flex jf-items-center jf-gap-2">
          {/* Reports Button - Ghost Style */}
          <button
            onClick={() => setShowReportCenter(true)}
            className="jf-flex jf-items-center jf-gap-2 jf-px-3 jf-py-1.5 jf-text-[#42526E] hover:jf-bg-white jf-border jf-border-transparent hover:jf-border-[#DFE1E6] jf-rounded-md jf-text-sm jf-transition-all"
          >
            <svg className="jf-w-4 jf-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            任务报告
          </button>
          {/* New Task Button - Secondary Style */}
          <button
            onClick={() => setShowCreateJiraModal(true)}
            className="jf-bg-[#0052CC] jf-text-white jf-border jf-border-[#0052CC] hover:jf-bg-[#0747A6] jf-shadow-sm jf-px-3 jf-py-1.5 jf-rounded-md jf-text-sm jf-font-medium jf-transition-all"
          >
            + 新建 Jira
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="jf-bg-white jf-text-[#42526E] jf-border jf-border-[#C1C7D0] hover:jf-bg-[#F4F5F7] jf-shadow-sm jf-px-3 jf-py-1.5 jf-rounded-md jf-text-sm jf-font-medium jf-transition-all"
          >
            + 新建本地
          </button>
          {/* Archive View Button */}
          <button
            onClick={() => plugin.activateArchiveView()}
            className="jf-flex jf-items-center jf-gap-2 jf-bg-white jf-text-[#42526E] jf-border jf-border-[#C1C7D0] hover:jf-bg-[#F4F5F7] jf-shadow-sm jf-px-3 jf-py-1.5 jf-rounded-md jf-text-sm jf-font-medium jf-transition-all"
          >
            <svg className="jf-w-4 jf-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            归档视图
          </button>
          {/* Sync Jira Button - Primary Style */}
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="jf-flex jf-items-center jf-gap-2 jf-bg-[#0052CC] hover:jf-bg-[#0747A6] jf-text-white jf-shadow-sm jf-px-3 jf-py-1.5 jf-rounded-md jf-text-sm jf-font-medium jf-transition-all"
          >
            <svg className="jf-w-4 jf-h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isSyncing ? "同步中..." : "同步 Jira"}
          </button>
        </div>
      </div>

      {layoutMode === "kanban" ? (
        <Board
          swimlanes={swimlanes}
          collapsedSwimlanes={collapsedSwimlanes}
          onToggleSwimlane={toggleSwimlane}
          onCardMove={handleCardMove}
          onCardOpen={handleCardOpen}
          onCardSelect={handleCardSelect}
          onCardDragStart={handleCardDragStart}
          onCardDragEnd={handleCardDragEnd}
          onOpenFile={handleOpenFile}
          searchQuery={searchQuery}
          matchedCards={matchedCards}
          searchMatchIndex={searchMatchIndex}
          selectedPaths={selectedPaths}
          dragState={dragState}
          onDragStateChange={setDragState}
          onClearSelection={handleClearSelection}
        />
      ) : (
        <IssueListView
          cards={displayCards}
          jiraHost={plugin.settings.jiraBrowseHost?.trim() || "https://jira.ykeey.cn"}
          title={boardTitle}
          onCardClick={handleCardOpen}
          searchQuery={searchQuery}
          matchedCards={matchedCards}
          searchMatchIndex={searchMatchIndex}
        />
      )}

      {/* Detail Side Panel */}
      {detailCard && (
        <TaskDetailPanel
          card={detailCard}
          plugin={plugin}
          viewMode={viewMode}
          onClose={() => setDetailCard(null)}
          onOpenFile={handleOpenFile}
          onArchive={handleArchive}
          onDelete={handleDeleteLocal}
          onCardUpdated={loadCards}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTaskModal
          plugin={plugin}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateTask}
        />
      )}

      {showCreateJiraModal && (
        <CreateJiraIssueModal
          plugin={plugin}
          onClose={() => setShowCreateJiraModal(false)}
          onSave={handleCreateJiraIssue}
        />
      )}
    </div>
  );
};
