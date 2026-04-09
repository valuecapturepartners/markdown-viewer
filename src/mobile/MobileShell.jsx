import { useEffect, useState } from 'react'
import Editor from '../editor/Editor.jsx'
import KanbanScreen from '../kanban/KanbanScreen.jsx'
import CaptureScreen from '../capture/CaptureScreen.jsx'
import NewFileDialog from '../editor/NewFileDialog.jsx'
import FolderView from './FolderView.jsx'
import { useAuth } from '../auth/auth-context.jsx'
import { getFileMetadata } from '../drive/drive-api.js'

// fileStack entries: { type: 'root' } | { type: 'folder', id, name } | { type: 'file', id, name }
const ROOT = { type: 'root' }

export default function MobileShell() {
  const { accessToken } = useAuth()
  const [activeTab, setActiveTab]     = useState('files')
  const [fileStack, setFileStack]     = useState([ROOT])
  const [captureOpen, setCaptureOpen] = useState(false)
  const [fileToOpen, setFileToOpen]   = useState(null)
  const [newFileFolder, setNewFileFolder] = useState(undefined) // undefined = closed

  const top = fileStack[fileStack.length - 1]
  const isViewingFile = top.type === 'file'
  const currentFolder = top.type === 'folder' ? { id: top.id, name: top.name } : null

  const pushFolder = (folder) =>
    setFileStack(s => [...s, { type: 'folder', ...folder }])

  const pushFile = (file) => {
    setFileStack(s => [...s, { type: 'file', ...file }])
    setFileToOpen(file)
    history.replaceState(null, '', '?file=' + file.id)
  }

  const pop = () => {
    setFileStack(s => {
      const next = s.length > 1 ? s.slice(0, -1) : s
      if (next[next.length - 1].type !== 'file') {
        history.replaceState(null, '', location.pathname)
      }
      return next
    })
  }

  // Open file from ?file=<id> deep-link
  useEffect(() => {
    const fileId = new URLSearchParams(location.search).get('file')
    if (!fileId || !accessToken) return
    getFileMetadata(accessToken, fileId)
      .then(meta => pushFile({ id: meta.id, name: meta.name }))
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileCreatedFromDialog = (file) => {
    setNewFileFolder(undefined)
    pushFile(file)
  }

  return (
    <div className="mobile-shell">

      {/* ── Files tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'files' && !isViewingFile && (
        <FolderView
          folder={top.type === 'root' ? null : { id: top.id, name: top.name }}
          title={top.type === 'root' ? 'Files' : top.name}
          onBack={fileStack.length > 1 ? pop : undefined}
          onFolderPush={pushFolder}
          onFilePick={pushFile}
          onNewFile={() => setNewFileFolder(currentFolder)}
        />
      )}

      {/* ── Editor (always mounted when a file is open, hidden otherwise) ── */}
      <div
        className="mobile-editor-layer"
        style={{ display: activeTab === 'files' && isViewingFile ? 'flex' : 'none' }}
      >
        <Editor
          hideSidebar
          onBack={pop}
          fileToOpen={fileToOpen}
        />
      </div>

      {/* ── Board tab ─────────────────────────────────────────────────────── */}
      <div
        className="mobile-editor-layer"
        style={{ display: activeTab === 'board' ? 'flex' : 'none' }}
      >
        <KanbanScreen inMobileShell />
      </div>

      {/* ── Bottom tab bar ────────────────────────────────────────────────── */}
      <nav className="mobile-tab-bar">
        <button
          className={`mobile-tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <span className="mobile-tab-icon">⬜</span>
          <span className="mobile-tab-label">Files</span>
        </button>
        <button
          className={`mobile-tab ${activeTab === 'board' ? 'active' : ''}`}
          onClick={() => setActiveTab('board')}
        >
          <span className="mobile-tab-icon">▦</span>
          <span className="mobile-tab-label">Board</span>
        </button>
      </nav>

      {/* ── FAB (capture) ─────────────────────────────────────────────────── */}
      {!isViewingFile && (
        <button
          className="mobile-fab"
          onClick={() => setCaptureOpen(true)}
          title="Capture — dictate or paste, Gemini cleans it up"
        >
          ✨
        </button>
      )}

      {/* ── Capture bottom sheet ──────────────────────────────────────────── */}
      {captureOpen && (
        <div
          className="capture-sheet-overlay"
          onClick={e => e.target === e.currentTarget && setCaptureOpen(false)}
        >
          <div className="capture-sheet">
            <div className="capture-sheet-handle" />
            <CaptureScreen asSheet onClose={() => setCaptureOpen(false)} />
          </div>
        </div>
      )}

      {/* ── New file dialog (triggered from FolderView) ───────────────────── */}
      {newFileFolder !== undefined && (
        <NewFileDialog
          currentFolder={newFileFolder}
          onCreated={handleFileCreatedFromDialog}
          onClose={() => setNewFileFolder(undefined)}
        />
      )}
    </div>
  )
}
