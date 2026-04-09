import { useRef, useState } from "react";

const COLUMNS = ["backlog", "active", "done"];
const COLUMN_LABELS = { backlog: "Backlog", active: "Active", done: "Done" };
const NEXT_STATUS = { backlog: "active", active: "done", done: "backlog" };
const LONG_PRESS_MS = 500;

function MobileCard({ task, onEdit, onMove }) {
  const timerRef = useRef(null);
  const didLongPress = useRef(false);
  const startPos = useRef(null);
  const [pressing, setPressing] = useState(false);

  const isOverdue =
    task.due && new Date(task.due) < new Date() && task.status !== "done";

  function startPress(x, y) {
    didLongPress.current = false;
    startPos.current = { x, y };
    setPressing(true);
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      setPressing(false);
      navigator.vibrate?.(40);
      onMove(task.id, NEXT_STATUS[task.status]);
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    clearTimeout(timerRef.current);
    setPressing(false);
  }

  function handlePointerDown(e) {
    // Only primary button / first touch
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startPress(e.clientX, e.clientY);
  }

  function handlePointerMove(e) {
    if (!startPos.current) return;
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > 8 || dy > 8) cancelPress(); // finger moved → scroll intent, abort
  }

  function handleClick(e) {
    if (didLongPress.current) {
      e.preventDefault();
      return;
    }
    onEdit(task);
  }

  return (
    <div
      className={`kanban-card km-card${pressing ? " km-pressing" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      onClick={handleClick}
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
        {task.boardLabel && (
          <span className="kanban-card-board">{task.boardLabel}</span>
        )}
      </div>
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

  return (
    <div className="km-shell">
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

      <div className="km-list">
        {tasks.length === 0 && (
          <div className="km-empty">No tasks in {COLUMN_LABELS[activeCol]}</div>
        )}
        {tasks.map((task) => (
          <MobileCard
            key={task.id}
            task={task}
            onEdit={onTaskEdit}
            onMove={onTaskMove}
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
