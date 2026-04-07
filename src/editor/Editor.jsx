import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/auth-context.jsx'
import CodeMirrorPane from './CodeMirrorPane.jsx'
import PreviewPane from './PreviewPane.jsx'
import Toolbar from './Toolbar.jsx'
import CommentDialog from './CommentDialog.jsx'
import NewFileDialog from './NewFileDialog.jsx'
import FolderBrowser from '../drive/FolderBrowser.jsx'
import { readFile, saveFile } from '../drive/drive-api.js'
import DiagnosticsPanel from '../debug/DiagnosticsPanel.jsx'

const WELCOME = `# Welcome to VCP Markdown Editor

Open a file from Google Drive to get started, or start typing here.

## CriticMarkup examples

- Insertion: {++ new text ++}
- Deletion: {-- removed text --}
- Highlight: {== important ==}
- Comment: {>> @alice (2026-03-17): Review this section <<}
`

const LAST_FILE_KEY = 'vcp_last_file'

export default function Editor() {
  const { accessToken, userInfo, signOut } = useAuth()
  const editorRef = useRef(null)

  const [content, setContent] = useState(WELCOME)
  const [currentFile, setCurrentFile] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(LAST_FILE_KEY)) } catch { return null }
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [isCommentOpen, setIsCommentOpen] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [viewMode, setViewMode] = useState('split')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [isNewFileOpen, setIsNewFileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentBrowseFolder, setCurrentBrowseFolder] = useState(null)
  const [showDiag, setShowDiag] = useState(false)

  // Reload last open file on mount
  useEffect(() => {
    const stored = (() => { try { return JSON.parse(sessionStorage.getItem(LAST_FILE_KEY)) } catch { return null } })()
    if (stored?.id) {
      readFile(accessToken, stored.id)
        .then(text => setContent(text))
        .catch(() => { setCurrentFile(null); sessionStorage.removeItem(LAST_FILE_KEY) })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const handleFilePicked = useCallback(
    async ({ id, name }) => {
      try {
        const text = await readFile(accessToken, id)
        setContent(text)
        setCurrentFile({ id, name })
        sessionStorage.setItem(LAST_FILE_KEY, JSON.stringify({ id, name }))
        setSaveStatus('')
      } catch (err) {
        alert(`Failed to open file: ${err.message}`)
      }
    },
    [accessToken],
  )

  const handleSave = useCallback(async () => {
    if (!currentFile) return
    setIsSaving(true)
    setSaveStatus('Saving…')
    try {
      await saveFile(accessToken, currentFile.id, content)
      setSaveStatus('Saved')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch (err) {
      setSaveStatus('Save failed')
      alert(`Failed to save: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }, [accessToken, currentFile, content])

  const handleFileCreated = useCallback(async ({ id, name }) => {
    try {
      const text = await readFile(accessToken, id)
      setContent(text)
    } catch {
      setContent('')
    }
    setCurrentFile({ id, name })
    sessionStorage.setItem(LAST_FILE_KEY, JSON.stringify({ id, name }))
    setSaveStatus('')
  }, [accessToken])

  const openCommentDialog = (selText) => {
    const sel = selText !== undefined ? selText : (editorRef.current?.getSelection() || '')
    setSelectedText(sel)
    setIsCommentOpen(true)
  }

  const handleCommentInsert = (markup) => {
    if (editorRef.current) {
      // CodeMirror is mounted: use it so cursor position is preserved
      editorRef.current.insertText(markup)
    } else {
      // Mobile preview mode: CodeMirror not rendered, patch markdown directly
      setContent(prev => {
        if (selectedText && prev.includes(selectedText)) return prev.replace(selectedText, markup)
        return prev + '\n' + markup
      })
    }
    setIsCommentOpen(false)
    setSelectedText('')
  }

  const effectiveView = isMobile && viewMode === 'split' ? 'preview' : viewMode

  return (
    <div className="editor-shell">
      {/* Header */}
      <header className="editor-header">
        <div className="header-left">
          <span className="app-title">VCP MD</span>
          <button
            className={`toolbar-btn sidebar-toggle ${sidebarOpen ? 'active' : ''}`}
            onClick={() => setSidebarOpen((v) => !v)}
            title="Toggle file browser"
          >
            ☰
          </button>
          <button
            className="toolbar-btn"
            onClick={() => setIsNewFileOpen(true)}
            title="New file"
          >
            New
          </button>
          {currentFile && (
            <span className="file-name" title={currentFile.name}>
              {currentFile.name}
            </span>
          )}
        </div>

        <div className="header-center">
          <Toolbar
            editorRef={editorRef}
            onComment={openCommentDialog}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isMobile={isMobile}
          />
        </div>

        <div className="header-right">
          {saveStatus && <span className="save-status">{saveStatus}</span>}
          {currentFile && (
            <button
              className="toolbar-btn save-btn"
              onClick={handleSave}
              disabled={isSaving}
            >
              Save
            </button>
          )}
          {userInfo?.picture && (
            <img
              src={userInfo.picture}
              alt={userInfo.name}
              className="user-avatar"
              title={userInfo.name}
            />
          )}
          <button className="toolbar-btn" onClick={() => setShowDiag(v => !v)} title="Diagnostics">
            🔧
          </button>
          <button className="toolbar-btn" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {/* Diagnostics overlay */}
      {showDiag && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#1a1a1a' }}>
          <button
            onClick={() => setShowDiag(false)}
            style={{ position: 'absolute', top: 12, right: 16, background: 'transparent', border: 'none', color: '#aaa', fontSize: 20, cursor: 'pointer' }}
          >✕</button>
          <DiagnosticsPanel />
        </div>
      )}

      {/* Editor body */}
      <div className="editor-main">
        {sidebarOpen && !isMobile && (
          <FolderBrowser
            currentFileId={currentFile?.id}
            onFilePicked={handleFilePicked}
            onNewFileInFolder={() => setIsNewFileOpen(true)}
            onFolderChange={setCurrentBrowseFolder}
          />
        )}

        <div className={`editor-body view-${effectiveView}`}>
          {(effectiveView === 'split' || effectiveView === 'editor') && (
            <div className="editor-pane">
              <CodeMirrorPane
                ref={editorRef}
                content={content}
                onChange={setContent}
              />
            </div>
          )}
          {(effectiveView === 'split' || effectiveView === 'preview') && (
            <div className="preview-pane">
              <PreviewPane
                content={content}
                onChange={effectiveView === 'split' || (isMobile && effectiveView === 'preview') ? setContent : undefined}
                onCommentRequest={openCommentDialog}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile tab bar */}
      {isMobile && (
        <nav className="mobile-tabs">
          <button
            className={`tab-btn ${effectiveView === 'editor' ? 'active' : ''}`}
            onClick={() => setViewMode('editor')}
          >
            Source
          </button>
          <button
            className="tab-btn tab-btn-comment"
            onClick={() => openCommentDialog()}
            title="Add comment"
          >
            💬
          </button>
          <button
            className={`tab-btn ${effectiveView === 'preview' ? 'active' : ''}`}
            onClick={() => setViewMode('preview')}
          >
            Review
          </button>
        </nav>
      )}

      {/* Comment dialog */}
      {isCommentOpen && (
        <CommentDialog
          selectedText={selectedText}
          onInsert={handleCommentInsert}
          onClose={() => { setIsCommentOpen(false); setSelectedText('') }}
        />
      )}

      {/* New file dialog */}
      {isNewFileOpen && (
        <NewFileDialog
          currentFolder={currentBrowseFolder}
          onCreated={handleFileCreated}
          onClose={() => setIsNewFileOpen(false)}
        />
      )}
    </div>
  )
}
