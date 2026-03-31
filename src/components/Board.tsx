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
  onCardOpen: (card: KanbanCard) => void;
  onCardSelect: (card: KanbanCard, options: { additive: boolean; range: boolean }) => void;
  onCardDragStart: (card: KanbanCard) => void;
  onCardDragEnd: () => void;
  onOpenFile: (filePath: string) => void;
  searchQuery: string;
  matchedCards: KanbanCard[];
  searchMatchIndex: number;
  selectedPaths: Set<string>;
  dragState: {
    isDragging: boolean;
    allowedColumns: Set<string>;
    activePaths: Set<string>;
  };
  onDragStateChange: (state: { isDragging: boolean; allowedColumns: Set<string>; activePaths: Set<string> }) => void;
  onClearSelection: () => void;
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
  onCardOpen,
  onCardSelect,
  onCardDragStart,
  onCardDragEnd,
  onOpenFile,
  searchQuery,
  matchedCards,
  searchMatchIndex,
  selectedPaths,
  dragState,
  onDragStateChange,
  onClearSelection,
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

  const handleBoardMouseDown = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-card-path]")) return;
    if (target.closest("[data-preserve-selection='true']")) return;
    onClearSelection();
  }, [onClearSelection]);

  return (
    <div className="jf-flex-1 jf-overflow-auto jf-bg-[#F7F8FA]" onMouseDown={handleBoardMouseDown}>
      {/* Single Sticky Header - Rendered once at the top */}
      <div className="jf-flex jf-sticky jf-top-0 jf-z-10 jf-bg-[#FAFBFC]/95 jf-backdrop-blur jf-border-b jf-border-[#DFE1E6]" data-preserve-selection="true">
        {/* Left Spacer matching swimlane label width */}
        <div 
          className="jf-flex-shrink-0 jf-border-r jf-border-gray-200"
          data-preserve-selection="true"
          style={{ width: "140px", minWidth: "140px" }}
        >
          <div className="jf-px-3 jf-py-3 jf-text-left">
            <span className="jf-text-[11px] jf-font-semibold jf-text-[#6B778C] jf-uppercase jf-tracking-wider">
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
              className="jf-flex-shrink-0 jf-px-3 jf-py-3 jf-border-r jf-border-[#DFE1E6]"
              data-preserve-selection="true"
              style={{ width: "180px", minWidth: "180px" }}
            >
              <div className="jf-flex jf-flex-col jf-items-start jf-gap-2 jf-text-left">
                <div className="jf-flex jf-items-center jf-gap-2">
                  <span className="jf-text-[11px] jf-font-semibold jf-text-[#42526E] jf-uppercase jf-tracking-wider">
                    {col.label}
                  </span>
                  {count > 0 && (
                    <span className="jf-bg-[#EBECF0] jf-text-[#42526E] jf-text-[10px] jf-px-2 jf-py-0.5 jf-rounded-full jf-font-medium">
                      {count}
                    </span>
                  )}
                </div>
                {/* Status color indicator bar */}
                <div 
                  className="jf-h-1 jf-w-full jf-rounded-full"
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
            onCardOpen={onCardOpen}
            onCardSelect={onCardSelect}
            onCardDragStart={onCardDragStart}
            onCardDragEnd={onCardDragEnd}
            onOpenFile={onOpenFile}
            searchQuery={searchQuery}
            matchedCards={matchedCards}
            searchMatchIndex={searchMatchIndex}
            selectedPaths={selectedPaths}
            dragState={dragState}
            onDragStateChange={onDragStateChange}
          />
        );
      })}
    </div>
  );
};
