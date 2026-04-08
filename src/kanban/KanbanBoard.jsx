import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { useState } from "react";
import KanbanColumn from "./KanbanColumn.jsx";
import KanbanCard from "./KanbanCard.jsx";

const COLUMNS = ["backlog", "active", "done"];

export default function KanbanBoard({
  tasksByStatus,
  allTasks,
  onTaskMove,
  onTaskEdit,
  onTaskAdd,
}) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const activeTask = activeId ? allTasks.find((t) => t.id === activeId) : null;

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragEnd(event) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id;
    const newStatus = over.id;
    if (COLUMNS.includes(newStatus)) {
      const task = allTasks.find((t) => t.id === taskId);
      if (task && task.status !== newStatus) {
        onTaskMove(taskId, newStatus);
      }
    }
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="kanban-board">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col}
            id={col}
            tasks={tasksByStatus[col] || []}
            onTaskEdit={onTaskEdit}
            onTaskAdd={onTaskAdd}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="kanban-drag-overlay">
            <KanbanCard task={activeTask} onEdit={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
