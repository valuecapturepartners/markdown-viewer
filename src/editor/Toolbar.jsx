export default function Toolbar({ editorRef, onComment, viewMode, onViewModeChange, isMobile, isTracking, onTrackingChange }) {
  const wrap = (before, after) => editorRef?.current?.wrapSelection(before, after)

  return (
    <div className="toolbar">
      {!isMobile && (
        <>
          <button className="toolbar-btn" onClick={() => wrap('**', '**')} title="Bold (Ctrl+B)">
            <b>B</b>
          </button>
          <button className="toolbar-btn" onClick={() => wrap('_', '_')} title="Italic">
            <i>I</i>
          </button>
          <button className="toolbar-btn" onClick={() => wrap('`', '`')} title="Inline code">
            {'</>'}
          </button>
          <span className="toolbar-divider" />
        </>
      )}

      <button className="toolbar-btn comment-btn" onClick={onComment} title="Add comment">
        Comment
      </button>
      <button
        className={`toolbar-btn ${isTracking ? 'active tracking-active' : ''}`}
        onClick={() => onTrackingChange?.(!isTracking)}
        title={isTracking ? 'Tracking changes (click to disable)' : 'Track changes'}
      >
        Track
      </button>

      {!isMobile && (
        <>
          <span className="toolbar-divider" />
          <button
            className={`toolbar-btn source-toggle ${viewMode !== 'preview' ? 'active' : ''}`}
            onClick={() => onViewModeChange(viewMode === 'preview' ? 'split' : 'preview')}
            title="Toggle source view"
          >
            Source
          </button>
        </>
      )}
    </div>
  )
}
