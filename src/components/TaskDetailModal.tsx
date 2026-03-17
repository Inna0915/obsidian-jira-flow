import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TFile } from "obsidian";
import { KANBAN_COLUMNS, SWIMLANES } from "../types";
import type { JiraAttachment, KanbanCard } from "../types";
import type JiraFlowPlugin from "../main";
import type { JiraCreateIssueMeta, JiraCreateIssueInput } from "../api/jira";
import type { ViewMode } from "./App";
import { useEscapeKey } from "../hooks/useEscapeKey";
import { JiraHtmlRenderer } from "./JiraHtmlRenderer";
import { IssuePreviewModal } from "./IssuePreviewModal";
import { JiraAuthImage } from "./JiraAuthImage";

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
  Personal: "#F59E0B",
  "Sub-task": "#6554C0",
  Epic: "#FF991F",
};

const typeIcons: Record<string, string> = {
  Bug: "\u{1F41B}",
  Story: "\u{1F4D7}",
  Task: "\u2705",
  Personal: "\u{1F464}",
  "Sub-task": "\u{1F4CE}",
  Epic: "\u26A1",
};

const LOCAL_TASK_TYPES = ["Personal", "Task", "Bug", "Story", "Sub-task", "Epic"];
const fieldClassName = "jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500 jf-transition-all";
const fieldStyle: React.CSSProperties = { minHeight: "44px", lineHeight: 1.5, boxSizing: "border-box" };

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

const IMAGE_MIME_PREFIX = "image/";
const IMAGE_FILE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg"];

function isImageAttachment(attachment: JiraAttachment): boolean {
  if (attachment.mimeType?.toLowerCase().startsWith(IMAGE_MIME_PREFIX)) {
    return true;
  }

  const filename = attachment.filename.toLowerCase();
  return IMAGE_FILE_EXTENSIONS.some((extension) => filename.endsWith(extension));
}

