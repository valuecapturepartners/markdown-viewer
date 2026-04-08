import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useAuth } from "../auth/auth-context.jsx";
import {
  findBoardFiles,
  getBoardLabel,
  readFile,
  saveFile,
} from "../drive/drive-api.js";
import {
  parseBoard,
  serializeTask,
  updateBoardContent,
  appendTaskToBoard,
} from "./board-parser.js";
import KanbanBoard from "./KanbanBoard.jsx";
import FilterBar from "./FilterBar.jsx";
import TaskEditDialog from "./TaskEditDialog.jsx";
import NewTaskDialog from "./NewTaskDialog.jsx";

function reducer(state, action) {
  switch (action.type) {
    case "LOADING":
      return { ...state, loading: true, error: null };
    case "BOARDS_LOADED":
      return { ...state, loading: false, boards: action.boards };
    case "BOARDS_ERROR":
      return { ...state, loading: false, error: action.error };
    case "TASK_UPDATED": {
      const { taskId, changes } = action;
      const boards = state.boards.map((b) => ({
        ...b,
        tasks: b.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const updated = { ...t, ...changes };
          if (changes.status === "done" && !t.done) {
            updated.done = true;
            updated.doneDate = new Date().toISOString().slice(0, 10);
          } else if (changes.status && changes.status !== "done") {
            updated.done = false;
            updated.doneDate = "";
          }
          return updated;
        }),
      }));
      return { ...state, boards };
    }
    case "TASK_ADDED": {
      const { task } = action;
      const boards = state.boards.map((b) => {
        if (b.fileId !== task.fileId) return b;
        return {
          ...b,
          tasks: [...b.tasks, task],
          content: appendTaskToBoard(b.content, serializeTask(task)),
        };
      });
      return { ...state, boards };
    }
    case "BOARD_CONTENT_UPDATED": {
      const { fileId, content } = action;
      const boards = state.boards.map((b) =>
        b.fileId === fileId ? { ...b, content } : b,
      );
      return { ...state, boards };
    }
    case "SET_FILTER":
      return {
        ...state,
        filters: { ...state.filters, [action.key]: action.value },
      };
    case "CONFLICT":
      return { ...state, conflict: action.message };
    case "CLEAR_CONFLICT":
      return { ...state, conflict: null };
    default:
      return state;
  }
}

const initialState = {
  boards: [],
  loading: true,
  error: null,
  filters: { owner: null, board: null, dueRange: null },
  conflict: null,
};

function isInThisWeek(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
  return d >= now && d <= endOfWeek;
}

function matchesDueFilter(task, dueRange) {
  if (!dueRange) return true;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  switch (dueRange) {
    case "overdue":
      return task.due && new Date(task.due) < now && task.status !== "done";
    case "this-week":
      return task.due && isInThisWeek(task.due);
    case "later":
      return (
        task.due &&
        new Date(task.due) >
          new Date(
            new Date().setDate(
              new Date().getDate() + (7 - new Date().getDay()),
            ),
          )
      );
    case "no-date":
      return !task.due;
    default:
      return true;
  }
}

