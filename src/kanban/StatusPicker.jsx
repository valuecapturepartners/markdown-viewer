const LABELS = { backlog: "Backlog", active: "Active", done: "Done" };
const ALL = ["backlog", "active", "done"];

export default function StatusPicker({ status, open, onToggle, onMove }) {
  return (
    <>
      <button
        className={`status-pill status-pill--${status}`}
        onClick={onToggle}
      >
        {LABELS[status]}
      </button>
      {open && (
        <div
          className="status-picker"
          onClick={(e) => e.stopPropagation()}
        >
          {ALL.map((s) => (
            <button
              key={s}
              className={`status-picker-opt status-pill--${s}${s === status ? " current" : ""}`}
              onClick={(e) => { e.stopPropagation(); onMove(s); }}
            >
              {LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
