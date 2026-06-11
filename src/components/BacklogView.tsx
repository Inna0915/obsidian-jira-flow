import React, { useEffect, useMemo, useRef, useState } from "react";
import type JiraFlowPlugin from "../main";
import type { JiraFeature, JiraCompletedIssue } from "../api/jira";
import { mapStatusToColumn } from "../types";
import type { KanbanCard, JiraSprint } from "../types";

type LiveCard = KanbanCard & { __live?: boolean };
const toLiveCard = (c: JiraCompletedIssue): LiveCard => ({
  filePath: `live:${c.jiraKey}`,
  jiraKey: c.jiraKey,
  status: c.status,
  mappedColumn: mapStatusToColumn(c.status) || c.status,
  issuetype: c.issuetype,
  priority: "",
  storyPoints: 0,
  dueDate: "",
  assignee: "",
  parentKey: c.parentKey,
  parentSummary: c.parentSummary,
  summary: c.summary,
  tags: ["done/live"],
  swimlane: "others",
  sprint: c.sprint,
  sprint_state: "",
  __live: true,
});

interface BacklogViewProps {
  cards: KanbanCard[];
  plugin: JiraFlowPlugin;
  onCardClick: (card: KanbanCard) => void;
  onLinkFeature: (issueKey: string, featureKey: string) => Promise<void>;
  onUnlinkFeature: (issueKey: string) => Promise<void>;
  onBatchLinkFeature: (issueKeys: string[], featureKey: string) => Promise<void>;
  onBatchMoveSprint: (issueKeys: string[], sprintId: number | null, sprintName: string) => Promise<void>;
  onBatchAssignToMe: (issueKeys: string[]) => Promise<void>;
}

const typeStyles: Record<string, { bg: string; fg: string; label: string }> = {
  Story: { bg: "#E3FCEF", fg: "#006644", label: "S" },
  Bug: { bg: "#FFEBE6", fg: "#BF2600", label: "B" },
  Task: { bg: "#DEEBFF", fg: "#0747A6", label: "T" },
  Feature: { bg: "#DEEBFF", fg: "#0747A6", label: "F" },
  Enabler: { bg: "#FFF7ED", fg: "#C2410C", label: "EN" },
  Epic: { bg: "#EAE6FF", fg: "#403294", label: "E" },
  "Sub-task": { bg: "#F4F5F7", fg: "#42526E", label: "ST" },
};

// 关键词包含匹配（Jira 状态是双语合并串，如 "Closed 关闭" / "Done 完成"）
const DONE_KEYWORDS = ["closed", "关闭", "done", "完成", "validated", "已验证", "released", "已发布", "resolved", "已解决", "cancel", "取消", "废弃"];
const isFeatureDone = (status: string): boolean => {
  const s = (status || "").toLowerCase();
  return DONE_KEYWORDS.some((k) => s.includes(k));
};
const isCardDone = (c: KanbanCard): boolean => (c.tags || []).some((t) => t.startsWith("done/"));

interface FeatureStat { total: number; done: number; storyPoints: number; unestimated: number; }

