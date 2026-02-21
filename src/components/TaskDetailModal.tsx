import React, { useCallback, useEffect, useState } from "react";
import { KANBAN_COLUMNS, SWIMLANES } from "../types";
import type { KanbanCard } from "../types";
import type JiraFlowPlugin from "../main";
import type { ViewMode } from "./App";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { JiraHtmlRenderer } from "./JiraHtmlRenderer";

// ===== Helpers =====

const priorityColors: Record<string, string> = {
  Highest: "#FF5630",
  High: "#FF7452",
  Medium: "#FFAB00",
  Low: "#36B37E",
  Lowest: "#00875A",
};

const typeColors: Record<string, string> = {
  Bug: "#FF5630",
  Story: "#36B37E",
  Task: "#4C9AFF",
  "Sub-task": "#6554C0",
  Epic: "#FF991F",
};

const typeIcons: Record<string, string> = {
  Bug: "\u{1F41B}",
  Story: "\u{1F4D7}",
  Task: "\u2705",
  "Sub-task": "\u{1F4CE}",
  Epic: "\u26A1",
};

const columnColors: Record<string, string> = {
  FUNNEL: "#6B778C",
  "TO DO": "#0052CC",
  READY: "#0065FF",
  "IN PROGRESS": "#FF991F",
  "IN REVIEW": "#6554C0",
  "CODE REVIEW": "#6554C0",
  TESTING: "#00B8D9",
  DONE: "#36B37E",
  RESOLVED: "#00875A",
  CLOSED: "#505F79",
  EXECUTED: "#403294",
  REJECTED: "#FF5630",
};

interface JiraLink {
  type: string;
  key: string;
  summary: string;
  direction: "inward" | "outward";
}

// ===== Task Detail Side Panel =====

interface TaskDetailPanelProps {
  card: KanbanCard;
  plugin: JiraFlowPlugin;
  viewMode: ViewMode;
  onClose: () => void;
  onOpenFile: (filePath: string) => void;
  onArchive: (card: KanbanCard) => void;
  onDelete: (card: KanbanCard) => void;
  onCardUpdated: () => void;
}

