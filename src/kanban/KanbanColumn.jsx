import { useDroppable } from "@dnd-kit/core";
import KanbanCard from "./KanbanCard.jsx";

const COLUMN_LABELS = {
  backlog: "Backlog",
  active: "Active",
  done: "Done",
};

export default function KanbanColumn({ id, tasks, onTaskEdit, onTaskAdd, onTaskMove }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="kanban-column">
      <div className="kanban-column-header">
        <span className="kanban-column-title">{COLUMN_LABELS[id] || id}</span>
        <span className="kanban-column-count">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`kanban-column-body${isOver ? " drag-over" : ""}`}
      >
        {tasks.map((task) => (
          <KanbanCard key={task.id} task={task} onEdit={onTaskEdit} onMove={onTaskMove} />
        ))}
      </div>
      <button className="kanban-column-add" onClick={() => onTaskAdd(id)}>
        + Add task
      </button>
    </div>
  );
}
