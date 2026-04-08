import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/auth-context.jsx'
import { processCapture } from '../capture/gemini-api.js'
import { findVCPFolders, listClients, saveToFolder, createFile } from '../drive/drive-api.js'

// brain is intentionally excluded — it's harvested from portco knowledge, never captured directly
const STATIC_CONTEXTS = [
  { id: 'ops', label: 'Ops' },
  { id: 'other', label: 'Other' },
]

function buildInboxFilename(context, source) {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 5).replace(':', '-')
  return `${date}-${time}-${context}-${source}.md`
}

function buildFrontmatter(fields) {
  const lines = ['---']
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== '') {
      const safe = typeof v === 'string' && /[:#\[\]{}]/.test(v) ? `"${v}"` : v
      lines.push(`${k}: ${safe}`)
    }
  }
  lines.push('---', '')
  return lines.join('\n')
}

function deriveAuthor(userInfo) {
  return (userInfo?.given_name || userInfo?.name || 'unknown').split(' ')[0].toLowerCase()
}

// ── Dump mode ────────────────────────────────────────────────────────────────

function DumpMode({ onClose }) {
  const { accessToken, userInfo } = useAuth()
  const [text, setText] = useState('')
  const [status, setStatus] = useState('idle') // idle | processing | saving | done | error
  const [statusMsg, setStatusMsg] = useState('')
  const [contexts, setContexts] = useState(STATIC_CONTEXTS)
  const textRef = useRef(null)

  // Load client names for Gemini context suggestions
  useEffect(() => {
    findVCPFolders(accessToken)
      .then(({ clientsId }) => clientsId ? listClients(accessToken, clientsId) : [])
      .then(clients => {
        if (clients.length > 0) {
          const clientCtx = clients.map(c => ({ id: c.name, label: formatSlug(c.name) }))
          setContexts([...clientCtx, ...STATIC_CONTEXTS])
        }
      })
      .catch(() => {}) // non-fatal — falls back to static contexts
  }, [accessToken])

  const run = useCallback(async (useGemini) => {
    if (!text.trim()) return
    setStatus('processing')
    setStatusMsg(useGemini ? 'Processing with Gemini…' : 'Saving…')

    try {
      setStatusMsg('Finding /vcp/inbox/…')
      const { inboxId } = await findVCPFolders(accessToken)

      let finalContent = text
      let context = 'other'
      let type = 'note'
      let taskTitle = ''

      if (useGemini) {
        setStatusMsg('Processing with Gemini…')
        const result = await processCapture(accessToken, text, contexts)
        finalContent = result.cleaned_content
        context = result.suggested_context || 'other'
        type = result.suggested_type || 'note'
        taskTitle = result.task_title || ''
      }

      setStatus('saving')
      setStatusMsg('Saving to inbox…')

      const source = useGemini ? 'dictation' : 'paste'
      const frontmatter = buildFrontmatter({
        context,
        type,
        ...(type === 'content+task' && taskTitle ? { task_title: taskTitle } : {}),
        author: deriveAuthor(userInfo),
        captured: new Date().toISOString(),
        source,
      })

      const filename = buildInboxFilename(context, source)
      await saveToFolder(accessToken, inboxId, filename, frontmatter + finalContent)

      setStatus('done')
      setStatusMsg(`Saved to inbox: ${filename}`)
      setTimeout(onClose, 1800)
    } catch (err) {
      setStatus('error')
      setStatusMsg(err.message)
    }
  }, [accessToken, userInfo, text, contexts, onClose])

  const busy = status === 'processing' || status === 'saving'

  return (
    <div className="nfd-mode">
      <p className="nfd-hint">
        Paste or type anything — raw notes, voice dictation, chat exports.
        Gemini will clean it up and route it to <code>/vcp/inbox/</code> automatically.
      </p>
      <textarea
        ref={textRef}
        className="nfd-textarea"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste or type content here…"
        autoFocus
        disabled={busy || status === 'done'}
      />
      {statusMsg && (
        <p className={`nfd-status ${status === 'error' ? 'error' : status === 'done' ? 'done' : ''}`}>
          {statusMsg}
        </p>
      )}
      <div className="nfd-dump-actions">
        <button
          className="nfd-btn-gemini"
          onClick={() => run(true)}
          disabled={busy || !text.trim() || status === 'done'}
        >
          ✨ Process with Gemini &amp; Save to Inbox
        </button>
        <button
          className="nfd-btn-raw"
          onClick={() => run(false)}
          disabled={busy || !text.trim() || status === 'done'}
        >
          Save Raw to Inbox
        </button>
      </div>
    </div>
  )
}

// ── Dedicated mode ────────────────────────────────────────────────────────────

function DedicatedMode({ currentFolder, onCreated, onClose }) {
  const { accessToken } = useAuth()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return
    const filename = name.trim().endsWith('.md') ? name.trim() : name.trim() + '.md'
    setSaving(true)
    setError('')
    try {
      const file = await createFile(accessToken, filename, '', currentFolder?.id || null)
      onCreated({ id: file.id, name: file.name })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }, [accessToken, name, currentFolder, onCreated, onClose])

  return (
    <div className="nfd-mode">
      <div className="nfd-location">
        <span className="nfd-location-label">Location</span>
        <span className="nfd-location-path">
          {currentFolder ? currentFolder.name : 'My Drive (root)'}
        </span>
        <span className="nfd-location-hint">
          Navigate in the sidebar first to change location
        </span>
      </div>
      <label className="nfd-label">
        File name
        <input
          className="nfd-input"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="my-notes.md"
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter') handleCreate()
            if (e.key === 'Escape') onClose()
          }}
        />
      </label>
      {error && <p className="nfd-status error">{error}</p>}
      <div className="nfd-dedicated-actions">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button
          className="btn-primary"
          onClick={handleCreate}
          disabled={saving || !name.trim()}
        >
          {saving ? 'Creating…' : 'Create'}
        </button>
      </div>
    </div>
  )
}

function formatSlug(slug) {
  return slug.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export default function NewFileDialog({ currentFolder, onCreated, onClose }) {
  const [mode, setMode] = useState('dedicated') // 'dump' | 'dedicated'

  return (
    <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dialog nfd-dialog">
        <div className="dialog-header">
          <h2>New</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Mode tabs */}
        <div className="nfd-tabs">
          <button
            className={`nfd-tab ${mode === 'dump' ? 'active' : ''}`}
            onClick={() => setMode('dump')}
          >
            Dump
          </button>
          <button
            className={`nfd-tab ${mode === 'dedicated' ? 'active' : ''}`}
            onClick={() => setMode('dedicated')}
          >
            Dedicated
          </button>
        </div>

        {mode === 'dump' ? (
          <DumpMode onClose={onClose} />
        ) : (
          <DedicatedMode
            currentFolder={currentFolder}
            onCreated={onCreated}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
