import { useEffect, useRef } from 'react'
import { marked } from 'marked'
import README from '../../README.md?raw'

export default function HelpPanel({ onClose }) {
  const ref = useRef(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Trap focus inside panel
  useEffect(() => { ref.current?.focus() }, [])

  return (
    <div className="help-overlay" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="help-panel"
        onClick={e => e.stopPropagation()}
        ref={ref}
        tabIndex={-1}
      >
        <div className="help-header">
          <span className="help-title">Help</span>
          <button className="help-close" onClick={onClose} aria-label="Close help">✕</button>
        </div>
        <div
          className="help-body preview-content"
          dangerouslySetInnerHTML={{ __html: marked.parse(README) }}
        />
      </div>
    </div>
  )
}
