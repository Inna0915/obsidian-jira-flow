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

const typeBorderColors: Record<string, string> = {
  Bug: "#FF5630",
  Story: "#36B37E",
};

const typeBgColors: Record<string, string> = {
  Bug: "#FFF5F5",
  Story: "#F0FFF4",
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
  const typeBorder = typeBorderColors[card.issuetype];
  const typeBg = typeBgColors[card.issuetype];

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      className="jf-rounded jf-p-2 jf-cursor-pointer jf-shadow-sm jf-transition-shadow hover:jf-shadow-md"
      style={{
        backgroundColor: typeBg || "#fff",
        border: typeBorder
          ? `1.5px solid ${typeBorder}`
          : isOverdue
            ? "1.5px solid #FF5630"
            : "1px solid var(--background-modifier-border)",
        borderLeftWidth: typeBorder || isOverdue ? "4px" : "1px",
        borderLeftColor: typeBorder || (isOverdue ? "#FF5630" : undefined),
        fontSize: "11px",
      }}
    >
      {/* Header: key + type icon */}
      <div className="jf-flex jf-items-center jf-gap-1 jf-mb-1">
        <span title={card.issuetype} style={{ fontSize: "12px" }}>
          {typeIcons[card.issuetype] || "\u{1F4CB}"}
        </span>
        <span className="jf-font-mono" style={{ color: "#0052CC", fontSize: "10px" }}>
          {card.jiraKey}
        </span>
        {card.source === "LOCAL" && (
          <span
            style={{
              fontSize: "9px",
              padding: "0 3px",
              borderRadius: "2px",
              backgroundColor: "#DFE1E6",
              color: "#6B778C",
            }}
          >
            LOCAL
          </span>
        )}
        <span
          className="jf-rounded-full jf-inline-block"
          style={{
            width: "8px",
            height: "8px",
            backgroundColor: priorityColor,
            marginLeft: "auto",
            flexShrink: 0,
          }}
          title={card.priority}
        />
      </div>

      {/* Summary */}
      <div
        className="jf-leading-snug jf-mb-1"
        style={{
          color: "#172B4D",
          fontSize: "11px",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {card.summary}
      </div>

      {/* Footer */}
      <div className="jf-flex jf-items-center jf-justify-between" style={{ fontSize: "10px" }}>
        <div className="jf-flex jf-items-center jf-gap-1">
          {card.storyPoints > 0 && (
            <span
              className="jf-rounded-full jf-px-1 jf-font-bold"
              style={{ backgroundColor: "#DFE1E6", color: "#42526E", fontSize: "9px" }}
            >
              {card.storyPoints}
            </span>
          )}
          {card.dueDate && (
            <span style={{ color: isOverdue ? "#FF5630" : "#6B778C" }}>
              {card.dueDate.slice(0, 10)}
            </span>
          )}
        </div>
        {card.assignee && (
          <span
            className="jf-rounded-full jf-flex jf-items-center jf-justify-center jf-font-bold jf-text-white"
            style={{
              width: "18px",
              height: "18px",
              backgroundColor: "#0052CC",
              fontSize: "8px",
            }}
            title={card.assignee}
          >
            {card.assignee
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </span>
        )}
      </div>
    </div>
  );
};
