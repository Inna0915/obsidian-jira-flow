import React from "react";
import { KANBAN_COLUMNS } from "../types";
import type { KanbanCard, SwimlaneType } from "../types";
import type { SwimlaneData } from "./App";
import { Column } from "./Column";

interface SwimlaneProps {
  swimlane: SwimlaneData;
  collapsed: boolean;
  totalCards: number;
  onToggle: () => void;
  onCardMove: (cardPath: string, targetColumn: string, targetSwimlane: SwimlaneType) => void;
  onCardClick: (card: KanbanCard) => void;
  onOpenFile: (filePath: string) => void;
}

// Swimlane indicator colors (left border)
const swimlaneAccentColors: Record<SwimlaneType, string> = {
  overdue: "#FF5630",
  onSchedule: "#36B37E",
  others: "#6B778C",
};

export const Swimlane: React.FC<SwimlaneProps> = ({
  swimlane,
  collapsed,
  totalCards,
  onToggle,
  onCardMove,
  onCardClick,
  onOpenFile,
}) => {
  const accentColor = swimlaneAccentColors[swimlane.id];

  return (
    <div className="jf-border-b jf-border-gray-200">
      {/* Swimlane Row */}
      <div className="jf-flex jf-flex-row">
        {/* Swimlane Label - Fixed width matching header spacer */}
        <div
          className="jf-flex-shrink-0 jf-flex jf-items-start jf-cursor-pointer jf-bg-white hover:jf-bg-gray-50 jf-transition-colors jf-border-r jf-border-gray-200"
          style={{
            width: "140px",
            minWidth: "140px",
            borderLeftWidth: "4px",
            borderLeftStyle: "solid",
            borderLeftColor: accentColor,
          }}
          onClick={onToggle}
        >
          <div className="jf-flex jf-flex-col jf-gap-1 jf-p-3">
            <div className="jf-flex jf-items-center jf-gap-1.5">
              <span 
                className="jf-text-xs jf-transition-transform jf-duration-200"
                style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
              >
                <svg className="jf-w-3 jf-h-3 jf-text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </span>
              <span className="jf-text-xs jf-font-bold jf-text-gray-700 jf-uppercase jf-tracking-wide">
                {swimlane.label}
              </span>
            </div>
            <span className="jf-text-[10px] jf-text-gray-400 jf-pl-4.5">
              {totalCards} tasks
            </span>
          </div>
        </div>

        {/* Columns - Drop zones only, no headers */}
        {!collapsed && KANBAN_COLUMNS.map((colDef) => {
          const cards = swimlane.columns.get(colDef.id) || [];
          return (
            <Column
              key={`${swimlane.id}:${colDef.id}`}
              columnId={colDef.id}
              swimlaneId={swimlane.id}
              cards={cards}
              onCardMove={onCardMove}
              onCardClick={onCardClick}
              onOpenFile={onOpenFile}
            />
          );
        })}

        {/* Collapsed placeholder */}
        {collapsed && (
          <div className="jf-flex-1 jf-flex jf-items-center jf-px-4 jf-py-3 jf-bg-gray-50/50">
            <span className="jf-text-xs jf-text-gray-400">
              {totalCards} tasks hidden
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
