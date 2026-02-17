import React, { useCallback } from "react";
import type { KanbanCard } from "../types";

interface CardProps {
  card: KanbanCard;
  onCardClick: (card: KanbanCard) => void;
}

const priorityColors: Record<string, string> = {
  Highest: "#FF5630",
  High: "#FF7452",
  Medium: "#FFAB00",
  Low: "#36B37E",
  Lowest: "#00875A",
};

const typeIcons: Record<string, string> = {
  Bug: "\u{1F41B}",
  Story: "\u{1F4D7}",
  Task: "\u2705",
  "Sub-task": "\u{1F4CE}",
  Epic: "\u26A1",
};

// Get left border color (hex) for inline style to avoid Tailwind purge issues
const getBorderColor = (issueType: string): string => {
  const type = (issueType || "").toLowerCase();
  switch (type) {
    case "bug": return "#EF4444";      // red-500
    case "story": return "#22C55E";    // green-500
    case "task": return "#60A5FA";     // blue-400
    case "epic": return "#A855F7";     // purple-500
    default: return "#D1D5DB";         // gray-300
  }
};

export const Card: React.FC<CardProps> = ({ card, onCardClick }) => {
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", card.filePath);
      e.dataTransfer.effectAllowed = "move";
    },
    [card.filePath]
  );

  const handleClick = useCallback(() => {
    onCardClick(card);
  }, [card, onCardClick]);

  const priorityColor = priorityColors[card.priority] || "#6B778C";
  const isOverdue = card.swimlane === "overdue";
  const borderLeftColor = getBorderColor(card.issuetype);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      className="jf-bg-white jf-p-3 jf-rounded-r-lg jf-rounded-l-sm jf-shadow-sm jf-border jf-border-gray-200 hover:jf-shadow-md hover:jf-border-gray-300 jf-transition-all jf-cursor-grab active:jf-cursor-grabbing jf-group jf-relative"
      style={{ borderLeftWidth: "4px", borderLeftColor, borderLeftStyle: "solid" }}
    >
      {/* Header: Key + Type icon + Priority dot */}
      <div className="jf-flex jf-items-center jf-gap-1.5 jf-mb-2">
        <span className="jf-text-xs" title={card.issuetype}>
          {typeIcons[card.issuetype] || "\u{1F4CB}"}
        </span>
        <span className="jf-font-mono jf-text-[10px] jf-font-semibold jf-text-blue-600 jf-bg-blue-50 jf-px-1.5 jf-py-0.5 jf-rounded">
          {card.jiraKey}
        </span>
        {card.source === "LOCAL" && (
          <span className="jf-text-[9px] jf-px-1.5 jf-py-0.5 jf-rounded jf-bg-gray-100 jf-text-gray-500 jf-font-medium">
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
      <div className="jf-text-sm jf-font-medium jf-text-gray-800 jf-leading-snug jf-mb-3 line-clamp-2">
        {card.summary}
      </div>

      {/* Footer */}
      <div className="jf-flex jf-items-center jf-justify-between jf-text-xs jf-text-gray-400">
        <div className="jf-flex jf-items-center jf-gap-2">
          {/* Story Points */}
          {card.storyPoints > 0 && (
            <span className="jf-bg-gray-100 jf-px-1.5 jf-py-0.5 jf-rounded jf-text-gray-500 jf-font-medium jf-text-[10px]">
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
            title={card.assignee}
          >
            {getInitials(card.assignee)}
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
