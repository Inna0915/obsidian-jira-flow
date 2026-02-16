import React, { useCallback } from "react";
import type { KanbanCard, SwimlaneType } from "../types";
import { Card } from "./Card";

interface ColumnProps {
  columnId: string;
  swimlaneId: SwimlaneType;
  cards: KanbanCard[];
  bgColor: string;
  onCardMove: (cardPath: string, targetColumn: string, targetSwimlane: SwimlaneType) => void;
  onCardClick: (card: KanbanCard) => void;
  onOpenFile: (filePath: string) => void;
}

export const Column: React.FC<ColumnProps> = ({
  columnId,
  swimlaneId,
  cards,
  bgColor,
  onCardMove,
  onCardClick,
  onOpenFile,
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
      className="jf-flex-shrink-0 jf-flex jf-flex-col jf-gap-1 jf-p-1"
      style={{
        width: "160px",
        minWidth: "160px",
        minHeight: "80px",
        backgroundColor: bgColor,
        borderRight: "1px solid var(--background-modifier-border)",
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {cards.length > 0 && (
        <div className="jf-text-[9px] jf-text-center jf-font-medium" style={{ color: "var(--text-muted)" }}>
          {cards.length}
        </div>
      )}
      {cards.map((card) => (
        <Card key={card.filePath} card={card} onCardClick={onCardClick} />
      ))}
    </div>
  );
};
