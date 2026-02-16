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

export const Swimlane: React.FC<SwimlaneProps> = ({
  swimlane,
  collapsed,
  totalCards,
  onToggle,
  onCardMove,
  onCardClick,
  onOpenFile,
}) => {
  return (
    <div style={{ borderBottom: "1px solid var(--background-modifier-border)" }}>
      {/* Swimlane Row */}
      <div className="jf-flex">
        {/* Swimlane Label (sticky left) */}
        <div
          className="jf-flex-shrink-0 jf-flex jf-items-start jf-cursor-pointer"
          style={{
            width: "140px",
            minWidth: "140px",
            backgroundColor: swimlane.color,
            padding: "8px",
          }}
          onClick={onToggle}
        >
          <div className="jf-flex jf-flex-col jf-gap-1">
            <div className="jf-flex jf-items-center jf-gap-1">
              <span style={{ fontSize: "10px", transition: "transform 0.2s", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
                ▼
              </span>
              <span className="jf-text-[11px] jf-font-bold jf-uppercase jf-tracking-wide" style={{ color: "var(--text-normal)" }}>
                {swimlane.label}
              </span>
            </div>
            <span className="jf-text-[10px]" style={{ color: "var(--text-muted)" }}>
              {totalCards} tasks
            </span>
          </div>
        </div>

        {/* Columns */}
        {!collapsed && KANBAN_COLUMNS.map((colDef) => {
          const cards = swimlane.columns.get(colDef.id) || [];
          return (
            <Column
              key={`${swimlane.id}:${colDef.id}`}
              columnId={colDef.id}
              swimlaneId={swimlane.id}
              cards={cards}
              bgColor={colDef.color}
              onCardMove={onCardMove}
              onCardClick={onCardClick}
              onOpenFile={onOpenFile}
            />
          );
        })}

        {/* Collapsed placeholder */}
        {collapsed && (
          <div
            className="jf-flex-1 jf-flex jf-items-center jf-justify-center jf-text-xs"
            style={{
              backgroundColor: swimlane.color,
              color: "var(--text-muted)",
              padding: "12px",
              minHeight: "40px",
            }}
          >
            {totalCards} tasks (collapsed)
          </div>
        )}
      </div>
    </div>
  );
};
