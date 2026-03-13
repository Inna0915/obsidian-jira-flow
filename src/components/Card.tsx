import React, { useCallback, useRef } from "react";
import { getAllowedTransitions, type KanbanCard } from "../types";

interface CardProps {
  card: KanbanCard;
  onCardClick: (card: KanbanCard) => void;
  onCardSelect?: (card: KanbanCard, additive: boolean) => void;
  onCardDragStart?: (card: KanbanCard) => void;
  onCardDragEnd?: () => void;
  searchQuery: string;
  isCurrentMatch?: boolean;
  isSelected?: boolean;
  selectedCount?: number;
}

// Helper function to highlight matching text
const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query || !text) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <span className="jf-bg-yellow-200 jf-text-gray-900 jf-font-semibold jf-rounded jf-px-0.5">
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  );
};

const priorityColors: Record<string, string> = {
  Highest: "#FF5630",
  High: "#FF7452",
  Medium: "#FFAB00",
  Low: "#36B37E",
  Lowest: "#00875A",
};

const typeIcons: Record<string, string> = {
  Bug: "B",
  Story: "S",
  Task: "T",
  Feature: "F",
  Personal: "P",
  "Sub-task": "ST",
  Epic: "E",
};

// Get left border color (hex) for inline style to avoid Tailwind purge issues
const getBorderColor = (issueType: string): string => {
  const type = (issueType || "").toLowerCase();
  switch (type) {
    case "bug": return "#EF4444";      // red-500
    case "story": return "#22C55E";    // green-500
    case "task": return "#60A5FA";     // blue-400
    case "feature": return "#3B82F6";  // blue-500
    case "personal": return "#F59E0B"; // amber-500
    case "epic": return "#A855F7";     // purple-500
    default: return "#D1D5DB";         // gray-300
  }
};

const getTypeBackground = (issueType: string): string => {
  const type = (issueType || "").toLowerCase();
  switch (type) {
    case "bug": return "#FFEBE6";
    case "story": return "#E3FCEF";
    case "task": return "#DEEBFF";
    case "feature": return "#DEEBFF";
    case "personal": return "#FFF0B3";
    case "epic": return "#EAE6FF";
    default: return "#F4F5F7";
  }
};

