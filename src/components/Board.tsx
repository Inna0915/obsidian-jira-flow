import React from "react";
import { KANBAN_COLUMNS } from "../types";
import type { KanbanCard, SwimlaneType } from "../types";
import type { SwimlaneData } from "./App";
import { Swimlane } from "./Swimlane";

interface BoardProps {
  swimlanes: SwimlaneData[];
  collapsedSwimlanes: Set<SwimlaneType>;
  onToggleSwimlane: (id: SwimlaneType) => void;
  onCardMove: (cardPath: string, targetColumn: string, targetSwimlane: SwimlaneType) => void;
  onCardClick: (card: KanbanCard) => void;
  onOpenFile: (filePath: string) => void;
  searchQuery: string;
  matchedCards: KanbanCard[];
  searchMatchIndex: number;
}

// Column top border colors
const columnBorderColors: Record<string, string> = {
  FUNNEL: "#6B778C",
  DEFINING: "#6B778C",
  READY: "#42526E",
  "TO DO": "#0052CC",
  EXECUTION: "#0052CC",
  EXECUTED: "#0052CC",
  "TESTING & REVIEW": "#6554C0",
  "TEST DONE": "#6554C0",
  VALIDATING: "#FF8B00",
  RESOLVED: "#006644",
  DONE: "#36B37E",
  CLOSED: "#505F79",
};

export const Board: React.FC<BoardProps> = ({
  swimlanes,
  collapsedSwimlanes,
  onToggleSwimlane,
  onCardMove,
  onCardClick,
  onOpenFile,
  searchQuery,
  matchedCards,
  searchMatchIndex,
}) => {
  // Calculate total cards per column across all swimlanes
  const columnCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    KANBAN_COLUMNS.forEach(col => counts[col.id] = 0);
    swimlanes.forEach(sl => {
      sl.columns.forEach((cards, colId) => {
        counts[colId] = (counts[colId] || 0) + cards.length;
      });
    });
    return counts;
  }, [swimlanes]);

  return (
    <div className="jf-flex-1 jf-overflow-auto jf-bg-white/50">
      {/* Single Sticky Header - Rendered once at the top */}
      <div className="jf-flex jf-sticky jf-top-0 jf-z-10 jf-bg-gray-50/95 jf-backdrop-blur jf-border-b jf-border-gray-200 jf-shadow-sm">
        {/* Left Spacer matching swimlane label width */}
        <div 
          className="jf-flex-shrink-0 jf-border-r jf-border-gray-200"
          style={{ width: "140px", minWidth: "140px" }}
        >
          <div className="jf-px-3 jf-py-3">
            <span className="jf-text-xs jf-font-bold jf-text-gray-500 jf-uppercase jf-tracking-wider">
              Swimlane
            </span>
          </div>
        </div>
        
        {/* Column Headers */}
        {KANBAN_COLUMNS.map((col) => {
          const borderColor = columnBorderColors[col.id] || "#6B778C";
          const count = columnCounts[col.id] || 0;
          return (
            <div
              key={col.id}
              className="jf-flex-shrink-0 jf-px-3 jf-py-3 jf-border-r jf-border-gray-200"
              style={{ width: "180px", minWidth: "180px" }}
            >
              <div className="jf-text-center">
                <span className="jf-text-xs jf-font-bold jf-text-gray-600 jf-uppercase jf-tracking-wider">
                  {col.label}
                </span>
                {count > 0 && (
                  <span className="jf-ml-2 jf-bg-gray-200 jf-text-gray-600 jf-text-[10px] jf-px-2 jf-py-0.5 jf-rounded-full jf-font-medium">
                    {count}
                  </span>
                )}
                {/* Status color indicator bar */}
                <div 
                  className="jf-h-1 jf-mt-2 jf-rounded-full"
                  style={{ backgroundColor: borderColor }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Swimlane Rows - No headers inside rows */}
      {swimlanes.map((sl) => {
        // Count total cards in this swimlane
        let totalCards = 0;
        sl.columns.forEach((cards) => { totalCards += cards.length; });

        return (
          <Swimlane
            key={sl.id}
            swimlane={sl}
            collapsed={collapsedSwimlanes.has(sl.id)}
            totalCards={totalCards}
            onToggle={() => onToggleSwimlane(sl.id)}
            onCardMove={onCardMove}
            onCardClick={onCardClick}
            onOpenFile={onOpenFile}
            searchQuery={searchQuery}
            matchedCards={matchedCards}
            searchMatchIndex={searchMatchIndex}
          />
        );
      })}
    </div>
  );
};
