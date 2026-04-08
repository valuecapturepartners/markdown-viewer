export default function FilterBar({ filters, owners, boards, onFilterChange }) {
  const dueRanges = [
    { key: "overdue", label: "Overdue" },
    { key: "this-week", label: "This week" },
    { key: "later", label: "Later" },
    { key: "no-date", label: "No date" },
  ];

  return (
    <div className="kanban-filters">
      <div className="kanban-filter-group">
        <span className="filter-label">Owner</span>
        <button
          className={`kanban-chip${!filters.owner ? " active" : ""}`}
          onClick={() => onFilterChange("owner", null)}
        >
          All
        </button>
        {owners.map((o) => (
          <button
            key={o}
            className={`kanban-chip${filters.owner === o ? " active" : ""}`}
            onClick={() =>
              onFilterChange("owner", filters.owner === o ? null : o)
            }
          >
            {o}
          </button>
        ))}
      </div>

      {boards.length > 1 && (
        <div className="kanban-filter-group">
          <span className="filter-label">Board</span>
          <button
            className={`kanban-chip${!filters.board ? " active" : ""}`}
            onClick={() => onFilterChange("board", null)}
          >
            All
          </button>
          {boards.map((b) => (
            <button
              key={b.fileId}
              className={`kanban-chip${filters.board === b.fileId ? " active" : ""}`}
              onClick={() =>
                onFilterChange(
                  "board",
                  filters.board === b.fileId ? null : b.fileId,
                )
              }
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      <div className="kanban-filter-group">
        <span className="filter-label">Due</span>
        <button
          className={`kanban-chip${!filters.dueRange ? " active" : ""}`}
          onClick={() => onFilterChange("dueRange", null)}
        >
          All
        </button>
        {dueRanges.map((d) => (
          <button
            key={d.key}
            className={`kanban-chip${filters.dueRange === d.key ? " active" : ""}`}
            onClick={() =>
              onFilterChange(
                "dueRange",
                filters.dueRange === d.key ? null : d.key,
              )
            }
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
