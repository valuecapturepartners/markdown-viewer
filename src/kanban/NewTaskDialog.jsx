import { useEffect, useRef, useState } from "react";

export default function NewTaskDialog({
  boards,
  defaultStatus,
  onSave,
  onClose,
}) {
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [source, setSource] = useState("");
  const [details, setDetails] = useState("");
  const [boardFileId, setBoardFileId] = useState(boards[0]?.fileId || "");
  const descRef = useRef(null);

  useEffect(() => {
    descRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim() || !boardFileId) return;
    onSave({
      description: description.trim(),
      owner,
      priority: "medium",
      status: defaultStatus,
      due,
      source,
      details: details.trim(),
      fileId: boardFileId,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit(e);
  };

  return (
    <div
      className="dialog-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dialog" onKeyDown={handleKeyDown}>
        <div className="dialog-header">
          <h2>New Task</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-form">
          <label>
            Description
            <textarea
              ref={descRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be done?"
              rows={2}
              required
            />
          </label>
          <label>
            Owner
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="e.g. jan-niklas"
            />
          </label>
          <label>
            Due date
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label>
            Source
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. weekly-sync"
            />
          </label>
          <label>
            Details
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="Additional context, bullet points, notes..."
            />
          </label>
          {boards.length > 1 && (
            <label>
              Add to board
              <select
                value={boardFileId}
                onChange={(e) => setBoardFileId(e.target.value)}
              >
                {boards.map((b) => (
                  <option key={b.fileId} value={b.fileId}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add Task (Ctrl+Enter)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
