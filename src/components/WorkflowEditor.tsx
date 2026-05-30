import React, { useCallback, useState } from "react";
import { KANBAN_COLUMNS, DEFAULT_WORKFLOWS, type WorkflowSettings } from "../types";
import type JiraFlowPlugin from "../main";
import { confirmModal } from "../ui/confirmModal";

type ProfileKey = "bug" | "default";
const COLUMN_IDS = KANBAN_COLUMNS.map((c) => c.id);
const DRAG_MIME = "application/x-jf-column";

const chipBase: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "4px",
  padding: "2px 8px", borderRadius: "var(--radius-s, 4px)",
  fontSize: "var(--font-ui-smaller, 11px)", fontWeight: 600,
  border: "1px solid var(--background-modifier-border)", userSelect: "none",
};

export const WorkflowEditor: React.FC<{ plugin: JiraFlowPlugin }> = ({ plugin }) => {
  const [profile, setProfile] = useState<ProfileKey>("default");
  const [workflows, setWorkflows] = useState<WorkflowSettings>(
    () => structuredClone(plugin.settings.workflows)
  );
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const persist = useCallback((next: WorkflowSettings) => {
    setWorkflows(next);
    plugin.settings.workflows = next;
    void plugin.saveSettings();
  }, [plugin]);

  const addTo = useCallback((zone: string, columnId: string) => {
    if (!COLUMN_IDS.includes(columnId)) return;
    const next = structuredClone(workflows);
    const p = next[profile];
    if (zone === "__global__") {
      if (!p.globalTargets.includes(columnId)) p.globalTargets.push(columnId);
    } else {
      if (zone === columnId) return;
      const list = p.transitions[zone] ?? (p.transitions[zone] = []);
      if (!list.includes(columnId)) list.push(columnId);
    }
    persist(next);
  }, [workflows, profile, persist]);

  const removeFrom = useCallback((zone: string, columnId: string) => {
    const next = structuredClone(workflows);
    const p = next[profile];
    if (zone === "__global__") {
      p.globalTargets = p.globalTargets.filter((c) => c !== columnId);
    } else {
      p.transitions[zone] = (p.transitions[zone] ?? []).filter((c) => c !== columnId);
    }
    persist(next);
  }, [workflows, profile, persist]);

  const resetProfile = useCallback(async () => {
    const ok = await confirmModal(plugin.app, `恢复「${profile === "bug" ? "Bug" : "默认"}」档案到默认配置？`, "恢复默认");
    if (!ok) return;
    const next = structuredClone(workflows);
    next[profile] = structuredClone(DEFAULT_WORKFLOWS[profile]);
    persist(next);
  }, [plugin.app, profile, workflows, persist]);

  const onChipDragStart = (e: React.DragEvent, columnId: string) => {
    e.dataTransfer.setData(DRAG_MIME, columnId);
    e.dataTransfer.effectAllowed = "copy";
  };
  const onZoneDrop = (e: React.DragEvent, zone: string) => {
    e.preventDefault();
    setDropTarget(null);
    const columnId = e.dataTransfer.getData(DRAG_MIME);
    if (columnId) addTo(zone, columnId);
  };
  const onZoneOver = (e: React.DragEvent, zone: string) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); setDropTarget(zone); }
  };

  const Chip = ({ id, onRemove }: { id: string; onRemove?: () => void }) => (
    <span style={{ ...chipBase, background: "var(--jf-accent-soft, var(--background-secondary))", color: "var(--jf-accent, var(--text-normal))" }}>
      {id}
      {onRemove && (
        <button aria-label={`移除 ${id}`} onClick={onRemove}
          style={{ border: "none", background: "transparent", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}>×</button>
      )}
    </span>
  );

  const Zone = ({ zone, items }: { zone: string; items: string[] }) => (
    <div
      onDrop={(e) => onZoneDrop(e, zone)}
      onDragOver={(e) => onZoneOver(e, zone)}
      onDragLeave={() => setDropTarget((z) => (z === zone ? null : z))}
      style={{
        display: "flex", flexWrap: "wrap", gap: "6px", minHeight: "32px",
        padding: "6px 8px", borderRadius: "var(--radius-m, 6px)",
        border: `1px dashed ${dropTarget === zone ? "var(--jf-accent, var(--interactive-accent))" : "var(--background-modifier-border)"}`,
        background: dropTarget === zone ? "var(--jf-accent-soft, var(--background-secondary))" : "var(--background-primary)",
      }}
    >
      {items.length === 0
        ? <span style={{ fontSize: "var(--font-ui-smaller,11px)", color: "var(--text-faint)" }}>拖入列以允许流转</span>
        : items.map((id) => <Chip key={id} id={id} onRemove={() => removeFrom(zone, id)} />)}
    </div>
  );

  const p = workflows[profile];

  return (
    <div className="jira-flow-plugin" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {(["default", "bug"] as ProfileKey[]).map((k) => (
            <button key={k} onClick={() => setProfile(k)}
              style={{
                padding: "5px 14px", borderRadius: "var(--radius-m,6px)", cursor: "pointer",
                border: "1px solid var(--background-modifier-border)", fontWeight: 600,
                background: profile === k ? "var(--jf-accent, var(--interactive-accent))" : "var(--background-secondary)",
                color: profile === k ? "var(--jf-on-accent, #fff)" : "var(--text-muted)",
              }}>{k === "bug" ? "Bug" : "默认"}</button>
          ))}
        </div>
        <button onClick={resetProfile}
          style={{ padding: "5px 12px", borderRadius: "var(--radius-m,6px)", cursor: "pointer", border: "1px solid var(--background-modifier-border)", background: "var(--background-secondary)", color: "var(--text-muted)" }}>
          恢复默认
        </button>
      </div>

      <div>
        <div style={{ fontSize: "var(--font-ui-smaller,11px)", color: "var(--text-muted)", marginBottom: "4px" }}>列（拖到下方区域）</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {COLUMN_IDS.map((id) => (
            <span key={id} draggable onDragStart={(e) => onChipDragStart(e, id)}
              style={{ ...chipBase, cursor: "grab", background: "var(--background-secondary)", color: "var(--text-normal)" }}>{id}</span>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>全局可达列<span style={{ fontWeight: 400, color: "var(--text-muted)" }}>（任意列都能流转到）</span></div>
        <Zone zone="__global__" items={p.globalTargets} />
      </div>

      <div>
        <div style={{ fontWeight: 600, marginBottom: "6px" }}>逐列转移规则</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {COLUMN_IDS.map((from) => (
            <div key={from} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "10px", alignItems: "start" }}>
              <div style={{ fontSize: "var(--font-ui-small,13px)", fontWeight: 600, paddingTop: "8px" }}>{from}</div>
              <Zone zone={from} items={p.transitions[from] ?? []} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
