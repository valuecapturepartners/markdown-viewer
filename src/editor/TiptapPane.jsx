import { useEffect, useImperativeHandle, useRef, forwardRef, useState, useCallback } from 'react'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { marked } from 'marked'
import { criticMarkupPlugin } from '../criticmarkup/marked-plugin.js'
import {
  CriticInsertion,
  CriticDeletion,
  CriticHighlight,
  CriticSubstitution,
  CriticComment,
} from '../criticmarkup/tiptap-extensions.js'
import { serializeToMarkdown } from './tiptap-serializer.js'
import { applyTrackChanges } from '../criticmarkup/track-changes.js'

marked.use(criticMarkupPlugin())

// Convert markdown → HTML for Tiptap input
function markdownToHtml(md) {
  try { return marked.parse(md) } catch { return `<p>${md}</p>` }
}

const CRITIC_EXTENSIONS = [
  CriticInsertion,
  CriticDeletion,
  CriticHighlight,
  CriticSubstitution,
  CriticComment,
]

// ── Component ─────────────────────────────────────────────────────────────────

const TiptapPane = forwardRef(function TiptapPane(
  { content, onChange, onCommentRequest, tracking = false, author = '' },
  ref,
) {
  const lastMd   = useRef(content)    // tracks last markdown we set/got
  const baselineMd = useRef(content)  // snapshot at focus for track-changes
  const [tapComment, setTapComment] = useState(null)

  const editor = useEditor({
    extensions: [StarterKit, ...CRITIC_EXTENSIONS],
    content: markdownToHtml(content),
    editable: !!onChange,
    onUpdate({ editor }) {
      const md = serializeToMarkdown(editor.getJSON())
      lastMd.current = md
      onChange?.(md)
    },
    onFocus() {
      baselineMd.current = lastMd.current
    },
  })

  // Sync external content changes (e.g. file open, CodeMirror edits in split)
  useEffect(() => {
    if (!editor || editor.isFocused) return
    if (content === lastMd.current) return
    lastMd.current = content
    baselineMd.current = content
    editor.commands.setContent(markdownToHtml(content), false)
  }, [content, editor])

  // Update editable when onChange presence changes
  useEffect(() => {
    editor?.setEditable(!!onChange, false)
  }, [editor, onChange])

  // Track-changes: on blur, diff baseline → current and reload if changed
  useEffect(() => {
    if (!editor || !tracking || !onChange) return
    // Reset baseline to current content when tracking is turned on, so only
    // edits made *after* enabling track changes are captured.
    baselineMd.current = lastMd.current
    const handleBlur = () => {
      const current = lastMd.current
      const tracked = applyTrackChanges(baselineMd.current, current, author)
      if (tracked !== current) {
        lastMd.current = tracked
        onChange(tracked)
        editor.commands.setContent(markdownToHtml(tracked), false)
      }
      baselineMd.current = tracked
    }
    editor.on('blur', handleBlur)
    return () => editor.off('blur', handleBlur)
  }, [editor, tracking, onChange])

  // Tap/click on critic-comment nodes → show popover
  useEffect(() => {
    const el = editor?.view?.dom
    if (!el) return
    const handler = (e) => {
      const comment = e.target.closest('.critic-comment')
      if (comment) {
        e.preventDefault()
        const rect = comment.getBoundingClientRect()
        setTapComment({
          author: comment.dataset.author || '',
          date:   comment.dataset.date   || '',
          text:   (comment.getAttribute('title') || '').replace(/^.*?\):\s*/, ''),
          x: Math.min(rect.left, window.innerWidth - 288),
          y: rect.bottom + 6,
        })
      } else if (!e.target.closest('.ctp-close')) {
        setTapComment(null)
      }
    }
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [editor])

  // Expose methods to Editor parent via ref
  useImperativeHandle(ref, () => ({
    // Force content update regardless of focus state (used by accept/reject all)
    forceContent: (md) => {
      if (!editor) return
      lastMd.current = md
      baselineMd.current = md
      editor.commands.setContent(markdownToHtml(md), false)
    },
    // Insert CriticMarkup comment (called after dialog submit)
    insertComment: ({ author, date, text, selectedText }) => {
      if (!editor) return
      const h = author.startsWith('@') ? author : `@${author}`
      // If selected text exists, apply highlight mark first
      if (selectedText) {
        const { from, to } = editor.state.selection
        if (from !== to) {
          editor.chain().focus()
            .setMark('criticHighlight')
            .insertContentAt(to, {
              type: 'criticComment',
              attrs: { author: h, date, text },
            })
            .run()
          return
        }
      }
      editor.chain().focus().insertContent({
        type: 'criticComment',
        attrs: { author: h, date, text },
      }).run()
    },
    // Get selected text
    getSelection: () => {
      if (!editor) return ''
      const { from, to } = editor.state.selection
      return editor.state.doc.textBetween(from, to, ' ')
    },
  }), [editor])

  const isEditable = !!onChange

  // ── Bubble menu button handler ─────────────────────────────────────────────
  const handleComment = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, ' ')
    onCommentRequest?.(text)
  }, [editor, onCommentRequest])

  const isActive = (name) => editor?.isActive(name)

  return (
    <div className={`tiptap-wrap${tracking ? '' : ' no-track'}`}>
      {editor && isEditable && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 150, placement: 'top', maxWidth: 'none' }}
          className="tiptap-bubble"
        >
          <button
            className={`tb-btn tb-comment`}
            onMouseDown={e => { e.preventDefault(); handleComment() }}
            title="Add comment"
          >💬</button>
          <span className="tb-sep" />
          <button
            className={`tb-btn tb-highlight ${isActive('criticHighlight') ? 'on' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleMark('criticHighlight').run() }}
            title="Highlight"
          >H</button>
          <button
            className={`tb-btn tb-insert ${isActive('criticInsertion') ? 'on' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleMark('criticInsertion').run() }}
            title="Mark as insertion"
          >+</button>
          <button
            className={`tb-btn tb-delete ${isActive('criticDeletion') ? 'on' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleMark('criticDeletion').run() }}
            title="Mark as deletion"
          >−</button>
          <span className="tb-sep" />
          <button
            className={`tb-btn ${isActive('bold') ? 'on' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
            title="Bold"
          ><b>B</b></button>
          <button
            className={`tb-btn ${isActive('italic') ? 'on' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
            title="Italic"
          ><i>I</i></button>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} className="tiptap-content" />

      {tapComment && (
        <div
          className="comment-tap-popover"
          style={{ position: 'fixed', left: tapComment.x, top: tapComment.y }}
        >
          <div className="ctp-header">
            <strong>{tapComment.author}</strong>
            <time>{tapComment.date}</time>
            <button className="ctp-close" onClick={() => setTapComment(null)}>✕</button>
          </div>
          <p className="ctp-text">{tapComment.text}</p>
        </div>
      )}
    </div>
  )
})

export default TiptapPane
