import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/auth-context.jsx'
import { buildCommentInsertion } from '../criticmarkup/syntax.js'

export default function CommentDialog({ selectedText, onInsert, onClose, mode = 'inline' }) {
  const { userInfo } = useAuth()
  const defaultHandle = userInfo?.name?.split(' ')[0]?.toLowerCase() || ''
  const [handle, setHandle] = useState(defaultHandle)
  const [text, setText] = useState('')
  const [commentMode, setCommentMode] = useState(selectedText ? 'inline' : mode)
  const textRef = useRef(null)

  useEffect(() => {
    textRef.current?.focus()
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!handle.trim() || !text.trim()) return
    if (commentMode === 'discussion') {
      // Document-level comment — signal to parent to append to ## Discussion
      const markup = buildCommentInsertion(handle.trim(), text.trim(), '')
      onInsert(markup, handle.trim(), text.trim(), { discussion: true })
    } else {
      const markup = buildCommentInsertion(handle.trim(), text.trim(), selectedText || '')
      onInsert(markup, handle.trim(), text.trim(), { discussion: false })
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e)
  }

  return (
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" onKeyDown={handleKeyDown}>
        <div className="dialog-header">
          <h2>Add Comment</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Mode toggle */}
        <div className="comment-mode-toggle">
          <button
            className={`comment-mode-btn ${commentMode === 'inline' ? 'active' : ''}`}
            onClick={() => setCommentMode('inline')}
            type="button"
          >
            Inline
          </button>
          <button
            className={`comment-mode-btn ${commentMode === 'discussion' ? 'active' : ''}`}
            onClick={() => setCommentMode('discussion')}
            type="button"
          >
            Discussion
          </button>
        </div>

        {commentMode === 'inline' && selectedText && (
          <div className="dialog-selection-preview">
            <span className="label">Commenting on:</span>
            <blockquote>{selectedText.slice(0, 120)}{selectedText.length > 120 ? '…' : ''}</blockquote>
          </div>
        )}

        {commentMode === 'discussion' && (
          <div className="dialog-selection-preview">
            <span className="label">Document-level comment</span>
            <blockquote>Will be added to the Discussion section at the end of the document.</blockquote>
          </div>
        )}

        <form onSubmit={handleSubmit} className="dialog-form">
          <label>
            Your handle
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. alice"
              required
            />
          </label>
          <label>
            Comment
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={commentMode === 'discussion' ? 'Write a document-level comment…' : 'Write your comment…'}
              rows={4}
              required
            />
          </label>
          <div className="dialog-preview-label">Will insert:</div>
          <code className="dialog-preview">
            {handle && text
              ? buildCommentInsertion(handle, text, commentMode === 'inline' ? (selectedText || '') : '')
              : '…'}
          </code>
          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">
              {commentMode === 'discussion' ? 'Add to Discussion (Ctrl+Enter)' : 'Insert (Ctrl+Enter)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
