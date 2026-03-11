import React, { useEffect, useMemo, useState } from "react";
import { Notice } from "obsidian";
import type { KanbanCard } from "../types";

interface IssueListViewProps {
  cards: KanbanCard[];
  jiraHost: string;
  title: string;
  onCardClick: (card: KanbanCard) => void;
  searchQuery: string;
  matchedCards: KanbanCard[];
  searchMatchIndex: number;
}

const priorityColors: Record<string, string> = {
  Highest: "#DE350B",
  High: "#FF5630",
  Medium: "#FFAB00",
  Low: "#36B37E",
  Lowest: "#00875A",
};

const typeStyles: Record<string, { bg: string; fg: string; label: string }> = {
  Story: { bg: "#E3FCEF", fg: "#006644", label: "S" },
  Bug: { bg: "#FFEBE6", fg: "#BF2600", label: "B" },
  Task: { bg: "#DEEBFF", fg: "#0747A6", label: "T" },
  Feature: { bg: "#DEEBFF", fg: "#0747A6", label: "F" },
  Personal: { bg: "#FFF0B3", fg: "#974F0C", label: "P" },
  Epic: { bg: "#EAE6FF", fg: "#403294", label: "E" },
  "Sub-task": { bg: "#F4F5F7", fg: "#42526E", label: "ST" },
};

const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query || !text) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <span className="jf-bg-yellow-200 jf-text-gray-900 jf-rounded jf-px-0.5">
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  );
};

