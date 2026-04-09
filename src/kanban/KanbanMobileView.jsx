import { useState } from "react";

const COLUMNS = ["backlog", "active", "done"];
const COLUMN_LABELS = { backlog: "Backlog", active: "Active", done: "Done" };
const OTHER_STATUSES = {
  backlog: ["active", "done"],
  active: ["backlog", "done"],
  done: ["backlog", "active"],
};

function MobileCard({ task, onEdit, onMove }) {
  const [showMover, setShowMover] = useState(false);

  const isOverdue =
    task.due && new Date(task.due) < new Date() && task.status !== "done";

  return (
    <div className="kanban-card km-card" onClick={() => onEdit(task)}>
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
        {task.boardLabel && (
          <span className="kanban-card-board">{task.boardLabel}</span>
        )}
        <button
          className="kanban-card-move-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowMover((v) => !v);
          }}
        >
          ⇄ Move
        </button>
      </div>
      {showMover && (
        <div className="kanban-card-mover" onClick={(e) => e.stopPropagation()}>
          {OTHER_STATUSES[task.status].map((s) => (
            <button
              key={s}
              className="kanban-card-mover-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowMover(false);
                onMove(task.id, s);
              }}
            >
              → {COLUMN_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function KanbanMobileView({
  tasksByStatus,
  onTaskEdit,
  onTaskAdd,
  onTaskMove,
}) {
  const [activeCol, setActiveCol] = useState("active");
  const tasks = tasksByStatus[activeCol] || [];

  function handleMove(taskId, newStatus) {
    onTaskMove(taskId, newStatus);
  }

  return (
    <div className="km-shell">
      {/* Segmented control */}
      <div className="km-seg">
        {COLUMNS.map((col) => (
          <button
            key={col}
            className={`km-seg-btn${activeCol === col ? " active" : ""}`}
            onClick={() => setActiveCol(col)}
          >
            {COLUMN_LABELS[col]}
            <span className="km-seg-count">
              {(tasksByStatus[col] || []).length}
            </span>
          </button>
        ))}
      </div>

      {/* Scrollable card list */}
      <div className="km-list">
        {tasks.length === 0 && (
          <div className="km-empty">No tasks in {COLUMN_LABELS[activeCol]}</div>
        )}
        {tasks.map((task) => (
          <MobileCard
            key={task.id}
            task={task}
            onEdit={onTaskEdit}
            onMove={handleMove}
          />
        ))}
        <button
          className="kanban-column-add km-add"
          onClick={() => onTaskAdd(activeCol)}
        >
          + Add task
        </button>
      </div>
    </div>
  );
}
