import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
} from '@codemirror/view'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { criticMarkupExtension } from '../criticmarkup/cm-extension.js'

const themeCompartment = new Compartment()

const CodeMirrorPane = forwardRef(function CodeMirrorPane({ content, onChange, darkMode = false }, ref) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const editorChangedRef = useRef(false)

  useImperativeHandle(ref, () => ({
    // Insert text at current cursor position
    insertText(text) {
      const view = viewRef.current
      if (!view) return
      const { from } = view.state.selection.main
      view.dispatch({
        changes: { from, to: from, insert: text },
        selection: { anchor: from + text.length },
      })
      view.focus()
    },
    // Wrap current selection (or insert markers at cursor if no selection)
    wrapSelection(before, after) {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      const selected = view.state.sliceDoc(from, to)
      const inserted = before + selected + after
      view.dispatch({
        changes: { from, to, insert: inserted },
        selection: {
          anchor: from + before.length,
          head: from + before.length + selected.length,
        },
      })
      view.focus()
    },
    // Return selected text
    getSelection() {
      const view = viewRef.current
      if (!view) return ''
      const { from, to } = view.state.selection.main
      return view.state.sliceDoc(from, to)
    },
    focus() {
      viewRef.current?.focus()
    },
  }))

  // Create editor once on mount
  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        dropCursor(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        markdown(),
        themeCompartment.of(darkMode ? oneDark : []),
        criticMarkupExtension,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            editorChangedRef.current = true
            onChange(update.state.doc.toString())
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
            lineHeight: '1.6',
          },
          '.cm-content': { padding: '12px 8px' },
        }),
        EditorView.lineWrapping,
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => view.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap CodeMirror theme when darkMode prop changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: themeCompartment.reconfigure(darkMode ? oneDark : []) })
  }, [darkMode])

  // Sync external content changes (e.g. file load) — but skip if we just typed
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (editorChangedRef.current) {
      editorChangedRef.current = false
      return
    }
    const current = view.state.doc.toString()
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content },
      })
    }
  }, [content])

  return <div ref={containerRef} className="cm-container" />
})

export default CodeMirrorPane