const stringToColor = (str: string): string => {
  const colors = ["#0052CC", "#00B8D9", "#6554C0", "#FF5630", "#FFAB00", "#36B37E", "#00875A"];
  let hash = 0;
  for (let index = 0; index < str.length; index += 1) {
    hash = str.charCodeAt(index) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string): string =>
  name
    .split(/[\s._-]+/)
    .map((item) => item[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

export const IssueListView: React.FC<IssueListViewProps> = ({
  cards,
  jiraHost,
  title,
  onCardClick,
  searchQuery,
  matchedCards,
  searchMatchIndex,
}) => {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedPaths((previous) => {
      const next = new Set<string>();
      const validPaths = new Set(cards.map((card) => card.filePath));
      previous.forEach((path) => {
        if (validPaths.has(path)) {
          next.add(path);
        }
      });
      return next;
    });
  }, [cards]);

  const allSelectablePaths = useMemo(() => cards.map((card) => card.filePath), [cards]);
  const selectedCards = useMemo(
    () => cards.filter((card) => selectedPaths.has(card.filePath)),
    [cards, selectedPaths]
  );
  const allSelected = cards.length > 0 && selectedPaths.size === cards.length;

  const toggleSelection = (filePath: string) => {
    setSelectedPaths((previous) => {
      const next = new Set(previous);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedPaths(allSelected ? new Set() : new Set(allSelectablePaths));
  };

  const copySelectedLinks = async () => {
    const baseUrl = (jiraHost || "https://jira.ykeey.cn").replace(/\/+$/, "");
    const text = selectedCards
      .map((card) => `${baseUrl}/browse/${card.jiraKey}`)
      .join("\n");

    try {
      await navigator.clipboard.writeText(text);
      new Notice(`Jira Flow：已复制 ${selectedCards.length} 条 Jira 链接。`);
    } catch (error) {
      new Notice(`Jira Flow：复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="jf-flex-1 jf-overflow-auto jf-bg-[#F7F8FA] jf-relative">
      <div className="jf-min-w-[1080px] jf-px-4 jf-py-4">
        <div className="jf-flex jf-items-center jf-gap-2 jf-mb-3 jf-px-1">
          <h3 className="jf-text-[18px] jf-font-semibold jf-text-[#172B4D] jf-m-0">{title}</h3>
          <span className="jf-text-sm jf-text-[#6B778C]">{cards.length} 个问题</span>
        </div>

        <div className="jf-overflow-hidden jf-rounded-xl jf-border jf-border-[#DFE1E6] jf-bg-white jf-shadow-[0_1px_2px_rgba(9,30,66,0.08)]">
          <div className="jf-grid jf-grid-cols-[48px_56px_minmax(360px,1.8fr)_160px_140px_120px_92px] jf-items-center jf-bg-[#FAFBFC] jf-border-b jf-border-[#DFE1E6] jf-px-3 jf-py-2.5 jf-text-[11px] jf-font-semibold jf-uppercase jf-tracking-wide jf-text-[#6B778C]">
            <div className="jf-flex jf-items-center jf-justify-center">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="jf-h-4 jf-w-4" />
            </div>
            <div>类型</div>
            <div>问题</div>
            <div>状态</div>
            <div>负责人</div>
            <div>截止日期</div>
            <div>优先级</div>
          </div>

          <div>
            {cards.map((card) => {
              const typeStyle = typeStyles[card.issuetype] || { bg: "#F4F5F7", fg: "#42526E", label: card.issuetype.slice(0, 1).toUpperCase() };
              const priorityColor = priorityColors[card.priority] || "#6B778C";
              const isCurrentMatch = matchedCards.length > 0 && matchedCards[searchMatchIndex]?.filePath === card.filePath;
              const isMatched = searchQuery && matchedCards.some((item) => item.filePath === card.filePath);

              return (
                <div
                  key={card.filePath}
                  data-card-path={card.filePath}
                  className={`jf-grid jf-grid-cols-[48px_56px_minmax(360px,1.8fr)_160px_140px_120px_92px] jf-items-center jf-px-3 jf-py-3 jf-border-b jf-border-[#EBECF0] jf-cursor-pointer hover:jf-bg-[#F4F5F7] jf-transition-colors ${
                    isCurrentMatch
                      ? "jf-bg-blue-50 jf-ring-2 jf-ring-inset jf-ring-blue-300"
                      : isMatched
                      ? "jf-bg-[#F0F7FF]"
                      : "jf-bg-white"
                  }`}
                  onClick={() => onCardClick(card)}
                >
                  <div className="jf-flex jf-items-center jf-justify-center" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedPaths.has(card.filePath)}
                      onChange={() => toggleSelection(card.filePath)}
                      className="jf-h-4 jf-w-4"
                    />
                  </div>

                  <div>
                    <span
                      className="jf-inline-flex jf-h-7 jf-w-7 jf-items-center jf-justify-center jf-rounded-md jf-text-[11px] jf-font-bold"
                      style={{ backgroundColor: typeStyle.bg, color: typeStyle.fg }}
                      title={card.issuetype}
                    >
                      {typeStyle.label}
                    </span>
                  </div>

                  <div className="jf-min-w-0">
                    <div className="jf-flex jf-items-center jf-gap-2 jf-min-w-0">
                      <span className="jf-font-mono jf-text-[12px] jf-font-semibold jf-text-[#0052CC] jf-shrink-0">
                        {highlightText(card.jiraKey, searchQuery)}
                      </span>
                      <span className="jf-truncate jf-text-[14px] jf-font-medium jf-text-[#172B4D]">
                        {highlightText(card.summary, searchQuery)}
                      </span>
                      {card.source === "LOCAL" && (
                        <span className="jf-shrink-0 jf-rounded jf-bg-[#F4F5F7] jf-px-1.5 jf-py-0.5 jf-text-[10px] jf-font-medium jf-text-[#6B778C]">
                          LOCAL
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="jf-inline-flex jf-max-w-full jf-truncate jf-rounded-full jf-bg-[#EBECF0] jf-px-2.5 jf-py-1 jf-text-[11px] jf-font-medium jf-text-[#42526E]">
                      {card.mappedColumn}
                    </span>
                  </div>

                  <div className="jf-flex jf-items-center jf-gap-2 jf-min-w-0">
                    {card.assignee ? (
                      <>
                        <span
                          className="jf-inline-flex jf-h-7 jf-w-7 jf-shrink-0 jf-items-center jf-justify-center jf-rounded-full jf-text-[10px] jf-font-bold jf-text-white"
                          style={{ backgroundColor: stringToColor(card.assignee) }}
                        >
                          {getInitials(card.assignee)}
                        </span>
                        <span className="jf-truncate jf-text-[12px] jf-text-[#42526E]">{highlightText(card.assignee, searchQuery)}</span>
                      </>
                    ) : (
                      <span className="jf-text-[12px] jf-text-[#97A0AF]">未分配</span>
                    )}
                  </div>

                  <div className="jf-text-[12px] jf-text-[#42526E]">
                    {card.dueDate ? card.dueDate.slice(0, 10) : <span className="jf-text-[#97A0AF]">无</span>}
                  </div>

                  <div className="jf-flex jf-items-center jf-gap-2 jf-text-[12px] jf-font-medium jf-text-[#42526E]">
                    <span className="jf-inline-block jf-h-2.5 jf-w-2.5 jf-rounded-full" style={{ backgroundColor: priorityColor }} />
                    <span>{card.priority}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedCards.length > 0 && (
        <div className="jf-sticky jf-bottom-6 jf-flex jf-justify-center jf-pointer-events-none">
          <button
            onClick={copySelectedLinks}
            className="jf-pointer-events-auto jf-rounded-full jf-bg-[#0052CC] jf-px-6 jf-py-3 jf-text-sm jf-font-semibold jf-text-white jf-shadow-[0_8px_24px_rgba(9,30,66,0.24)] hover:jf-bg-[#0747A6] jf-transition-colors"
          >
            批量复制原生链接 ({selectedCards.length})
          </button>
        </div>
      )}
    </div>
  );
};