import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/auth-context.jsx'
import { listFolderContents, listSharedDrives } from './drive-api.js'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ── Single tree node (folder or file) ────────────────────────────────────────

function TreeNode({ entry, depth, currentFileId, accessToken, onFilePicked, onNewFile, onFolderChange, refreshTarget }) {
  const isFolder = entry.mimeType === FOLDER_MIME || entry._isFolder
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState(null) // null = not loaded yet
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)

  const loadChildren = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const items = await listFolderContents(accessToken, entry.id)
      setChildren(items)
    } catch (e) {
      setErr('Failed to load')
    } finally {
      setLoading(false)
    }
  }, [accessToken, entry.id])

  // Reload this folder's children when a file was just created inside it
  useEffect(() => {
    if (refreshTarget?.id === entry.id && refreshTarget?.key && open) {
      loadChildren()
    }
  }, [refreshTarget?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async () => {
    if (open) { setOpen(false); return }
    onFolderChange?.({ id: entry.id, name: entry.name })
    if (children === null) {
      await loadChildren()
    }
    setOpen(true)
  }

  const indent = depth * 14 // px per level

  if (!isFolder) {
    const isActive = entry.id === currentFileId
    return (
      <button
        className={`tree-file${isActive ? ' active' : ''}`}
        style={{ paddingLeft: 16 + indent }}
        onClick={() => onFilePicked({ id: entry.id, name: entry.name })}
        title={entry.name}
      >
        <span className="tree-file-name">{entry.name.replace(/\.md$/i, '')}</span>
        <span className="tree-file-date">{formatDate(entry.modifiedTime)}</span>
      </button>
    )
  }

  const folders = children?.filter(c => c.mimeType === FOLDER_MIME) ?? []
  const files   = children?.filter(c => c.mimeType !== FOLDER_MIME) ?? []

  return (
    <div className="tree-folder-wrap">
      <button className="tree-folder" style={{ paddingLeft: 10 + indent }} onClick={toggle}>
        <span className="tree-arrow">{loading ? '·' : open ? '▾' : '▸'}</span>
        <span className="tree-folder-name">{entry.name}</span>
        {open && (
          <span
            className="tree-new"
            role="button"
            tabIndex={0}
            title="New file here"
            onClick={(e) => { e.stopPropagation(); onNewFile?.({ id: entry.id, name: entry.name }) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onNewFile?.({ id: entry.id, name: entry.name }) } }}
          >
            +
          </span>
        )}
      </button>

      {err && (
        <div className="tree-status tree-err" style={{ paddingLeft: 18 + indent }}>{err}</div>
      )}

      {open && children !== null && (
        <div className="tree-children">
          {folders.map(c => (
            <TreeNode key={c.id} entry={{ ...c, _isFolder: true }} depth={depth + 1}
              currentFileId={currentFileId} accessToken={accessToken}
              onFilePicked={onFilePicked} onNewFile={onNewFile}
              onFolderChange={onFolderChange} refreshTarget={refreshTarget} />
          ))}
          {files.map(c => (
            <TreeNode key={c.id} entry={c} depth={depth + 1}
              currentFileId={currentFileId} accessToken={accessToken}
              onFilePicked={onFilePicked} onNewFile={onNewFile}
              onFolderChange={onFolderChange} refreshTarget={refreshTarget} />
          ))}
          {folders.length === 0 && files.length === 0 && (
            <div className="tree-status" style={{ paddingLeft: 18 + (depth + 1) * 14 }}>empty</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Folder browser shell ──────────────────────────────────────────────────────

export default function FolderBrowser({ currentFileId, onFilePicked, onNewFileInFolder, onFolderChange, isMobile, onClose, width, onResizeStart, refreshTarget }) {
  const { accessToken } = useAuth()
  const [roots, setRoots] = useState(null)   // null = loading
  const [err, setErr]     = useState(null)

  const loadRoots = useCallback(async () => {
    setErr(null)
    setRoots(null)
    try {
      const drives = await listSharedDrives(accessToken)
      const entries = [
        { id: 'root', name: 'My Drive', _isFolder: true, mimeType: FOLDER_MIME },
        ...drives.map(d => ({ id: d.id, name: d.name, _isFolder: true, mimeType: FOLDER_MIME })),
      ]
      setRoots(entries)
    } catch (e) {
      setErr(e.message)
    }
  }, [accessToken])

  useEffect(() => { loadRoots() }, [loadRoots])

  const handleFilePicked = (file) => {
    onFilePicked(file)
    if (isMobile) onClose?.()
  }

  const style = !isMobile && width ? { width } : undefined

  return (
    <aside className={`folder-browser${isMobile ? ' mobile-drawer' : ''}`} style={style}>
      <div className="fb-tree-header">
        <span className="fb-tree-title">Files</span>
        <button className="fb-icon-btn" onClick={loadRoots} title="Refresh">↻</button>
        {isMobile && (
          <button className="fb-icon-btn fb-close-btn" onClick={onClose} title="Close">✕</button>
        )}
      </div>

      <div className="fb-tree-scroll">
        {err && <div className="tree-status tree-err" style={{ padding: '10px 12px' }}>{err}</div>}
        {roots === null && !err && <div className="tree-status" style={{ padding: '10px 12px' }}>Loading…</div>}
        {roots?.map(entry => (
          <TreeNode
            key={entry.id}
            entry={entry}
            depth={0}
            currentFileId={currentFileId}
            accessToken={accessToken}
            onFilePicked={handleFilePicked}
            onNewFile={onNewFileInFolder}
            onFolderChange={onFolderChange}
            refreshTarget={refreshTarget}
          />
        ))}
      </div>

      {/* Desktop resize handle */}
      {!isMobile && (
        <div
          className="fb-resize-handle"
          onMouseDown={onResizeStart}
          title="Drag to resize"
        />
      )}
    </aside>
  )
}
