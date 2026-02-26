import React, { useCallback } from "react";
import type { KanbanCard, SwimlaneType } from "../types";
import { Card } from "./Card";

interface ColumnProps {
  columnId: string;
  swimlaneId: SwimlaneType;
  cards: KanbanCard[];
  onCardMove: (cardPath: string, targetColumn: string, targetSwimlane: SwimlaneType) => void;
  onCardClick: (card: KanbanCard) => void;
  onOpenFile: (filePath: string) => void;
  searchQuery: string;
  matchedCards: KanbanCard[];
  searchMatchIndex: number;
}

export const Column: React.FC<ColumnProps> = ({
  columnId,
  swimlaneId,
  cards,
  onCardMove,
  onCardClick,
  searchQuery,
  matchedCards,
  searchMatchIndex,
}) => {
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const cardPath = e.dataTransfer.getData("text/plain");
      if (cardPath) {
        onCardMove(cardPath, columnId, swimlaneId);
      }
    },
    [columnId, swimlaneId, onCardMove]
  );

  return (
    <div
      className="jf-flex-shrink-0 jf-border-r jf-border-gray-100 jf-bg-gray-50/10"
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
            onCardClick={onCardClick}
            searchQuery={searchQuery}
            isCurrentMatch={matchedCards.length > 0 && matchedCards[searchMatchIndex]?.filePath === card.filePath}
          />
        ))}
      </div>
    </div>
  );
};