export const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  card, plugin, viewMode, onClose, onOpenFile, onArchive, onDelete, onCardUpdated,
}) => {
  // Trap ESC key to close drawer without closing Obsidian tab
  useEscapeKey(plugin.app, onClose, true);

  const [storyPoints, setStoryPoints] = useState(card.storyPoints);
  const [dueDate, setDueDate] = useState(card.dueDate?.slice(0, 10) || "");
  const [summary, setSummary] = useState(card.summary);
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState<JiraLink[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [localDesc, setLocalDesc] = useState("");
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isLocal = card.source === "LOCAL";
  const isJira = card.source === "JIRA";
  const showSaveToJira = (viewMode === "sprint" || viewMode === "all") && isJira;
  const jiraUrl = plugin.settings.jiraHost
    ? `${plugin.settings.jiraHost}/browse/${card.jiraKey}`
    : "";

  // Track dirty state for Jira save
  const isDirty = storyPoints !== card.storyPoints || dueDate !== (card.dueDate?.slice(0, 10) || "");

  // Fetch full issue details for Jira tasks
  useEffect(() => {
    if (!isJira || !plugin.settings.jiraHost) return;
    (async () => {
      const issue = await plugin.jiraApi.fetchIssue(card.jiraKey);
      if (!issue) return;
      // Description - use rendered HTML if available
      const desc = issue.renderedFields?.description 
        || issue.fields.description 
        || "";
      setDescription(typeof desc === "string" ? desc : "");
      // Links
      const issueLinks = (issue.fields as Record<string, unknown>).issuelinks as Array<{
        type: { name: string; inward: string; outward: string };
        inwardIssue?: { key: string; fields: { summary: string } };
        outwardIssue?: { key: string; fields: { summary: string } };
      }> | undefined;
      if (issueLinks) {
        setLinks(issueLinks.map((l) => {
          if (l.inwardIssue) {
            return { type: l.type.inward, key: l.inwardIssue.key, summary: l.inwardIssue.fields.summary, direction: "inward" as const };
          }
          return { type: l.type.outward, key: l.outwardIssue!.key, summary: l.outwardIssue!.fields.summary, direction: "outward" as const };
        }));
      }
    })();
  }, [card.jiraKey, isJira, plugin]);

  // For local tasks, read description from file body
  useEffect(() => {
    if (!isLocal) return;
    (async () => {
      const file = plugin.app.vault.getAbstractFileByPath(card.filePath);
      if (!file || !(file instanceof (await import("obsidian")).TFile)) return;
      const content = await plugin.app.vault.read(file as import("obsidian").TFile);
      // Strip frontmatter
      const fmEnd = content.indexOf("---", content.indexOf("---") + 3);
      const body = fmEnd > 0 ? content.slice(fmEnd + 3).trim() : "";
      setDescription(body);
      setLocalDesc(body);
    })();
  }, [card.filePath, isLocal, plugin]);

  const handleSaveToJira = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const fields: Record<string, unknown> = {};
      const spField = plugin.settings.storyPointsField;
      const ddField = plugin.settings.dueDateField;
      if (storyPoints !== card.storyPoints) fields[spField] = storyPoints;
      if (dueDate !== (card.dueDate?.slice(0, 10) || "")) fields[ddField] = dueDate || null;

      // Sync to Jira API
      if (isJira && plugin.settings.jiraHost && Object.keys(fields).length > 0) {
        await plugin.jiraApi.updateIssueFields(card.jiraKey, fields);
      }
      // Update local file
      const file = plugin.app.vault.getAbstractFileByPath(card.filePath);
      if (file) {
        await plugin.app.fileManager.processFrontMatter(file as import("obsidian").TFile, (fm) => {
          fm.story_points = storyPoints;
          fm.due_date = dueDate;
        });
      }
      setSaved(true);
      onCardUpdated();
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [card, storyPoints, dueDate, isJira, plugin, onCardUpdated]);

  const handleSaveSummary = useCallback(async () => {
    if (!isLocal) return;
    setEditingSummary(false);
    const file = plugin.app.vault.getAbstractFileByPath(card.filePath);
    if (file) {
      await plugin.app.fileManager.processFrontMatter(file as import("obsidian").TFile, (fm) => {
        fm.summary = summary;
      });
    }
    onCardUpdated();
  }, [summary, isLocal, card, plugin, onCardUpdated]);

  const handleSaveLocalField = useCallback(async (field: string, value: string) => {
    if (!isLocal) return;
    const file = plugin.app.vault.getAbstractFileByPath(card.filePath);
    if (file) {
      await plugin.app.fileManager.processFrontMatter(file as import("obsidian").TFile, (fm) => {
        fm[field] = value;
      });
    }
    onCardUpdated();
  }, [isLocal, card, plugin, onCardUpdated]);

  const handleSaveDescription = useCallback(async () => {
    if (!isLocal) return;
    setEditingDesc(false);
    const file = plugin.app.vault.getAbstractFileByPath(card.filePath);
    if (!file || !(file instanceof (await import("obsidian")).TFile)) return;
    const content = await plugin.app.vault.read(file as import("obsidian").TFile);
    const fmEnd = content.indexOf("---", content.indexOf("---") + 3);
    const newContent = fmEnd > 0
      ? content.slice(0, fmEnd + 3) + "\n" + localDesc
      : content + "\n" + localDesc;
    await plugin.app.vault.modify(file as import("obsidian").TFile, newContent);
    setDescription(localDesc);
  }, [isLocal, localDesc, card, plugin]);

  const handleCopyKey = useCallback(() => {
    navigator.clipboard.writeText(`${card.summary} - ${card.jiraKey}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [card]);

  const pColor = priorityColors[card.priority] || "#6B778C";
  const tColor = typeColors[card.issuetype] || "#4C9AFF";
  const cColor = columnColors[card.mappedColumn] || "#6B778C";
  const isOverdue = card.swimlane === "overdue";
  const canArchive = isLocal && ["EXECUTED", "DONE", "CLOSED"].includes(card.mappedColumn);

  return (
    <>
      {/* Backdrop */}
      <div className="jf-fixed jf-inset-0 jf-z-[9999] jf-bg-black/40 jf-backdrop-blur-sm" onClick={onClose} />
      {/* Side Panel */}
      <div className="jf-fixed jf-top-0 jf-right-0 jf-bottom-0 jf-z-[10000] jf-w-[480px] jf-max-w-[90vw] jf-bg-white jf-shadow-2xl jf-flex jf-flex-col"
        style={{ animation: "jf-slide-in 0.2s ease-out" }}>
        
        {/* Header */}
        <div className="jf-flex jf-items-center jf-justify-between jf-px-5 jf-py-4 jf-border-b jf-border-gray-100">
          <div className="jf-flex jf-items-center jf-gap-2">
            <span className="jf-text-sm">{typeIcons[card.issuetype] || "\u{1F4CB}"}</span>
            {jiraUrl ? (
              <a href={jiraUrl} className="jf-font-mono jf-text-sm jf-font-semibold jf-text-blue-600 hover:jf-underline"
                title="Open in Jira"
                onClick={(e) => { e.preventDefault(); window.open(jiraUrl); }}>
                {card.jiraKey}
              </a>
            ) : (
              <span className="jf-font-mono jf-text-sm jf-font-semibold jf-text-blue-600">{card.jiraKey}</span>
            )}
            <button onClick={handleCopyKey} title="复制任务信息" 
              className={`jf-text-xs jf-px-2 jf-py-1 jf-rounded jf-border jf-transition-colors ${copied ? "jf-bg-green-50 jf-text-green-600 jf-border-green-200" : "jf-bg-white jf-text-blue-600 jf-border-blue-200 hover:jf-bg-blue-50"}`}>
              {copied ? "已复制" : "复制"}
            </button>
            {isLocal && <span className="jf-text-[10px] jf-px-1.5 jf-py-0.5 jf-rounded jf-bg-gray-200 jf-text-gray-500">LOCAL</span>}
          </div>
          <button onClick={onClose} className="jf-text-gray-400 hover:jf-text-gray-600 jf-p-1 jf-rounded jf-hover:bg-gray-100">
            <svg className="jf-w-5 jf-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="jf-flex-1 jf-overflow-y-auto jf-p-5">
          {/* Summary */}
          <div className="jf-mb-5">
            {editingSummary && isLocal ? (
              <input value={summary} onChange={(e) => setSummary(e.target.value)}
                onBlur={handleSaveSummary} onKeyDown={(e) => e.key === "Enter" && handleSaveSummary()}
                autoFocus className="jf-w-full jf-px-3 jf-py-2 jf-border jf-border-gray-300 jf-rounded-lg jf-text-base jf-font-semibold focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500" />
            ) : (
              <h3 className="jf-text-base jf-font-semibold jf-text-gray-800 jf-leading-snug jf-cursor-pointer"
                onClick={() => isLocal && setEditingSummary(true)}>
                {card.summary}
              </h3>
            )}
          </div>

          {/* Badge Row */}
          <div className="jf-flex jf-flex-wrap jf-gap-2 jf-mb-5">
            <Badge text={card.issuetype} color={tColor} />
            <Badge text={card.priority} color={pColor} dot />
            <Badge text={card.mappedColumn} color={cColor} />
            {card.sprint && <Badge text={card.sprint} color="#006644" bgColor="#E3FCEF" />}
          </div>

          {/* Metadata Grid */}
          <div className="jf-grid jf-grid-cols-2 jf-gap-0 jf-border jf-border-gray-200 jf-rounded-lg jf-overflow-hidden jf-mb-5">
            <MetaCell label="Status" value={card.mappedColumn} valueColor={cColor} />
            <MetaCell label="Assignee" value={card.assignee || "-"} />
            <MetaCell label="Type" value={card.issuetype} />
            <MetaCell label="Priority" value={card.priority} valueColor={pColor} />
            <MetaCell label="Source" value={card.source} />
            <MetaCell label="Swimlane" value={
              card.swimlane === "overdue" ? "OVERDUE" : card.swimlane === "onSchedule" ? "ON SCHEDULE" : "OTHERS"
            } valueColor={isOverdue ? "#FF5630" : undefined} />
          </div>

          {/* Editable Fields */}
          <div className="jf-grid jf-grid-cols-2 jf-gap-4 jf-mb-5">
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase">Story Points</label>
              <input type="number" min={0} value={storyPoints}
                onChange={(e) => setStoryPoints(Number(e.target.value))}
                className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500"
                disabled={saving} />
            </div>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase">Due Date</label>
              <input type="date" value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500 ${isOverdue ? "jf-text-red-500" : ""}`}
                disabled={saving} />
            </div>
          </div>

          {/* Local-only editable fields */}
          {isLocal && (
            <div className="jf-grid jf-grid-cols-2 jf-gap-4 jf-mb-5">
              <div>
                <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase">Type</label>
                <select value={card.issuetype} onChange={(e) => handleSaveLocalField("issuetype", e.target.value)} 
                  className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500">
                  {["Task", "Bug", "Story", "Sub-task", "Epic"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase">Priority</label>
                <select value={card.priority} onChange={(e) => handleSaveLocalField("priority", e.target.value)} 
                  className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500">
                  {["Highest", "High", "Medium", "Low", "Lowest"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="jf-mb-5">
            <div className="jf-flex jf-items-center jf-justify-between jf-mb-2">
              <label className="jf-text-xs jf-font-medium jf-text-gray-500 jf-uppercase">Description</label>
              {isLocal && !editingDesc && (
                <button onClick={() => { setEditingDesc(true); setLocalDesc(description); }} 
                  className="jf-text-xs jf-text-blue-600 hover:jf-text-blue-700 jf-font-medium">Edit</button>
              )}
            </div>
            {editingDesc && isLocal ? (
              <div>
                <textarea value={localDesc} onChange={(e) => setLocalDesc(e.target.value)}
                  rows={6} className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500 jf-resize-vertical" />
                <div className="jf-flex jf-gap-2 jf-mt-2">
                  <button onClick={handleSaveDescription} 
                    className="jf-px-3 jf-py-1.5 jf-bg-blue-600 jf-text-white jf-text-xs jf-font-medium jf-rounded-lg hover:jf-bg-blue-700">Save</button>
                  <button onClick={() => setEditingDesc(false)} 
                    className="jf-px-3 jf-py-1.5 jf-text-gray-600 jf-text-xs jf-font-medium jf-rounded-lg hover:jf-bg-gray-100">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="jf-text-sm jf-leading-relaxed jf-p-3 jf-bg-gray-50 jf-rounded-lg jf-min-h-[80px]">
                {isJira && description ? (
                  <JiraHtmlRenderer html={description} plugin={plugin} />
                ) : (
                  <span className="jf-whitespace-pre-wrap">{description || <span className="jf-text-gray-400">No description</span>}</span>
                )}
              </div>
            )}
          </div>

          {/* Linked Issues (Jira only) */}
          {isJira && links.length > 0 && (
            <div className="jf-mb-5">
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-2 jf-uppercase">Linked Issues</label>
              <div className="jf-flex jf-flex-col jf-gap-2">
                {links.map((link, i) => (
                  <div key={i} className="jf-flex jf-items-center jf-gap-2 jf-p-2.5 jf-bg-gray-50 jf-rounded-lg jf-text-sm">
                    <span className="jf-text-xs jf-text-gray-400 jf-shrink-0">{link.type}</span>
                    <a href={`${plugin.settings.jiraHost}/browse/${link.key}`}
                      onClick={(e) => { e.preventDefault(); window.open(`${plugin.settings.jiraHost}/browse/${link.key}`); }}
                      className="jf-font-mono jf-text-xs jf-font-semibold jf-text-blue-600 hover:jf-underline jf-shrink-0">
                      {link.key}
                    </a>
                    <span className="jf-truncate jf-text-gray-700">{link.summary}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {card.tags.length > 0 && (
            <div className="jf-mb-5">
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-2 jf-uppercase">Tags</label>
              <div className="jf-flex jf-flex-wrap jf-gap-2">
                {card.tags.map((tag) => (
                  <span key={tag} className="jf-text-[10px] jf-px-2 jf-py-1 jf-rounded jf-bg-gray-100 jf-text-gray-500">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="jf-flex jf-items-center jf-justify-between jf-px-5 jf-py-4 jf-border-t jf-border-gray-100 jf-bg-gray-50/50">
          <div className="jf-flex jf-gap-2">
            {canArchive && (
              <button onClick={() => onArchive(card)} 
                className="jf-px-3 jf-py-2 jf-text-sm jf-font-medium jf-text-red-600 hover:jf-bg-red-50 jf-rounded-lg jf-transition-colors">
                Archive
              </button>
            )}
            {isLocal && (
              <button onClick={() => setShowDeleteConfirm(true)} 
                className="jf-px-3 jf-py-2 jf-text-sm jf-font-medium jf-text-red-600 hover:jf-bg-red-50 jf-rounded-lg jf-transition-colors">
                Delete
              </button>
            )}
          </div>
          <div className="jf-flex jf-items-center jf-gap-3">
            {saved && <span className="jf-text-xs jf-text-green-600 jf-font-medium">已保存</span>}
            {showSaveToJira && isDirty && (
              <button onClick={handleSaveToJira} disabled={saving} 
                className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-white jf-bg-green-600 hover:jf-bg-green-700 jf-rounded-lg jf-transition-colors disabled:jf-opacity-60">
                {saving ? "Saving..." : "Save to Jira"}
              </button>
            )}
            <button onClick={() => { onOpenFile(card.filePath); onClose(); }} 
              className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-white jf-bg-blue-600 hover:jf-bg-blue-700 jf-rounded-lg jf-transition-colors">
              Open File
            </button>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <>
            <div className="jf-fixed jf-inset-0 jf-z-[10001] jf-bg-black/30" onClick={() => setShowDeleteConfirm(false)} />
            <div className="jf-fixed jf-top-1/2 jf-left-1/2 jf-transform -jf-translate-x-1/2 -jf-translate-y-1/2 jf-z-[10002] jf-w-[360px] jf-max-w-[90vw] jf-bg-white jf-rounded-xl jf-shadow-2xl jf-p-6">
              <h3 className="jf-text-base jf-font-semibold jf-mb-3">Confirm Delete</h3>
              <p className="jf-text-sm jf-text-gray-500 jf-mb-5">
                Are you sure you want to delete <strong>{card.jiraKey}</strong>? This will permanently remove the task and its markdown file.
              </p>
              <div className="jf-flex jf-justify-end jf-gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} 
                  className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-gray-600 hover:jf-bg-gray-100 jf-rounded-lg">Cancel</button>
                <button onClick={() => { setShowDeleteConfirm(false); onDelete(card); }} 
                  className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-white jf-bg-red-600 hover:jf-bg-red-700 jf-rounded-lg">Delete</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

// ===== Sub-components =====

const Badge: React.FC<{ text: string; color: string; bgColor?: string; dot?: boolean }> = ({ text, color, bgColor, dot }) => (
  <span className="jf-inline-flex jf-items-center jf-gap-1 jf-text-[11px] jf-px-2 jf-py-0.5 jf-rounded-full jf-font-semibold"
    style={{ backgroundColor: bgColor || `${color}18`, color }}>
    {dot && <span className="jf-w-1.5 jf-h-1.5 jf-rounded-full" style={{ backgroundColor: color }} />}
    {text}
  </span>
);

const MetaCell: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div className="jf-p-3 jf-border-b jf-border-r jf-border-gray-100">
    <div className="jf-text-[10px] jf-font-semibold jf-text-gray-400 jf-uppercase jf-tracking-wide jf-mb-1">{label}</div>
    <div className="jf-text-sm jf-font-medium" style={{ color: valueColor || "#374151" }}>{value}</div>
  </div>
);

// ===== Create Task Modal =====

export interface CreateTaskData {
  summary: string;
  issuetype: string;
  priority: string;
  mappedColumn: string;
  storyPoints: number;
  dueDate: string;
  assignee: string;
}

interface CreateTaskModalProps {
  plugin: JiraFlowPlugin;
  onClose: () => void;
  onSave: (data: CreateTaskData) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ plugin, onClose, onSave }) => {
  // Trap ESC key to close modal without closing Obsidian tab
  useEscapeKey(plugin.app, onClose, true);

  const [summary, setSummary] = useState("");
  const [issuetype, setIssuetype] = useState("Task");
  const [priority, setPriority] = useState("Medium");
  const [mappedColumn, setMappedColumn] = useState("TO DO");
  const [storyPoints, setStoryPoints] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState("");

  const handleSave = useCallback(() => {
    if (!summary.trim()) return;
    onSave({
      summary: summary.trim(),
      issuetype,
      priority,
      mappedColumn,
      storyPoints,
      dueDate,
      assignee,
    });
    onClose();
  }, [summary, issuetype, priority, mappedColumn, storyPoints, dueDate, assignee, onSave, onClose]);

  return (
    <>
      {/* Overlay */}
      <div className="jf-fixed jf-inset-0 jf-bg-black/40 jf-backdrop-blur-sm jf-z-50 jf-flex jf-items-center jf-justify-center" onClick={onClose} />
      
      {/* Modal */}
      <div className="jf-fixed jf-top-1/2 jf-left-1/2 jf-transform -jf-translate-x-1/2 -jf-translate-y-1/2 jf-z-50 jf-w-full jf-max-w-lg jf-bg-white jf-rounded-xl jf-shadow-2xl jf-border jf-border-gray-100 jf-overflow-hidden">
        
        {/* Header */}
        <div className="jf-px-6 jf-py-4 jf-border-b jf-border-gray-100 jf-bg-gray-50/50 jf-flex jf-justify-between jf-items-center">
          <h3 className="jf-text-lg jf-font-semibold jf-text-gray-800">Create Local Task</h3>
          <button onClick={onClose} className="jf-text-gray-400 hover:jf-text-gray-600 jf-transition-colors">
            <svg className="jf-w-5 jf-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="jf-p-6 jf-space-y-4">
          {/* Summary - Full width */}
          <div>
            <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">Summary</label>
            <input 
              value={summary} 
              onChange={(e) => setSummary(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus 
              placeholder="What needs to be done?"
              className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500 jf-transition-all" 
            />
          </div>

          {/* Row 2: Type & Priority */}
          <div className="jf-grid jf-grid-cols-2 jf-gap-4">
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">Type</label>
              <select 
                value={issuetype} 
                onChange={(e) => setIssuetype(e.target.value)} 
                className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500 jf-transition-all">
                {["Task", "Bug", "Story", "Sub-task", "Epic"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">Priority</label>
              <select 
                value={priority} 
                onChange={(e) => setPriority(e.target.value)} 
                className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500 jf-transition-all">
                {["Highest", "High", "Medium", "Low", "Lowest"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Row 3: Column & Story Points */}
          <div className="jf-grid jf-grid-cols-2 jf-gap-4">
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">Status</label>
              <select 
                value={mappedColumn} 
                onChange={(e) => setMappedColumn(e.target.value)} 
                className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500 jf-transition-all">
                {KANBAN_COLUMNS.map((col) => <option key={col.id} value={col.id}>{col.label}</option>)}
              </select>
            </div>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">Story Points</label>
              <input 
                type="number" 
                min={0} 
                value={storyPoints}
                onChange={(e) => setStoryPoints(Number(e.target.value))} 
                className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500 jf-transition-all" 
              />
            </div>
          </div>

          {/* Row 4: Due Date & Assignee */}
          <div className="jf-grid jf-grid-cols-2 jf-gap-4">
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">Due Date</label>
              <input 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)} 
                className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500 jf-transition-all" 
              />
            </div>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">Assignee</label>
              <input 
                value={assignee} 
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Username"
                className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500 jf-transition-all" 
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="jf-px-6 jf-py-4 jf-bg-gray-50 jf-flex jf-justify-end jf-gap-3">
          <button 
            onClick={onClose} 
            className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-gray-600 hover:jf-bg-gray-100 jf-rounded-lg jf-transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={!summary.trim()} 
            className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-white jf-bg-blue-600 hover:jf-bg-blue-700 jf-shadow-sm jf-rounded-lg jf-transition-all disabled:jf-opacity-50 disabled:jf-cursor-not-allowed">
            Create Task
          </button>
        </div>
      </div>
    </>
  );
};
