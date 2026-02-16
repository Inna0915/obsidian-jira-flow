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
}

export const Board: React.FC<BoardProps> = ({
  swimlanes,
  collapsedSwimlanes,
  onToggleSwimlane,
  onCardMove,
  onCardClick,
  onOpenFile,
}) => {
  return (
    <div className="jf-flex-1 jf-overflow-auto">
      {/* Column Headers */}
      <div className="jf-flex jf-sticky jf-top-0 jf-z-10" style={{ backgroundColor: "var(--background-primary)" }}>
        {/* Swimlane label spacer */}
        <div className="jf-flex-shrink-0" style={{ width: "140px", minWidth: "140px" }} />
        {KANBAN_COLUMNS.map((col) => (
          <div
            key={col.id}
            className="jf-flex-shrink-0 jf-px-2 jf-py-2 jf-text-center"
            style={{ width: "160px", minWidth: "160px" }}
          >
            <span
              className="jf-text-[10px] jf-font-bold jf-uppercase jf-tracking-wide"
              style={{ color: col.headerColor }}
            >
              {col.label}
            </span>
          </div>
        ))}
      </div>

      {/* Swimlane Rows */}
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
          />
        );
      })}
    </div>
  );
};
