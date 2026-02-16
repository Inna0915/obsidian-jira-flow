import React, { useCallback, useEffect, useState } from "react";
import { KANBAN_COLUMNS } from "../types";
import type { KanbanCard } from "../types";
import type JiraFlowPlugin from "../main";

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
  onClose: () => void;
  onOpenFile: (filePath: string) => void;
  onArchive: (card: KanbanCard) => void;
  onCardUpdated: () => void;
}

export const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  card, plugin, onClose, onOpenFile, onArchive, onCardUpdated,
}) => {
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

  const isLocal = card.source === "LOCAL";
  const isJira = card.source === "JIRA";
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
      // Description
      const desc = issue.fields.description || "";
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
      if (storyPoints !== card.storyPoints) fields.customfield_10016 = storyPoints;
      if (dueDate !== (card.dueDate?.slice(0, 10) || "")) fields.duedate = dueDate || null;

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

  const pColor = priorityColors[card.priority] || "#6B778C";
  const tColor = typeColors[card.issuetype] || "#4C9AFF";
  const cColor = columnColors[card.mappedColumn] || "#6B778C";
  const isOverdue = card.swimlane === "overdue";
  const canArchive = isLocal && ["EXECUTED", "DONE", "CLOSED"].includes(card.mappedColumn);

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(0,0,0,0.3)" }} onClick={onClose} />
      {/* Side Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 10000,
        width: "480px", maxWidth: "90vw",
        backgroundColor: "var(--background-primary)",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
        display: "flex", flexDirection: "column",
        animation: "jf-slide-in 0.2s ease-out",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--background-modifier-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "14px" }}>{typeIcons[card.issuetype] || "\u{1F4CB}"}</span>
            {jiraUrl ? (
              <a href={jiraUrl} style={{
                fontFamily: "var(--font-monospace)", fontSize: "14px", fontWeight: 600,
                color: "#0052CC", textDecoration: "none",
              }} title="Open in Jira"
                onClick={(e) => { e.preventDefault(); window.open(jiraUrl); }}
              >{card.jiraKey}</a>
            ) : (
              <span style={{ fontFamily: "var(--font-monospace)", fontSize: "14px", fontWeight: 600, color: "#0052CC" }}>
                {card.jiraKey}
              </span>
            )}
            {isLocal && <Badge text="LOCAL" bg="#DFE1E6" color="#6B778C" />}
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {/* Summary */}
          <div style={{ marginBottom: "20px" }}>
            {editingSummary && isLocal ? (
              <input value={summary} onChange={(e) => setSummary(e.target.value)}
                onBlur={handleSaveSummary} onKeyDown={(e) => e.key === "Enter" && handleSaveSummary()}
                autoFocus style={{ ...inputStyle, fontSize: "17px", fontWeight: 700 }} />
            ) : (
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, lineHeight: 1.4, cursor: isLocal ? "pointer" : "default" }}
                onClick={() => isLocal && setEditingSummary(true)}>
                {card.summary}
              </h3>
            )}
          </div>

          {/* Badge Row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>
            <Badge text={card.issuetype} bg={`${tColor}18`} color={tColor} />
            <Badge text={card.priority} bg={`${pColor}18`} color={pColor} dot={pColor} />
            <Badge text={card.mappedColumn} bg={`${cColor}18`} color={cColor} />
            {card.sprint && <Badge text={card.sprint} bg="#E3FCEF" color="#006644" />}
          </div>

          {/* Metadata Grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0",
            border: "1px solid var(--background-modifier-border)", borderRadius: "8px",
            overflow: "hidden", marginBottom: "20px",
          }}>
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
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px",
          }}>
            <div>
              <label style={labelStyle}>Story Points</label>
              <input type="number" min={0} value={storyPoints}
                onChange={(e) => setStoryPoints(Number(e.target.value))}
                style={inputStyle} disabled={saving} />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input type="date" value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ ...inputStyle, color: isOverdue ? "#FF5630" : "var(--text-normal)" }}
                disabled={saving} />
            </div>
          </div>

          {/* Local-only editable fields */}
          {isLocal && (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px",
            }}>
              <div>
                <label style={labelStyle}>Type</label>
                <select value={card.issuetype} onChange={(e) => handleSaveLocalField("issuetype", e.target.value)} style={inputStyle}>
                  {["Task", "Bug", "Story", "Sub-task", "Epic"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <select value={card.priority} onChange={(e) => handleSaveLocalField("priority", e.target.value)} style={inputStyle}>
                  {["Highest", "High", "Medium", "Low", "Lowest"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Description</label>
              {isLocal && !editingDesc && (
                <button onClick={() => { setEditingDesc(true); setLocalDesc(description); }}
                  style={{ ...smallBtnStyle, color: "#0052CC" }}>Edit</button>
              )}
            </div>
            {editingDesc && isLocal ? (
              <div>
                <textarea value={localDesc} onChange={(e) => setLocalDesc(e.target.value)}
                  rows={6} style={{ ...inputStyle, resize: "vertical" }} />
                <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                  <button onClick={handleSaveDescription} style={{ ...smallBtnStyle, backgroundColor: "#0052CC", color: "#fff" }}>Save</button>
                  <button onClick={() => setEditingDesc(false)} style={smallBtnStyle}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{
                fontSize: "13px", lineHeight: 1.6, color: description ? "var(--text-normal)" : "var(--text-muted)",
                whiteSpace: "pre-wrap", padding: "10px 12px", borderRadius: "6px",
                backgroundColor: "var(--background-secondary)", minHeight: "40px",
              }}>
                {description || "No description"}
              </div>
            )}
          </div>

          {/* Linked Issues (Jira only) */}
          {isJira && links.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Linked Issues</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {links.map((link, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "8px 12px", borderRadius: "6px",
                    backgroundColor: "var(--background-secondary)", fontSize: "13px",
                  }}>
                    <span style={{ color: "var(--text-muted)", fontSize: "11px", flexShrink: 0 }}>{link.type}</span>
                    <a href={`${plugin.settings.jiraHost}/browse/${link.key}`}
                      onClick={(e) => { e.preventDefault(); window.open(`${plugin.settings.jiraHost}/browse/${link.key}`); }}
                      style={{ color: "#0052CC", fontFamily: "var(--font-monospace)", fontSize: "12px", fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
                      {link.key}
                    </a>
                    <span style={{ color: "var(--text-normal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {link.summary}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {card.tags.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Tags</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {card.tags.map((tag) => (
                  <span key={tag} style={{
                    fontSize: "11px", padding: "3px 8px", borderRadius: "4px",
                    backgroundColor: "var(--background-secondary)", color: "var(--text-muted)",
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px", borderTop: "1px solid var(--background-modifier-border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {canArchive && (
              <button onClick={() => onArchive(card)} style={{
                ...actionBtnStyle, border: "1px solid #FF5630", color: "#FF5630",
              }}>Archive</button>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {saved && <span style={{ fontSize: "12px", color: "#36B37E" }}>Saved!</span>}
            {isDirty && (
              <button onClick={handleSaveToJira} disabled={saving} style={{
                ...actionBtnStyle, backgroundColor: "#36B37E", color: "#fff", border: "none",
                opacity: saving ? 0.6 : 1,
              }}>{saving ? "Saving..." : "Save to Jira"}</button>
            )}
            <button onClick={() => { onOpenFile(card.filePath); onClose(); }} style={{
              ...actionBtnStyle, backgroundColor: "#0052CC", color: "#fff", border: "none",
            }}>Open File</button>
          </div>
        </div>
      </div>
    </>
  );
};

// ===== Sub-components =====

const Badge: React.FC<{ text: string; bg: string; color: string; dot?: string }> = ({ text, bg, color, dot }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: "4px",
    fontSize: "11px", padding: "3px 8px", borderRadius: "12px",
    backgroundColor: bg, color, fontWeight: 600,
  }}>
    {dot && <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: dot, display: "inline-block" }} />}
    {text}
  </span>
);

const MetaCell: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div style={{
    padding: "10px 14px",
    borderBottom: "1px solid var(--background-modifier-border)",
    borderRight: "1px solid var(--background-modifier-border)",
  }}>
    <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "3px" }}>
      {label}
    </div>
    <div style={{ fontSize: "13px", color: valueColor || "var(--text-normal)", fontWeight: 500 }}>
      {value}
    </div>
  </div>
);

// ===== Styles =====

const labelStyle: React.CSSProperties = {
  fontSize: "10px", fontWeight: 600, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px", display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: "6px",
  border: "1px solid var(--background-modifier-border)",
  backgroundColor: "var(--background-primary)", color: "var(--text-normal)", fontSize: "13px",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: "18px", color: "var(--text-muted)", padding: "4px 8px", lineHeight: 1,
};

const smallBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: "4px", border: "1px solid var(--background-modifier-border)",
  background: "transparent", cursor: "pointer", fontSize: "11px", fontWeight: 600,
};

const actionBtnStyle: React.CSSProperties = {
  padding: "7px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600,
};

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
  onClose: () => void;
  onSave: (data: CreateTaskData) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ onClose, onSave }) => {
  const [summary, setSummary] = useState("");
  const [issuetype, setIssuetype] = useState("Task");
  const [priority, setPriority] = useState("Medium");

  const handleSave = useCallback(() => {
    if (!summary.trim()) return;
    onSave({
      summary: summary.trim(),
      issuetype,
      priority,
      mappedColumn: "TO DO",
      storyPoints: 0,
      dueDate: "",
      assignee: "",
    });
    onClose();
  }, [summary, issuetype, priority, onSave, onClose]);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(0,0,0,0.3)" }} onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        zIndex: 10000, width: "400px", maxWidth: "90vw",
        backgroundColor: "var(--background-primary)", borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)", padding: "24px",
      }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "16px" }}>Create Local Task</h3>
        <div style={{ marginBottom: "12px" }}>
          <label style={labelStyle}>Summary</label>
          <input value={summary} onChange={(e) => setSummary(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus placeholder="Task summary..." style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={issuetype} onChange={(e) => setIssuetype(e.target.value)} style={inputStyle}>
              {["Task", "Bug", "Story", "Sub-task", "Epic"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={inputStyle}>
              {["Highest", "High", "Medium", "Low", "Lowest"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={smallBtnStyle}>Cancel</button>
          <button onClick={handleSave} disabled={!summary.trim()} style={{
            ...actionBtnStyle, backgroundColor: "#0052CC", color: "#fff", border: "none",
            opacity: summary.trim() ? 1 : 0.5,
          }}>Create</button>
        </div>
      </div>
    </>
  );
};