export default function KanbanScreen({ onOpenEditor, onOpenCapture, inMobileShell }) {
  const { accessToken, userInfo } = useAuth();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [editTask, setEditTask] = useState(null);
  const [newTaskStatus, setNewTaskStatus] = useState(null);

  const loadBoards = useCallback(async () => {
    dispatch({ type: "LOADING" });
    try {
      const files = await findBoardFiles(accessToken);
      const boards = await Promise.all(
        files.map(async (f) => {
          const [content, label] = await Promise.all([
            readFile(accessToken, f.id),
            getBoardLabel(accessToken, f.id),
          ]);
          const tasks = parseBoard(content, {
            fileId: f.id,
            boardLabel: label,
          });
          return { fileId: f.id, label, content, tasks };
        }),
      );
      dispatch({ type: "BOARDS_LOADED", boards });
    } catch (err) {
      dispatch({ type: "BOARDS_ERROR", error: err.message });
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) loadBoards();
  }, [accessToken, loadBoards]);

  const allTasks = useMemo(
    () => state.boards.flatMap((b) => b.tasks),
    [state.boards],
  );

  const filteredTasks = useMemo(() => {
    const { owner, board, dueRange } = state.filters;
    return allTasks.filter((t) => {
      if (owner && t.owner !== owner) return false;
      if (board && t.fileId !== board) return false;
      if (!matchesDueFilter(t, dueRange)) return false;
      return true;
    });
  }, [allTasks, state.filters]);

  const tasksByStatus = useMemo(() => {
    const groups = { backlog: [], active: [], done: [] };
    for (const t of filteredTasks) {
      const col = groups[t.status] ? t.status : "backlog";
      groups[col].push(t);
    }
    // Sort: high priority first, then by due date
    const priorityOrder = { high: 0, medium: 1, low: 2, "": 3 };
    for (const col of Object.keys(groups)) {
      groups[col].sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 3;
        const pb = priorityOrder[b.priority] ?? 3;
        if (pa !== pb) return pa - pb;
        if (a.due && b.due) return a.due.localeCompare(b.due);
        if (a.due) return -1;
        if (b.due) return 1;
        return 0;
      });
    }
    return groups;
  }, [filteredTasks]);

  const owners = useMemo(
    () => [...new Set(allTasks.map((t) => t.owner).filter(Boolean))].sort(),
    [allTasks],
  );
  const boardsList = useMemo(() => {
    const seen = new Set();
    return state.boards
      .filter((b) => {
        if (seen.has(b.fileId)) return false;
        seen.add(b.fileId);
        return true;
      })
      .map((b) => ({ fileId: b.fileId, label: b.label }));
  }, [state.boards]);

  const handleTaskMove = useCallback(
    async (taskId, newStatus) => {
      dispatch({
        type: "TASK_UPDATED",
        taskId,
        changes: { status: newStatus },
      });
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;
      try {
        const currentContent = await readFile(accessToken, task.fileId);
        const updatedTask = { ...task, status: newStatus };
        if (newStatus === "done") {
          updatedTask.done = true;
          updatedTask.doneDate = new Date().toISOString().slice(0, 10);
        } else {
          updatedTask.done = false;
          updatedTask.doneDate = "";
        }
        const newLine = serializeTask(updatedTask);
        const { updatedContent, conflict } = updateBoardContent(
          currentContent,
          task.lineIndex,
          newLine,
          task.rawLine,
          task.lineCount || 1,
        );
        if (conflict) {
          dispatch({
            type: "CONFLICT",
            message: "File changed externally. Click Refresh to reload.",
          });
          return;
        }
        await saveFile(accessToken, task.fileId, updatedContent);
        dispatch({
          type: "BOARD_CONTENT_UPDATED",
          fileId: task.fileId,
          content: updatedContent,
        });
      } catch (err) {
        dispatch({ type: "CONFLICT", message: `Save failed: ${err.message}` });
      }
    },
    [accessToken, allTasks],
  );

  const handleTaskEdit = useCallback(
    async (taskId, changes) => {
      dispatch({ type: "TASK_UPDATED", taskId, changes });
      setEditTask(null);
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;
      try {
        const currentContent = await readFile(accessToken, task.fileId);
        const updatedTask = { ...task, ...changes };
        if (changes.status === "done" && !task.done) {
          updatedTask.done = true;
          updatedTask.doneDate = new Date().toISOString().slice(0, 10);
        } else if (changes.status && changes.status !== "done") {
          updatedTask.done = false;
          updatedTask.doneDate = "";
        }
        const newLine = serializeTask(updatedTask);
        const { updatedContent, conflict } = updateBoardContent(
          currentContent,
          task.lineIndex,
          newLine,
          task.rawLine,
          task.lineCount || 1,
        );
        if (conflict) {
          dispatch({
            type: "CONFLICT",
            message: "File changed externally. Click Refresh to reload.",
          });
          return;
        }
        await saveFile(accessToken, task.fileId, updatedContent);
        dispatch({
          type: "BOARD_CONTENT_UPDATED",
          fileId: task.fileId,
          content: updatedContent,
        });
      } catch (err) {
        dispatch({ type: "CONFLICT", message: `Save failed: ${err.message}` });
      }
    },
    [accessToken, allTasks],
  );

  const handleNewTask = useCallback(
    async (taskData) => {
      setNewTaskStatus(null);
      const board = state.boards.find((b) => b.fileId === taskData.fileId);
      if (!board) return;
      const task = {
        id: `${taskData.fileId}:new-${Date.now()}`,
        fileId: taskData.fileId,
        boardLabel: board.label,
        lineIndex: -1,
        lineCount: 1,
        rawLine: "",
        done: taskData.status === "done",
        description: taskData.description,
        owner: taskData.owner,
        priority: taskData.priority || "medium",
        status: taskData.status,
        due: taskData.due,
        source: taskData.source,
        details: taskData.details || "",
        doneDate:
          taskData.status === "done"
            ? new Date().toISOString().slice(0, 10)
            : "",
      };
      const newLine = serializeTask(task);
      try {
        const currentContent = await readFile(accessToken, task.fileId);
        const updatedContent = appendTaskToBoard(currentContent, newLine);
        await saveFile(accessToken, task.fileId, updatedContent);
        // Reload to get correct line indexes
        await loadBoards();
      } catch (err) {
        dispatch({ type: "CONFLICT", message: `Save failed: ${err.message}` });
      }
    },
    [accessToken, state.boards, loadBoards],
  );

  return (
    <div className="kanban-shell">
      <header className="kanban-header">
        <span className="app-title">VCP</span>
        {!inMobileShell && onOpenEditor && (
          <button className="toolbar-btn" onClick={onOpenEditor}>
            Editor
          </button>
        )}
        {!inMobileShell && onOpenCapture && (
          <button className="toolbar-btn" onClick={onOpenCapture}>
            Capture
          </button>
        )}
        <button
          className="toolbar-btn"
          onClick={loadBoards}
          disabled={state.loading}
          title="Refresh boards"
        >
          Refresh
        </button>
        <span className="header-spacer" />
        {userInfo && (
          <span className="user-block">
            {userInfo.picture && <img src={userInfo.picture} alt="" />}
            <span className="desktop-only">
              {userInfo.given_name || userInfo.name}
            </span>
          </span>
        )}
      </header>

      {state.conflict && (
        <div className="kanban-conflict">
          <span>{state.conflict}</span>
          <button
            onClick={() => {
              dispatch({ type: "CLEAR_CONFLICT" });
              loadBoards();
            }}
          >
            Refresh
          </button>
        </div>
      )}

      {!state.loading && !state.error && allTasks.length > 0 && (
        <FilterBar
          filters={state.filters}
          owners={owners}
          boards={boardsList}
          onFilterChange={(key, value) =>
            dispatch({ type: "SET_FILTER", key, value })
          }
        />
      )}

      {state.loading && <div className="kanban-loading">Loading boards...</div>}
      {state.error && <div className="kanban-error">{state.error}</div>}
      {!state.loading && !state.error && allTasks.length === 0 && (
        <div className="kanban-empty">No board.md files found on Drive</div>
      )}
      {!state.loading && !state.error && allTasks.length > 0 && (
        <KanbanBoard
          tasksByStatus={tasksByStatus}
          allTasks={filteredTasks}
          onTaskMove={handleTaskMove}
          onTaskEdit={(task) => setEditTask(task)}
          onTaskAdd={(status) => setNewTaskStatus(status)}
        />
      )}

      {editTask && (
        <TaskEditDialog
          task={editTask}
          onSave={handleTaskEdit}
          onClose={() => setEditTask(null)}
        />
      )}
      {newTaskStatus && (
        <NewTaskDialog
          boards={boardsList}
          defaultStatus={newTaskStatus}
          onSave={handleNewTask}
          onClose={() => setNewTaskStatus(null)}
        />
      )}
    </div>
  );
}
