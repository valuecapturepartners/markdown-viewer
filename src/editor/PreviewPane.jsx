import { useEffect, useRef, useState, useCallback } from 'react'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { criticMarkupPlugin } from '../criticmarkup/marked-plugin.js'

marked.use(criticMarkupPlugin())

const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' })
td.addRule('criticmarkup', {
  filter: node => node.dataset?.critic,
  replacement: (content, node) => decodeURIComponent(node.dataset.critic),
})

const BAR_WIDTH = 260

export default function PreviewPane({ content, onChange, onCommentRequest }) {
  const ref = useRef(null)
  const isFocused = useRef(false)
  const [floatingBar, setFloatingBar] = useState(null) // { rect, text }
  const [tapComment, setTapComment] = useState(null)   // { author, date, text, x, y }

  // Render markdown → HTML (only when content changes externally)
  useEffect(() => {
    if (!ref.current || isFocused.current) return
    try {
      ref.current.innerHTML = marked.parse(content)
    } catch (e) {
      ref.current.innerHTML = `<pre class="parse-error">${e.message}</pre>`
    }
  }, [content])

  // Tap-to-open comment bubbles (works on both touch and click)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handleClick = (e) => {
      const comment = e.target.closest('.critic-comment')
      if (comment) {
        e.preventDefault()
        e.stopPropagation()
        const rect = comment.getBoundingClientRect()
        setTapComment({
          author: comment.dataset.author || '',
          date: comment.dataset.date || '',
          text: comment.title || '',
          x: Math.min(rect.left, window.innerWidth - 280 - 8),
          y: rect.bottom + 6,
        })
      } else {
        setTapComment(null)
      }
    }
    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [])

  // Track text selection → show floating toolbar
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !ref.current?.contains(sel.anchorNode)) {
        setFloatingBar(null)
        return
      }
      const text = sel.toString().trim()
      if (!text) { setFloatingBar(null); return }
      try {
        const rect = sel.getRangeAt(0).getBoundingClientRect()
        setFloatingBar({ rect, text })
      } catch {
        setFloatingBar(null)
      }
    }
    const handleScroll = () => setFloatingBar(null)
    document.addEventListener('selectionchange', handleSelectionChange)
    ref.current?.addEventListener('scroll', handleScroll)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      ref.current?.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Apply CriticMarkup/markdown formatting to the source
  const applyMarkup = useCallback((before, after) => {
    if (!floatingBar?.text || !onChange) return
    const { text } = floatingBar
    if (!content.includes(text)) return
    onChange(content.replace(text, `${before}${text}${after}`))
    setFloatingBar(null)
    window.getSelection()?.removeAllRanges()
  }, [floatingBar, content, onChange])

  const handleBlur = () => {
    isFocused.current = false
    if (!onChange || !ref.current) return
    onChange(td.turndown(ref.current.innerHTML))
  }

  // Position floating bar above selection, clamped to viewport
  let barStyle = null
  if (floatingBar) {
    const { rect } = floatingBar
    const x = Math.max(8, Math.min(rect.left + rect.width / 2 - BAR_WIDTH / 2, window.innerWidth - BAR_WIDTH - 8))
    const y = rect.top - 44 - 8
    barStyle = { left: x, top: Math.max(8, y) }
  }

  return (
    <>
      <div
        ref={ref}
        className="preview-content"
        contentEditable={!!onChange}
        suppressContentEditableWarning
        onFocus={() => { isFocused.current = true }}
        onBlur={handleBlur}
      />

      {floatingBar && onChange && barStyle && (
        <div className="preview-floating-bar" style={barStyle}>
          <button
            className="pfb-btn pfb-comment"
            onMouseDown={(e) => {
              e.preventDefault()
              onCommentRequest?.(floatingBar.text)
              setFloatingBar(null)
              window.getSelection()?.removeAllRanges()
            }}
            title="Add comment"
          >
            💬
          </button>
          <span className="pfb-sep" />
          <button
            className="pfb-btn pfb-highlight"
            onMouseDown={(e) => { e.preventDefault(); applyMarkup('{== ', ' ==}') }}
            title="Highlight"
          >
            H
          </button>
          <button
            className="pfb-btn pfb-insert"
            onMouseDown={(e) => { e.preventDefault(); applyMarkup('{++ ', ' ++}') }}
            title="Mark as insertion"
          >
            +
          </button>
          <button
            className="pfb-btn pfb-delete"
            onMouseDown={(e) => { e.preventDefault(); applyMarkup('{-- ', ' --}') }}
            title="Mark as deletion"
          >
            −
          </button>
          <span className="pfb-sep" />
          <button
            className="pfb-btn"
            onMouseDown={(e) => { e.preventDefault(); applyMarkup('**', '**') }}
            title="Bold"
          >
            <b>B</b>
          </button>
          <button
            className="pfb-btn"
            onMouseDown={(e) => { e.preventDefault(); applyMarkup('_', '_') }}
            title="Italic"
          >
            <i>I</i>
          </button>
        </div>
      )}

      {tapComment && (
        <div
          className="comment-tap-popover"
          style={{ left: tapComment.x, top: tapComment.y }}
        >
          <div className="ctp-header">
            <strong>{tapComment.author}</strong>
            <time>{tapComment.date}</time>
            <button className="ctp-close" onClick={() => setTapComment(null)}>✕</button>
          </div>
          <p className="ctp-text">{tapComment.text}</p>
        </div>
      )}
    </>
  )
}
