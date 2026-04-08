import { useEffect, useRef, useState } from "react";

export default function TaskEditDialog({ task, onSave, onClose }) {
  const [description, setDescription] = useState(task.description);
  const [owner, setOwner] = useState(task.owner);
  const [status, setStatus] = useState(task.status);
  const [due, setDue] = useState(task.due);
  const [source, setSource] = useState(task.source);
  const [details, setDetails] = useState(task.details || "");
  const descRef = useRef(null);

  useEffect(() => {
    descRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim()) return;
    onSave(task.id, {
      description: description.trim(),
      owner,
      status,
      due,
      source,
      details: details.trim(),
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
          <h2>Edit Task</h2>
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
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="backlog">Backlog</option>
              <option value="active">Active</option>
              <option value="done">Done</option>
            </select>
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
              rows={4}
              placeholder="Additional context, bullet points, notes..."
            />
          </label>
          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save (Ctrl+Enter)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