export const Card: React.FC<CardProps> = ({ card, onCardClick, onCardSelect, onCardDragStart, onCardDragEnd, searchQuery, isCurrentMatch, isSelected, selectedCount = 0 }) => {
  const dragTriggeredRef = useRef(false);
  const isMatched = searchQuery && (
    card.jiraKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.assignee?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.priority.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.issuetype.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      dragTriggeredRef.current = true;
      onCardDragStart?.(card);
      e.dataTransfer.setData("text/plain", card.filePath);
      e.dataTransfer.setData("application/x-jira-flow-card", card.filePath);
      e.dataTransfer.effectAllowed = "move";

      if (isSelected && selectedCount > 1) {
        e.dataTransfer.setData("application/x-jira-flow-selection", "selected");
      }
    },
    [card, card.filePath, isSelected, onCardDragStart, selectedCount]
  );

  const handleDragEnd = useCallback(() => {
    window.setTimeout(() => {
      dragTriggeredRef.current = false;
      onCardDragEnd?.();
    }, 0);
  }, [onCardDragEnd]);

  const handleClick = useCallback((event: React.MouseEvent) => {
    if (dragTriggeredRef.current) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && onCardSelect) {
      onCardSelect(card, true);
      return;
    }

    onCardClick(card);
  }, [card, onCardClick, onCardSelect]);

  const handleSelectionToggle = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onCardSelect?.(card, true);
  }, [card, onCardSelect]);

  const priorityColor = priorityColors[card.priority] || "#6B778C";
  const isOverdue = card.swimlane === "overdue";
  const borderLeftColor = getBorderColor(card.issuetype);
  const typeBackground = getTypeBackground(card.issuetype);
  const allowedTargets = getAllowedTransitions(card.issuetype, card.mappedColumn, card.source);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      data-card-path={card.filePath}
      className={`jf-bg-white jf-p-3 jf-rounded-md jf-shadow-[0_1px_2px_rgba(9,30,66,0.08)] jf-border hover:jf-shadow-[0_4px_8px_rgba(9,30,66,0.16)] hover:jf-border-[#C1C7D0] jf-transition-all jf-cursor-grab active:jf-cursor-grabbing jf-group jf-relative ${
        isSelected
          ? "jf-border-[#0052CC] jf-ring-2 jf-ring-[#4C9AFF]"
          :
        isCurrentMatch
          ? "jf-border-blue-600 jf-ring-4 jf-ring-blue-300 jf-z-10"
          : isMatched
          ? "jf-border-blue-400 jf-ring-2 jf-ring-blue-200"
          : "jf-border-[#DFE1E6]"
      }`}
      style={{ borderLeftWidth: "4px", borderLeftColor, borderLeftStyle: "solid" }}
    >
      <button
        type="button"
        onClick={handleSelectionToggle}
        className={`jf-absolute jf-top-2 jf-right-2 jf-inline-flex jf-items-center jf-justify-center jf-w-5 jf-h-5 jf-rounded-full jf-border jf-transition-all ${
          isSelected
            ? "jf-bg-[#0052CC] jf-border-[#0052CC] jf-text-white"
            : "jf-bg-white jf-border-[#C1C7D0] jf-text-[#6B778C] hover:jf-border-[#4C9AFF]"
        }`}
        title={isSelected ? "取消选择" : "加入批量选择"}
      >
        <span className="jf-text-[10px] jf-font-bold">
          {isSelected ? (selectedCount > 1 ? selectedCount : "✓") : "+"}
        </span>
      </button>
      {/* Header: Key + Type icon + Priority dot */}
      <div className="jf-flex jf-items-center jf-gap-1.5 jf-mb-2">
        <span
          className="jf-inline-flex jf-h-5 jf-min-w-[20px] jf-items-center jf-justify-center jf-rounded-[4px] jf-px-1 jf-text-[10px] jf-font-bold"
          title={card.issuetype}
          style={{ backgroundColor: typeBackground, color: borderLeftColor }}
        >
          {typeIcons[card.issuetype] || "?"}
        </span>
        <span className="jf-font-mono jf-text-[10px] jf-font-semibold jf-text-[#0052CC] jf-bg-[#DEEBFF] jf-px-1.5 jf-py-0.5 jf-rounded">
          {highlightText(card.jiraKey, searchQuery)}
        </span>
        {card.source === "LOCAL" && (
          <span className="jf-text-[9px] jf-px-1.5 jf-py-0.5 jf-rounded jf-bg-[#F4F5F7] jf-text-[#6B778C] jf-font-medium">
            LOCAL
          </span>
        )}
        <span
          className="jf-w-2 jf-h-2 jf-rounded-full jf-ml-auto"
          style={{ backgroundColor: priorityColor }}
          title={card.priority}
        />
      </div>

      {/* Summary */}
      <div className="jf-text-sm jf-font-medium jf-text-[#172B4D] jf-leading-snug jf-mb-3 line-clamp-2">
        {highlightText(card.summary, searchQuery)}
      </div>

      {/* Footer */}
      <div className="jf-flex jf-items-center jf-justify-between jf-text-xs jf-text-[#6B778C]">
        <div className="jf-flex jf-items-center jf-gap-2">
          {/* Story Points */}
          {card.storyPoints > 0 && (
            <span className="jf-bg-[#F4F5F7] jf-px-1.5 jf-py-0.5 jf-rounded jf-text-[#42526E] jf-font-medium jf-text-[10px]">
              {card.storyPoints}
            </span>
          )}
          
          {/* Due Date */}
          {card.dueDate && (
            <span className={`jf-flex jf-items-center jf-gap-1 ${isOverdue ? "jf-text-red-500" : ""}`}>
              <svg className="jf-w-3 jf-h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="jf-text-[10px]">{card.dueDate.slice(0, 10)}</span>
            </span>
          )}
        </div>

        {/* Assignee Avatar */}
        {card.assignee && (
          <span
            className="jf-w-5 jf-h-5 jf-rounded-full jf-flex jf-items-center jf-justify-center jf-text-white jf-text-[9px] jf-font-bold"
            style={{ backgroundColor: stringToColor(card.assignee) }}
            title={highlightText(card.assignee, searchQuery)?.toString() || card.assignee}
          >
            {getInitials(card.assignee)}
          </span>
        )}
      </div>

      <div className="jf-mt-2 jf-flex jf-flex-wrap jf-gap-1">
        {allowedTargets.slice(0, 3).map((columnId) => (
          <span key={columnId} className="jf-text-[9px] jf-px-1.5 jf-py-0.5 jf-rounded-full jf-bg-[#F4F5F7] jf-text-[#6B778C]">
            {columnId}
          </span>
        ))}
        {allowedTargets.length > 3 && (
          <span className="jf-text-[9px] jf-px-1.5 jf-py-0.5 jf-rounded-full jf-bg-[#F4F5F7] jf-text-[#6B778C]">
            +{allowedTargets.length - 3}
          </span>
        )}
      </div>
    </div>
  );
};

// Helper to generate consistent color from string
function stringToColor(str: string): string {
  const colors = [
    "#0052CC", "#00B8D9", "#6554C0", "#FF5630", "#FFAB00",
    "#36B37E", "#00875A", "#253858", "#6B778C", "#FF7452"
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Helper to get initials from name
function getInitials(name: string): string {
  return name
    .split(/[\s._-]+/)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