export const BacklogView: React.FC<BacklogViewProps> = ({ cards, plugin, onCardClick, onLinkFeature, onUnlinkFeature, onBatchLinkFeature, onBatchMoveSprint, onBatchAssignToMe }) => {
  const [features, setFeatures] = useState<JiraFeature[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(true);
  const [featureSearch, setFeatureSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [activeFeatureKey, setActiveFeatureKey] = useState<string | null>(null);
  const [linkingKey, setLinkingKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedCards, setCompletedCards] = useState<LiveCard[]>([]);
  const [completedState, setCompletedState] = useState<"idle" | "loading" | "loaded">("idle");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Record<string, FeatureStat | "loading">>({});

  // 批量选择（Shift 多选）+ 批量操作
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [linkMenuOpen, setLinkMenuOpen] = useState(false);
  const [sprintMenuOpen, setSprintMenuOpen] = useState(false);
  const [batchFeatureSearch, setBatchFeatureSearch] = useState("");
  const [sprints, setSprints] = useState<JiraSprint[] | null>(null);

  // 勾「显示已完成」时实时拉取我的已完成任务（已归档，不在本地）
  // 用 ref 去重 + 依赖里不放 completedState，避免 setState 触发 effect 重跑、
  // 上一次 cleanup 把进行中的请求标记为失效，导致永远停在「加载中」。
  const completedFetched = useRef(false);
  useEffect(() => {
    if (!showCompleted || completedFetched.current) return;
    completedFetched.current = true;
    setCompletedState("loading");
    let cancelled = false;
    void plugin.jiraApi.fetchMyCompletedIssues().then((list) => {
      if (cancelled) return;
      setCompletedCards(list.map(toLiveCard));
      setCompletedState("loaded");
    });
    return () => { cancelled = true; };
  }, [showCompleted, plugin]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); return next; }
      next.add(key);
      // 懒加载原生统计
      if (!stats[key]) {
        setStats((s) => ({ ...s, [key]: "loading" }));
        void plugin.jiraApi.fetchFeatureStats(key).then((r) => setStats((s) => ({ ...s, [key]: r })));
      }
      return next;
    });
  };

  const featureProject = useMemo(() => {
    if (plugin.settings.featureProjectKey) return plugin.settings.featureProjectKey;
    const counts: Record<string, number> = {};
    for (const c of cards) {
      const prefix = (c.parentKey || "").split("-")[0];
      if (prefix) counts[prefix] = (counts[prefix] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }, [cards, plugin.settings.featureProjectKey]);

  useEffect(() => {
    let mounted = true;
    if (!featureProject) { setLoadingFeatures(false); return; }
    setLoadingFeatures(true);
    void plugin.jiraApi.fetchFeatures(featureProject)
      .then((list) => { if (mounted) { setFeatures(list); setLoadingFeatures(false); } })
      .catch((e) => { if (mounted) { setError(e instanceof Error ? e.message : String(e)); setLoadingFeatures(false); } });
    return () => { mounted = false; };
  }, [plugin, featureProject]);

  // 每个 feature 的本地关联任务统计（数量 + 完成数，用于进度条）
  const statByFeature = useMemo(() => {
    const m: Record<string, { total: number; done: number }> = {};
    for (const c of cards) {
      if (!c.parentKey) continue;
      const s = (m[c.parentKey] = m[c.parentKey] || { total: 0, done: 0 });
      s.total += 1;
      if (isCardDone(c)) s.done += 1;
    }
    return m;
  }, [cards]);

  const visibleFeatures = useMemo(() => {
    const q = featureSearch.trim().toLowerCase();
    return features.filter((f) => {
      if (activeOnly && isFeatureDone(f.status)) return false;
      if (!q) return true;
      return f.summary.toLowerCase().includes(q) || f.key.toLowerCase().includes(q);
    });
  }, [features, featureSearch, activeOnly]);

  const filteredCards = useMemo(() => {
    let list: KanbanCard[] = showCompleted ? [...cards, ...completedCards] : cards;
    if (activeFeatureKey === "__none__") list = list.filter((c) => !c.parentKey);
    else if (activeFeatureKey) list = list.filter((c) => c.parentKey === activeFeatureKey);
    if (!showCompleted) list = list.filter((c) => !isCardDone(c));
    return list;
  }, [cards, completedCards, activeFeatureKey, showCompleted]);

  // 右侧按 sprint 分组：活跃 sprint 优先，其余按名，Backlog（无 sprint）置底
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; cards: KanbanCard[]; hasActive: boolean }>();
    for (const c of filteredCards) {
      const key = c.sprint || "__backlog__";
      const g = map.get(key) || { name: c.sprint || "Backlog", cards: [], hasActive: false };
      g.cards.push(c);
      if (c.sprint_state === "ACTIVE") g.hasActive = true;
      map.set(key, g);
    }
    return [...map.entries()]
      .map(([key, g]) => ({ key, ...g }))
      .sort((a, b) => {
        if (a.key === "__backlog__") return 1;
        if (b.key === "__backlog__") return -1;
        if (a.hasActive !== b.hasActive) return a.hasActive ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [filteredCards]);

  // 可选行的显示顺序（仅未折叠分组内的非 live 卡），用于 Shift 范围选择
  const flatSelectable = useMemo(() => {
    const keys: string[] = [];
    for (const g of groups) {
      if (collapsed.has(g.key)) continue;
      for (const c of g.cards) {
        if ((c as LiveCard).__live) continue;
        keys.push(c.jiraKey);
      }
    }
    return keys;
  }, [groups, collapsed]);

  const handleRowSelect = (key: string, shiftKey: boolean) => {
    if (shiftKey && lastClicked && lastClicked !== key) {
      const a = flatSelectable.indexOf(lastClicked);
      const b = flatSelectable.indexOf(key);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = flatSelectable.slice(lo, hi + 1);
        setSelectedKeys((prev) => new Set([...prev, ...range]));
        setLastClicked(key);
        return;
      }
    }
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    setLastClicked(key);
  };

  const clearSelection = () => { setSelectedKeys(new Set()); setLastClicked(null); };

  const runBatchLink = async (featureKey: string, keys: string[]) => {
    if (!keys.length) return;
    setBatchBusy(true);
    try { await onBatchLinkFeature(keys, featureKey); }
    finally { setBatchBusy(false); setLinkMenuOpen(false); setBatchFeatureSearch(""); clearSelection(); }
  };

  const runBatchAssign = async () => {
    const keys = [...selectedKeys];
    if (!keys.length) return;
    setBatchBusy(true);
    try { await onBatchAssignToMe(keys); }
    finally { setBatchBusy(false); clearSelection(); }
  };

  const runBatchMove = async (sprintId: number | null, name: string) => {
    const keys = [...selectedKeys];
    if (!keys.length) return;
    setBatchBusy(true);
    try { await onBatchMoveSprint(keys, sprintId, name); }
    finally { setBatchBusy(false); setSprintMenuOpen(false); clearSelection(); }
  };

  const openSprintMenu = () => {
    setSprintMenuOpen((o) => !o);
    setLinkMenuOpen(false);
    if (sprints === null) {
      void plugin.jiraApi.fetchSprints(plugin.settings.projectKey).then((list) => setSprints(list));
    }
  };

  const handleDropOnFeature = async (featureKey: string, issueKey: string) => {
    if (!issueKey) return;
    setLinkingKey(issueKey);
    try { await onLinkFeature(issueKey, featureKey); }
    finally { setLinkingKey(null); setDragOverKey(null); }
  };
  const handleUnlink = async (issueKey: string) => {
    setLinkingKey(issueKey);
    try { await onUnlinkFeature(issueKey); } finally { setLinkingKey(null); }
  };
  const toggleCollapse = (key: string) => setCollapsed((prev) => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  return (
    <div className="jf-flex-1 jf-min-h-0 jf-flex jf-overflow-hidden jf-bg-[#F7F8FA]">
      {/* 左：Feature 卡片列表 */}
      <aside className="jf-w-[300px] jf-shrink-0 jf-border-r jf-border-[#DFE1E6] jf-bg-[#FAFBFC] jf-flex jf-flex-col">
        <div className="jf-px-3 jf-py-3 jf-border-b jf-border-[#EBECF0] jf-bg-white">
          <div className="jf-flex jf-items-center jf-justify-between jf-mb-2">
            <span className="jf-text-[12px] jf-font-semibold jf-uppercase jf-tracking-wide jf-text-[#6B778C]">
              产品 FEATURES{featureProject ? `（${featureProject}）` : ""}
            </span>
            <label className="jf-flex jf-items-center jf-gap-1 jf-text-[11px] jf-text-[#6B778C] jf-cursor-pointer">
              <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
              仅活跃
            </label>
          </div>
          <input
            className="jf-w-full jf-px-2 jf-py-1.5 jf-text-[13px] jf-border jf-border-[#DFE1E6] jf-rounded-md focus:jf-outline-none focus:jf-border-[#4C9AFF]"
            placeholder="搜索 Feature…"
            value={featureSearch}
            onChange={(e) => setFeatureSearch(e.target.value)}
          />
        </div>

        <div className="jf-flex-1 jf-overflow-auto jf-px-2 jf-py-2 jf-space-y-1.5">
          {/* 未关联 */}
          <button
            type="button"
            onClick={() => setActiveFeatureKey((k) => (k === "__none__" ? null : "__none__"))}
            className={`jf-block jf-w-full jf-text-left jf-px-3 jf-py-2 jf-rounded-lg jf-text-[13px] jf-border jf-transition-colors ${activeFeatureKey === "__none__" ? "jf-border-[#4C9AFF] jf-bg-[#E9F2FF] jf-text-[#0052CC]" : "jf-border-[#EBECF0] jf-bg-white hover:jf-bg-[#F4F5F7]"}`}
          >
            未关联 Feature <span className="jf-text-[#97A0AF]">（{cards.filter((c) => !c.parentKey).length}）</span>
          </button>

          {!featureProject ? (
            <div className="jf-px-3 jf-py-4 jf-text-[12px] jf-text-amber-700">未配置 Feature 项目，且无法从已同步任务推断。请在设置里填写「Feature 项目 Key」。</div>
          ) : loadingFeatures ? (
            <div className="jf-px-3 jf-py-4 jf-text-[12px] jf-text-[#6B778C]">正在加载 Feature…</div>
          ) : error ? (
            <div className="jf-px-3 jf-py-4 jf-text-[12px] jf-text-red-600">{error}</div>
          ) : visibleFeatures.length === 0 ? (
            <div className="jf-px-3 jf-py-4 jf-text-[12px] jf-text-[#6B778C]">无匹配 Feature</div>
          ) : (
            visibleFeatures.map((f) => {
              const isOver = dragOverKey === f.key;
              const isActive = activeFeatureKey === f.key;
              const stat = statByFeature[f.key];
              const isExpanded = expanded.has(f.key);
              const raw = stats[f.key];
              const nstat = raw && raw !== "loading" ? raw : null;
              const npct = nstat && nstat.total ? Math.round((nstat.done / nstat.total) * 100) : 0;
              return (
                <div
                  key={f.key}
                  onDragOver={(e) => { e.preventDefault(); setDragOverKey(f.key); }}
                  onDragLeave={() => setDragOverKey((k) => (k === f.key ? null : k))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverKey(null);
                    const data = e.dataTransfer.getData("text/plain");
                    if (e.dataTransfer.getData("application/x-jf-batch") === "1") {
                      void runBatchLink(f.key, data.split(",").filter(Boolean));
                    } else {
                      void handleDropOnFeature(f.key, data);
                    }
                  }}
                  onClick={() => setActiveFeatureKey((k) => (k === f.key ? null : f.key))}
                  className={`jf-px-3 jf-py-2.5 jf-rounded-lg jf-border jf-cursor-pointer jf-transition-all jf-shadow-[0_1px_2px_rgba(9,30,66,0.06)] ${
                    isOver ? "jf-border-[#4C9AFF] jf-bg-[#DEEBFF] jf-ring-2 jf-ring-[#4C9AFF]"
                      : isActive ? "jf-border-[#4C9AFF] jf-bg-[#E9F2FF]"
                      : "jf-border-[#EBECF0] jf-bg-white hover:jf-border-[#C1C7D0] hover:jf-shadow-[0_2px_6px_rgba(9,30,66,0.12)]"
                  }`}
                  title="拖任务到此以关联 / 点击筛选"
                >
                  <div className="jf-flex jf-items-start jf-gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleExpand(f.key); }}
                      className="jf-shrink-0 jf-mt-1 jf-flex jf-h-4 jf-w-4 jf-items-center jf-justify-center jf-bg-transparent jf-border-0 jf-p-0 jf-shadow-none jf-text-[#97A0AF] hover:jf-text-[#42526E]"
                      title="展开/收起统计"
                    >
                      <svg viewBox="0 0 12 12" width="9" height="9" fill="currentColor" className={`jf-transition-transform ${isExpanded ? "jf-rotate-90" : ""}`}>
                        <path d="M4 2l4 4-4 4z" />
                      </svg>
                    </button>
                    <span className="jf-min-w-0 jf-flex-1 jf-text-[13px] jf-font-medium jf-text-[#172B4D] jf-break-words jf-leading-snug">{f.summary}</span>
                    {stat?.total ? (
                      <span className="jf-shrink-0 jf-text-[11px] jf-text-[#5E6C84] jf-bg-[#EBECF0] jf-rounded-full jf-px-1.5 jf-h-[18px] jf-flex jf-items-center">{stat.total}</span>
                    ) : null}
                  </div>
                  <div className="jf-mt-1 jf-pl-[18px] jf-flex jf-items-center jf-gap-1.5">
                    <span className="jf-text-[10px] jf-font-mono jf-text-[#97A0AF]">{f.key}</span>
                    <span className="jf-text-[10px] jf-text-[#97A0AF]">· {f.status}</span>
                  </div>

                  {isExpanded && (
                    <div className="jf-mt-2 jf-pl-[18px]" onClick={(e) => e.stopPropagation()}>
                      {!nstat ? (
                        <div className="jf-text-[11px] jf-text-[#97A0AF]">加载统计…</div>
                      ) : (
                        <>
                          <div className="jf-grid jf-grid-cols-2 jf-gap-x-4 jf-gap-y-1 jf-text-[11px] jf-text-[#5E6C84]">
                            <div className="jf-flex jf-justify-between"><span>问题</span><span className="jf-font-semibold jf-text-[#172B4D]">{nstat.total}</span></div>
                            <div className="jf-flex jf-justify-between"><span>已完成</span><span className="jf-font-semibold jf-text-[#006644]">{nstat.done}</span></div>
                            <div className="jf-flex jf-justify-between"><span>预估</span><span className="jf-font-semibold jf-text-[#172B4D]">{nstat.storyPoints}</span></div>
                            <div className="jf-flex jf-justify-between"><span>未预估</span><span className="jf-font-semibold jf-text-[#172B4D]">{nstat.unestimated}</span></div>
                          </div>
                          <div className="jf-mt-1.5 jf-h-1.5 jf-w-full jf-rounded-full jf-bg-[#EBECF0] jf-overflow-hidden" title={`${nstat.done}/${nstat.total} 已完成`}>
                            <div className="jf-h-full jf-rounded-full jf-bg-[#36B37E]" style={{ width: `${npct}%` }} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* 右：按 sprint 分组的任务清单 */}
      <div className="jf-flex-1 jf-min-w-0 jf-flex jf-flex-col">
        <div className="jf-flex-1 jf-overflow-auto">
        <div className="jf-px-4 jf-py-4">
          <div className="jf-flex jf-items-center jf-gap-2 jf-mb-3 jf-px-1">
            <h3 className="jf-text-[18px] jf-font-semibold jf-text-[#172B4D] jf-m-0">Backlog</h3>
            <span className="jf-text-sm jf-text-[#6B778C]">{filteredCards.length} 个问题</span>
            {activeFeatureKey && (
              <button onClick={() => setActiveFeatureKey(null)} className="jf-text-[12px] jf-text-[#0052CC] hover:jf-underline">清除筛选</button>
            )}
            <label className="jf-ml-auto jf-flex jf-items-center jf-gap-1 jf-text-[12px] jf-text-[#6B778C] jf-cursor-pointer">
              <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />
              显示已完成{completedState === "loading" ? "（加载中…）" : ""}
            </label>
            <span className="jf-text-[12px] jf-text-[#97A0AF]">勾选 / Shift 连选后可批量操作 · 拖动到左侧 Feature 关联</span>
          </div>

          <div className="jf-space-y-3">
            {groups.map((g) => {
              const isCollapsed = collapsed.has(g.key);
              return (
                <div key={g.key} className="jf-overflow-hidden jf-rounded-xl jf-bg-white jf-shadow-[0_1px_3px_rgba(9,30,66,0.13)]">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(g.key)}
                    className={`jf-flex jf-w-full jf-items-center jf-gap-2 jf-bg-[#FAFBFC] jf-px-3 jf-py-2.5 jf-text-left ${isCollapsed ? "" : "jf-border-b jf-border-[#EBECF0]"}`}
                  >
                    <span className={`jf-text-[#6B778C] jf-transition-transform ${isCollapsed ? "" : "jf-rotate-90"}`}>▸</span>
                    <span className="jf-text-[13px] jf-font-semibold jf-text-[#172B4D]">{g.name}</span>
                    {g.hasActive && g.key !== "__backlog__" && (
                      <span className="jf-text-[10px] jf-font-semibold jf-text-[#006644] jf-bg-[#E3FCEF] jf-rounded jf-px-1.5 jf-py-0.5">活跃</span>
                    )}
                    <span className="jf-ml-1 jf-text-[12px] jf-text-[#6B778C]">{g.cards.length} 个问题</span>
                  </button>

                  {!isCollapsed && g.cards.map((card) => {
                    const ts = typeStyles[card.issuetype] || { bg: "#F4F5F7", fg: "#42526E", label: card.issuetype.slice(0, 1).toUpperCase() };
                    const linking = linkingKey === card.jiraKey;
                    const done = isCardDone(card);
                    const isLive = (card as LiveCard).__live === true;
                    const isSelected = selectedKeys.has(card.jiraKey);
                    return (
                      <div
                        key={card.filePath}
                        draggable={!linking && !isLive}
                        onDragStart={(e) => {
                          if (isLive) return;
                          if (isSelected && selectedKeys.size > 1) {
                            e.dataTransfer.setData("application/x-jf-batch", "1");
                            e.dataTransfer.setData("text/plain", [...selectedKeys].join(","));
                          } else {
                            e.dataTransfer.setData("text/plain", card.jiraKey);
                          }
                        }}
                        onClick={(e) => {
                          if (isLive) return;
                          if (e.shiftKey || e.metaKey || e.ctrlKey) { e.preventDefault(); handleRowSelect(card.jiraKey, e.shiftKey); return; }
                          onCardClick(card);
                        }}
                        className={`jf-flex jf-items-center jf-gap-3 jf-px-3 jf-py-2.5 jf-border-b jf-border-[#EBECF0] last:jf-border-b-0 ${isSelected ? "jf-bg-[#E9F2FF]" : "hover:jf-bg-[#F7F8FA]"} ${isLive ? "jf-cursor-default" : "jf-cursor-pointer"} ${linking ? "jf-opacity-60" : ""}`}
                      >
                        {!isLive ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            onClick={(e) => { e.stopPropagation(); handleRowSelect(card.jiraKey, e.shiftKey); }}
                            className="jf-shrink-0 jf-cursor-pointer"
                            title="选择（Shift 连选）"
                          />
                        ) : (
                          <span className="jf-w-[13px] jf-shrink-0" />
                        )}
                        <span className="jf-inline-flex jf-h-7 jf-w-7 jf-shrink-0 jf-items-center jf-justify-center jf-rounded-md jf-text-[11px] jf-font-bold" style={{ backgroundColor: ts.bg, color: ts.fg }} title={card.issuetype}>{ts.label}</span>
                        <span className={`jf-font-mono jf-text-[12px] jf-font-semibold jf-shrink-0 ${done ? "jf-text-[#97A0AF] jf-line-through" : "jf-text-[#0052CC]"}`}>{card.jiraKey}</span>
                        <span className={`jf-truncate jf-text-[14px] jf-min-w-0 jf-flex-1 ${done ? "jf-text-[#97A0AF] jf-line-through" : "jf-text-[#172B4D]"}`}>{card.summary}</span>
                        <span className="jf-shrink-0 jf-text-[11px] jf-text-[#5E6C84] jf-bg-[#EBECF0] jf-rounded-full jf-px-2 jf-py-0.5">{card.mappedColumn}</span>
                        <div className="jf-shrink-0 jf-flex jf-items-center jf-gap-1 jf-min-w-[150px] jf-justify-end" onClick={(e) => e.stopPropagation()}>
                          {linking ? (
                            <span className="jf-text-[11px] jf-text-[#6B778C]">处理中…</span>
                          ) : card.parentKey ? (
                            <span className="jf-inline-flex jf-items-center jf-gap-1 jf-max-w-[200px] jf-rounded-md jf-bg-[#F1F2F4] jf-text-[#44546F] jf-border jf-border-[#DCDFE4] jf-pl-2 jf-pr-1 jf-py-0.5 jf-text-[11px]">
                              <span className="jf-truncate">{card.parentSummary || card.parentKey}</span>
                              {!isLive && (
                                <button
                                  type="button"
                                  title="解除关联"
                                  onClick={() => void handleUnlink(card.jiraKey)}
                                  className="jf-inline-flex jf-h-4 jf-w-4 jf-items-center jf-justify-center jf-rounded jf-bg-transparent jf-text-[#8590A2] hover:jf-bg-[#FFECEB] hover:jf-text-[#C9372C] jf-leading-none jf-text-[13px]"
                                >×</button>
                              )}
                            </span>
                          ) : (
                            <span className="jf-text-[11px] jf-text-[#97A0AF] jf-italic">未关联</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {groups.length === 0 && <div className="jf-px-4 jf-py-6 jf-text-[13px] jf-text-[#6B778C]">没有匹配的任务</div>}
          </div>
        </div>
        </div>

        {/* 批量操作栏 */}
        {selectedKeys.size > 0 && (
          <div className="jf-shrink-0 jf-border-t jf-border-[#DFE1E6] jf-bg-white jf-px-4 jf-py-2.5 jf-flex jf-items-center jf-gap-3 jf-shadow-[0_-2px_8px_rgba(9,30,66,0.12)]">
            <span className="jf-text-[13px] jf-font-semibold jf-text-[#172B4D]">已选 {selectedKeys.size} 项</span>

            {/* 分配给我 */}
            <button
              type="button"
              disabled={batchBusy}
              onClick={() => void runBatchAssign()}
              className="jf-px-3 jf-py-1.5 jf-text-[13px] jf-rounded-md jf-border jf-border-[#DFE1E6] jf-bg-white hover:jf-bg-[#F4F5F7] jf-text-[#172B4D] disabled:jf-opacity-50"
            >分配给我</button>

            {/* 关联 Feature */}
            <div className="jf-relative">
              <button
                type="button"
                disabled={batchBusy}
                onClick={() => { setLinkMenuOpen((o) => !o); setSprintMenuOpen(false); }}
                className="jf-px-3 jf-py-1.5 jf-text-[13px] jf-rounded-md jf-border jf-border-[#DFE1E6] jf-bg-white hover:jf-bg-[#F4F5F7] jf-text-[#172B4D] disabled:jf-opacity-50"
              >关联 Feature ▾</button>
              {linkMenuOpen && (
                <div className="jf-absolute jf-bottom-full jf-mb-1 jf-left-0 jf-w-[300px] jf-rounded-lg jf-border jf-border-[#DFE1E6] jf-bg-white jf-shadow-[0_4px_16px_rgba(9,30,66,0.2)] jf-z-30 jf-overflow-hidden">
                  <div className="jf-p-2 jf-border-b jf-border-[#EBECF0]">
                    <input
                      autoFocus
                      className="jf-w-full jf-px-2 jf-py-1.5 jf-text-[13px] jf-border jf-border-[#DFE1E6] jf-rounded-md focus:jf-outline-none focus:jf-border-[#4C9AFF]"
                      placeholder="搜索 Feature…"
                      value={batchFeatureSearch}
                      onChange={(e) => setBatchFeatureSearch(e.target.value)}
                    />
                  </div>
                  <div className="jf-max-h-[280px] jf-overflow-auto jf-py-1">
                    {(() => {
                      const q = batchFeatureSearch.trim().toLowerCase();
                      const list = features.filter((f) => {
                        if (activeOnly && isFeatureDone(f.status)) return false;
                        if (!q) return true;
                        return f.summary.toLowerCase().includes(q) || f.key.toLowerCase().includes(q);
                      });
                      if (!list.length) return <div className="jf-px-3 jf-py-3 jf-text-[12px] jf-text-[#6B778C]">无匹配 Feature</div>;
                      return list.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => void runBatchLink(f.key, [...selectedKeys])}
                          className="jf-block jf-w-full jf-text-left jf-px-3 jf-py-2 jf-text-[13px] jf-bg-transparent jf-border-0 hover:jf-bg-[#E9F2FF] jf-cursor-pointer"
                        >
                          <span className="jf-text-[#172B4D]">{f.summary}</span>
                          <span className="jf-ml-1.5 jf-text-[10px] jf-font-mono jf-text-[#97A0AF]">{f.key}</span>
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* 移动到迭代 */}
            <div className="jf-relative">
              <button
                type="button"
                disabled={batchBusy}
                onClick={openSprintMenu}
                className="jf-px-3 jf-py-1.5 jf-text-[13px] jf-rounded-md jf-border jf-border-[#DFE1E6] jf-bg-white hover:jf-bg-[#F4F5F7] jf-text-[#172B4D] disabled:jf-opacity-50"
              >移动到迭代 ▾</button>
              {sprintMenuOpen && (
                <div className="jf-absolute jf-bottom-full jf-mb-1 jf-left-0 jf-w-[280px] jf-max-h-[320px] jf-overflow-auto jf-rounded-lg jf-border jf-border-[#DFE1E6] jf-bg-white jf-shadow-[0_4px_16px_rgba(9,30,66,0.2)] jf-z-30 jf-py-1">
                  {sprints === null ? (
                    <div className="jf-px-3 jf-py-3 jf-text-[12px] jf-text-[#6B778C]">加载迭代…</div>
                  ) : (
                    <>
                      {sprints.map((sp) => (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => void runBatchMove(sp.id, sp.name)}
                          className="jf-flex jf-w-full jf-items-center jf-gap-2 jf-text-left jf-px-3 jf-py-2 jf-text-[13px] jf-bg-transparent jf-border-0 hover:jf-bg-[#E9F2FF] jf-cursor-pointer"
                        >
                          <span className="jf-text-[#172B4D] jf-truncate">{sp.name}</span>
                          {sp.state === "active" && (
                            <span className="jf-shrink-0 jf-text-[10px] jf-font-semibold jf-text-[#006644] jf-bg-[#E3FCEF] jf-rounded jf-px-1.5 jf-py-0.5">活跃</span>
                          )}
                        </button>
                      ))}
                      <div className="jf-my-1 jf-border-t jf-border-[#EBECF0]" />
                      <button
                        type="button"
                        onClick={() => void runBatchMove(null, "Backlog")}
                        className="jf-block jf-w-full jf-text-left jf-px-3 jf-py-2 jf-text-[13px] jf-bg-transparent jf-border-0 hover:jf-bg-[#F4F5F7] jf-cursor-pointer jf-text-[#5E6C84]"
                      >移出迭代（Backlog）</button>
                    </>
                  )}
                </div>
              )}
            </div>

            {batchBusy && <span className="jf-text-[12px] jf-text-[#6B778C]">处理中…</span>}
            <button
              type="button"
              onClick={clearSelection}
              className="jf-ml-auto jf-text-[12px] jf-text-[#6B778C] hover:jf-text-[#172B4D] jf-bg-transparent jf-border-0 jf-cursor-pointer"
            >清除选择</button>
          </div>
        )}
      </div>
    </div>
  );
};
