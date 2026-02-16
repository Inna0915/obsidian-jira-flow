import React, { useCallback, useEffect, useState } from "react";
import { Notice, TFile } from "obsidian";
import type JiraFlowPlugin from "../main";
import {
  KANBAN_COLUMNS,
  SWIMLANES,
  classifySwimlane,
  isTransitionAllowed,
} from "../types";
import type { KanbanCard, SwimlaneType } from "../types";
import { Board } from "./Board";
import { TaskDetailPanel, CreateTaskModal } from "./TaskDetailModal";
import type { CreateTaskData } from "./TaskDetailModal";
import { ReportCenter } from "./ReportCenter";

interface AppProps {
  plugin: JiraFlowPlugin;
}

export type ViewMode = "sprint" | "all" | "local";

export interface SwimlaneData {
  id: SwimlaneType;
  label: string;
  color: string;
  columns: Map<string, KanbanCard[]>;
}

export const App: React.FC<AppProps> = ({ plugin }) => {
  const [allCards, setAllCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<SwimlaneType>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("sprint");
  const [detailCard, setDetailCard] = useState<KanbanCard | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReportCenter, setShowReportCenter] = useState(false);

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
        summary: fm.summary,
        tags: fm.tags,
        swimlane,
        sprint: fm.sprint,
      });
    }

    setAllCards(cards);
    setLoading(false);
  }, [plugin]);

  // Filter cards by view mode
  const filteredCards = allCards.filter((card) => {
    if (viewMode === "local") return card.source === "LOCAL";
    if (viewMode === "sprint") {
      // Sprint view: only cards that belong to a sprint (have non-empty sprint field)
      return !!card.sprint;
    }
    return true; // "all"
  });

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

    for (const card of filteredCards) {
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
    loadCards();
    // Use metadataCache "changed" event instead of vault "modify" —
    // vault modify fires before the cache updates, causing stale reads.
    const ref = plugin.app.metadataCache.on("changed", () => loadCards());
    const ref2 = plugin.app.vault.on("create", () => loadCards());
    const ref3 = plugin.app.vault.on("delete", () => loadCards());
    return () => {
      plugin.app.metadataCache.offref(ref);
      plugin.app.vault.offref(ref2);
      plugin.app.vault.offref(ref3);
    };
  }, [loadCards, plugin]);

  const handleCardMove = useCallback(
    async (cardPath: string, targetColumn: string, _targetSwimlane: SwimlaneType) => {
      const file = plugin.app.vault.getAbstractFileByPath(cardPath);
      if (!file || !(file instanceof TFile)) return;

      const fm = plugin.fileManager.getTaskFrontmatter(file);
      if (!fm) return;

      const originalColumn = fm.mapped_column;

      if (!isTransitionAllowed(fm.issuetype, originalColumn, targetColumn, fm.source)) {
        new Notice(`Jira Flow: Cannot move ${fm.issuetype} from ${originalColumn} to ${targetColumn}`);
        return;
      }

      await plugin.fileManager.updateStatus(file, targetColumn);

      if (fm.source === "JIRA" && plugin.settings.jiraHost) {
        const result = await plugin.jiraApi.transitionIssue(fm.jira_key, targetColumn);
        if (!result.success) {
          await plugin.fileManager.updateStatus(file, originalColumn);
          new Notice(`Jira Flow: Transition failed for ${fm.jira_key}, rolled back to ${originalColumn}`);
          return;
        }
        // Update local file with the actual Jira status after transition
        if (result.actualColumn && result.actualColumn !== targetColumn) {
          await plugin.fileManager.updateStatus(file, result.actualColumn);
        }
      }

      if (targetColumn === "DONE" || targetColumn === "CLOSED") {
        await plugin.workLogger.logWork(file);
      }
      // Board refreshes automatically via metadataCache "changed" event
    },
    [plugin]
  );

  const handleSync = useCallback(async () => {
    setLoading(true);
    await plugin.syncJira();
    loadCards();
  }, [plugin, loadCards]);

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

  const handleCardClick = useCallback((card: KanbanCard) => {
    setDetailCard(card);
  }, []);

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
        sprint: "",
        sprint_state: "",
        tags: ["jira/source/local"],
        summary: data.summary,
        created: now,
        updated: now,
      };
      await plugin.fileManager.createTaskFile(key, data.summary, frontmatter, "");
      new Notice("Jira Flow: Local task created.");
      loadCards();
    },
    [plugin, loadCards]
  );

  const handleArchive = useCallback(
    async (card: KanbanCard) => {
      const file = plugin.app.vault.getAbstractFileByPath(card.filePath);
      if (!file || !(file instanceof TFile)) return;
      await plugin.fileManager.archiveTask(file);
      new Notice(`Jira Flow: ${card.jiraKey} archived.`);
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
    { id: "sprint", label: "Sprint" },
    { id: "all", label: "All Tasks" },
    { id: "local", label: "Local" },
  ];

  return (
    <div className="jf-flex jf-flex-col jf-h-full jf-bg-transparent">
      {/* Header */}
      <div className="jf-flex jf-items-center jf-justify-between jf-px-4 jf-py-3 jf-border-b jf-border-gray-200">
        <div className="jf-flex jf-items-center jf-gap-3">
          <h2 className="jf-text-xl jf-font-bold jf-m-0">Jira Flow</h2>
          {/* View Mode Tabs */}
          <div className="jf-flex jf-gap-0" style={{ borderRadius: "6px", overflow: "hidden", border: "1px solid var(--background-modifier-border)" }}>
            {viewModes.map((vm) => (
              <button
                key={vm.id}
                onClick={() => setViewMode(vm.id)}
                style={{
                  padding: "4px 12px",
                  fontSize: "12px",
                  fontWeight: viewMode === vm.id ? 600 : 400,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: viewMode === vm.id ? "#0052CC" : "transparent",
                  color: viewMode === vm.id ? "#fff" : "var(--text-muted)",
                }}
              >
                {vm.label}
              </button>
            ))}
          </div>
        </div>
        <div className="jf-flex jf-items-center jf-gap-2">
          <button
            onClick={() => setShowReportCenter(true)}
            className="jf-px-3 jf-py-1.5 jf-rounded jf-text-sm jf-font-medium jf-cursor-pointer"
            style={{
              backgroundColor: "transparent",
              border: "1px solid var(--background-modifier-border)",
              color: "var(--text-normal)",
            }}
          >
            Reports
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="jf-px-3 jf-py-1.5 jf-rounded jf-text-sm jf-font-medium jf-cursor-pointer"
            style={{
              backgroundColor: "transparent",
              border: "1px solid #0052CC",
              color: "#0052CC",
            }}
          >
            + New Task
          </button>
          <button
            onClick={handleSync}
            className="jf-px-4 jf-py-1.5 jf-rounded jf-text-white jf-text-sm jf-font-medium jf-cursor-pointer"
            style={{ backgroundColor: "#0052CC" }}
          >
            Sync Jira
          </button>
        </div>
      </div>

      {/* Board */}
      <Board
        swimlanes={swimlanes}
        collapsedSwimlanes={collapsedSwimlanes}
        onToggleSwimlane={toggleSwimlane}
        onCardMove={handleCardMove}
        onCardClick={handleCardClick}
        onOpenFile={handleOpenFile}
      />

      {/* Detail Side Panel */}
      {detailCard && (
        <TaskDetailPanel
          card={detailCard}
          plugin={plugin}
          onClose={() => setDetailCard(null)}
          onOpenFile={handleOpenFile}
          onArchive={handleArchive}
          onCardUpdated={loadCards}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateTask}
        />
      )}
    </div>
  );
};
