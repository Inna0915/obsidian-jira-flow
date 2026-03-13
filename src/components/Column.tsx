import React, { useCallback } from "react";
import type { KanbanCard, SwimlaneType } from "../types";
import { Card } from "./Card";

interface ColumnProps {
  columnId: string;
  swimlaneId: SwimlaneType;
  cards: KanbanCard[];
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
}

export const Column: React.FC<ColumnProps> = ({
  columnId,
  swimlaneId,
  cards,
  onCardMove,
  onCardOpen,
  onCardSelect,
  onCardDragStart,
  onCardDragEnd,
  searchQuery,
  matchedCards,
  searchMatchIndex,
  selectedPaths,
  dragState,
  onDragStateChange,
}) => {
  const isAllowedDropTarget = dragState.allowedColumns.has(columnId);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!dragState.isDragging || !isAllowedDropTarget) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, [dragState.isDragging, isAllowedDropTarget]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const selectedDrag = e.dataTransfer.getData("application/x-jira-flow-selection") === "selected";
      if (selectedDrag && dragState.activePaths.size > 0) {
        dragState.activePaths.forEach((cardPath) => {
          onCardMove(cardPath, columnId, swimlaneId);
        });
      } else {
        const cardPath = e.dataTransfer.getData("application/x-jira-flow-card") || e.dataTransfer.getData("text/plain");
        if (cardPath) {
          onCardMove(cardPath, columnId, swimlaneId);
        }
      }
      onDragStateChange({ isDragging: false, allowedColumns: new Set(), activePaths: new Set() });
    },
    [columnId, swimlaneId, onCardMove, dragState.activePaths, onDragStateChange]
  );

  return (
    <div
      className={`jf-flex-shrink-0 jf-border-r jf-border-gray-100 jf-transition-all ${
        dragState.isDragging
          ? isAllowedDropTarget
            ? 'jf-bg-[#E9F2FF] jf-outline jf-outline-2 jf-outline-dashed jf-outline-[#4C9AFF]'
            : 'jf-bg-[#F7F8FA] jf-opacity-60'
          : 'jf-bg-gray-50/10'
      }`}
      style={{ width: "180px", minWidth: "180px" }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Column Body - No header here anymore, just cards */}
      <div className="jf-px-2 jf-py-3 jf-space-y-2 jf-min-h-[120px]">
        {cards.map((card) => (
          <Card
            key={card.filePath}
            card={card}
            onCardOpen={onCardOpen}
            onCardSelect={onCardSelect}
            onCardDragStart={onCardDragStart}
            onCardDragEnd={onCardDragEnd}
            searchQuery={searchQuery}
            isCurrentMatch={matchedCards.length > 0 && matchedCards[searchMatchIndex]?.filePath === card.filePath}
            isSelected={selectedPaths.has(card.filePath)}
            selectedCount={selectedPaths.has(card.filePath) ? selectedPaths.size : 0}
          />
        ))}
      </div>
    </div>
  );
};
