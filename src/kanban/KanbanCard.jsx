import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";
import StatusPicker from "./StatusPicker.jsx";

export default function KanbanCard({ task, onEdit, onMove }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const isOverdue =
    task.due && new Date(task.due) < new Date() && task.status !== "done";

  return (
    <div
      ref={setNodeRef}
      className={`kanban-card${isDragging ? " dragging" : ""}`}
      onClick={() => onEdit(task)}
      {...listeners}
      {...attributes}
    >
      <div className="kanban-card-desc">{task.description}</div>
      {task.details && (
        <div className="kanban-card-details">{task.details}</div>
      )}
      <div className="kanban-card-meta">
        {task.owner && <span className="kanban-card-owner">{task.owner}</span>}
        {task.due && (
          <span className={`kanban-card-due${isOverdue ? " overdue" : ""}`}>
            {isOverdue ? "Overdue: " : "Due: "}
            {task.due}
          </span>
        )}
        {task.source && (
          <span className="kanban-card-source">{task.source}</span>
        )}
        {task.boardLabel && (
          <span className="kanban-card-board">{task.boardLabel}</span>
        )}
        <StatusPicker
          status={task.status}
          open={pickerOpen}
          onToggle={(e) => { e.stopPropagation(); setPickerOpen((v) => !v); }}
          onMove={(s) => { setPickerOpen(false); if (onMove) onMove(task.id, s); }}
        />
      </div>
    </div>
  );
}