function formatAttachmentSize(size?: number): string {
  if (!size || size <= 0) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [previewIssueKey, setPreviewIssueKey] = useState<string | null>(null);
  const [imageAttachments, setImageAttachments] = useState<JiraAttachment[]>([]);
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState(0);

  const isLocal = card.source === "LOCAL";
  const isJira = card.source === "JIRA";
  const showSaveToJira = (viewMode === "sprint" || viewMode === "all") && isJira;
  const jiraUrl = plugin.settings.jiraHost
    ? `${plugin.settings.jiraHost}/browse/${card.jiraKey}`
    : "";

  // Track dirty state for Jira save
  const isDirty = storyPoints !== card.storyPoints || dueDate !== (card.dueDate?.slice(0, 10) || "");
  const selectedAttachment = imageAttachments[selectedAttachmentIndex] || null;
  const attachmentHint = useMemo(() => {
    if (imageAttachments.length <= 1) {
      return "";
    }

    return `第 ${selectedAttachmentIndex + 1} / ${imageAttachments.length} 张，可用左右方向键切换`;
  }, [imageAttachments.length, selectedAttachmentIndex]);

  // Fetch full issue details for Jira tasks
  useEffect(() => {
    if (!isJira || !plugin.settings.jiraHost) return;
    (async () => {
      const issue = await plugin.jiraApi.fetchIssue(card.jiraKey);
      if (!issue) return;
      
      const rawDesc = issue.renderedFields?.description 
        || issue.fields.description 
        || "";

      // CRITICAL FIX: We MUST process the description just like we do in sync!
      // This converts Wiki images and ensures we use local downloaded assets instead of hitting cert errors.
      const processedDesc = await plugin.fileManager.processDescription(rawDesc, issue.key);
      
      setDescription(processedDesc);
      const nextImageAttachments = (issue.fields.attachment || []).filter(isImageAttachment);
      setImageAttachments(nextImageAttachments);
      setSelectedAttachmentIndex(0);
      
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

  useEffect(() => {
    if (!isJira) {
      setImageAttachments([]);
      setSelectedAttachmentIndex(0);
    }
  }, [isJira]);

  useEffect(() => {
    if (imageAttachments.length === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (previewIssueKey || showEditModal || showDeleteConfirm) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSelectedAttachmentIndex((current) => (current - 1 + imageAttachments.length) % imageAttachments.length);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setSelectedAttachmentIndex((current) => (current + 1) % imageAttachments.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imageAttachments.length, previewIssueKey, showDeleteConfirm, showEditModal]);

  // For local tasks, read description from file body
  useEffect(() => {
    if (!isLocal) return;
    (async () => {
      const file = plugin.app.vault.getAbstractFileByPath(card.filePath);
      if (!file || !(file instanceof TFile)) return;
      const content = await plugin.app.vault.read(file as TFile);
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
        await plugin.app.fileManager.processFrontMatter(file as TFile, (fm) => {
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
      await plugin.app.fileManager.processFrontMatter(file as TFile, (fm) => {
        fm.summary = summary;
      });
    }
    onCardUpdated();
  }, [summary, isLocal, card, plugin, onCardUpdated]);

  const handleSaveLocalField = useCallback(async (field: string, value: string) => {
    if (!isLocal) return;
    const file = plugin.app.vault.getAbstractFileByPath(card.filePath);
    if (file) {
      await plugin.app.fileManager.processFrontMatter(file as TFile, (fm) => {
        fm[field] = value;
      });
    }
    onCardUpdated();
  }, [isLocal, card, plugin, onCardUpdated]);

  const handleSaveDescription = useCallback(async () => {
    if (!isLocal) return;
    setEditingDesc(false);
    const file = plugin.app.vault.getAbstractFileByPath(card.filePath);
    if (!file || !(file instanceof TFile)) return;
    const content = await plugin.app.vault.read(file as TFile);
    const fmEnd = content.indexOf("---", content.indexOf("---") + 3);
    const newContent = fmEnd > 0
      ? content.slice(0, fmEnd + 3) + "\n" + localDesc
      : content + "\n" + localDesc;
    await plugin.app.vault.modify(file as TFile, newContent);
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
      <div className="jf-fixed jf-top-0 jf-right-0 jf-bottom-0 jf-z-[10000] jf-w-[960px] jf-max-w-[90vw] jf-bg-white jf-shadow-2xl jf-flex jf-flex-col"
        style={{ animation: "jf-slide-in 0.2s ease-out" }}>
        
        {/* Header */}
        <div className="jf-flex jf-items-center jf-justify-between jf-px-5 jf-py-4 jf-border-b jf-border-gray-100">
          <div className="jf-flex jf-items-center jf-gap-2">
            <span className="jf-text-sm">{typeIcons[card.issuetype] || "\u{1F4CB}"}</span>
            {jiraUrl ? (
              <a href={jiraUrl} className="jf-font-mono jf-text-sm jf-font-semibold jf-text-blue-600 hover:jf-underline"
                title="在 Jira 中打开"
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
            <MetaCell label="状态" value={card.mappedColumn} valueColor={cColor} />
            <MetaCell label="负责人" value={card.assignee || "-"} />
            <MetaCell label="类型" value={card.issuetype} />
            <MetaCell label="优先级" value={card.priority} valueColor={pColor} />
            <MetaCell label="来源" value={card.source} />
            <MetaCell label="泳道" value={
              card.swimlane === "overdue" ? "已逾期" : card.swimlane === "onSchedule" ? "按时" : "其他"
            } valueColor={isOverdue ? "#FF5630" : undefined} />
          </div>

          {/* Editable Fields */}
          <div className="jf-grid jf-grid-cols-2 jf-gap-4 jf-mb-5">
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase">故事点</label>
              <input type="number" min={0} value={storyPoints}
                onChange={(e) => setStoryPoints(Number(e.target.value))}
                className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500"
                disabled={saving} />
            </div>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase">截止日期</label>
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
                <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase">类型</label>
                <select value={card.issuetype} onChange={(e) => handleSaveLocalField("issuetype", e.target.value)} 
                  className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500">
                  {["Task", "Bug", "Story", "Sub-task", "Epic"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase">优先级</label>
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
              <label className="jf-text-xs jf-font-medium jf-text-gray-500 jf-uppercase">描述</label>
              {isLocal && !editingDesc && (
                <button onClick={() => { setEditingDesc(true); setLocalDesc(description); }} 
                  className="jf-text-xs jf-text-blue-600 hover:jf-text-blue-700 jf-font-medium">编辑</button>
              )}
            </div>
            {editingDesc && isLocal ? (
              <div>
                <textarea value={localDesc} onChange={(e) => setLocalDesc(e.target.value)}
                  rows={6} className="jf-w-full jf-px-3 jf-py-2 jf-bg-white jf-border jf-border-gray-300 jf-rounded-lg jf-text-sm focus:jf-outline-none focus:jf-ring-2 focus:jf-ring-blue-500/20 focus:jf-border-blue-500 jf-resize-vertical" />
                <div className="jf-flex jf-gap-2 jf-mt-2">
                  <button onClick={handleSaveDescription} 
                    className="jf-px-3 jf-py-1.5 jf-bg-blue-600 jf-text-white jf-text-xs jf-font-medium jf-rounded-lg hover:jf-bg-blue-700">保存</button>
                  <button onClick={() => setEditingDesc(false)} 
                    className="jf-px-3 jf-py-1.5 jf-text-gray-600 jf-text-xs jf-font-medium jf-rounded-lg hover:jf-bg-gray-100">取消</button>
                </div>
              </div>
            ) : (
              <div className="jf-text-sm jf-leading-relaxed jf-p-3 jf-bg-gray-50 jf-rounded-lg jf-min-h-[80px]">
                {isJira && description ? (
                  <JiraHtmlRenderer html={description} plugin={plugin} />
                ) : (
                  <span className="jf-whitespace-pre-wrap">{description || <span className="jf-text-gray-400">暂无描述</span>}</span>
                )}
              </div>
            )}
          </div>

          {isJira && imageAttachments.length > 0 && (
            <div className="jf-mb-5">
              <div className="jf-flex jf-items-center jf-justify-between jf-mb-2">
                <label className="jf-text-xs jf-font-medium jf-text-gray-500 jf-uppercase">附件</label>
                {attachmentHint && <span className="jf-text-[11px] jf-text-gray-400">{attachmentHint}</span>}
              </div>
              <div className="jf-rounded-xl jf-border jf-border-gray-200 jf-bg-gray-50 jf-p-3">
                {selectedAttachment && (
                  <div className="jf-mb-3 jf-rounded-xl jf-border jf-border-gray-200 jf-bg-white jf-p-3">
                    <div className="jf-flex jf-items-center jf-justify-between jf-gap-3 jf-mb-3">
                      <div className="jf-min-w-0">
                        <div className="jf-text-sm jf-font-medium jf-text-gray-800 jf-truncate">{selectedAttachment.filename}</div>
                        <div className="jf-text-[11px] jf-text-gray-400">
                          {[selectedAttachment.mimeType || "图片", formatAttachmentSize(selectedAttachment.size)].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      {imageAttachments.length > 1 && (
                        <div className="jf-flex jf-items-center jf-gap-2 jf-shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedAttachmentIndex((current) => (current - 1 + imageAttachments.length) % imageAttachments.length)}
                            className="jf-rounded-lg jf-border jf-border-gray-200 jf-bg-white jf-px-2.5 jf-py-1.5 jf-text-xs jf-font-medium jf-text-gray-600 hover:jf-bg-gray-100"
                          >
                            上一张
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedAttachmentIndex((current) => (current + 1) % imageAttachments.length)}
                            className="jf-rounded-lg jf-border jf-border-gray-200 jf-bg-white jf-px-2.5 jf-py-1.5 jf-text-xs jf-font-medium jf-text-gray-600 hover:jf-bg-gray-100"
                          >
                            下一张
                          </button>
                        </div>
                      )}
                    </div>
                    <JiraAuthImage
                      src={selectedAttachment.content}
                      alt={selectedAttachment.filename}
                      plugin={plugin}
                      containerClassName="jf-my-0"
                      className="jf-w-full"
                      hideZoomButton={imageAttachments.length > 1}
                      maxHeight={360}
                      preserveWhileLoading
                    />
                  </div>
                )}
                <div className="jf-flex jf-gap-2 jf-overflow-x-auto jf-pb-1">
                  {imageAttachments.map((attachment, index) => {
                    const isActive = index === selectedAttachmentIndex;
                    return (
                      <button
                        key={attachment.id || `${attachment.filename}-${index}`}
                        type="button"
                        onClick={() => setSelectedAttachmentIndex(index)}
                        className={`jf-group jf-shrink-0 jf-w-28 jf-rounded-xl jf-border jf-bg-white jf-p-1.5 jf-text-left jf-transition-all ${isActive ? "jf-border-blue-500 jf-shadow-sm" : "jf-border-gray-200 hover:jf-border-gray-300"}`}
                      >
                        <JiraAuthImage
                          src={attachment.thumbnail || attachment.content}
                          alt={attachment.filename}
                          plugin={plugin}
                          interactive={false}
                          containerClassName="jf-my-0"
                          frameClassName="jf-block jf-w-full jf-overflow-hidden jf-rounded-lg jf-bg-gray-100"
                          placeholderClassName="jf-h-16 jf-w-full jf-animate-pulse jf-rounded-lg jf-bg-gray-200 jf-flex jf-items-center jf-justify-center jf-text-[10px] jf-text-gray-400"
                          className="jf-block jf-h-16 jf-w-full"
                          maxHeight={64}
                          preserveWhileLoading
                        />
                        <div className="jf-mt-1 jf-px-1">
                          <div className="jf-text-[10px] jf-font-medium jf-text-gray-700 jf-leading-tight jf-truncate" title={attachment.filename}>{`附件 ${index + 1}`}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Linked Issues (Jira only) */}
          {isJira && links.length > 0 && (
            <div className="jf-mb-5">
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-2 jf-uppercase">关联任务</label>
              <div className="jf-flex jf-flex-col jf-gap-2">
                {links.map((link, i) => (
                  <div key={i} className="jf-flex jf-items-center jf-gap-2 jf-p-2.5 jf-bg-gray-50 jf-rounded-lg jf-text-sm jf-cursor-pointer hover:jf-bg-gray-100 jf-transition-colors"
                    onClick={() => setPreviewIssueKey(link.key)}>
                    <span className="jf-text-xs jf-text-gray-400 jf-shrink-0">{link.type}</span>
                    <span className="jf-font-mono jf-text-xs jf-font-semibold jf-text-blue-600 hover:jf-underline jf-shrink-0">
                      {link.key}
                    </span>
                    <span className="jf-truncate jf-text-gray-700">{link.summary}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {card.tags.length > 0 && (
            <div className="jf-mb-5">
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-2 jf-uppercase">标签</label>
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
                归档
              </button>
            )}
            {isLocal && (
              <>
                <button onClick={() => setShowEditModal(true)} 
                  className="jf-px-3 jf-py-2 jf-text-sm jf-font-medium jf-text-blue-600 hover:jf-bg-blue-50 jf-rounded-lg jf-transition-colors">
                  编辑
                </button>
                <button onClick={() => setShowDeleteConfirm(true)} 
                  className="jf-px-3 jf-py-2 jf-text-sm jf-font-medium jf-text-red-600 hover:jf-bg-red-50 jf-rounded-lg jf-transition-colors">
                  删除
                </button>
              </>
            )}
          </div>
          <div className="jf-flex jf-items-center jf-gap-3">
            {saved && <span className="jf-text-xs jf-text-green-600 jf-font-medium">已保存</span>}
            {showSaveToJira && isDirty && (
              <button onClick={handleSaveToJira} disabled={saving} 
                className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-white jf-bg-green-600 hover:jf-bg-green-700 jf-rounded-lg jf-transition-colors disabled:jf-opacity-60">
                {saving ? "保存中..." : "保存到 Jira"}
              </button>
            )}
            <button onClick={() => { onOpenFile(card.filePath); onClose(); }} 
              className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-white jf-bg-blue-600 hover:jf-bg-blue-700 jf-rounded-lg jf-transition-colors">
              打开文件
            </button>
          </div>
        </div>

        {/* Edit Task Modal */}
        {showEditModal && isLocal && (
          <EditTaskModal
            plugin={plugin}
            task={{
              key: card.jiraKey,
              summary: card.summary,
              issuetype: card.issuetype,
              priority: card.priority,
              mappedColumn: card.mappedColumn,
              storyPoints: card.storyPoints,
              dueDate: card.dueDate?.slice(0, 10) || "",
              assignee: card.assignee,
            }}
            onClose={() => setShowEditModal(false)}
            onSave={async (data) => {
              const file = plugin.app.vault.getAbstractFileByPath(card.filePath);
              if (file && file instanceof TFile) {
                await plugin.app.fileManager.processFrontMatter(file, (fm) => {
                  fm.summary = data.summary;
                  fm.issuetype = data.issuetype;
                  fm.priority = data.priority;
                  fm.mapped_column = data.mappedColumn;
                  fm.status = data.mappedColumn;
                  fm.story_points = data.storyPoints;
                  fm.due_date = data.dueDate;
                  fm.assignee = data.assignee;
                });
                new Notice(`任务 ${data.key} 已更新`);
                onCardUpdated();
              }
              setShowEditModal(false);
            }}
          />
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <>
            <div className="jf-fixed jf-inset-0 jf-z-[10001] jf-bg-black/30" onClick={() => setShowDeleteConfirm(false)} />
            <div className="jf-fixed jf-top-1/2 jf-left-1/2 jf-transform -jf-translate-x-1/2 -jf-translate-y-1/2 jf-z-[10002] jf-w-[360px] jf-max-w-[90vw] jf-bg-white jf-rounded-xl jf-shadow-2xl jf-p-6">
              <h3 className="jf-text-base jf-font-semibold jf-mb-3">确认删除</h3>
              <p className="jf-text-sm jf-text-gray-500 jf-mb-5">
                确定要删除 <strong>{card.jiraKey}</strong> 吗？这将永久删除该任务及其 Markdown 文件。
              </p>
              <div className="jf-flex jf-justify-end jf-gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} 
                  className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-gray-600 hover:jf-bg-gray-100 jf-rounded-lg">取消</button>
                <button onClick={() => { setShowDeleteConfirm(false); onDelete(card); }} 
                  className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-white jf-bg-red-600 hover:jf-bg-red-700 jf-rounded-lg">删除</button>
              </div>
            </div>
          </>
        )}

        {/* Issue Preview Modal */}
        {previewIssueKey && (
          <IssuePreviewModal 
            issueKey={previewIssueKey} 
            plugin={plugin} 
            onClose={() => setPreviewIssueKey(null)} 
          />
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
  const [issuetype, setIssuetype] = useState("Personal");
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
      <div className="jf-fixed jf-top-1/2 jf-left-1/2 jf-transform -jf-translate-x-1/2 -jf-translate-y-1/2 jf-z-50 jf-w-full jf-max-w-2xl jf-bg-white jf-rounded-xl jf-shadow-2xl jf-border jf-border-gray-100 jf-overflow-hidden">
        
        {/* Header */}
        <div className="jf-px-6 jf-py-4 jf-border-b jf-border-gray-100 jf-bg-gray-50/50 jf-flex jf-justify-between jf-items-center">
          <h3 className="jf-text-lg jf-font-semibold jf-text-gray-800">创建本地任务</h3>
          <button onClick={onClose} className="jf-text-gray-400 hover:jf-text-gray-600 jf-transition-colors">
            <svg className="jf-w-5 jf-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="jf-p-6 jf-space-y-4" style={{ maxHeight: "min(70vh, 720px)", overflowY: "auto" }}>
          {/* Summary - Full width */}
          <div>
            <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">摘要</label>
            <input 
              value={summary} 
              onChange={(e) => setSummary(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus 
              placeholder="需要做什么？"
              className={fieldClassName}
              style={fieldStyle}
            />
          </div>

          {/* Row 2: Type & Priority */}
          <div className="jf-grid jf-grid-cols-2 jf-gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">类型</label>
              <select 
                value={issuetype} 
                onChange={(e) => setIssuetype(e.target.value)} 
                className={fieldClassName}
                style={fieldStyle}>
                {LOCAL_TASK_TYPES.map((t) => <option key={t} value={t}>{t === "Personal" ? "个人任务" : t}</option>)}
              </select>
            </div>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">优先级</label>
              <select 
                value={priority} 
                onChange={(e) => setPriority(e.target.value)} 
                className={fieldClassName}
                style={fieldStyle}>
                {["Highest", "High", "Medium", "Low", "Lowest"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Row 3: Column & Story Points */}
          <div className="jf-grid jf-grid-cols-2 jf-gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">状态</label>
              <select 
                value={mappedColumn} 
                onChange={(e) => setMappedColumn(e.target.value)} 
                className={fieldClassName}
                style={fieldStyle}>
                {KANBAN_COLUMNS.map((col) => <option key={col.id} value={col.id}>{col.label}</option>)}
              </select>
            </div>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">故事点</label>
              <input 
                type="number" 
                min={0} 
                value={storyPoints}
                onChange={(e) => setStoryPoints(Number(e.target.value))} 
                className={fieldClassName}
                style={fieldStyle}
              />
            </div>
          </div>

          {/* Row 4: Due Date & Assignee */}
          <div className="jf-grid jf-grid-cols-2 jf-gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">截止日期</label>
              <input 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)} 
                className={fieldClassName}
                style={fieldStyle}
              />
            </div>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">负责人</label>
              <input 
                value={assignee} 
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="用户名"
                className={fieldClassName}
                style={fieldStyle}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="jf-px-6 jf-py-4 jf-bg-gray-50 jf-flex jf-justify-end jf-gap-3">
          <button 
            onClick={onClose} 
            className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-gray-600 hover:jf-bg-gray-100 jf-rounded-lg jf-transition-colors">
            取消
          </button>
          <button 
            onClick={handleSave} 
            disabled={!summary.trim()} 
            className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-white jf-bg-blue-600 hover:jf-bg-blue-700 jf-shadow-sm jf-rounded-lg jf-transition-all disabled:jf-opacity-50 disabled:jf-cursor-not-allowed">
            创建任务
          </button>
        </div>
      </div>
    </>
  );
};

// ===== Edit Task Modal =====

export interface EditTaskData {
  key: string;
  summary: string;
  issuetype: string;
  priority: string;
  mappedColumn: string;
  storyPoints: number;
  dueDate: string;
  assignee: string;
}

export interface CreateJiraIssueData extends JiraCreateIssueInput {}

interface EditTaskModalProps {
  plugin: JiraFlowPlugin;
  task: EditTaskData;
  onClose: () => void;
  onSave: (data: EditTaskData) => void;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({ plugin, task, onClose, onSave }) => {
  useEscapeKey(plugin.app, onClose, true);

  const [summary, setSummary] = useState(task.summary);
  const [issuetype, setIssuetype] = useState(task.issuetype);
  const [priority, setPriority] = useState(task.priority);
  const [mappedColumn, setMappedColumn] = useState(task.mappedColumn);
  const [storyPoints, setStoryPoints] = useState(task.storyPoints);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [assignee, setAssignee] = useState(task.assignee);

  const handleSave = useCallback(() => {
    if (!summary.trim()) return;
    onSave({
      key: task.key,
      summary: summary.trim(),
      issuetype,
      priority,
      mappedColumn,
      storyPoints,
      dueDate,
      assignee,
    });
    onClose();
  }, [summary, issuetype, priority, mappedColumn, storyPoints, dueDate, assignee, task.key, onSave, onClose]);

  return (
    <>
      {/* Overlay */}
      <div className="jf-fixed jf-inset-0 jf-bg-black/40 jf-backdrop-blur-sm jf-z-50 jf-flex jf-items-center jf-justify-center" onClick={onClose} />
      
      {/* Modal */}
      <div className="jf-fixed jf-top-1/2 jf-left-1/2 jf-transform -jf-translate-x-1/2 -jf-translate-y-1/2 jf-z-50 jf-w-full jf-max-w-2xl jf-bg-white jf-rounded-xl jf-shadow-2xl jf-border jf-border-gray-100 jf-overflow-hidden">
        
        {/* Header */}
        <div className="jf-px-6 jf-py-4 jf-border-b jf-border-gray-100 jf-bg-gray-50/50 jf-flex jf-justify-between jf-items-center">
          <div className="jf-flex jf-items-center jf-gap-3">
            <h3 className="jf-text-lg jf-font-semibold jf-text-gray-800">编辑本地任务</h3>
            <span className="jf-text-sm jf-font-mono jf-text-blue-600 jf-bg-blue-50 jf-px-2 jf-py-1 jf-rounded">{task.key}</span>
          </div>
          <button onClick={onClose} className="jf-text-gray-400 hover:jf-text-gray-600 jf-transition-colors">
            <svg className="jf-w-5 jf-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="jf-p-6 jf-space-y-4" style={{ maxHeight: "min(70vh, 720px)", overflowY: "auto" }}>
          {/* Summary - Full width */}
          <div>
            <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">摘要</label>
            <input 
              value={summary} 
              onChange={(e) => setSummary(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus 
              placeholder="需要做什么？"
              className={fieldClassName}
              style={fieldStyle}
            />
          </div>

          {/* Row 2: Type & Priority */}
          <div className="jf-grid jf-grid-cols-2 jf-gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">类型</label>
              <select 
                value={issuetype} 
                onChange={(e) => setIssuetype(e.target.value)} 
                className={fieldClassName}
                style={fieldStyle}>
                {LOCAL_TASK_TYPES.map((t) => <option key={t} value={t}>{t === "Personal" ? "个人任务" : t}</option>)}
              </select>
            </div>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">优先级</label>
              <select 
                value={priority} 
                onChange={(e) => setPriority(e.target.value)} 
                className={fieldClassName}
                style={fieldStyle}>
                {["Highest", "High", "Medium", "Low", "Lowest"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Row 3: Column & Story Points */}
          <div className="jf-grid jf-grid-cols-2 jf-gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">状态</label>
              <select 
                value={mappedColumn} 
                onChange={(e) => setMappedColumn(e.target.value)} 
                className={fieldClassName}
                style={fieldStyle}>
                {KANBAN_COLUMNS.map((col) => <option key={col.id} value={col.id}>{col.label}</option>)}
              </select>
            </div>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">故事点</label>
              <input 
                type="number" 
                min={0} 
                value={storyPoints}
                onChange={(e) => setStoryPoints(Number(e.target.value))} 
                className={fieldClassName}
                style={fieldStyle}
              />
            </div>
          </div>

          {/* Row 4: Due Date & Assignee */}
          <div className="jf-grid jf-grid-cols-2 jf-gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">截止日期</label>
              <input 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)} 
                className={fieldClassName}
                style={fieldStyle}
              />
            </div>
            <div>
              <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">负责人</label>
              <input 
                value={assignee} 
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="用户名"
                className={fieldClassName}
                style={fieldStyle}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="jf-px-6 jf-py-4 jf-bg-gray-50 jf-flex jf-justify-end jf-gap-3">
          <button 
            onClick={onClose} 
            className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-gray-600 hover:jf-bg-gray-100 jf-rounded-lg jf-transition-colors">
            取消
          </button>
          <button 
            onClick={handleSave} 
            disabled={!summary.trim()} 
            className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-white jf-bg-blue-600 hover:jf-bg-blue-700 jf-shadow-sm jf-rounded-lg jf-transition-all disabled:jf-opacity-50 disabled:jf-cursor-not-allowed">
            保存修改
          </button>
        </div>
      </div>
    </>
  );
};

interface CreateJiraIssueModalProps {
  plugin: JiraFlowPlugin;
  onClose: () => void;
  onSave: (data: CreateJiraIssueData) => Promise<void> | void;
}

export const CreateJiraIssueModal: React.FC<CreateJiraIssueModalProps> = ({ plugin, onClose, onSave }) => {
  useEscapeKey(plugin.app, onClose, true);

  const [meta, setMeta] = useState<JiraCreateIssueMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [issueTypeId, setIssueTypeId] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [myAssignee, setMyAssignee] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [storyPoints, setStoryPoints] = useState("");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [plannedEndDate, setPlannedEndDate] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadMeta = async () => {
      if (!plugin.settings.projectKey) {
        setError("请先在设置中填写项目 Key。");
        setLoadingMeta(false);
        return;
      }

      try {
        const [createMeta, currentUser] = await Promise.all([
          plugin.jiraApi.fetchCreateIssueMeta(plugin.settings.projectKey),
          plugin.jiraApi.getCurrentUser(),
        ]);

        if (!mounted) return;

        setMeta(createMeta);
        setIssueTypeId(createMeta.issueTypes.find((item) => item.name.toLowerCase() === "story")?.id || createMeta.issueTypes[0]?.id || "");
        setPriorityId(createMeta.priorities.find((item) => item.name.toLowerCase() === "low")?.id || createMeta.priorities[0]?.id || "");
        const currentAssignee = currentUser?.name || currentUser?.displayName || currentUser?.emailAddress || "";
        setMyAssignee(currentAssignee);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (mounted) {
          setLoadingMeta(false);
        }
      }
    };

    loadMeta();
    return () => {
      mounted = false;
    };
  }, [plugin]);

  const handleSubmit = useCallback(async () => {
    if (!meta || !summary.trim() || !issueTypeId) return;

    setSaving(true);
    setError("");

    try {
      await onSave({
        projectKey: meta.projectKey,
        issueTypeId,
        summary: summary.trim(),
        description: description.trim(),
        assignee: assignee.trim(),
        priorityId,
        storyPoints: storyPoints.trim() === "" ? undefined : Number(storyPoints),
        plannedStartDate: plannedStartDate || undefined,
        plannedEndDate: plannedEndDate || undefined,
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }, [assignee, description, issueTypeId, meta, onClose, onSave, plannedEndDate, plannedStartDate, priorityId, storyPoints, summary]);

  return (
    <>
      <div className="jf-fixed jf-inset-0 jf-bg-black/40 jf-backdrop-blur-sm jf-z-50" onClick={onClose} />

      <div className="jf-fixed jf-top-1/2 jf-left-1/2 jf-transform -jf-translate-x-1/2 -jf-translate-y-1/2 jf-z-[10001] jf-w-full jf-max-w-2xl jf-bg-white jf-rounded-xl jf-shadow-2xl jf-border jf-border-gray-100 jf-overflow-hidden">
        <div className="jf-px-6 jf-py-4 jf-border-b jf-border-gray-100 jf-bg-gray-50/50 jf-flex jf-justify-between jf-items-center">
          <div className="jf-flex jf-items-center jf-gap-3">
            <h3 className="jf-text-lg jf-font-semibold jf-text-gray-800">新建 Jira 任务</h3>
            {meta && <span className="jf-text-sm jf-font-mono jf-text-blue-600 jf-bg-blue-50 jf-px-2 jf-py-1 jf-rounded">{meta.projectKey}</span>}
          </div>
          <button onClick={onClose} className="jf-text-gray-400 hover:jf-text-gray-600 jf-transition-colors">
            <svg className="jf-w-5 jf-h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="jf-p-6 jf-space-y-4" style={{ maxHeight: "min(78vh, 820px)", overflowY: "auto" }}>
          {loadingMeta ? (
            <div className="jf-text-sm jf-text-gray-500">正在读取 Jira 创建元数据...</div>
          ) : error ? (
            <div className="jf-text-sm jf-text-red-600 jf-bg-red-50 jf-border jf-border-red-200 jf-rounded-lg jf-p-3">{error}</div>
          ) : meta ? (
            <>
              <div className="jf-grid jf-gap-4" style={{ gridTemplateColumns: "180px minmax(0, 1fr)" }}>
                <div>
                  <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">项目</label>
                  <div className={fieldClassName} style={{ ...fieldStyle, display: "flex", alignItems: "center" }}>
                    {meta.projectName} ({meta.projectKey})
                  </div>
                </div>
                <div>
                  <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">问题类型</label>
                  <select value={issueTypeId} onChange={(e) => setIssueTypeId(e.target.value)} className={fieldClassName} style={fieldStyle}>
                    {meta.issueTypes.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">概要</label>
                <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="请输入 Jira 任务标题" className={fieldClassName} style={fieldStyle} autoFocus />
              </div>

              <div className="jf-grid jf-gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div>
                  <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">经办人</label>
                  <div className="jf-flex jf-gap-2">
                    <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="留空则自动分配" className={fieldClassName} style={fieldStyle} />
                    <button
                      type="button"
                      onClick={() => setAssignee(myAssignee)}
                      disabled={!myAssignee}
                      className="jf-px-3 jf-py-2 jf-text-sm jf-font-medium jf-text-blue-700 jf-bg-blue-50 jf-border jf-border-blue-200 jf-rounded-lg hover:jf-bg-blue-100 disabled:jf-opacity-50 disabled:jf-cursor-not-allowed"
                    >
                      分配给我
                    </button>
                  </div>
                </div>
                <div>
                  <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">故事点</label>
                  <input value={storyPoints} onChange={(e) => setStoryPoints(e.target.value)} placeholder={plugin.settings.storyPointsField || "未配置故事点字段"} className={fieldClassName} style={fieldStyle} />
                </div>
              </div>

              <div>
                <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">描述</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="请输入任务描述"
                  className={fieldClassName}
                  style={{ ...fieldStyle, minHeight: "180px", resize: "vertical" }}
                />
              </div>

              <div className="jf-grid jf-gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div>
                  <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">优先级</label>
                  <select value={priorityId} onChange={(e) => setPriorityId(e.target.value)} className={fieldClassName} style={fieldStyle}>
                    {meta.priorities.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">Planned Start Date</label>
                  <input type="date" value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} className={fieldClassName} style={fieldStyle} />
                  {!plugin.settings.plannedStartDateField && <div className="jf-text-[10px] jf-text-amber-600 jf-mt-1">设置中未配置计划开始日期字段，创建时不会提交该值。</div>}
                </div>
                <div>
                  <label className="jf-block jf-text-xs jf-font-medium jf-text-gray-500 jf-mb-1 jf-uppercase jf-tracking-wide">Planned End Date</label>
                  <input type="date" value={plannedEndDate} onChange={(e) => setPlannedEndDate(e.target.value)} className={fieldClassName} style={fieldStyle} />
                  {!plugin.settings.dueDateField && <div className="jf-text-[10px] jf-text-amber-600 jf-mt-1">设置中未配置计划结束日期字段，创建时不会提交该值。</div>}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="jf-px-6 jf-py-4 jf-bg-gray-50 jf-flex jf-justify-end jf-gap-3">
          <button onClick={onClose} className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-gray-600 hover:jf-bg-gray-100 jf-rounded-lg jf-transition-colors">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loadingMeta || saving || !meta || !summary.trim() || !issueTypeId}
            className="jf-px-4 jf-py-2 jf-text-sm jf-font-medium jf-text-white jf-bg-blue-600 hover:jf-bg-blue-700 jf-shadow-sm jf-rounded-lg jf-transition-all disabled:jf-opacity-50 disabled:jf-cursor-not-allowed"
          >
            {saving ? "创建中..." : "新建并同步"}
          </button>
        </div>
      </div>
    </>
  );
};
